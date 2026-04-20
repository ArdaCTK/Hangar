use aes_gcm::{
    aead::{rand_core::RngCore, Aead, AeadCore, KeyInit, OsRng},
    Aes256Gcm, Key, Nonce,
};
use base64::{engine::general_purpose::STANDARD, Engine};
use pbkdf2::pbkdf2_hmac;
use sha2::{Digest, Sha256};

use crate::commands::utils::get_machine_hostname;

const SALT_LEN: usize = 16;
const NONCE_LEN: usize = 12;
const PBKDF2_ITERS: u32 = 210_000;

pub fn encrypt_with_machine_binding(purpose: &str, plaintext: &str) -> Result<String, String> {
    let mut salt = [0u8; SALT_LEN];
    OsRng.fill_bytes(&mut salt);

    let key_bytes = derive_key(purpose, &salt);
    let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);

    let ciphertext = cipher
        .encrypt(&nonce, plaintext.as_bytes())
        .map_err(|e| format!("Encryption failed: {}", e))?;

    let mut combined = Vec::with_capacity(SALT_LEN + NONCE_LEN + ciphertext.len());
    combined.extend_from_slice(&salt);
    combined.extend_from_slice(nonce.as_slice());
    combined.extend_from_slice(&ciphertext);

    Ok(format!("v2:{}", STANDARD.encode(combined)))
}

pub fn decrypt_with_machine_binding(purpose: &str, encoded: &str) -> Result<String, String> {
    let payload = encoded.strip_prefix("v2:").unwrap_or(encoded);
    let combined = STANDARD
        .decode(payload)
        .map_err(|e| format!("Base64 decode failed: {}", e))?;

    if combined.len() < SALT_LEN + NONCE_LEN {
        return Err("Encrypted payload is too short".to_string());
    }

    let (salt, rest) = combined.split_at(SALT_LEN);
    let (nonce_bytes, ciphertext) = rest.split_at(NONCE_LEN);
    let key_bytes = derive_key(purpose, salt);
    let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);
    let nonce = Nonce::from_slice(nonce_bytes);

    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| "Decryption failed — vault may be from a different machine or corrupted".to_string())?;

    String::from_utf8(plaintext).map_err(|e| e.to_string())
}

fn derive_key(purpose: &str, salt: &[u8]) -> [u8; 32] {
    let username = std::env::var("USERNAME")
        .or_else(|_| std::env::var("USER"))
        .unwrap_or_else(|_| "hangar-user".to_string());

    // FIX: get_machine_hostname() artık sysinfo OS API'lerini kullanıyor;
    // önceki Command::new("hostname") subprocess PATH manipülasyonuna açıktı.
    let hostname = get_machine_hostname();

    let mut hasher = Sha256::new();
    hasher.update(b"hangar-secure-store-v2:");
    hasher.update(purpose.as_bytes());
    hasher.update(b":");
    hasher.update(hostname.as_bytes());
    hasher.update(b":");
    hasher.update(username.as_bytes());
    let seed = hasher.finalize();

    let mut key = [0u8; 32];
    pbkdf2_hmac::<Sha256>(&seed, salt, PBKDF2_ITERS, &mut key);
    key
}
