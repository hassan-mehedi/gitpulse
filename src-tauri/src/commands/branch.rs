use std::path::Path;

use crate::error::GitError;
use crate::git::branch;
use crate::git::types::{BranchInfo, OperationResult};

#[tauri::command]
pub async fn git_branches(repo_path: String) -> Result<Vec<BranchInfo>, GitError> {
    branch::branches(Path::new(&repo_path)).await
}

#[tauri::command]
pub async fn git_current_branch(repo_path: String) -> Result<String, GitError> {
    branch::current_branch(Path::new(&repo_path)).await
}

#[tauri::command]
pub async fn git_create_branch(
    repo_path: String,
    name: String,
    source: Option<String>,
) -> Result<(), GitError> {
    branch::create_branch(Path::new(&repo_path), &name, source.as_deref()).await
}

#[tauri::command]
pub async fn git_switch_branch(repo_path: String, name: String) -> Result<(), GitError> {
    branch::switch_branch(Path::new(&repo_path), &name).await
}

#[tauri::command]
pub async fn git_rename_branch(
    repo_path: String,
    old: String,
    new: String,
) -> Result<(), GitError> {
    branch::rename_branch(Path::new(&repo_path), &old, &new).await
}

#[tauri::command]
pub async fn git_delete_branch(
    repo_path: String,
    name: String,
    force: Option<bool>,
) -> Result<(), GitError> {
    branch::delete_branch(Path::new(&repo_path), &name, force.unwrap_or(false)).await
}

#[tauri::command]
pub async fn git_merge(repo_path: String, branch: String) -> Result<OperationResult, GitError> {
    branch::merge(Path::new(&repo_path), &branch).await
}

#[tauri::command]
pub async fn git_rebase(repo_path: String, onto: String) -> Result<OperationResult, GitError> {
    branch::rebase(Path::new(&repo_path), &onto).await
}

#[tauri::command]
pub async fn git_abort_merge(repo_path: String) -> Result<(), GitError> {
    branch::abort_merge(Path::new(&repo_path)).await
}

#[tauri::command]
pub async fn git_abort_rebase(repo_path: String) -> Result<(), GitError> {
    branch::abort_rebase(Path::new(&repo_path)).await
}
