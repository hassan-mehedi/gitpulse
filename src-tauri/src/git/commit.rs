use std::path::Path;

use crate::error::GitError;
use crate::git::parser::{parse_commit_result, parse_log};
use crate::git::runner::GitRunner;
use crate::git::types::{CommitIdentity, CommitInfo, CommitResult, OperationResult};

const LOG_FORMAT: &str = "%H%x1f%P%x1f%D%x1f%s%x1f%an%x1f%ae%x1f%cI%x1f%G?";

pub async fn commit(
    repo_path: &Path,
    message: &str,
    all: bool,
    sign: bool,
    identity: Option<&CommitIdentity>,
) -> Result<CommitResult, GitError> {
    let mut args: Vec<String> = identity_args(identity);
    args.push("commit".to_string());
    if all {
        args.push("-a".to_string());
    }
    if sign {
        args.push("-S".to_string());
    }
    args.extend(["-m".to_string(), message.to_string()]);
    run_dynamic(repo_path, &args).await?;
    let output = GitRunner::run(repo_path, &["rev-parse", "HEAD"]).await?;
    parse_commit_result(&output)
}

pub async fn amend(
    repo_path: &Path,
    message: Option<&str>,
    sign: bool,
    identity: Option<&CommitIdentity>,
) -> Result<CommitResult, GitError> {
    let mut args: Vec<String> = identity_args(identity);
    args.extend(["commit".to_string(), "--amend".to_string()]);
    if sign {
        args.push("-S".to_string());
    }
    if let Some(message) = message {
        args.extend(["-m".to_string(), message.to_string()]);
    } else {
        args.push("--no-edit".to_string());
    }
    run_dynamic(repo_path, &args).await?;
    let output = GitRunner::run(repo_path, &["rev-parse", "HEAD"]).await?;
    parse_commit_result(&output)
}

pub async fn undo_last_commit(repo_path: &Path) -> Result<(), GitError> {
    GitRunner::run(repo_path, &["reset", "--soft", "HEAD~1"]).await?;
    Ok(())
}

pub async fn revert(repo_path: &Path, sha: &str) -> Result<OperationResult, GitError> {
    GitRunner::run(repo_path, &["revert", "--no-edit", sha]).await?;
    Ok(OperationResult {
        summary: format!("Reverted {sha}"),
    })
}

pub async fn reset(repo_path: &Path, sha: &str, mode: &str) -> Result<OperationResult, GitError> {
    let flag = match mode {
        "soft" => "--soft",
        "mixed" => "--mixed",
        "hard" => "--hard",
        _ => return Err(GitError::Parse(format!("unsupported reset mode: {mode}"))),
    };
    GitRunner::run(repo_path, &["reset", flag, sha]).await?;
    Ok(OperationResult {
        summary: format!("Reset {mode} to {sha}"),
    })
}

pub async fn log(
    repo_path: &Path,
    n: usize,
    skip: Option<usize>,
    file: Option<&str>,
) -> Result<Vec<CommitInfo>, GitError> {
    let limit = n.to_string();
    let mut args = vec![
        "log",
        "--format=%H%x1f%P%x1f%D%x1f%s%x1f%an%x1f%ae%x1f%cI%x1f%G?",
        "-n",
        &limit,
    ];
    let skip_value;
    if let Some(skip) = skip {
        skip_value = format!("--skip={skip}");
        args.push(&skip_value);
    }
    if let Some(file) = file {
        args.push("--follow");
        args.push("--");
        args.push(file);
    }
    let output = GitRunner::run(repo_path, &args).await?;
    Ok(parse_log(&output))
}

pub async fn show_commit_header(repo_path: &Path, sha: &str) -> Result<String, GitError> {
    let format = format!("--format={LOG_FORMAT}%n%b");
    GitRunner::run(repo_path, &["show", "--stat", &format, "--summary", sha]).await
}

fn identity_args(identity: Option<&CommitIdentity>) -> Vec<String> {
    match identity {
        Some(identity) => vec![
            "-c".to_string(),
            format!("user.name={}", identity.name),
            "-c".to_string(),
            format!("user.email={}", identity.email),
        ],
        None => Vec::new(),
    }
}

async fn run_dynamic(repo_path: &Path, args: &[String]) -> Result<String, GitError> {
    let arg_refs = args.iter().map(String::as_str).collect::<Vec<_>>();
    GitRunner::run(repo_path, &arg_refs).await
}
