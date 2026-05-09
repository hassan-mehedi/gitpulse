use std::path::Path;

use crate::error::GitError;
use crate::git::commit;
use crate::git::types::{CommitInfo, CommitResult};

#[tauri::command]
pub async fn git_commit(repo_path: String, message: String) -> Result<CommitResult, GitError> {
    commit::commit(Path::new(&repo_path), &message, false).await
}

#[tauri::command]
pub async fn git_commit_all(repo_path: String, message: String) -> Result<CommitResult, GitError> {
    commit::commit(Path::new(&repo_path), &message, true).await
}

#[tauri::command]
pub async fn git_commit_amend(
    repo_path: String,
    message: Option<String>,
) -> Result<CommitResult, GitError> {
    commit::amend(Path::new(&repo_path), message.as_deref()).await
}

#[tauri::command]
pub async fn git_undo_last_commit(repo_path: String) -> Result<(), GitError> {
    commit::undo_last_commit(Path::new(&repo_path)).await
}

#[tauri::command]
pub async fn git_log(
    repo_path: String,
    n: usize,
    skip: Option<usize>,
    file: Option<String>,
) -> Result<Vec<CommitInfo>, GitError> {
    commit::log(Path::new(&repo_path), n, skip, file.as_deref()).await
}
