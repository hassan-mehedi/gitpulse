use std::path::Path;

use crate::error::GitError;
use crate::git::stash;
use crate::git::types::{FileDiff, OperationResult, StashEntry};

#[tauri::command]
pub async fn git_stash_list(repo_path: String) -> Result<Vec<StashEntry>, GitError> {
    stash::list(Path::new(&repo_path)).await
}

#[tauri::command]
pub async fn git_stash_push(
    repo_path: String,
    message: Option<String>,
    include_untracked: Option<bool>,
) -> Result<OperationResult, GitError> {
    stash::push(
        Path::new(&repo_path),
        message.as_deref(),
        include_untracked.unwrap_or(false),
    )
    .await
}

#[tauri::command]
pub async fn git_stash_pop(
    repo_path: String,
    stash_ref: Option<String>,
) -> Result<OperationResult, GitError> {
    stash::pop(Path::new(&repo_path), stash_ref.as_deref()).await
}

#[tauri::command]
pub async fn git_stash_apply(
    repo_path: String,
    stash_ref: Option<String>,
) -> Result<OperationResult, GitError> {
    stash::apply(Path::new(&repo_path), stash_ref.as_deref()).await
}

#[tauri::command]
pub async fn git_stash_drop(
    repo_path: String,
    stash_ref: String,
) -> Result<OperationResult, GitError> {
    stash::drop(Path::new(&repo_path), &stash_ref).await
}

#[tauri::command]
pub async fn git_stash_show(
    repo_path: String,
    stash_ref: String,
) -> Result<Vec<FileDiff>, GitError> {
    stash::show(Path::new(&repo_path), &stash_ref).await
}

#[tauri::command]
pub async fn git_stash_clear(repo_path: String) -> Result<OperationResult, GitError> {
    stash::clear(Path::new(&repo_path)).await
}
