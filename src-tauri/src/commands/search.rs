use crate::models::SearchResult;
use std::path::Path;
use walkdir::WalkDir;

const SEARCHABLE_EXTS: &[&str] = &[
    "md", "txt", "rs", "ts", "tsx", "js", "jsx", "py", "go",
    "cs", "java", "kt", "swift", "cpp", "c", "h", "html", "css",
    "json", "toml", "yaml", "yml", "env", "sh",
];

const SKIP_DIRS: &[&str] = &[
    ".git", "node_modules", "target", ".svelte-kit", "dist",
    "build", ".next", "out", "__pycache__", "venv", ".venv",
    "vendor", ".cargo",
];

#[tauri::command]
pub fn search_projects(
    projects_path: String,
    query: String,
    max_results: usize,
) -> Result<Vec<SearchResult>, String> {
    if query.trim().is_empty() {
        return Ok(vec![]);
    }

    let root = Path::new(&projects_path);
    let query_lower = query.to_lowercase();
    let mut results = Vec::new();

    // Iterate top-level project dirs
    let entries = std::fs::read_dir(root).map_err(|e| e.to_string())?;
    for entry in entries.flatten() {
        if results.len() >= max_results { break; }

        let project_path = entry.path();
        if !project_path.is_dir() { continue; }

        let project_name = project_path.file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        if project_name.starts_with('.') { continue; }

        // Walk project, search files
        for file_entry in WalkDir::new(&project_path)
            .follow_links(false)
            .into_iter()
            .filter_entry(|e| {
                if e.file_type().is_dir() {
                    let n = e.file_name().to_string_lossy();
                    return !SKIP_DIRS.iter().any(|s| *s == n.as_ref());
                }
                true
            })
            .flatten()
        {
            if results.len() >= max_results { break; }
            if !file_entry.file_type().is_file() { continue; }

            let file_path = file_entry.path();
            let ext = file_path.extension()
                .map(|e| e.to_string_lossy().to_lowercase())
                .unwrap_or_default();

            let file_name = file_path.file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();

            // Check filename or extension
            let is_searchable = SEARCHABLE_EXTS.contains(&ext.as_str())
                || file_name.starts_with(".env")
                || file_name == "Makefile"
                || file_name == "Dockerfile";

            if !is_searchable { continue; }

            // Skip very large files (> 2MB)
            if let Ok(meta) = file_entry.metadata() {
                if meta.len() > 2_000_000 { continue; }
            }

            let Ok(content) = std::fs::read_to_string(file_path) else { continue };
            let lines: Vec<&str> = content.lines().collect();

            for (i, line) in lines.iter().enumerate() {
                if results.len() >= max_results { break; }

                if !line.to_lowercase().contains(&query_lower) { continue; }

                let context_before = if i > 0 { lines[i - 1] } else { "" };
                let context_after  = if i + 1 < lines.len() { lines[i + 1] } else { "" };

                results.push(SearchResult {
                    project_name: project_name.clone(),
                    project_path: project_path.to_string_lossy().to_string(),
                    file_name: file_name.clone(),
                    file_path: file_path.to_string_lossy().to_string(),
                    line_number: i + 1,
                    line_content: line.to_string(),
                    context_before: context_before.to_string(),
                    context_after: context_after.to_string(),
                });
            }
        }
    }

    Ok(results)
}
