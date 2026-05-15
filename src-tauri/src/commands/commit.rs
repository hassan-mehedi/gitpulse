use std::path::Path;

use crate::error::GitError;
use crate::git::commit;
use crate::git::types::{CommitIdentity, CommitInfo, CommitResult, OperationResult};

#[tauri::command]
pub async fn git_commit(
    repo_path: String,
    message: String,
    sign: Option<bool>,
    identity: Option<CommitIdentity>,
) -> Result<CommitResult, GitError> {
    commit::commit(
        Path::new(&repo_path),
        &message,
        false,
        sign.unwrap_or(false),
        identity.as_ref(),
    )
    .await
}

#[tauri::command]
pub async fn git_commit_all(
    repo_path: String,
    message: String,
    sign: Option<bool>,
    identity: Option<CommitIdentity>,
) -> Result<CommitResult, GitError> {
    commit::commit(
        Path::new(&repo_path),
        &message,
        true,
        sign.unwrap_or(false),
        identity.as_ref(),
    )
    .await
}

#[tauri::command]
pub async fn git_commit_amend(
    repo_path: String,
    message: Option<String>,
    sign: Option<bool>,
    identity: Option<CommitIdentity>,
) -> Result<CommitResult, GitError> {
    commit::amend(
        Path::new(&repo_path),
        message.as_deref(),
        sign.unwrap_or(false),
        identity.as_ref(),
    )
    .await
}

#[tauri::command]
pub async fn git_undo_last_commit(repo_path: String) -> Result<(), GitError> {
    commit::undo_last_commit(Path::new(&repo_path)).await
}

#[tauri::command]
pub async fn git_revert_commit(
    repo_path: String,
    sha: String,
) -> Result<OperationResult, GitError> {
    commit::revert(Path::new(&repo_path), &sha).await
}

#[tauri::command]
pub async fn git_reset_to_commit(
    repo_path: String,
    sha: String,
    mode: String,
) -> Result<OperationResult, GitError> {
    commit::reset(Path::new(&repo_path), &sha, &mode).await
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
