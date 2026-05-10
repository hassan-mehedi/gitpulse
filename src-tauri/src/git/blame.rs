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
