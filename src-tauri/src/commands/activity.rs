use crate::models::ActivityDay;
use std::collections::HashMap;
use std::path::Path;
use std::process::Command;

/// Returns last 365 days of commit activity across all provided project paths.
#[tauri::command]
pub fn get_activity_data(project_paths: Vec<String>) -> Vec<ActivityDay> {
    // Map: date -> (count, projects)
    let mut day_map: HashMap<String, (u32, Vec<String>)> = HashMap::new();

    for path_str in &project_paths {
        let path = Path::new(path_str);
        if !path.join(".git").exists() { continue; }

        let project_name = path.file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        // git log: one line per commit, just the date, last 365 days
        let out = Command::new("git")
            .args(["log", "--since=365 days ago", "--format=%ad", "--date=format:%Y-%m-%d"])
            .current_dir(path)
            .output();

        let output = match out {
            Ok(o) if o.status.success() => o,
            _ => continue,
        };

        let text = String::from_utf8_lossy(&output.stdout);
        for line in text.lines() {
            let date = line.trim().to_string();
            if date.len() != 10 { continue; }
            let entry = day_map.entry(date).or_insert((0, Vec::new()));
            entry.0 += 1;
            if !entry.1.contains(&project_name) {
                entry.1.push(project_name.clone());
            }
        }
    }

    // Build full 365-day range so empty days are included
    let mut days: Vec<ActivityDay> = day_map
        .into_iter()
        .map(|(date, (count, projects))| ActivityDay { date, count, projects })
        .collect();

    days.sort_by(|a, b| a.date.cmp(&b.date));
    days
}
