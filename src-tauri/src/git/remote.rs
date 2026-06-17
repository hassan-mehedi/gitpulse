use std::path::Path;

use tauri::{AppHandle, Runtime};
use tokio::process::Command;

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

pub async fn pull_ff_only<R: Runtime>(
    app_handle: &AppHandle<R>,
    repo_path: &Path,
    remote: Option<&str>,
    branch: Option<&str>,
) -> Result<OperationResult, GitError> {
    let mut args = vec!["pull", "--ff-only", "--progress"];
    if let Some(remote) = remote {
        args.push(remote);
    }
    if let Some(branch) = branch {
        args.push(branch);
    }
    GitRunner::run_with_progress(app_handle, repo_path, "pull", &args).await?;
    Ok(OperationResult {
        summary: "Fast-forward pull completed".to_string(),
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
    if remote.is_none()
        && branch.is_none()
        && !force
        && current_upstream(repo_path).await?.is_none()
    {
        let branch = current_branch(repo_path).await?.ok_or_else(|| {
            GitError::Io(
                "Cannot publish a detached HEAD without specifying a remote and branch."
                    .to_string(),
            )
        })?;
        let remote = default_push_remote(repo_path).await?;
        push_set_upstream(app_handle, repo_path, &remote, &branch).await?;
        return Ok(OperationResult {
            summary: format!("Published {branch} to {remote}"),
        });
    }

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
    if remote.is_none() && branch.is_none() && current_upstream(repo_path).await?.is_none() {
        let branch = current_branch(repo_path).await?.ok_or_else(|| {
            GitError::Io(
                "Cannot sync a detached HEAD without specifying a remote and branch.".to_string(),
            )
        })?;
        let remote = default_push_remote(repo_path).await?;
        fetch_all(app_handle, repo_path).await?;
        push_set_upstream(app_handle, repo_path, &remote, &branch).await?;
        return Ok(OperationResult {
            summary: format!("Published {branch} to {remote}"),
        });
    }

    fetch_all(app_handle, repo_path).await?;
    pull_rebase(app_handle, repo_path, remote, branch).await?;
    push(app_handle, repo_path, remote, branch, false).await?;
    Ok(OperationResult {
        summary: "Sync completed".to_string(),
    })
}

async fn current_branch(repo_path: &Path) -> Result<Option<String>, GitError> {
    let output = git_output(repo_path, &["branch", "--show-current"]).await?;
    Ok(output
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty()))
}

async fn current_upstream(repo_path: &Path) -> Result<Option<String>, GitError> {
    let output = git_output(
        repo_path,
        &["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"],
    )
    .await?;
    Ok(output
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty()))
}

async fn default_push_remote(repo_path: &Path) -> Result<String, GitError> {
    let remotes = list_remotes(repo_path).await?;
    if let Some(remote) = select_default_push_remote(&remotes) {
        return Ok(remote);
    }
    Err(GitError::Io(
        "No Git remote is configured. Add a remote before publishing this branch.".to_string(),
    ))
}

fn select_default_push_remote(remotes: &[RemoteInfo]) -> Option<String> {
    remotes
        .iter()
        .find(|remote| remote.name == "origin")
        .or_else(|| {
            remotes
                .iter()
                .find(|remote| !remote.push_url.is_empty() || !remote.fetch_url.is_empty())
        })
        .map(|remote| remote.name.clone())
}

async fn git_output(repo_path: &Path, args: &[&str]) -> Result<Option<String>, GitError> {
    let output = Command::new("git")
        .args(args)
        .current_dir(repo_path)
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("LC_ALL", "C")
        .output()
        .await
        .map_err(|err| GitError::Io(err.to_string()))?;

    if !output.status.success() {
        return Ok(None);
    }

    Ok(Some(String::from_utf8_lossy(&output.stdout).to_string()))
}

#[cfg(test)]
mod tests {
    use super::select_default_push_remote;
    use crate::git::types::RemoteInfo;

    fn remote(name: &str, fetch_url: &str, push_url: &str) -> RemoteInfo {
        RemoteInfo {
            name: name.to_string(),
            fetch_url: fetch_url.to_string(),
            push_url: push_url.to_string(),
        }
    }

    #[test]
    fn publish_remote_prefers_origin() {
        let remotes = [
            remote("upstream", "git@example.com:upstream/repo.git", ""),
            remote("origin", "git@example.com:me/repo.git", ""),
        ];

        assert_eq!(
            select_default_push_remote(&remotes).as_deref(),
            Some("origin")
        );
    }

    #[test]
    fn publish_remote_falls_back_to_first_remote_with_url() {
        let remotes = [
            remote("empty", "", ""),
            remote("fork", "", "git@example.com:me/repo.git"),
        ];

        assert_eq!(
            select_default_push_remote(&remotes).as_deref(),
            Some("fork")
        );
    }

    #[test]
    fn publish_remote_returns_none_without_configured_urls() {
        let remotes = [remote("empty", "", "")];

        assert_eq!(select_default_push_remote(&remotes), None);
    }
}
