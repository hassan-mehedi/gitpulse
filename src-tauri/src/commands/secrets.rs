use crate::error::GitError;

const SERVICE: &str = "com.gitpulse.app.ai";

#[tauri::command]
pub async fn ai_get_api_key(provider: String) -> Result<Option<String>, GitError> {
    tauri::async_runtime::spawn_blocking(move || {
        let entry = keyring::Entry::new(SERVICE, &provider)
            .map_err(|error| GitError::Io(error.to_string()))?;
        match entry.get_password() {
            Ok(value) => Ok(Some(value)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(error) => Err(GitError::Io(error.to_string())),
        }
    })
    .await
    .map_err(|error| GitError::Io(error.to_string()))?
}

#[tauri::command]
pub async fn ai_set_api_key(provider: String, api_key: String) -> Result<(), GitError> {
    tauri::async_runtime::spawn_blocking(move || {
        let entry = keyring::Entry::new(SERVICE, &provider)
            .map_err(|error| GitError::Io(error.to_string()))?;
        if api_key.trim().is_empty() {
            return match entry.delete_credential() {
                Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
                Err(error) => Err(GitError::Io(error.to_string())),
            };
        }
        entry
            .set_password(&api_key)
            .map_err(|error| GitError::Io(error.to_string()))
    })
    .await
    .map_err(|error| GitError::Io(error.to_string()))?
}
