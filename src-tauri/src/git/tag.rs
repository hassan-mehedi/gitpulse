use std::path::Path;

use crate::error::GitError;
use crate::git::parser::parse_tags;
use crate::git::runner::GitRunner;
use crate::git::types::{OperationResult, TagInfo};

pub async fn list(repo_path: &Path) -> Result<Vec<TagInfo>, GitError> {
    // `tag -l --format` uses for-each-ref syntax, so the hex escape is `%XX`
    // (not `%xXX` like `git log --format`). Using `%x1f` here ships the literal
    // text "%x1f" in the output, which breaks `parse_tags`.
    let format =
        "%(refname:short)%1f%(objectname)%1f%(subject)%1f%(objecttype)%1f%(taggername)%1f%(creatordate:iso8601)";
    let output = GitRunner::run(repo_path, &["tag", "-l", "--format", format]).await?;
    Ok(parse_tags(&output))
}

pub async fn create(
    repo_path: &Path,
    name: &str,
    sha: Option<&str>,
    message: Option<&str>,
) -> Result<OperationResult, GitError> {
    let mut args = vec!["tag"];
    if let Some(message) = message.filter(|value| !value.trim().is_empty()) {
        args.push("-a");
        args.push("-m");
        args.push(message);
    }
    args.push(name);
    if let Some(sha) = sha {
        args.push(sha);
    }

    GitRunner::run(repo_path, &args).await?;
    Ok(OperationResult {
        summary: format!("Created tag {name}"),
    })
}

pub async fn delete(repo_path: &Path, name: &str) -> Result<OperationResult, GitError> {
    GitRunner::run(repo_path, &["tag", "-d", name]).await?;
    Ok(OperationResult {
        summary: format!("Deleted tag {name}"),
    })
}

pub async fn push(repo_path: &Path, remote: &str, name: &str) -> Result<OperationResult, GitError> {
    GitRunner::run(repo_path, &["push", remote, name]).await?;
    Ok(OperationResult {
        summary: format!("Pushed tag {name} to {remote}"),
    })
}
