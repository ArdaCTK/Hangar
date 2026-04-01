use crate::models::ProjectInfo;
use std::collections::{HashMap, HashSet};
use std::path::Path;
use walkdir::WalkDir;

// Directories and files to skip during scanning
const SKIP_DIRS: &[&str] = &[
    ".git", "node_modules", "target", ".svelte-kit", "dist", "build",
    ".next", ".nuxt", "out", "__pycache__", ".pytest_cache", ".mypy_cache",
    "venv", ".venv", "env", ".env_dir", "vendor", ".cargo",
    "Pods", "DerivedData", ".gradle", ".idea", ".vscode",
];

// Language detection by extension
fn ext_to_lang(ext: &str) -> Option<&'static str> {
    match ext {
        "ts" | "tsx"             => Some("TypeScript"),
        "js" | "jsx" | "mjs"    => Some("JavaScript"),
        "rs"                     => Some("Rust"),
        "py"                     => Some("Python"),
        "cs"                     => Some("C#"),
        "go"                     => Some("Go"),
        "kt" | "kts"             => Some("Kotlin"),
        "java"                   => Some("Java"),
        "swift"                  => Some("Swift"),
        "cpp" | "cc" | "cxx"    => Some("C++"),
        "c"                      => Some("C"),
        "h" | "hpp"              => Some("C/C++ Header"),
        "html" | "htm"           => Some("HTML"),
        "css"                    => Some("CSS"),
        "scss" | "sass"          => Some("SCSS"),
        "vue"                    => Some("Vue"),
        "svelte"                 => Some("Svelte"),
        "dart"                   => Some("Dart"),
        "rb"                     => Some("Ruby"),
        "php"                    => Some("PHP"),
        "lua"                    => Some("Lua"),
        "zig"                    => Some("Zig"),
        "ex" | "exs"             => Some("Elixir"),
        "fs" | "fsi" | "fsx"     => Some("F#"),
        "r"                      => Some("R"),
        "sh" | "bash"            => Some("Shell"),
        "ps1"                    => Some("PowerShell"),
        "sql"                    => Some("SQL"),
        _                        => None,
    }
}

// Framework detection from file presence
fn detect_frameworks(project_path: &Path) -> Vec<String> {
    let mut fws = Vec::new();

    let checks: &[(&[&str], &str)] = &[
        (&["tauri.conf.json", "tauri.conf.json5"],           "Tauri"),
        (&["vite.config.ts", "vite.config.js"],              "Vite"),
        (&["next.config.js", "next.config.mjs", "next.config.ts"], "Next.js"),
        (&["nuxt.config.ts", "nuxt.config.js"],              "Nuxt"),
        (&["svelte.config.js", "svelte.config.ts"],          "SvelteKit"),
        (&["remix.config.js"],                               "Remix"),
        (&["astro.config.mjs", "astro.config.ts"],           "Astro"),
        (&["angular.json"],                                  "Angular"),
        (&["vue.config.js"],                                  "Vue CLI"),
        (&["gatsby-config.js", "gatsby-config.ts"],          "Gatsby"),
        (&["expo.json", "app.json"],                         "Expo"),
        (&["metro.config.js"],                               "React Native"),
        (&["Cargo.toml"],                                    "Rust/Cargo"),
        (&["pyproject.toml"],                                "Python/Poetry"),
        (&["requirements.txt"],                              "Python/pip"),
        (&["go.mod"],                                        "Go Module"),
        (&["pom.xml"],                                       "Maven"),
        (&["build.gradle", "build.gradle.kts"],              "Gradle"),
        (&["CMakeLists.txt"],                                "CMake"),
        (&["Makefile"],                                      "Make"),
        (&["docker-compose.yml", "docker-compose.yaml"],     "Docker Compose"),
        (&["Dockerfile"],                                    "Docker"),
        (&["terraform.tf", "main.tf"],                       "Terraform"),
        (&[".github/workflows"],                             "GitHub Actions"),
        (&["unity.project", "ProjectSettings/ProjectVersion.txt"], "Unity"),
        (&["AndroidManifest.xml"],                           "Android"),
        (&["Info.plist"],                                    "iOS/macOS"),
    ];

    for (files, fw) in checks {
        for file in *files {
            if project_path.join(file).exists() {
                fws.push(fw.to_string());
                break;
            }
        }
    }

    // Check package.json for React / etc.
    let pkg = project_path.join("package.json");
    if pkg.exists() {
        if let Ok(raw) = std::fs::read_to_string(&pkg) {
            if raw.contains("\"react\"") || raw.contains("\"react-dom\"") {
                fws.push("React".to_string());
            }
            if raw.contains("\"@tauri-apps/api\"") {
                // already counted via tauri.conf.json, skip dup
            }
            if raw.contains("\"electron\"") {
                fws.push("Electron".to_string());
            }
            if raw.contains("\"express\"") || raw.contains("\"fastify\"") || raw.contains("\"koa\"") {
                fws.push("Node.js API".to_string());
            }
            if raw.contains("\"@trpc/server\"") || raw.contains("\"@trpc/client\"") {
                fws.push("tRPC".to_string());
            }
        }
    }

    // Deduplicate preserving order
    let mut seen = HashSet::new();
    fws.retain(|f| seen.insert(f.clone()));
    fws
}

// Infer project type from languages/frameworks/files
fn infer_type(
    project_path: &Path,
    langs: &[String],
    fws: &[String],
) -> String {
    let has = |s: &str| fws.iter().any(|f| f.contains(s)) || langs.iter().any(|l| l.contains(s));

    if has("Unity")                                            { return "Game".to_string(); }
    if has("Android") || has("Expo") || has("React Native")   { return "Mobile".to_string(); }
    if has("Tauri") || has("Electron")                         { return "Desktop".to_string(); }
    if has("Next.js") || has("Nuxt") || has("SvelteKit")
        || has("Gatsby") || has("Astro")                       { return "Web App".to_string(); }
    if has("React") || has("Vue") || has("Angular")
        || has("Svelte")                                        { return "Frontend".to_string(); }
    if has("Node.js API") || has("tRPC") || project_path.join("server.ts").exists()
        || project_path.join("server.js").exists()             { return "Backend".to_string(); }
    if has("Docker") || has("Terraform")                       { return "DevOps".to_string(); }
    if has("Rust/Cargo") && !has("Tauri")                      { return "Rust CLI/Lib".to_string(); }
    if has("Python/pip") || has("Python/Poetry")               { return "Python".to_string(); }
    if has("Go Module")                                        { return "Go".to_string(); }
    if langs.iter().any(|l| l == "TypeScript" || l == "JavaScript") {
        return "Node.js".to_string();
    }
    "Other".to_string()
}

// ── Public re-exports for files.rs ───────────────────────────────────────────

pub fn ext_to_lang_pub(ext: &str) -> Option<&'static str> { ext_to_lang(ext) }
pub fn detect_frameworks_pub(p: &Path) -> Vec<String> { detect_frameworks(p) }
pub fn infer_type_pub(p: &Path, l: &[String], f: &[String]) -> String { infer_type(p, l, f) }
pub fn git_remote_pub(p: &Path) -> Option<String> { git_remote(p) }
pub fn parse_github_pub(url: &str) -> Option<(String, String)> { parse_github(url) }

// ─────────────────────────────────────────────────────────────────────────────

// Parse github owner/repo from remote URL
fn parse_github(url: &str) -> Option<(String, String)> {
    let re = regex::Regex::new(r"github\.com[:/]([^/]+)/([^/.]+?)(?:\.git)?$").ok()?;
    let caps = re.captures(url)?;
    Some((caps[1].to_string(), caps[2].to_string()))
}

// Read git remote url
fn git_remote(project_path: &Path) -> Option<String> {
    let cfg = project_path.join(".git").join("config");
    let raw = std::fs::read_to_string(&cfg).ok()?;
    for line in raw.lines() {
        let t = line.trim();
        if t.starts_with("url = ") {
            return Some(t["url = ".len()..].trim().to_string());
        }
    }
    None
}

#[tauri::command]
pub fn scan_projects(path: String) -> Result<Vec<ProjectInfo>, String> {
    let root = Path::new(&path);
    if !root.exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    let mut projects = Vec::new();

    // List top-level subdirectories only
    let entries = std::fs::read_dir(root).map_err(|e| e.to_string())?;
    for entry in entries.flatten() {
        let meta = entry.metadata().map_err(|e| e.to_string())?;
        if !meta.is_dir() {
            continue;
        }
        let dir_path = entry.path();
        let name = dir_path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        // Skip hidden/system dirs at root level
        if name.starts_with('.') {
            continue;
        }

        // Scan the project directory
        let info = scan_single_project(&dir_path, &name);
        projects.push(info);
    }

    // Sort by last_modified descending
    projects.sort_by(|a, b| b.last_modified.cmp(&a.last_modified));

    Ok(projects)
}

fn scan_single_project(project_path: &Path, name: &str) -> ProjectInfo {
    let mut lang_counts: HashMap<&'static str, u32> = HashMap::new();
    let mut file_count = 0u64;
    let mut total_size = 0u64;
    let mut last_modified = 0i64;

    // Pass 1: Count ALL files (including node_modules, target, dist etc.)
    // This gives accurate disk usage numbers matching what Explorer shows.
    for entry in WalkDir::new(project_path)
        .follow_links(false)
        .into_iter()
        .flatten()
    {
        if entry.file_type().is_file() {
            file_count += 1;
            if let Ok(meta) = entry.metadata() {
                total_size += meta.len();
                if let Ok(mtime) = meta.modified() {
                    if let Ok(dur) = mtime.duration_since(std::time::UNIX_EPOCH) {
                        let ts = dur.as_secs() as i64;
                        if ts > last_modified {
                            last_modified = ts;
                        }
                    }
                }
            }
        }
    }

    // Pass 2: Language detection — skip build artifacts/deps for accuracy.
    for entry in WalkDir::new(project_path)
        .follow_links(false)
        .into_iter()
        .filter_entry(|e| {
            if e.file_type().is_dir() {
                let n = e.file_name().to_string_lossy();
                return !SKIP_DIRS.iter().any(|skip| *skip == n.as_ref());
            }
            true
        })
        .flatten()
    {
        if entry.file_type().is_file() {
            if let Some(ext) = entry.path().extension() {
                let ext_str = ext.to_string_lossy().to_lowercase();
                if let Some(lang) = ext_to_lang(&ext_str) {
                    *lang_counts.entry(lang).or_insert(0) += 1;
                }
            }
        }
    }

    // Sort languages by frequency
    let mut lang_vec: Vec<(&str, u32)> = lang_counts.into_iter().collect();
    lang_vec.sort_by(|a, b| b.1.cmp(&a.1));
    let languages: Vec<String> = lang_vec
        .into_iter()
        .take(8)
        .map(|(l, _)| l.to_string())
        .collect();

    let frameworks = detect_frameworks(project_path);
    let project_type = infer_type(project_path, &languages, &frameworks);

    let has_git = project_path.join(".git").exists();
    let remote_url = if has_git { git_remote(project_path) } else { None };
    let (github_owner, github_repo) = remote_url
        .as_deref()
        .and_then(parse_github)
        .map(|(o, r)| (Some(o), Some(r)))
        .unwrap_or((None, None));

    ProjectInfo {
        name: name.to_string(),
        path: project_path.to_string_lossy().to_string(),
        has_git,
        remote_url,
        github_owner,
        github_repo,
        languages,
        frameworks,
        project_type,
        last_modified,
        file_count,
        total_size,
    }
}
