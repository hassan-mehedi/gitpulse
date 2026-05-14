use std::path::Path;

use crate::error::GitError;
use crate::git::runner::GitRunner;
use crate::git::types::{
    GitHookInfo, LfsLockInfo, LfsStatus, OperationResult, PrRemoteInfo, SubmoduleInfo,
};

pub async fn bisect(
    repo_path: &Path,
    action: &str,
    rev: Option<&str>,
) -> Result<OperationResult, GitError> {
    let mut args = vec!["bisect", action];
    if let Some(rev) = rev {
        if !rev.trim().is_empty() {
            args.push(rev);
        }
    }
    let output = GitRunner::run(repo_path, &args).await?;
    Ok(OperationResult {
        summary: output.trim().to_string(),
    })
}

pub async fn submodule_status(repo_path: &Path) -> Result<Vec<SubmoduleInfo>, GitError> {
    let output = GitRunner::run(repo_path, &["submodule", "status", "--recursive"])
        .await
        .unwrap_or_default();
    Ok(output
        .lines()
        .filter_map(|line| {
            let status = line.chars().next().unwrap_or(' ');
            let trimmed = line.trim_start_matches([' ', '-', '+', 'U']);
            let mut parts = trimmed.split_whitespace();
            Some(SubmoduleInfo {
                status: status.to_string(),
                sha: parts.next()?.to_string(),
                path: parts.next()?.to_string(),
                description: parts.collect::<Vec<_>>().join(" "),
            })
        })
        .collect())
}

pub async fn submodule_init(repo_path: &Path) -> Result<OperationResult, GitError> {
    GitRunner::run(repo_path, &["submodule", "init"]).await?;
    Ok(OperationResult {
        summary: "Submodules initialized".to_string(),
    })
}

pub async fn submodule_update(repo_path: &Path) -> Result<OperationResult, GitError> {
    GitRunner::run(repo_path, &["submodule", "update", "--recursive"]).await?;
    Ok(OperationResult {
        summary: "Submodules updated".to_string(),
    })
}

pub async fn sparse_list(repo_path: &Path) -> Result<Vec<String>, GitError> {
    let output = GitRunner::run(repo_path, &["sparse-checkout", "list"])
        .await
        .unwrap_or_default();
    Ok(output.lines().map(ToString::to_string).collect())
}

pub async fn sparse_set(
    repo_path: &Path,
    patterns: &[String],
) -> Result<OperationResult, GitError> {
    GitRunner::run(repo_path, &["sparse-checkout", "init", "--cone"]).await?;
    let mut args = vec!["sparse-checkout", "set"];
    for pattern in patterns {
        if !pattern.trim().is_empty() {
            args.push(pattern);
        }
    }
    GitRunner::run(repo_path, &args).await?;
    Ok(OperationResult {
        summary: "Sparse checkout updated".to_string(),
    })
}

pub async fn sparse_disable(repo_path: &Path) -> Result<OperationResult, GitError> {
    GitRunner::run(repo_path, &["sparse-checkout", "disable"]).await?;
    Ok(OperationResult {
        summary: "Sparse checkout disabled".to_string(),
    })
}

pub async fn lfs_status(repo_path: &Path) -> Result<LfsStatus, GitError> {
    let output = GitRunner::run(repo_path, &["lfs", "status"])
        .await
        .unwrap_or_else(|err| format!("{err}"));
    Ok(LfsStatus { output })
}

pub async fn lfs_locks(repo_path: &Path) -> Result<Vec<LfsLockInfo>, GitError> {
    let output = GitRunner::run(repo_path, &["lfs", "locks"])
        .await
        .unwrap_or_default();
    Ok(output
        .lines()
        .filter_map(|line| {
            let parts = line.split_whitespace().collect::<Vec<_>>();
            if parts.len() < 2 {
                return None;
            }
            Some(LfsLockInfo {
                path: parts[0].to_string(),
                owner: parts.get(1).copied().unwrap_or("").to_string(),
                id: parts
                    .last()
                    .copied()
                    .unwrap_or("")
                    .trim_matches(['(', ')'])
                    .to_string(),
            })
        })
        .collect())
}

pub async fn lfs_lock(repo_path: &Path, file: &str) -> Result<OperationResult, GitError> {
    GitRunner::run(repo_path, &["lfs", "lock", file]).await?;
    Ok(OperationResult {
        summary: format!("Locked {file}"),
    })
}

pub async fn lfs_unlock(repo_path: &Path, file: &str) -> Result<OperationResult, GitError> {
    GitRunner::run(repo_path, &["lfs", "unlock", file]).await?;
    Ok(OperationResult {
        summary: format!("Unlocked {file}"),
    })
}

pub async fn hooks(repo_path: &Path) -> Result<Vec<GitHookInfo>, GitError> {
    let git_dir = GitRunner::run(repo_path, &["rev-parse", "--git-path", "hooks"]).await?;
    let mut hooks_path = repo_path.to_path_buf();
    hooks_path.push(git_dir.trim());
    let entries = std::fs::read_dir(hooks_path).map_err(|err| GitError::Io(err.to_string()))?;
    let mut hooks = Vec::new();
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.ends_with(".sample") {
            continue;
        }
        let metadata = entry.metadata().ok();
        hooks.push(GitHookInfo {
            name,
            path: entry.path().display().to_string(),
            executable: metadata
                .map(|m| !m.permissions().readonly())
                .unwrap_or(false),
        });
    }
    hooks.sort_by(|left, right| left.name.cmp(&right.name));
    Ok(hooks)
}

pub async fn hook_read(repo_path: &Path, name: &str) -> Result<String, GitError> {
    let git_dir = GitRunner::run(repo_path, &["rev-parse", "--git-path", "hooks"]).await?;
    let mut path = repo_path.to_path_buf();
    path.push(git_dir.trim());
    path.push(name);
    std::fs::read_to_string(path).map_err(|err| GitError::Io(err.to_string()))
}

pub async fn patch_create(repo_path: &Path, staged: bool) -> Result<String, GitError> {
    let args = if staged {
        vec!["diff", "--cached", "--patch"]
    } else {
        vec!["diff", "--patch"]
    };
    GitRunner::run(repo_path, &args).await
}

pub async fn patch_apply(repo_path: &Path, patch: &str) -> Result<OperationResult, GitError> {
    GitRunner::run_with_input(repo_path, &["apply", "-"], patch).await?;
    Ok(OperationResult {
        summary: "Patch applied".to_string(),
    })
}

pub async fn remote_set_url(
    repo_path: &Path,
    remote: &str,
    url: &str,
    push: bool,
) -> Result<OperationResult, GitError> {
    let args = if push {
        vec!["remote", "set-url", "--push", remote, url]
    } else {
        vec!["remote", "set-url", remote, url]
    };
    GitRunner::run(repo_path, &args).await?;
    Ok(OperationResult {
        summary: format!("Updated remote {remote}"),
    })
}

pub async fn pr_remotes(repo_path: &Path) -> Result<Vec<PrRemoteInfo>, GitError> {
    let output = GitRunner::run(repo_path, &["remote", "-v"])
        .await
        .unwrap_or_default();
    let mut remotes = Vec::new();
    for line in output.lines().filter(|line| line.contains("(fetch)")) {
        let parts = line.split_whitespace().collect::<Vec<_>>();
        if parts.len() < 2 {
            continue;
        }
        let url = parts[1].to_string();
        let provider = if url.contains("github.com") {
            "GitHub"
        } else if url.contains("gitlab.com") {
            "GitLab"
        } else {
            "Unknown"
        };
        remotes.push(PrRemoteInfo {
            remote: parts[0].to_string(),
            url,
            provider: provider.to_string(),
        });
    }
    Ok(remotes)
}
