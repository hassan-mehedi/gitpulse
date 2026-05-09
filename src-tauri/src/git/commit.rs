use std::path::Path;

use crate::error::GitError;
use crate::git::parser::{parse_commit_result, parse_log};
use crate::git::runner::GitRunner;
use crate::git::types::{CommitInfo, CommitResult};

const LOG_FORMAT: &str = "%H%x1f%P%x1f%D%x1f%s%x1f%an%x1f%ae%x1f%aI";

pub async fn commit(repo_path: &Path, message: &str, all: bool) -> Result<CommitResult, GitError> {
    let args = if all {
        vec!["commit", "-a", "-m", message]
    } else {
        vec!["commit", "-m", message]
    };
    GitRunner::run(repo_path, &args).await?;
    let output = GitRunner::run(repo_path, &["rev-parse", "HEAD"]).await?;
    parse_commit_result(&output)
}

pub async fn amend(repo_path: &Path, message: Option<&str>) -> Result<CommitResult, GitError> {
    let args = if let Some(message) = message {
        vec!["commit", "--amend", "-m", message]
    } else {
        vec!["commit", "--amend", "--no-edit"]
    };
    GitRunner::run(repo_path, &args).await?;
    let output = GitRunner::run(repo_path, &["rev-parse", "HEAD"]).await?;
    parse_commit_result(&output)
}

pub async fn undo_last_commit(repo_path: &Path) -> Result<(), GitError> {
    GitRunner::run(repo_path, &["reset", "--soft", "HEAD~1"]).await?;
    Ok(())
}

pub async fn log(
    repo_path: &Path,
    n: usize,
    skip: Option<usize>,
    file: Option<&str>,
) -> Result<Vec<CommitInfo>, GitError> {
    let limit = n.to_string();
    let mut args = vec!["log", "--format=%H%x1f%P%x1f%D%x1f%s%x1f%an%x1f%ae%x1f%aI", "-n", &limit];
    let skip_value;
    if let Some(skip) = skip {
        skip_value = format!("--skip={skip}");
        args.push(&skip_value);
    }
    if let Some(file) = file {
        args.push("--");
        args.push(file);
    }
    let output = GitRunner::run(repo_path, &args).await?;
    Ok(parse_log(&output))
}

pub async fn show_commit_header(repo_path: &Path, sha: &str) -> Result<String, GitError> {
    let format = format!("--format={LOG_FORMAT}");
    GitRunner::run(repo_path, &["show", "--stat", &format, "--summary", sha]).await
}
