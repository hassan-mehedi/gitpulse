use std::path::Path;

use crate::error::GitError;
use crate::git::diff;
use crate::git::types::{CommitDetail, FileDiff};

#[tauri::command]
pub async fn git_show_commit(repo_path: String, sha: String) -> Result<CommitDetail, GitError> {
    diff::show_commit(Path::new(&repo_path), &sha).await
}

#[tauri::command]
pub async fn git_commit_diff(repo_path: String, sha: String) -> Result<Vec<FileDiff>, GitError> {
    diff::commit_diff(Path::new(&repo_path), &sha).await
}

#[tauri::command]
pub async fn git_diff_refs(
    repo_path: String,
    from: String,
    to: String,
) -> Result<Vec<FileDiff>, GitError> {
    diff::diff_refs(Path::new(&repo_path), &from, &to).await
}

#[tauri::command]
pub async fn git_diff_merge_base(
    repo_path: String,
    ref1: String,
    ref2: String,
) -> Result<Vec<FileDiff>, GitError> {
    diff::diff_merge_base(Path::new(&repo_path), &ref1, &ref2).await
}

#[tauri::command]
pub async fn git_file_bytes(
    repo_path: String,
    file: String,
    revision: Option<String>,
) -> Result<Vec<u8>, GitError> {
    diff::file_bytes(Path::new(&repo_path), &file, revision.as_deref()).await
}
