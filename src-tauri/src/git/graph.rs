use std::path::Path;

use crate::error::GitError;
use crate::git::parser::{parse_log, parse_reflog};
use crate::git::runner::GitRunner;
use crate::git::types::{CommitInfo, ReflogEntry};

pub async fn graph(
    repo_path: &Path,
    max_count: Option<usize>,
) -> Result<Vec<CommitInfo>, GitError> {
    let limit = max_count.unwrap_or(120).to_string();
    let output = GitRunner::run(
        repo_path,
        &[
            "log",
            "--all",
            "--topo-order",
            "--format=%H%x1f%P%x1f%D%x1f%s%x1f%an%x1f%ae%x1f%aI",
            "-n",
            &limit,
        ],
    )
    .await?;
    Ok(parse_log(&output))
}

pub async fn ref_log(
    repo_path: &Path,
    n: Option<usize>,
) -> Result<Vec<ReflogEntry>, GitError> {
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
