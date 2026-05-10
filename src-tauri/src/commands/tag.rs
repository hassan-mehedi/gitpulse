use std::path::Path;

use crate::error::GitError;
use crate::git::tag;
use crate::git::types::{OperationResult, TagInfo};

#[tauri::command]
pub async fn git_list_tags(repo_path: String) -> Result<Vec<TagInfo>, GitError> {
    tag::list(Path::new(&repo_path)).await
}

#[tauri::command]
pub async fn git_create_tag(
    repo_path: String,
    name: String,
    sha: Option<String>,
    message: Option<String>,
) -> Result<OperationResult, GitError> {
    tag::create(Path::new(&repo_path), &name, sha.as_deref(), message.as_deref()).await
}

#[tauri::command]
pub async fn git_delete_tag(repo_path: String, name: String) -> Result<OperationResult, GitError> {
    tag::delete(Path::new(&repo_path), &name).await
}

#[tauri::command]
pub async fn git_push_tag(
    repo_path: String,
    remote: String,
    name: String,
) -> Result<OperationResult, GitError> {
    tag::push(Path::new(&repo_path), &remote, &name).await
}
