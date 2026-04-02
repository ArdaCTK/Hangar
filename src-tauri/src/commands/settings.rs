use crate::models::{Settings, ProjectNote};
use std::collections::HashMap;
use std::path::PathBuf;

fn config_dir() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("project-dashboard")
}

fn settings_path() -> PathBuf { config_dir().join("settings.json") }
fn notes_path()    -> PathBuf { config_dir().join("notes.json") }

fn ensure_dir() {
    let _ = std::fs::create_dir_all(config_dir());
}

#[tauri::command]
pub fn load_settings() -> Settings {
    let path = settings_path();
    if !path.exists() { return Settings::default(); }
    serde_json::from_str(&std::fs::read_to_string(&path).unwrap_or_default())
        .unwrap_or_default()
}

#[tauri::command]
pub fn save_settings(settings: Settings) -> Result<(), String> {
    ensure_dir();
    let raw = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    std::fs::write(settings_path(), raw).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_notes() -> HashMap<String, ProjectNote> {
    let path = notes_path();
    if !path.exists() { return HashMap::new(); }
    serde_json::from_str(&std::fs::read_to_string(&path).unwrap_or_default())
        .unwrap_or_default()
}

#[tauri::command]
pub fn save_note(project_path: String, note: String, tags: Vec<String>) -> Result<(), String> {
    ensure_dir();
    let mut notes = load_notes();
    notes.insert(project_path, ProjectNote {
        note,
        tags,
        updated_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0),
    });
    let raw = serde_json::to_string_pretty(&notes).map_err(|e| e.to_string())?;
    std::fs::write(notes_path(), raw).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_note(project_path: String) -> Result<(), String> {
    ensure_dir();
    let mut notes = load_notes();
    notes.remove(&project_path);
    let raw = serde_json::to_string_pretty(&notes).map_err(|e| e.to_string())?;
    std::fs::write(notes_path(), raw).map_err(|e| e.to_string())
}
