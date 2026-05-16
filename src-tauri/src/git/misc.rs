use std::path::Path;

use crate::error::GitError;
use crate::git::runner::GitRunner;
use crate::git::types::{
    GitHookInfo, LfsLockInfo, LfsStatus, OperationResult, PatchApplyResult, PatchCreateResult,
    PrRemoteInfo, SparseCheckoutStatus, SubmoduleInfo,
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

pub async fn sparse_list(repo_path: &Path) -> Result<SparseCheckoutStatus, GitError> {
    match GitRunner::run(repo_path, &["sparse-checkout", "list"]).await {
        Ok(output) => Ok(SparseCheckoutStatus {
            enabled: true,
            patterns: output.lines().map(ToString::to_string).collect(),
        }),
        Err(_) => Ok(SparseCheckoutStatus {
            enabled: false,
            patterns: Vec::new(),
        }),
    }
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
    match GitRunner::run(repo_path, &["lfs", "status"]).await {
        Ok(output) => Ok(parse_lfs_status(&output, true)),
        Err(error) => Ok(parse_lfs_status(&format!("{error}"), false)),
    }
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

fn parse_lfs_status(output: &str, command_succeeded: bool) -> LfsStatus {
    let normalized = output.trim();
    let unavailable = normalized.contains("git: 'lfs' is not a git command")
        || normalized.to_ascii_lowercase().contains("git-lfs")
            && normalized.to_ascii_lowercase().contains("not found");
    LfsStatus {
        available: command_succeeded && !unavailable,
        pending_push_count: parse_lfs_count(normalized, "Objects to be pushed"),
        pending_pull_count: parse_lfs_count(normalized, "Objects to be pulled"),
        output: output.to_string(),
    }
}

fn parse_lfs_count(output: &str, prefix: &str) -> Option<usize> {
    output.lines().find_map(|line| {
        let trimmed = line.trim();
        if !trimmed.starts_with(prefix) {
            return None;
        }
        trimmed
            .rsplit_once(':')
            .and_then(|(_, value)| value.trim().parse().ok())
    })
}

#[cfg(test)]
mod lfs_tests {
    use super::{parse_lfs_status, patch_stats};

    #[test]
    fn parses_structured_lfs_counts() {
        let status = parse_lfs_status(
            "Objects to be pushed to origin/main: 3\nObjects to be pulled from origin/main: 1",
            true,
        );

        assert!(status.available);
        assert_eq!(status.pending_push_count, Some(3));
        assert_eq!(status.pending_pull_count, Some(1));
    }

    #[test]
    fn marks_missing_lfs_as_unavailable() {
        let status = parse_lfs_status("git: 'lfs' is not a git command", false);

        assert!(!status.available);
        assert_eq!(status.pending_push_count, None);
        assert_eq!(status.pending_pull_count, None);
    }

    #[test]
    fn counts_patch_files_and_hunks() {
        let patch = "diff --git a/a b/a\n@@\n+one\ndiff --git a/b b/b\n@@\n+two\n@@\n+three";
        assert_eq!(patch_stats(patch), (2, 3));
    }
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

pub async fn patch_create(repo_path: &Path, staged: bool) -> Result<PatchCreateResult, GitError> {
    let args = if staged {
        vec!["diff", "--cached", "--patch"]
    } else {
        vec!["diff", "--patch"]
    };
    let patch = GitRunner::run(repo_path, &args).await?;
    let (file_count, hunk_count) = patch_stats(&patch);
    Ok(PatchCreateResult {
        patch,
        file_count,
        hunk_count,
        staged,
    })
}

pub async fn patch_apply(repo_path: &Path, patch: &str) -> Result<PatchApplyResult, GitError> {
    GitRunner::run_with_input(repo_path, &["apply", "-"], patch).await?;
    let (file_count, hunk_count) = patch_stats(patch);
    Ok(PatchApplyResult {
        summary: "Patch applied".to_string(),
        file_count,
        hunk_count,
    })
}

fn patch_stats(patch: &str) -> (usize, usize) {
    (
        patch
            .lines()
            .filter(|line| line.starts_with("diff --git "))
            .count(),
        patch.lines().filter(|line| line.starts_with("@@")).count(),
    )
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
