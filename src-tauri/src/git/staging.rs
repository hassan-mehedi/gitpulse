use std::io::Write;
use std::path::Path;

use crate::error::GitError;
use crate::git::runner::GitRunner;

pub async fn stage_file(repo_path: &Path, file: &str) -> Result<(), GitError> {
    GitRunner::run(repo_path, &["add", "--", file]).await?;
    Ok(())
}

pub async fn stage_files(repo_path: &Path, files: &[String]) -> Result<(), GitError> {
    let mut args = vec!["add", "--"];
    for file in files {
        args.push(file.as_str());
    }
    GitRunner::run(repo_path, &args).await?;
    Ok(())
}

pub async fn stage_all(repo_path: &Path) -> Result<(), GitError> {
    GitRunner::run(repo_path, &["add", "-A"]).await?;
    Ok(())
}

pub async fn stage_dir(repo_path: &Path, dir: &str) -> Result<(), GitError> {
    let target = format!("{dir}/");
    GitRunner::run(repo_path, &["add", "--", &target]).await?;
    Ok(())
}

pub async fn stage_lines(repo_path: &Path, patch: &str) -> Result<(), GitError> {
    GitRunner::run_with_input(
        repo_path,
        &["apply", "--cached", "--unidiff-zero", "-"],
        patch,
    )
    .await?;
    Ok(())
}

pub async fn unstage_file(repo_path: &Path, file: &str) -> Result<(), GitError> {
    GitRunner::run(repo_path, &["reset", "HEAD", "--", file]).await?;
    Ok(())
}

pub async fn unstage_all(repo_path: &Path) -> Result<(), GitError> {
    GitRunner::run(repo_path, &["reset", "HEAD"]).await?;
    Ok(())
}

pub async fn unstage_lines(repo_path: &Path, patch: &str) -> Result<(), GitError> {
    GitRunner::run_with_input(
        repo_path,
        &["apply", "--cached", "--reverse", "--unidiff-zero", "-"],
        patch,
    )
    .await?;
    Ok(())
}

pub async fn add_to_gitignore(repo_path: &Path, file: &str) -> Result<(), GitError> {
    let mut ignore_path = repo_path.to_path_buf();
    ignore_path.push(".gitignore");
    let entry = file.trim().trim_start_matches("./");
    if entry.is_empty() {
        return Ok(());
    }

    let current = std::fs::read_to_string(&ignore_path).unwrap_or_default();
    if current.lines().any(|line| line.trim() == entry) {
        return Ok(());
    }

    let needs_newline = !current.is_empty() && !current.ends_with('\n');
    let mut file_handle = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&ignore_path)
        .map_err(|err| GitError::Io(err.to_string()))?;
    if needs_newline {
        writeln!(file_handle).map_err(|err| GitError::Io(err.to_string()))?;
    }
    writeln!(file_handle, "{entry}").map_err(|err| GitError::Io(err.to_string()))?;
    Ok(())
}
