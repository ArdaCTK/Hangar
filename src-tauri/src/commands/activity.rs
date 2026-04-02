use crate::models::ActivityDay;
use crate::commands::utils::silent_command;
use std::collections::HashMap;
use std::path::Path;

#[tauri::command]
pub fn get_activity_data(project_paths: Vec<String>) -> Vec<ActivityDay> {
    let mut day_map: HashMap<String, (u32, Vec<String>)> = HashMap::new();

    for path_str in &project_paths {
        let path = Path::new(path_str);
        if !path.join(".git").exists() { continue; }
        let project_name = path.file_name().unwrap_or_default().to_string_lossy().to_string();

        let mut cmd = silent_command("git");
        cmd.args(["log", "--since=365 days ago", "--format=%ad", "--date=format:%Y-%m-%d"])
           .current_dir(path);

        let Ok(output) = cmd.output() else { continue };
        if !output.status.success() { continue; }

        let text = String::from_utf8_lossy(&output.stdout);
        for line in text.lines() {
            let date = line.trim().to_string();
            if date.len() != 10 { continue; }
            let entry = day_map.entry(date).or_insert((0, Vec::new()));
            entry.0 += 1;
            if !entry.1.contains(&project_name) { entry.1.push(project_name.clone()); }
        }
    }

    let mut days: Vec<ActivityDay> = day_map.into_iter()
        .map(|(date, (count, projects))| ActivityDay { date, count, projects })
        .collect();
    days.sort_by(|a, b| a.date.cmp(&b.date));
    days
}
