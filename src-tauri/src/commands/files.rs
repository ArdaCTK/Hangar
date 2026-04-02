use crate::models::{FileNode, ProjectDetails, ProjectInfo};
use crate::commands::{git as git_cmds, scanner, utils::silent_command};
use std::path::Path;
use walkdir::WalkDir;

const SKIP_DIRS: &[&str] = &[
    ".git","node_modules","target",".svelte-kit","dist","build",
    ".next",".nuxt","out","__pycache__",".pytest_cache",".mypy_cache",
    "venv",".venv","env","vendor",".cargo","Pods","DerivedData",
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
                let (ad, bd) = (a.path().is_dir(), b.path().is_dir());
                match (ad, bd) {
                    (true,false) => std::cmp::Ordering::Less,
                    (false,true) => std::cmp::Ordering::Greater,
                    _ => a.file_name().cmp(&b.file_name()),
                }
            });
            for entry in entries.into_iter().take(MAX_CHILDREN_PER_DIR) {
                let p = entry.path();
                let n = p.file_name().unwrap_or_default().to_string_lossy().to_string();
                if p.is_dir() && SKIP_DIRS.iter().any(|s| *s == n.as_str()) { continue; }
                children.push(build_tree_node(&p, depth + 1));
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
        let (ad, bd) = (a.path().is_dir(), b.path().is_dir());
        match (ad, bd) {
            (true,false) => std::cmp::Ordering::Less,
            (false,true) => std::cmp::Ordering::Greater,
            _ => a.file_name().cmp(&b.file_name()),
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

/// Fast project details — skips expensive WalkDir re-scan.
/// Uses only lightweight file reads (git, deps, docs, env).
#[tauri::command]
pub fn get_project_details(path: String) -> Result<ProjectDetails, String> {
    let project_path = Path::new(&path);
    if !project_path.exists() { return Err(format!("Project path not found: {}", path)); }
    let name = project_path.file_name().unwrap_or_default().to_string_lossy().to_string();

    // Build a lightweight ProjectInfo from manifest files only (no WalkDir)
    let info = build_project_info_fast(project_path, &name);

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
    let mut cmd;
    #[cfg(target_os = "windows")]
    { cmd = silent_command("explorer"); }
    #[cfg(target_os = "macos")]
    { cmd = silent_command("open"); }
    #[cfg(target_os = "linux")]
    { cmd = silent_command("xdg-open"); }
    cmd.arg(&path).spawn().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn open_in_vscode(path: String) -> Result<(), String> {
    // Try both 'code' and 'code.cmd' (Windows)
    let result = silent_command("code").arg(&path).spawn();
    if result.is_ok() { return Ok(()); }
    // Windows fallback via cmd
    #[cfg(target_os = "windows")]
    {
        silent_command("cmd")
            .args(["/C", "code", &path])
            .spawn()
            .map_err(|e| format!("VS Code not found. Make sure 'code' is in PATH: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
pub fn git_checkout(path: String, branch: String) -> Result<(), String> {
    let mut cmd = silent_command("git");
    cmd.args(["checkout", &branch]).current_dir(&path);
    let out = cmd.output().map_err(|e| e.to_string())?;
    if out.status.success() { Ok(()) }
    else { Err(String::from_utf8_lossy(&out.stderr).trim().to_string()) }
}

/// Fast ProjectInfo — only reads manifest files, no WalkDir.
/// file_count and total_size are left as 0 (taken from scan cache in frontend).
fn build_project_info_fast(project_path: &Path, name: &str) -> ProjectInfo {
    let frameworks = scanner::detect_frameworks_pub(project_path);
    let mut languages = Vec::new();

    // Infer languages from manifest presence (fast)
    let pkg = project_path.join("package.json");
    if pkg.exists() {
        if let Ok(raw) = std::fs::read_to_string(&pkg) {
            if raw.contains("\"typescript\"") || project_path.join("tsconfig.json").exists() {
                languages.push("TypeScript");
            } else {
                languages.push("JavaScript");
            }
        }
    }
    if project_path.join("Cargo.toml").exists() { languages.push("Rust"); }
    if project_path.join("requirements.txt").exists() || project_path.join("pyproject.toml").exists() { languages.push("Python"); }
    if project_path.join("go.mod").exists() { languages.push("Go"); }

    let languages: Vec<String> = languages.iter().map(|s| s.to_string()).collect();
    let project_type = scanner::infer_type_pub(project_path, &languages, &frameworks);
    let has_git = project_path.join(".git").exists();
    let remote_url = if has_git { scanner::git_remote_pub(project_path) } else { None };
    let (github_owner, github_repo) = remote_url.as_deref()
        .and_then(scanner::parse_github_pub)
        .map(|(o, r)| (Some(o), Some(r)))
        .unwrap_or((None, None));

    // Get last_modified from .git/COMMIT_EDITMSG or HEAD (very fast)
    let last_modified = if has_git {
        project_path.join(".git").join("COMMIT_EDITMSG")
            .metadata().ok()
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0)
    } else { 0 };

    ProjectInfo {
        name: name.to_string(),
        path: project_path.to_string_lossy().to_string(),
        has_git, remote_url, github_owner, github_repo,
        languages, frameworks, project_type,
        last_modified,
        file_count: 0, // already known from scan cache
        total_size: 0,
        dep_count: git_cmds::count_dependencies_fast(project_path),
    }
}

/// Full scan info for initial project listing (used by scanner.rs)
pub fn build_full_project_info(project_path: &Path, name: &str) -> ProjectInfo {
    use std::collections::HashMap;
    const SKIP: &[&str] = &[".git","node_modules","target",".svelte-kit","dist","build",".next",".nuxt","__pycache__",".mypy_cache","venv",".venv","vendor",".cargo","Pods","DerivedData"];
    let mut lang_counts: HashMap<&'static str, u32> = HashMap::new();
    let mut file_count = 0u64;
    let mut total_size = 0u64;
    let mut last_modified = 0i64;

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

    for entry in WalkDir::new(project_path).follow_links(false).into_iter()
        .filter_entry(|e| {
            if e.file_type().is_dir() { let n = e.file_name().to_string_lossy(); return !SKIP.iter().any(|s| *s == n.as_ref()); }
            true
        }).flatten()
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
    let (github_owner, github_repo) = remote_url.as_deref()
        .and_then(scanner::parse_github_pub)
        .map(|(o, r)| (Some(o), Some(r)))
        .unwrap_or((None, None));
    let dep_count = git_cmds::count_dependencies_fast(project_path);

    ProjectInfo {
        name: name.to_string(), path: project_path.to_string_lossy().to_string(),
        has_git, remote_url, github_owner, github_repo,
        languages, frameworks, project_type, last_modified, file_count, total_size, dep_count,
    }
}
