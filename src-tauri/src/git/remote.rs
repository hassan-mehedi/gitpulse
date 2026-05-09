use std::path::Path;

use tauri::{AppHandle, Runtime};

use crate::error::GitError;
use crate::git::parser::parse_remotes;
use crate::git::runner::GitRunner;
use crate::git::types::{OperationResult, RemoteInfo};

pub async fn list_remotes(repo_path: &Path) -> Result<Vec<RemoteInfo>, GitError> {
    let output = GitRunner::run(repo_path, &["remote", "-v"]).await?;
    Ok(parse_remotes(&output))
}

pub async fn add_remote(repo_path: &Path, name: &str, url: &str) -> Result<(), GitError> {
    GitRunner::run(repo_path, &["remote", "add", name, url]).await?;
    Ok(())
}

pub async fn remove_remote(repo_path: &Path, name: &str) -> Result<(), GitError> {
    GitRunner::run(repo_path, &["remote", "remove", name]).await?;
    Ok(())
}

pub async fn rename_remote(repo_path: &Path, old: &str, new: &str) -> Result<(), GitError> {
    GitRunner::run(repo_path, &["remote", "rename", old, new]).await?;
    Ok(())
}

pub async fn fetch<R: Runtime>(
    app_handle: &AppHandle<R>,
    repo_path: &Path,
    remote: Option<&str>,
) -> Result<(), GitError> {
    let args = if let Some(remote) = remote {
        vec!["fetch", "--progress", remote]
    } else {
        vec!["fetch", "--progress"]
    };
    GitRunner::run_with_progress(app_handle, repo_path, "fetch", &args).await?;
    Ok(())
}

pub async fn fetch_all<R: Runtime>(
    app_handle: &AppHandle<R>,
    repo_path: &Path,
) -> Result<(), GitError> {
    GitRunner::run_with_progress(
        app_handle,
        repo_path,
        "fetch",
        &["fetch", "--all", "--progress"],
    )
    .await?;
    Ok(())
}

pub async fn fetch_prune<R: Runtime>(
    app_handle: &AppHandle<R>,
    repo_path: &Path,
) -> Result<(), GitError> {
    GitRunner::run_with_progress(
        app_handle,
        repo_path,
        "fetch",
        &["fetch", "--prune", "--progress"],
    )
    .await?;
    Ok(())
}

pub async fn pull<R: Runtime>(
    app_handle: &AppHandle<R>,
    repo_path: &Path,
    remote: Option<&str>,
    branch: Option<&str>,
) -> Result<OperationResult, GitError> {
    let mut args = vec!["pull", "--progress"];
    if let Some(remote) = remote {
        args.push(remote);
    }
    if let Some(branch) = branch {
        args.push(branch);
    }
    GitRunner::run_with_progress(app_handle, repo_path, "pull", &args).await?;
    Ok(OperationResult {
        summary: "Pull completed".to_string(),
    })
}

pub async fn pull_rebase<R: Runtime>(
    app_handle: &AppHandle<R>,
    repo_path: &Path,
    remote: Option<&str>,
    branch: Option<&str>,
) -> Result<OperationResult, GitError> {
    let mut args = vec!["pull", "--rebase", "--progress"];
    if let Some(remote) = remote {
        args.push(remote);
    }
    if let Some(branch) = branch {
        args.push(branch);
    }
    GitRunner::run_with_progress(app_handle, repo_path, "pull", &args).await?;
    Ok(OperationResult {
        summary: "Pull with rebase completed".to_string(),
    })
}

pub async fn push<R: Runtime>(
    app_handle: &AppHandle<R>,
    repo_path: &Path,
    remote: Option<&str>,
    branch: Option<&str>,
    force: bool,
) -> Result<OperationResult, GitError> {
    let mut args = vec!["push", "--progress"];
    if let Some(remote) = remote {
        args.push(remote);
    }
    if let Some(branch) = branch {
        args.push(branch);
    }
    if force {
        args.push("--force-with-lease");
    }
    GitRunner::run_with_progress(app_handle, repo_path, "push", &args).await?;
    Ok(OperationResult {
        summary: "Push completed".to_string(),
    })
}

pub async fn push_set_upstream<R: Runtime>(
    app_handle: &AppHandle<R>,
    repo_path: &Path,
    remote: &str,
    branch: &str,
) -> Result<(), GitError> {
    GitRunner::run_with_progress(
        app_handle,
        repo_path,
        "push",
        &["push", "--progress", "-u", remote, branch],
    )
    .await?;
    Ok(())
}

pub async fn sync<R: Runtime>(
    app_handle: &AppHandle<R>,
    repo_path: &Path,
    remote: Option<&str>,
    branch: Option<&str>,
) -> Result<OperationResult, GitError> {
    fetch_all(app_handle, repo_path).await?;
    pull_rebase(app_handle, repo_path, remote, branch).await?;
    push(app_handle, repo_path, remote, branch, false).await?;
    Ok(OperationResult {
        summary: "Sync completed".to_string(),
    })
}
