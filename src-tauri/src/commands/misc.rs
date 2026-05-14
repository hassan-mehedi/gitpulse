use std::path::Path;

use crate::error::GitError;
use crate::git::misc;
use crate::git::types::{
    GitHookInfo, LfsLockInfo, LfsStatus, OperationResult, PrRemoteInfo, SubmoduleInfo,
};

#[tauri::command]
pub async fn git_bisect(
    repo_path: String,
    action: String,
    rev: Option<String>,
) -> Result<OperationResult, GitError> {
    misc::bisect(Path::new(&repo_path), &action, rev.as_deref()).await
}

#[tauri::command]
pub async fn git_submodule_status(repo_path: String) -> Result<Vec<SubmoduleInfo>, GitError> {
    misc::submodule_status(Path::new(&repo_path)).await
}

#[tauri::command]
pub async fn git_submodule_init(repo_path: String) -> Result<OperationResult, GitError> {
    misc::submodule_init(Path::new(&repo_path)).await
}

#[tauri::command]
pub async fn git_submodule_update(repo_path: String) -> Result<OperationResult, GitError> {
    misc::submodule_update(Path::new(&repo_path)).await
}

#[tauri::command]
pub async fn git_sparse_list(repo_path: String) -> Result<Vec<String>, GitError> {
    misc::sparse_list(Path::new(&repo_path)).await
}

#[tauri::command]
pub async fn git_sparse_set(
    repo_path: String,
    patterns: Vec<String>,
) -> Result<OperationResult, GitError> {
    misc::sparse_set(Path::new(&repo_path), &patterns).await
}

#[tauri::command]
pub async fn git_sparse_disable(repo_path: String) -> Result<OperationResult, GitError> {
    misc::sparse_disable(Path::new(&repo_path)).await
}

#[tauri::command]
pub async fn git_lfs_status(repo_path: String) -> Result<LfsStatus, GitError> {
    misc::lfs_status(Path::new(&repo_path)).await
}

#[tauri::command]
pub async fn git_lfs_locks(repo_path: String) -> Result<Vec<LfsLockInfo>, GitError> {
    misc::lfs_locks(Path::new(&repo_path)).await
}

#[tauri::command]
pub async fn git_lfs_lock(repo_path: String, file: String) -> Result<OperationResult, GitError> {
    misc::lfs_lock(Path::new(&repo_path), &file).await
}

#[tauri::command]
pub async fn git_lfs_unlock(repo_path: String, file: String) -> Result<OperationResult, GitError> {
    misc::lfs_unlock(Path::new(&repo_path), &file).await
}

#[tauri::command]
pub async fn git_hooks(repo_path: String) -> Result<Vec<GitHookInfo>, GitError> {
    misc::hooks(Path::new(&repo_path)).await
}

#[tauri::command]
pub async fn git_hook_read(repo_path: String, name: String) -> Result<String, GitError> {
    misc::hook_read(Path::new(&repo_path), &name).await
}

#[tauri::command]
pub async fn git_patch_create(repo_path: String, staged: bool) -> Result<String, GitError> {
    misc::patch_create(Path::new(&repo_path), staged).await
}

#[tauri::command]
pub async fn git_patch_apply(
    repo_path: String,
    patch: String,
) -> Result<OperationResult, GitError> {
    misc::patch_apply(Path::new(&repo_path), &patch).await
}

#[tauri::command]
pub async fn git_remote_set_url(
    repo_path: String,
    remote: String,
    url: String,
    push: bool,
) -> Result<OperationResult, GitError> {
    misc::remote_set_url(Path::new(&repo_path), &remote, &url, push).await
}

#[tauri::command]
pub async fn git_pr_remotes(repo_path: String) -> Result<Vec<PrRemoteInfo>, GitError> {
    misc::pr_remotes(Path::new(&repo_path)).await
}
