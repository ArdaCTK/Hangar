use crate::commands::crypto::{decrypt_with_machine_binding, encrypt_with_machine_binding};
use crate::commands::utils::get_machine_hostname;
use crate::models::{VaultProject, VaultSecret};
use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Key, Nonce,
};
use base64::{engine::general_purpose::STANDARD, Engine};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

static VAULT_LOCK: Mutex<()> = Mutex::new(());

fn vault_dir() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("hangar")
}

fn vault_path() -> PathBuf {
    vault_dir().join("vault.json")
}

fn ensure_dir() {
    let _ = std::fs::create_dir_all(vault_dir());
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct VaultSecretInput {
    pub key: String,
    pub value: String,
    pub category: String,
}

fn load_vault_data() -> HashMap<String, Vec<VaultSecret>> {
    let path = vault_path();
    if !path.exists() {
        return HashMap::new();
    }

    let raw = match std::fs::read_to_string(&path) {
        Ok(s) => s,
        Err(_) => return HashMap::new(),
    };
    let trimmed = raw.trim();

    // v2 format (PBKDF2 + random salt + AES-256-GCM)
    if trimmed.starts_with("v2:") {
        if let Ok(decrypted) = decrypt_with_machine_binding("vault", trimmed) {
            if let Ok(data) = serde_json::from_str(&decrypted) {
                return data;
            }
        }
    }

    // v1 legacy encrypted format (deterministic key, no salt) for migration.
    if let Ok(decrypted) = decrypt_v1_legacy(trimmed) {
        if let Ok(data) = serde_json::from_str(&decrypted) {
            let _ = save_vault_data(&data);
            return data;
        }
    }

    // Legacy plaintext format fallback.
    if let Ok(data) = serde_json::from_str::<HashMap<String, Vec<VaultSecret>>>(&raw) {
        let _ = save_vault_data(&data);
        return data;
    }

    HashMap::new()
}

fn save_vault_data(data: &HashMap<String, Vec<VaultSecret>>) -> Result<(), String> {
    ensure_dir();
    let plaintext = serde_json::to_string(data).map_err(|e| e.to_string())?;
    let encrypted = encrypt_with_machine_binding("vault", &plaintext)?;
    std::fs::write(vault_path(), encrypted).map_err(|e| e.to_string())
}

fn upsert_secret(secrets: &mut Vec<VaultSecret>, key: String, value: String, category: String) {
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
}

#[tauri::command]
pub fn vault_get_all() -> Vec<VaultProject> {
    let _guard = VAULT_LOCK.lock().unwrap();
    let data = load_vault_data();
    data.into_iter()
        .map(|(path, secrets)| {
            let name = path.split(['/', '\\']).last().unwrap_or(&path).to_string();
            VaultProject {
                project_path: path,
                project_name: name,
                secrets,
            }
        })
        .collect()
}

#[tauri::command]
pub fn vault_add_secret(
    project_path: String,
    key: String,
    value: String,
    category: String,
) -> Result<(), String> {
    let _guard = VAULT_LOCK.lock().unwrap();
    let mut data = load_vault_data();
    let secrets = data.entry(project_path).or_default();
    upsert_secret(secrets, key, value, category);
    save_vault_data(&data)
}

#[tauri::command]
pub fn vault_add_secrets_batch(
    project_path: String,
    secrets: Vec<VaultSecretInput>,
) -> Result<u32, String> {
    let _guard = VAULT_LOCK.lock().unwrap();
    let mut data = load_vault_data();
    let entries = data.entry(project_path).or_default();
    let mut count = 0u32;

    for s in secrets {
        if s.key.trim().is_empty() {
            continue;
        }
        upsert_secret(entries, s.key, s.value, s.category);
        count += 1;
    }

    save_vault_data(&data)?;
    Ok(count)
}

#[tauri::command]
pub fn vault_delete_secret(project_path: String, key: String) -> Result<(), String> {
    let _guard = VAULT_LOCK.lock().unwrap();
    let mut data = load_vault_data();
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
    let _guard = VAULT_LOCK.lock().unwrap();
    let data = load_vault_data();
    let secrets = data.get(&project_path).cloned().unwrap_or_default();
    let env_content = secrets
        .iter()
        .map(|s| format!("{}={}", s.key, s.value))
        .collect::<Vec<_>>()
        .join("\n");
    Ok(env_content)
}

#[tauri::command]
pub fn vault_import_env(project_path: String, env_content: String) -> Result<u32, String> {
    let _guard = VAULT_LOCK.lock().unwrap();
    let mut data = load_vault_data();
    let secrets = data.entry(project_path).or_default();
    let mut count = 0u32;

    for line in env_content.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        if let Some((key, value)) = line.split_once('=') {
            let key = key.trim().to_string();
            let value = value
                .trim()
                .trim_matches('"')
                .trim_matches('\'')
                .to_string();
            if key.is_empty() {
                continue;
            }
            let category = guess_category(&key);
            upsert_secret(secrets, key, value, category);
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

    let env_files = [
        ".env",
        ".env.local",
        ".env.development",
        ".env.production",
        ".env.example",
    ];
    for name in &env_files {
        let file_path = dir.join(name);
        if !file_path.exists() {
            continue;
        }
        let Ok(content) = std::fs::read_to_string(&file_path) else {
            continue;
        };
        for line in content.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }
            if let Some((key, value)) = line.split_once('=') {
                let key = key.trim().to_string();
                let value = value
                    .trim()
                    .trim_matches('"')
                    .trim_matches('\'')
                    .to_string();
                if key.is_empty() {
                    continue;
                }
                if is_sensitive(&key) {
                    found.push(VaultSecret {
                        key: key.clone(),
                        value,
                        category: guess_category(&key),
                        created_at: now_ts(),
                        updated_at: now_ts(),
                    });
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

fn is_sensitive(key: &str) -> bool {
    let k = key.to_uppercase();
    k.contains("KEY")
        || k.contains("SECRET")
        || k.contains("TOKEN")
        || k.contains("PASSWORD")
        || k.contains("PASS")
        || k.contains("API")
        || k.contains("AUTH")
        || k.contains("CREDENTIAL")
        || k.contains("SSH")
        || k.contains("JWT")
        || k.contains("PRIVATE")
        || k.contains("DATABASE_URL")
        || k.contains("DB_")
        || k.contains("MONGO")
        || k.contains("REDIS")
        || k.contains("AWS_")
        || k.contains("AZURE_")
        || k.contains("GCP_")
        || k.contains("STRIPE")
        || k.contains("SENDGRID")
        || k.contains("TWILIO")
}

fn now_ts() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

// ── Legacy v1 decryptor (for migration only) ──────────────────────────────────

fn decrypt_v1_legacy(encoded: &str) -> Result<String, String> {
    let combined = STANDARD
        .decode(encoded)
        .map_err(|e| format!("Legacy vault base64 decode failed: {}", e))?;

    if combined.len() < 12 {
        return Err("Legacy vault payload too short".to_string());
    }

    let (nonce_bytes, ciphertext) = combined.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);

    let key_bytes = derive_v1_legacy_key();
    let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);

    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| "Legacy vault decryption failed".to_string())?;

    String::from_utf8(plaintext).map_err(|e| e.to_string())
}

fn derive_v1_legacy_key() -> [u8; 32] {
    // FIX: get_machine_hostname() artık sysinfo OS API'lerini kullanıyor;
    // önceki Command::new("hostname") subprocess PATH manipülasyonuna açıktı.
    let hostname = get_machine_hostname();
    let username = std::env::var("USERNAME")
        .or_else(|_| std::env::var("USER"))
        .unwrap_or_else(|_| "hangar-user".to_string());

    let mut hasher = Sha256::new();
    hasher.update(b"hangar-vault-v1:");
    hasher.update(hostname.as_bytes());
    hasher.update(b":");
    hasher.update(username.as_bytes());
    hasher.finalize().into()
}
