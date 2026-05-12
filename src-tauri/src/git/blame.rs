use std::path::Path;

use crate::error::GitError;
use crate::git::parser::parse_blame;
use crate::git::runner::GitRunner;
use crate::git::types::BlameLine;

pub async fn blame(
    repo_path: &Path,
    file: &str,
    ignore_whitespace: bool,
) -> Result<Vec<BlameLine>, GitError> {
    let mut args = vec!["blame", "--porcelain"];
    if ignore_whitespace {
        args.push("-w");
    }
    args.push("--");
    args.push(file);
    let output = GitRunner::run(repo_path, &args).await?;
    parse_blame(&output)
}

/// Blame for a single line range. Much cheaper than blaming the whole file when
/// the caller only needs one line (e.g. inline status-bar blame on cursor move).
pub async fn blame_line(
    repo_path: &Path,
    file: &str,
    line: usize,
) -> Result<Option<BlameLine>, GitError> {
    let range = format!("{line},{line}");
    let args = vec!["blame", "--porcelain", "-L", &range, "--", file];
    let output = GitRunner::run(repo_path, &args).await?;
    let mut lines = parse_blame(&output)?;
    Ok(lines.pop())
}
