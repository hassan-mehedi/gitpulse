use std::path::{Component, Path};

use crate::error::GitError;
use crate::git::runner::GitRunner;

#[tauri::command]
pub async fn git_discard_file(repo_path: String, file: String) -> Result<(), GitError> {
    GitRunner::run(Path::new(&repo_path), &["checkout", "--", &file]).await?;
    Ok(())
}

#[tauri::command]
pub async fn git_discard_all(repo_path: String) -> Result<(), GitError> {
    GitRunner::run(Path::new(&repo_path), &["checkout", "--", "."]).await?;
    Ok(())
}

#[tauri::command]
pub async fn git_discard_lines(
    repo_path: String,
    file: String,
    patch: String,
) -> Result<(), GitError> {
    let _ = file;
    GitRunner::run_with_input(
        Path::new(&repo_path),
        &["apply", "--reverse", "--unidiff-zero", "-"],
        &patch,
    )
    .await?;
    Ok(())
}

#[tauri::command]
pub async fn git_clean_untracked(repo_path: String, paths: Vec<String>) -> Result<(), GitError> {
    validate_clean_paths(&paths)?;
    let mut args = vec!["--literal-pathspecs", "clean", "-fd", "--"];
    for path in &paths {
        args.push(path);
    }
    GitRunner::run(Path::new(&repo_path), &args).await?;
    Ok(())
}

fn validate_clean_paths(paths: &[String]) -> Result<(), GitError> {
    if paths.is_empty() {
        return Err(GitError::Parse(
            "refusing to clean without an explicit path".to_string(),
        ));
    }

    for path in paths {
        let candidate = Path::new(path);
        if candidate.as_os_str().is_empty() || candidate.is_absolute() {
            return Err(invalid_clean_path(path));
        }

        let mut has_normal_component = false;
        for component in candidate.components() {
            match component {
                Component::Normal(_) => has_normal_component = true,
                Component::CurDir => {}
                Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                    return Err(invalid_clean_path(path));
                }
            }
        }

        if !has_normal_component {
            return Err(invalid_clean_path(path));
        }
    }

    Ok(())
}

fn invalid_clean_path(path: &str) -> GitError {
    GitError::Parse(format!("refusing to clean unsafe path: {path}"))
}

#[cfg(test)]
mod tests {
    use super::validate_clean_paths;

    #[test]
    fn rejects_missing_or_escaping_clean_paths() {
        for paths in [
            Vec::<String>::new(),
            vec!["".to_string()],
            vec!["/tmp/file".to_string()],
            vec!["../outside".to_string()],
            vec!["nested/../../outside".to_string()],
            vec![".".to_string()],
        ] {
            assert!(validate_clean_paths(&paths).is_err());
        }
    }

    #[test]
    fn accepts_repo_relative_clean_paths_including_pathspec_like_names() {
        for path in [
            "file.txt",
            "nested/file.txt",
            "./nested/file.txt",
            ":(glob)**",
        ] {
            assert!(
                validate_clean_paths(&[path.to_string()]).is_ok(),
                "{path} should be a valid repo-relative path"
            );
        }
    }
}
