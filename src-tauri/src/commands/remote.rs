use std::path::Path;

use tauri::{AppHandle, Runtime};

use crate::error::GitError;
use crate::git::remote;
use crate::git::types::{OperationResult, RemoteInfo};

#[tauri::command]
pub async fn git_list_remotes(repo_path: String) -> Result<Vec<RemoteInfo>, GitError> {
    remote::list_remotes(Path::new(&repo_path)).await
}

#[tauri::command]
pub async fn git_add_remote(repo_path: String, name: String, url: String) -> Result<(), GitError> {
    remote::add_remote(Path::new(&repo_path), &name, &url).await
}

#[tauri::command]
pub async fn git_remove_remote(repo_path: String, name: String) -> Result<(), GitError> {
    remote::remove_remote(Path::new(&repo_path), &name).await
}

#[tauri::command]
pub async fn git_rename_remote(
    repo_path: String,
    old: String,
    new: String,
) -> Result<(), GitError> {
    remote::rename_remote(Path::new(&repo_path), &old, &new).await
}

#[tauri::command]
pub async fn git_fetch<R: Runtime>(
    app_handle: AppHandle<R>,
    repo_path: String,
    remote: Option<String>,
) -> Result<(), GitError> {
    remote::fetch(&app_handle, Path::new(&repo_path), remote.as_deref()).await
}

#[tauri::command]
pub async fn git_fetch_all<R: Runtime>(
    app_handle: AppHandle<R>,
    repo_path: String,
) -> Result<(), GitError> {
    remote::fetch_all(&app_handle, Path::new(&repo_path)).await
}

#[tauri::command]
pub async fn git_fetch_prune<R: Runtime>(
    app_handle: AppHandle<R>,
    repo_path: String,
) -> Result<(), GitError> {
    remote::fetch_prune(&app_handle, Path::new(&repo_path)).await
}

#[tauri::command]
pub async fn git_pull<R: Runtime>(
    app_handle: AppHandle<R>,
    repo_path: String,
    remote: Option<String>,
    branch: Option<String>,
) -> Result<OperationResult, GitError> {
    remote::pull(
        &app_handle,
        Path::new(&repo_path),
        remote.as_deref(),
        branch.as_deref(),
    )
    .await
}

#[tauri::command]
pub async fn git_pull_ff_only<R: Runtime>(
    app_handle: AppHandle<R>,
    repo_path: String,
    remote: Option<String>,
    branch: Option<String>,
) -> Result<OperationResult, GitError> {
    remote::pull_ff_only(
        &app_handle,
        Path::new(&repo_path),
        remote.as_deref(),
        branch.as_deref(),
    )
    .await
}

#[tauri::command]
pub async fn git_pull_rebase<R: Runtime>(
    app_handle: AppHandle<R>,
    repo_path: String,
    remote: Option<String>,
    branch: Option<String>,
) -> Result<OperationResult, GitError> {
    remote::pull_rebase(
        &app_handle,
        Path::new(&repo_path),
        remote.as_deref(),
        branch.as_deref(),
    )
    .await
}

#[tauri::command]
pub async fn git_push<R: Runtime>(
    app_handle: AppHandle<R>,
    repo_path: String,
    remote: Option<String>,
    branch: Option<String>,
    force: Option<bool>,
) -> Result<OperationResult, GitError> {
    remote::push(
        &app_handle,
        Path::new(&repo_path),
        remote.as_deref(),
        branch.as_deref(),
        force.unwrap_or(false),
    )
    .await
}

#[tauri::command]
pub async fn git_push_set_upstream<R: Runtime>(
    app_handle: AppHandle<R>,
    repo_path: String,
    remote: String,
    branch: String,
) -> Result<(), GitError> {
    remote::push_set_upstream(&app_handle, Path::new(&repo_path), &remote, &branch).await
}

#[tauri::command]
pub async fn git_sync<R: Runtime>(
    app_handle: AppHandle<R>,
    repo_path: String,
    remote: Option<String>,
    branch: Option<String>,
) -> Result<OperationResult, GitError> {
    remote::sync(
        &app_handle,
        Path::new(&repo_path),
        remote.as_deref(),
        branch.as_deref(),
    )
    .await
}
