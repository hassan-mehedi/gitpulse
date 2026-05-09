use std::path::Path;

use crate::error::GitError;
use crate::git::status;
use crate::git::types::{DiffStat, FileDiff, RepoStatus};

#[tauri::command]
pub async fn git_status(repo_path: String) -> Result<RepoStatus, GitError> {
    status::status(Path::new(&repo_path)).await
}

#[tauri::command]
pub async fn git_diff_file(
    repo_path: String,
    file: String,
    staged: bool,
) -> Result<FileDiff, GitError> {
    status::diff_file(Path::new(&repo_path), &file, staged).await
}

#[tauri::command]
pub async fn git_diff_stat(repo_path: String) -> Result<DiffStat, GitError> {
    status::diff_stat(Path::new(&repo_path), false).await
}

#[tauri::command]
pub async fn git_diff_staged_stat(repo_path: String) -> Result<DiffStat, GitError> {
    status::diff_stat(Path::new(&repo_path), true).await
}
