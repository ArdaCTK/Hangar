use crate::models::{VaultSecret, VaultProject};
use aes_gcm::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    Aes256Gcm, Key, Nonce,
};
use base64::{engine::general_purpose::STANDARD, Engine};
use sha2::{Digest, Sha256};
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

// ── Encryption ────────────────────────────────────────────────────────────────

/// Derives a 256-bit key from machine-specific identifiers.
/// The vault is intentionally non-portable: tied to this machine + OS user.
fn derive_key() -> [u8; 32] {
    let hostname = get_hostname();
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

#[cfg(target_os = "windows")]
fn get_hostname() -> String {
    std::env::var("COMPUTERNAME").unwrap_or_else(|_| "unknown-host".to_string())
}

#[cfg(not(target_os = "windows"))]
fn get_hostname() -> String {
    std::process::Command::new("hostname")
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .unwrap_or_else(|| "unknown-host".to_string())
        .trim()
        .to_string()
}

/// Encrypts plaintext with AES-256-GCM. Output is base64(nonce || ciphertext).
fn encrypt_vault(plaintext: &str) -> Result<String, String> {
    let key_bytes = derive_key();
    let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);

    let ciphertext = cipher
        .encrypt(&nonce, plaintext.as_bytes())
        .map_err(|e| format!("Vault encryption failed: {}", e))?;

    let mut combined = nonce.to_vec();
    combined.extend_from_slice(&ciphertext);
    Ok(STANDARD.encode(&combined))
}

/// Decrypts base64(nonce || ciphertext) back to plaintext.
fn decrypt_vault(encoded: &str) -> Result<String, String> {
    let combined = STANDARD
        .decode(encoded)
        .map_err(|e| format!("Vault base64 decode failed: {}", e))?;

    if combined.len() < 12 {
        return Err("Vault data too short to be valid".to_string());
    }

    let (nonce_bytes, ciphertext) = combined.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);

    let key_bytes = derive_key();
    let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);

    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| {
            "Vault decryption failed — data may be from a different machine or corrupted".to_string()
        })?;

    String::from_utf8(plaintext).map_err(|e| e.to_string())
}

// ── Storage ───────────────────────────────────────────────────────────────────

fn load_vault_data() -> HashMap<String, Vec<VaultSecret>> {
    let path = vault_path();
    if !path.exists() { return HashMap::new(); }

    let raw = match std::fs::read_to_string(&path) {
        Ok(s) => s,
        Err(_) => return HashMap::new(),
    };

    // Try encrypted format first (normal path)
    if let Ok(decrypted) = decrypt_vault(raw.trim()) {
        if let Ok(data) = serde_json::from_str(&decrypted) {
            return data;
        }
    }

    // Fall back to legacy plaintext format (auto-migrates on next write)
    if let Ok(data) = serde_json::from_str::<HashMap<String, Vec<VaultSecret>>>(&raw) {
        eprintln!("[hangar] Migrating vault from plaintext to encrypted format");
        let _ = save_vault_data(&data);
        return data;
    }

    HashMap::new()
}

fn save_vault_data(data: &HashMap<String, Vec<VaultSecret>>) -> Result<(), String> {
    ensure_dir();
    let plaintext = serde_json::to_string(data).map_err(|e| e.to_string())?;
    let encrypted = encrypt_vault(&plaintext)?;
    std::fs::write(vault_path(), encrypted).map_err(|e| e.to_string())
}

// ── Commands ──────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn vault_get_all() -> Vec<VaultProject> {
    let data = load_vault_data();
    data.into_iter().map(|(path, secrets)| {
        let name = path.split(['/', '\\']).last().unwrap_or(&path).to_string();
        VaultProject { project_path: path, project_name: name, secrets }
    }).collect()
}

#[tauri::command]
pub fn vault_add_secret(project_path: String, key: String, value: String, category: String) -> Result<(), String> {
    let mut data = load_vault_data();
    let secrets = data.entry(project_path).or_default();

    if let Some(existing) = secrets.iter_mut().find(|s| s.key == key) {
        existing.value = value;
        existing.category = category;
        existing.updated_at = now_ts();
    } else {
        secrets.push(VaultSecret {
            key, value, category,
            created_at: now_ts(),
            updated_at: now_ts(),
        });
    }
    save_vault_data(&data)
}

#[tauri::command]
pub fn vault_delete_secret(project_path: String, key: String) -> Result<(), String> {
    let mut data = load_vault_data();
    if let Some(secrets) = data.get_mut(&project_path) {
        secrets.retain(|s| s.key != key);
        if secrets.is_empty() { data.remove(&project_path); }
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
                    key, value, category,
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

    let env_files = [".env", ".env.local", ".env.development", ".env.production", ".env.example"];
    for name in &env_files {
        let file_path = dir.join(name);
        if !file_path.exists() { continue; }
        let Ok(content) = std::fs::read_to_string(&file_path) else { continue };
        for line in content.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') { continue; }
            if let Some((key, value)) = line.split_once('=') {
                let key = key.trim().to_string();
                let value = value.trim().trim_matches('"').trim_matches('\'').to_string();
                if key.is_empty() { continue; }
                let category = guess_category(&key);
                if is_sensitive(&key) {
                    found.push(VaultSecret {
                        key, value, category,
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
    if k.contains("SSH") || k.contains("PRIVATE_KEY") { "ssh_key".to_string() }
    else if k.contains("TOKEN") || k.contains("JWT") { "token".to_string() }
    else if k.contains("API") || k.contains("KEY") || k.contains("SECRET") { "api_key".to_string() }
    else { "env".to_string() }
}

fn is_sensitive(key: &str) -> bool {
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
