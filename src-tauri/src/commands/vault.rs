use crate::models::{VaultSecret, VaultProject};
use std::collections::HashMap;
use std::path::PathBuf;

fn vault_dir() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("hangar")
}

fn vault_path() -> PathBuf { vault_dir().join("vault.json") }

fn ensure_dir() {
    let _ = std::fs::create_dir_all(vault_dir());
}

fn load_vault_data() -> HashMap<String, Vec<VaultSecret>> {
    let path = vault_path();
    if !path.exists() { return HashMap::new(); }
    serde_json::from_str(&std::fs::read_to_string(&path).unwrap_or_default())
        .unwrap_or_default()
}

fn save_vault_data(data: &HashMap<String, Vec<VaultSecret>>) -> Result<(), String> {
    ensure_dir();
    let raw = serde_json::to_string_pretty(data).map_err(|e| e.to_string())?;
    std::fs::write(vault_path(), raw).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn vault_get_all() -> Vec<VaultProject> {
    let data: HashMap<String, Vec<VaultSecret>> = load_vault_data();
    data.into_iter().map(|(path, secrets)| {
        let name = path.split(['/', '\\']).last().unwrap_or(&path).to_string();
        VaultProject {
            project_path: path,
            project_name: name,
            secrets,
        }
    }).collect()
}

#[tauri::command]
pub fn vault_add_secret(project_path: String, key: String, value: String, category: String) -> Result<(), String> {
    let mut data = load_vault_data();
    let secrets = data.entry(project_path).or_default();

    // If key already exists, update it
    if let Some(existing) = secrets.iter_mut().find(|s| s.key == key) {
        existing.value = value;
        existing.category = category;
        existing.updated_at = now_ts();
    } else {
        secrets.push(VaultSecret {
            key,
            value,
            category,
            created_at: now_ts(),
            updated_at: now_ts(),
        });
    }

    save_vault_data(&data)
}

#[tauri::command]
pub fn vault_delete_secret(project_path: String, key: String) -> Result<(), String> {
    let mut data: HashMap<String, Vec<VaultSecret>> = load_vault_data();
    if let Some(secrets) = data.get_mut(&project_path) {
        secrets.retain(|s| s.key != key);
        if secrets.is_empty() {
            data.remove(&project_path);
        }
    }
    save_vault_data(&data)
}

#[tauri::command]
pub fn vault_export_env(project_path: String) -> Result<String, String> {
    let data = load_vault_data();
    let secrets = data.get(&project_path).cloned().unwrap_or_default();
    let env_content = secrets.iter()
        .map(|s| format!("{}={}", s.key, s.value))
        .collect::<Vec<_>>()
        .join("\n");
    Ok(env_content)
}

#[tauri::command]
pub fn vault_import_env(project_path: String, env_content: String) -> Result<u32, String> {
    let mut data = load_vault_data();
    let secrets = data.entry(project_path).or_default();
    let mut count = 0u32;

    for line in env_content.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') { continue; }
        if let Some((key, value)) = line.split_once('=') {
            let key = key.trim().to_string();
            let value = value.trim().trim_matches('"').trim_matches('\'').to_string();
            if key.is_empty() { continue; }

            if let Some(existing) = secrets.iter_mut().find(|s| s.key == key) {
                existing.value = value;
                existing.updated_at = now_ts();
            } else {
                let category = guess_category(&key);
                secrets.push(VaultSecret {
                    key,
                    value,
                    category,
                    created_at: now_ts(),
                    updated_at: now_ts(),
                });
            }
            count += 1;
        }
    }

    save_vault_data(&data)?;
    Ok(count)
}

#[tauri::command]
pub fn vault_scan_project_env(project_path: String) -> Result<Vec<VaultSecret>, String> {
    let mut found = Vec::new();
    let dir = std::path::Path::new(&project_path);

    // Scan common env files
    let env_files = [".env", ".env.local", ".env.development", ".env.production", ".env.example"];
    for name in &env_files {
        let file_path = dir.join(name);
        if file_path.exists() {
            if let Ok(content) = std::fs::read_to_string(&file_path) {
                for line in content.lines() {
                    let line = line.trim();
                    if line.is_empty() || line.starts_with('#') { continue; }
                    if let Some((key, value)) = line.split_once('=') {
                        let key = key.trim().to_string();
                        let value = value.trim().trim_matches('"').trim_matches('\'').to_string();
                        if key.is_empty() { continue; }
                        let category = guess_category(&key);
                        // Only include secrets that look sensitive
                        if is_sensitive(&key, &value) {
                            found.push(VaultSecret {
                                key,
                                value,
                                category,
                                created_at: now_ts(),
                                updated_at: now_ts(),
                            });
                        }
                    }
                }
            }
        }
    }

    Ok(found)
}

fn guess_category(key: &str) -> String {
    let k = key.to_uppercase();
    if k.contains("SSH") || k.contains("PRIVATE_KEY") {
        "ssh_key".to_string()
    } else if k.contains("TOKEN") || k.contains("JWT") {
        "token".to_string()
    } else if k.contains("API") || k.contains("KEY") || k.contains("SECRET") {
        "api_key".to_string()
    } else {
        "env".to_string()
    }
}

fn is_sensitive(key: &str, _value: &str) -> bool {
    let k = key.to_uppercase();
    k.contains("KEY") || k.contains("SECRET") || k.contains("TOKEN")
        || k.contains("PASSWORD") || k.contains("PASS") || k.contains("API")
        || k.contains("AUTH") || k.contains("CREDENTIAL") || k.contains("SSH")
        || k.contains("JWT") || k.contains("PRIVATE") || k.contains("DATABASE_URL")
        || k.contains("DB_") || k.contains("MONGO") || k.contains("REDIS")
        || k.contains("AWS_") || k.contains("AZURE_") || k.contains("GCP_")
        || k.contains("STRIPE") || k.contains("SENDGRID") || k.contains("TWILIO")
}

fn now_ts() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}
