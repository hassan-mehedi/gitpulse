use std::path::Path;

use crate::error::GitError;
use crate::git::diff::parse_multi_file_diff;
use crate::git::parser::parse_stashes;
use crate::git::runner::GitRunner;
use crate::git::types::{FileDiff, OperationResult, StashEntry};

pub async fn list(repo_path: &Path) -> Result<Vec<StashEntry>, GitError> {
    let format = "%gd%x1f%H%x1f%gs%x1f%ci%x1f%an";
    let output = GitRunner::run(repo_path, &["stash", "list", "--format", format]).await?;
    Ok(parse_stashes(&output))
}

pub async fn push(
    repo_path: &Path,
    message: Option<&str>,
    include_untracked: bool,
) -> Result<OperationResult, GitError> {
    let mut args = vec!["stash", "push"];
    if include_untracked {
        args.push("--include-untracked");
    }
    if let Some(message) = message.filter(|value| !value.trim().is_empty()) {
        args.push("-m");
        args.push(message);
    }

    GitRunner::run(repo_path, &args).await?;
    Ok(OperationResult {
        summary: "Saved working tree changes to stash".to_string(),
    })
}

pub async fn pop(repo_path: &Path, stash_ref: Option<&str>) -> Result<OperationResult, GitError> {
    let mut args = vec!["stash", "pop"];
    if let Some(stash_ref) = stash_ref {
        args.push(stash_ref);
    }

    GitRunner::run(repo_path, &args).await?;
    Ok(OperationResult {
        summary: format!("Popped {}", stash_ref.unwrap_or("latest stash")),
    })
}

pub async fn apply(repo_path: &Path, stash_ref: Option<&str>) -> Result<OperationResult, GitError> {
    let mut args = vec!["stash", "apply"];
    if let Some(stash_ref) = stash_ref {
        args.push(stash_ref);
    }

    GitRunner::run(repo_path, &args).await?;
    Ok(OperationResult {
        summary: format!("Applied {}", stash_ref.unwrap_or("latest stash")),
    })
}

pub async fn drop(repo_path: &Path, stash_ref: &str) -> Result<OperationResult, GitError> {
    GitRunner::run(repo_path, &["stash", "drop", stash_ref]).await?;
    Ok(OperationResult {
        summary: format!("Dropped {stash_ref}"),
    })
}

pub async fn show(repo_path: &Path, stash_ref: &str) -> Result<Vec<FileDiff>, GitError> {
    let output = GitRunner::run(repo_path, &["stash", "show", "-p", stash_ref]).await?;
    parse_multi_file_diff(&output)
}

pub async fn clear(repo_path: &Path) -> Result<OperationResult, GitError> {
    GitRunner::run(repo_path, &["stash", "clear"]).await?;
    Ok(OperationResult {
        summary: "Cleared all stashes".to_string(),
    })
}
