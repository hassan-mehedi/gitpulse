use std::path::Path;

use crate::error::GitError;
use crate::git::types::{OperationResult, WorktreeInfo};
use crate::git::worktree;

#[tauri::command]
pub async fn git_list_worktrees(repo_path: String) -> Result<Vec<WorktreeInfo>, GitError> {
    worktree::list(Path::new(&repo_path)).await
}

#[tauri::command]
pub async fn git_add_worktree(
    repo_path: String,
    path: String,
    branch: Option<String>,
) -> Result<WorktreeInfo, GitError> {
    worktree::add(Path::new(&repo_path), &path, branch.as_deref()).await
}

#[tauri::command]
pub async fn git_remove_worktree(
    repo_path: String,
    path: String,
) -> Result<OperationResult, GitError> {
    worktree::remove(Path::new(&repo_path), &path).await
}

#[tauri::command]
pub async fn git_prune_worktrees(repo_path: String) -> Result<OperationResult, GitError> {
    worktree::prune(Path::new(&repo_path)).await
}
