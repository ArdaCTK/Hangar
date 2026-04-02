use crate::models::JunkItem;
use std::path::Path;
use walkdir::WalkDir;

/// Categories of junk, with display label and dir/file names to match
const JUNK_DIRS: &[(&str, &str, &str)] = &[
    // (category, dir_name, display_label)
    ("Dependencies",  "node_modules",     "node_modules (npm)"),
    ("Build",         "target",           "target/ (Rust build)"),
    ("Build",         "dist",             "dist/ (build output)"),
    ("Build",         "build",            "build/ (build output)"),
    ("Build",         ".next",            ".next/ (Next.js)"),
    ("Build",         ".nuxt",            ".nuxt/ (Nuxt)"),
    ("Build",         ".svelte-kit",      ".svelte-kit/"),
    ("Build",         "out",              "out/ (build output)"),
    ("Build",         ".output",          ".output/ (Nuxt)"),
    ("Cache",         ".turbo",           ".turbo/ (Turbo cache)"),
    ("Cache",         ".parcel-cache",    ".parcel-cache/"),
    ("Cache",         ".cache",           ".cache/"),
    ("Cache",         ".eslintcache",     ".eslintcache"),
    ("Cache",         "__pycache__",      "__pycache__ (Python)"),
    ("Cache",         ".pytest_cache",    ".pytest_cache/"),
    ("Cache",         ".mypy_cache",      ".mypy_cache/"),
    ("Cache",         ".ruff_cache",      ".ruff_cache/"),
    ("Venv",          "venv",             "venv/ (Python venv)"),
    ("Venv",          ".venv",            ".venv/ (Python venv)"),
    ("Venv",          "env",              "env/ (Python env)"),
    ("Venv",          ".env_dir",         ".env_dir/"),
    ("Logs",          "logs",             "logs/"),
    ("Logs",          ".logs",            ".logs/"),
    ("Coverage",      "coverage",         "coverage/ (test coverage)"),
    ("Coverage",      ".nyc_output",      ".nyc_output/ (NYC)"),
    ("Native",        "Pods",             "Pods/ (iOS CocoaPods)"),
    ("Native",        "DerivedData",      "DerivedData/ (Xcode)"),
    ("Native",        ".gradle",          ".gradle/ (Gradle cache)"),
];

const JUNK_FILES: &[(&str, &str, &str)] = &[
    // (category, extension_or_name, display_label)
    ("Logs",  ".log",             "*.log files"),
    ("Logs",  "npm-debug.log",    "npm-debug.log"),
    ("Logs",  "yarn-error.log",   "yarn-error.log"),
    ("Temp",  ".tmp",             "*.tmp files"),
    ("Temp",  ".temp",            "*.temp files"),
    ("OS",    ".DS_Store",        ".DS_Store (macOS)"),
    ("OS",    "Thumbs.db",        "Thumbs.db (Windows)"),
    ("OS",    "desktop.ini",      "desktop.ini"),
];

fn dir_size(path: &Path) -> u64 {
    WalkDir::new(path)
        .follow_links(false)
        .into_iter()
        .flatten()
        .filter(|e| e.file_type().is_file())
        .filter_map(|e| e.metadata().ok())
        .map(|m| m.len())
        .sum()
}

#[tauri::command]
pub fn detect_junk(projects_path: String) -> Result<Vec<JunkItem>, String> {
    let root = Path::new(&projects_path);
    if !root.exists() {
        return Err(format!("Path not found: {}", projects_path));
    }

    let mut items = Vec::new();

    let entries = std::fs::read_dir(root).map_err(|e| e.to_string())?;
    for project_entry in entries.flatten() {
        let project_path = project_entry.path();
        if !project_path.is_dir() { continue; }

        let project_name = project_path.file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        if project_name.starts_with('.') { continue; }

        // Check for junk directories (only top-level + 1 level deep for perf)
        for depth_path in [project_path.clone()]
            .iter()
            .chain(
                std::fs::read_dir(&project_path)
                    .into_iter()
                    .flatten()
                    .flatten()
                    .filter(|e| e.path().is_dir())
                    .map(|e| e.path())
                    .collect::<Vec<_>>()
                    .iter()
            )
        {
            if let Ok(rd) = std::fs::read_dir(depth_path) {
                for entry in rd.flatten() {
                    let p = entry.path();
                    let name = p.file_name().unwrap_or_default().to_string_lossy().to_string();

                    if p.is_dir() {
                        for (category, dir_name, _label) in JUNK_DIRS {
                            if name == *dir_name {
                                let size = dir_size(&p);
                                items.push(JunkItem {
                                    path: p.to_string_lossy().to_string(),
                                    name: name.clone(),
                                    project: project_name.clone(),
                                    category: category.to_string(),
                                    size_bytes: size,
                                    is_dir: true,
                                });
                                break;
                            }
                        }
                    } else {
                        // Check junk files
                        for (category, pattern, _label) in JUNK_FILES {
                            let matches = if pattern.starts_with('*') {
                                name.ends_with(&pattern[1..])
                            } else {
                                name == *pattern || name.ends_with(pattern)
                            };
                            if matches {
                                let size = p.metadata().map(|m| m.len()).unwrap_or(0);
                                items.push(JunkItem {
                                    path: p.to_string_lossy().to_string(),
                                    name: name.clone(),
                                    project: project_name.clone(),
                                    category: category.to_string(),
                                    size_bytes: size,
                                    is_dir: false,
                                });
                                break;
                            }
                        }
                    }
                }
            }
        }
    }

    // Sort by size descending
    items.sort_by(|a, b| b.size_bytes.cmp(&a.size_bytes));
    Ok(items)
}

#[tauri::command]
pub fn delete_junk_items(paths: Vec<String>) -> Result<DeleteResult, String> {
    let mut deleted = 0u64;
    let mut errors: Vec<String> = Vec::new();

    for path_str in &paths {
        let p = Path::new(path_str);
        if !p.exists() { continue; }

        let result = if p.is_dir() {
            let size = dir_size(p);
            std::fs::remove_dir_all(p).map(|_| size)
        } else {
            let size = p.metadata().map(|m| m.len()).unwrap_or(0);
            std::fs::remove_file(p).map(|_| size)
        };

        match result {
            Ok(size) => deleted += size,
            Err(e)   => errors.push(format!("{}: {}", path_str, e)),
        }
    }

    Ok(DeleteResult { freed_bytes: deleted, errors })
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DeleteResult {
    pub freed_bytes: u64,
    pub errors: Vec<String>,
}
