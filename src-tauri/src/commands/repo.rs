use std::path::Path;

use crate::error::GitError;
use crate::git::runner::GitRunner;
use crate::git::types::{Repository, UserInfo};
use crate::workspace::manager::scan_repo;

#[tauri::command]
pub async fn git_detect_repo(path: String) -> Result<bool, GitError> {
    let output = tokio::process::Command::new("git")
        .arg("rev-parse")
        .arg("--git-dir")
        .current_dir(&path)
        .output()
        .await?;
    Ok(output.status.success())
}

#[tauri::command]
pub async fn git_init(path: String) -> Result<Repository, GitError> {
    let repo_path = Path::new(&path);
    GitRunner::run(repo_path, &["init"]).await?;
    scan_repo(repo_path).await
}

#[tauri::command]
pub async fn git_clone(url: String, dest: String) -> Result<Repository, GitError> {
    let dest_path = Path::new(&dest);
    let parent = dest_path
        .parent()
        .ok_or_else(|| GitError::Io("destination path has no parent".to_string()))?;
    let dest_name = dest_path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| GitError::Io("destination path is invalid".to_string()))?;
    GitRunner::run(parent, &["clone", &url, dest_name]).await?;
    scan_repo(dest_path).await
}

#[tauri::command]
pub async fn git_get_config(repo_path: String, key: String) -> Result<Option<String>, GitError> {
    match GitRunner::run(Path::new(&repo_path), &["config", "--get", &key]).await {
        Ok(value) => Ok(Some(value.trim().to_string())),
        Err(GitError::CommandFailed { code: Some(1), .. }) => Ok(None),
        Err(error) => Err(error),
    }
}

#[tauri::command]
pub async fn git_set_config(repo_path: String, key: String, value: String) -> Result<(), GitError> {
    GitRunner::run(Path::new(&repo_path), &["config", &key, &value]).await?;
    Ok(())
}

#[tauri::command]
pub async fn git_get_user_info(repo_path: String) -> Result<UserInfo, GitError> {
    let repo_path = Path::new(&repo_path);
    let name = match GitRunner::run(repo_path, &["config", "user.name"]).await {
        Ok(value) => Some(value.trim().to_string()),
        Err(_) => None,
    };
    let email = match GitRunner::run(repo_path, &["config", "user.email"]).await {
        Ok(value) => Some(value.trim().to_string()),
        Err(_) => None,
    };

    Ok(UserInfo { name, email })
}
