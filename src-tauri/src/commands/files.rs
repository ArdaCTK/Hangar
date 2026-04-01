use crate::models::{FileNode, ProjectDetails, ProjectInfo};
use crate::commands::{git as git_cmds, scanner};
use std::path::Path;
use walkdir::WalkDir;

const SKIP_DIRS: &[&str] = &[
    ".git", "node_modules", "target", ".svelte-kit", "dist", "build",
    ".next", ".nuxt", "out", "__pycache__", ".pytest_cache", ".mypy_cache",
    "venv", ".venv", "env", "vendor", ".cargo", "Pods", "DerivedData",
];

const MAX_TREE_DEPTH: usize = 4;
const MAX_CHILDREN_PER_DIR: usize = 200;

fn build_tree_node(path: &Path, depth: usize) -> FileNode {
    let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
    let is_dir = path.is_dir();
    let ext = path.extension().map(|e| e.to_string_lossy().to_string());
    let size = if is_dir { 0 } else { std::fs::metadata(path).map(|m| m.len()).unwrap_or(0) };
    let mut children = Vec::new();

    if is_dir && depth < MAX_TREE_DEPTH {
        if let Ok(rd) = std::fs::read_dir(path) {
            let mut entries: Vec<_> = rd.flatten().collect();
            entries.sort_by(|a, b| {
                let a_d = a.path().is_dir();
                let b_d = b.path().is_dir();
                match (a_d, b_d) {
                    (true, false) => std::cmp::Ordering::Less,
                    (false, true) => std::cmp::Ordering::Greater,
                    _ => a.file_name().cmp(&b.file_name()),
                }
            });
            for entry in entries.into_iter().take(MAX_CHILDREN_PER_DIR) {
                let child_path = entry.path();
                let child_name = child_path.file_name().unwrap_or_default().to_string_lossy().to_string();
                if child_path.is_dir() && SKIP_DIRS.iter().any(|s| *s == child_name.as_str()) {
                    continue;
                }
                children.push(build_tree_node(&child_path, depth + 1));
            }
        }
    }
    FileNode { name, path: path.to_string_lossy().to_string(), is_dir, size, extension: ext, children }
}

#[tauri::command]
pub fn get_file_tree(path: String) -> Result<Vec<FileNode>, String> {
    let root = Path::new(&path);
    if !root.exists() { return Err(format!("Path not found: {}", path)); }
    let Ok(rd) = std::fs::read_dir(root) else { return Ok(vec![]); };
    let mut entries: Vec<_> = rd.flatten().collect();
    entries.sort_by(|a, b| {
        let a_d = a.path().is_dir();
        let b_d = b.path().is_dir();
        match (a_d, b_d) {
            (true, false)  => std::cmp::Ordering::Less,
            (false, true)  => std::cmp::Ordering::Greater,
            _              => a.file_name().cmp(&b.file_name()),
        }
    });
    let mut nodes = Vec::new();
    for entry in entries.into_iter().take(MAX_CHILDREN_PER_DIR) {
        let p = entry.path();
        let n = p.file_name().unwrap_or_default().to_string_lossy().to_string();
        if p.is_dir() && SKIP_DIRS.iter().any(|s| *s == n.as_str()) { continue; }
        nodes.push(build_tree_node(&p, 1));
    }
    Ok(nodes)
}

#[tauri::command]
pub fn read_project_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_project_details(path: String) -> Result<ProjectDetails, String> {
    let project_path = Path::new(&path);
    if !project_path.exists() { return Err(format!("Project path not found: {}", path)); }
    let name = project_path.file_name().unwrap_or_default().to_string_lossy().to_string();
    let info = build_project_info(project_path, &name);
    let (git_branches, git_current_branch) = if info.has_git {
        git_cmds::get_git_branches(project_path)
    } else { (vec![], None) };
    let git_log = if info.has_git { git_cmds::get_git_log(project_path, 50) } else { vec![] };
    let dependencies = git_cmds::collect_dependencies(project_path);
    let docs = git_cmds::collect_docs(project_path);
    let api_connections = git_cmds::detect_api_connections(project_path);
    Ok(ProjectDetails { info, git_branches, git_log, git_current_branch, dependencies, docs, api_connections })
}

#[tauri::command]
pub fn open_in_explorer(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    std::process::Command::new("explorer").arg(&path).spawn().map_err(|e| e.to_string())?;
    #[cfg(target_os = "macos")]
    std::process::Command::new("open").arg(&path).spawn().map_err(|e| e.to_string())?;
    #[cfg(target_os = "linux")]
    std::process::Command::new("xdg-open").arg(&path).spawn().map_err(|e| e.to_string())?;
    Ok(())
}

/// Git branch checkout
#[tauri::command]
pub fn git_checkout(path: String, branch: String) -> Result<(), String> {
    let out = std::process::Command::new("git")
        .args(["checkout", &branch])
        .current_dir(&path)
        .output()
        .map_err(|e| e.to_string())?;
    if out.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
    }
}

fn build_project_info(project_path: &Path, name: &str) -> ProjectInfo {
    use std::collections::HashMap;

    const SKIP: &[&str] = &[
        ".git", "node_modules", "target", ".svelte-kit", "dist", "build",
        ".next", ".nuxt", "__pycache__", ".mypy_cache", "venv", ".venv",
        "vendor", ".cargo", "Pods", "DerivedData",
    ];

    let mut lang_counts: HashMap<&'static str, u32> = HashMap::new();
    let mut file_count = 0u64;
    let mut total_size = 0u64;
    let mut last_modified = 0i64;

    // Pass 1: Count ALL files (matches Explorer — includes node_modules, target etc.)
    for entry in WalkDir::new(project_path).follow_links(false).into_iter().flatten() {
        if !entry.file_type().is_file() { continue; }
        file_count += 1;
        if let Ok(meta) = entry.metadata() {
            total_size += meta.len();
            if let Ok(mtime) = meta.modified() {
                if let Ok(dur) = mtime.duration_since(std::time::UNIX_EPOCH) {
                    let ts = dur.as_secs() as i64;
                    if ts > last_modified { last_modified = ts; }
                }
            }
        }
    }

    // Pass 2: Source files only for language detection (skip build artifacts)
    for entry in WalkDir::new(project_path)
        .follow_links(false)
        .into_iter()
        .filter_entry(|e| {
            if e.file_type().is_dir() {
                let n = e.file_name().to_string_lossy();
                return !SKIP.iter().any(|s| *s == n.as_ref());
            }
            true
        })
        .flatten()
    {
        if !entry.file_type().is_file() { continue; }
        if let Some(ext) = entry.path().extension() {
            let ext_str = ext.to_string_lossy().to_lowercase();
            if let Some(lang) = scanner::ext_to_lang_pub(&ext_str) {
                *lang_counts.entry(lang).or_insert(0) += 1;
            }
        }
    }

    let mut lang_vec: Vec<(&str, u32)> = lang_counts.into_iter().collect();
    lang_vec.sort_by(|a, b| b.1.cmp(&a.1));
    let languages: Vec<String> = lang_vec.iter().take(8).map(|(l, _)| l.to_string()).collect();
    let frameworks = scanner::detect_frameworks_pub(project_path);
    let project_type = scanner::infer_type_pub(project_path, &languages, &frameworks);
    let has_git = project_path.join(".git").exists();
    let remote_url = if has_git { scanner::git_remote_pub(project_path) } else { None };
    let (github_owner, github_repo) = remote_url
        .as_deref()
        .and_then(scanner::parse_github_pub)
        .map(|(o, r)| (Some(o), Some(r)))
        .unwrap_or((None, None));

    ProjectInfo {
        name: name.to_string(),
        path: project_path.to_string_lossy().to_string(),
        has_git, remote_url, github_owner, github_repo,
        languages, frameworks, project_type,
        last_modified, file_count, total_size,
    }
}
