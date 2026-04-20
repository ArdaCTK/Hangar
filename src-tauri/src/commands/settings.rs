use crate::models::{Settings, ProjectNote};
use crate::commands::crypto::{decrypt_with_machine_binding, encrypt_with_machine_binding};
use std::collections::HashMap;
use std::path::PathBuf;

fn config_dir() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("hangar")
}

fn settings_path() -> PathBuf { config_dir().join("settings.json") }
fn notes_path()    -> PathBuf { config_dir().join("notes.json") }

fn ensure_dir() {
    let _ = std::fs::create_dir_all(config_dir());
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, Default)]
struct StoredSettings {
    #[serde(default)]
    projects_path: String,
    #[serde(default)]
    github_token: Option<String>, // legacy plaintext field (migrated on read)
    #[serde(default)]
    github_token_encrypted: Option<String>,
}

#[tauri::command]
pub fn load_settings() -> Settings {
    let path = settings_path();
    if !path.exists() { return Settings::default(); }
    let raw = std::fs::read_to_string(&path).unwrap_or_default();

    if let Ok(stored) = serde_json::from_str::<StoredSettings>(&raw) {
        let decrypted_token = stored
            .github_token_encrypted
            .as_deref()
            .and_then(|blob| decrypt_with_machine_binding("github-token", blob).ok());
        let token = decrypted_token.or(stored.github_token.clone());

        let settings = Settings {
            projects_path: stored.projects_path,
            github_token: token,
        };

        // FIX: Plaintext token migration — başarısız olursa hata artık loglanıyor.
        // Önceki `let _ = ...` sessizce yutuyordu; disk dolu veya izin hatalarında
        // token her açılışta yeniden plaintext okunmaya devam ediyordu.
        if stored.github_token.is_some() {
            if let Err(e) = save_settings(settings.clone()) {
                eprintln!("[Hangar] Warning: GitHub token encrypted storage migration failed: {e}. \
                           Token will be re-migrated on next launch.");
            }
        }

        return settings;
    }

    // Legacy shape fallback.
    let settings = serde_json::from_str::<Settings>(&raw).unwrap_or_default();
    if settings.github_token.is_some() {
        if let Err(e) = save_settings(settings.clone()) {
            eprintln!("[Hangar] Warning: Legacy settings migration failed: {e}.");
        }
    }
    settings
}

#[tauri::command]
pub fn save_settings(settings: Settings) -> Result<(), String> {
    ensure_dir();

    let token_enc = settings
        .github_token
        .as_deref()
        .filter(|t| !t.trim().is_empty())
        .map(|token| encrypt_with_machine_binding("github-token", token))
        .transpose()?;

    let stored = StoredSettings {
        projects_path: settings.projects_path,
        github_token: None,
        github_token_encrypted: token_enc,
    };
    let raw = serde_json::to_string_pretty(&stored).map_err(|e| e.to_string())?;
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
