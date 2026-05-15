use std::path::Path;

use crate::error::GitError;
use crate::git::parser::{parse_log, parse_reflog};
use crate::git::runner::GitRunner;
use crate::git::types::{CommitInfo, ReflogEntry};

pub async fn graph(
    repo_path: &Path,
    max_count: Option<usize>,
    include_all: Option<bool>,
    file: Option<&str>,
) -> Result<Vec<CommitInfo>, GitError> {
    let limit = max_count.unwrap_or(500).to_string();
    let mut args: Vec<&str> = vec!["log"];
    if include_all.unwrap_or(false) {
        args.push("--all");
    }
    args.extend_from_slice(&[
        "--date-order",
        "--format=%H%x1f%P%x1f%D%x1f%s%x1f%an%x1f%ae%x1f%cI%x1f%G?",
        "-n",
        &limit,
    ]);
    if let Some(file) = file {
        args.push("--");
        args.push(file);
    }
    let output = GitRunner::run(repo_path, &args).await?;
    Ok(parse_log(&output))
}

pub async fn ref_log(repo_path: &Path, n: Option<usize>) -> Result<Vec<ReflogEntry>, GitError> {
    let limit = n.unwrap_or(50).to_string();
    let output = GitRunner::run(
        repo_path,
        &[
            "reflog",
            "--format=%gd%x1f%H%x1f%gs%x1f%an%x1f%aI",
            "-n",
            &limit,
        ],
    )
    .await?;
    Ok(parse_reflog(&output))
}
