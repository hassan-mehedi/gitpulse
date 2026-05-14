use std::path::Path;

use tokio::process::Command;

use crate::error::GitError;
use crate::git::runner::GitRunner;
use crate::git::types::OperationResult;

/// Run `git rebase -i <base>` with a pre-built todo list. We override
/// `GIT_SEQUENCE_EDITOR` so git copies our pre-built todo over the one
/// it generates. When the todo contains reword/squash entries, git invokes
/// `GIT_EDITOR`; the generated editor script consumes one queued message file
/// per invocation and writes it into git's commit-message buffer.
pub async fn rebase_interactive(
    repo_path: &Path,
    base_sha: &str,
    todo_lines: Vec<String>,
    messages: Vec<String>,
) -> Result<OperationResult, GitError> {
    let mut todo_path = std::env::temp_dir();
    let temp_id = format!(
        "gitpulse-rebase-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0)
    );
    todo_path.push(format!("{temp_id}-todo"));
    let body = format!("{}\n", todo_lines.join("\n"));
    std::fs::write(&todo_path, body).map_err(|err| GitError::Io(err.to_string()))?;

    let mut editor_script_path = std::env::temp_dir();
    editor_script_path.push(format!("{temp_id}-editor.sh"));
    let mut queue_path = std::env::temp_dir();
    queue_path.push(format!("{temp_id}-message-queue"));
    let mut message_paths = Vec::new();
    for (index, message) in messages.iter().enumerate() {
        let mut message_path = std::env::temp_dir();
        message_path.push(format!("{temp_id}-message-{index}"));
        std::fs::write(&message_path, format!("{message}\n"))
            .map_err(|err| GitError::Io(err.to_string()))?;
        message_paths.push(message_path);
    }
    if !message_paths.is_empty() {
        let queue = message_paths
            .iter()
            .map(|path| path.to_string_lossy().to_string())
            .collect::<Vec<_>>()
            .join("\n");
        std::fs::write(&queue_path, format!("{queue}\n"))
            .map_err(|err| GitError::Io(err.to_string()))?;
        let script = format!(
            "#!/bin/sh\nqueue={:?}\ntarget=\"$1\"\nif [ ! -s \"$queue\" ]; then\n  exit 0\nfi\nmessage_file=$(head -n 1 \"$queue\")\ntail -n +2 \"$queue\" > \"$queue.next\" && mv \"$queue.next\" \"$queue\"\ncat \"$message_file\" > \"$target\"\n",
            queue_path
        );
        std::fs::write(&editor_script_path, script).map_err(|err| GitError::Io(err.to_string()))?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut permissions = std::fs::metadata(&editor_script_path)
                .map_err(|err| GitError::Io(err.to_string()))?
                .permissions();
            permissions.set_mode(0o700);
            std::fs::set_permissions(&editor_script_path, permissions)
                .map_err(|err| GitError::Io(err.to_string()))?;
        }
    }

    let editor_cmd = format!("cp {:?}", todo_path);
    let commit_editor = if message_paths.is_empty() {
        ":".to_string()
    } else {
        editor_script_path.to_string_lossy().to_string()
    };
    let args = ["rebase", "-i", base_sha];

    let output = Command::new("git")
        .args(args)
        .current_dir(repo_path)
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("LC_ALL", "C")
        .env("GIT_SEQUENCE_EDITOR", &editor_cmd)
        .env("GIT_EDITOR", commit_editor)
        .output()
        .await
        .map_err(|err| GitError::Io(err.to_string()))?;

    let _ = std::fs::remove_file(&todo_path);
    let _ = std::fs::remove_file(&editor_script_path);
    let _ = std::fs::remove_file(&queue_path);
    for message_path in message_paths {
        let _ = std::fs::remove_file(message_path);
    }

    if output.status.success() {
        Ok(OperationResult {
            summary: format!("Rebased onto {base_sha}"),
        })
    } else {
        Err(GitError::CommandFailed {
            args: args.iter().map(|s| (*s).to_string()).collect(),
            stderr: String::from_utf8_lossy(&output.stderr).trim().to_string(),
            code: output.status.code(),
        })
    }
}

pub async fn rebase_continue(repo_path: &Path) -> Result<(), GitError> {
    let output = Command::new("git")
        .args(["rebase", "--continue"])
        .current_dir(repo_path)
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("LC_ALL", "C")
        .env("GIT_EDITOR", ":")
        .output()
        .await
        .map_err(|err| GitError::Io(err.to_string()))?;

    if output.status.success() {
        Ok(())
    } else {
        Err(GitError::CommandFailed {
            args: vec!["rebase".to_string(), "--continue".to_string()],
            stderr: String::from_utf8_lossy(&output.stderr).trim().to_string(),
            code: output.status.code(),
        })
    }
}

/// List commits between `base_sha` (exclusive) and HEAD (inclusive),
/// oldest first — the order they would appear in a rebase todo file.
pub async fn list_rebase_candidates(
    repo_path: &Path,
    base_sha: &str,
) -> Result<Vec<RebaseCandidate>, GitError> {
    let range = format!("{base_sha}..HEAD");
    let output = GitRunner::run(
        repo_path,
        &[
            "log",
            "--reverse",
            "--format=%H%x1f%h%x1f%s%x1f%an%x1f%aI",
            &range,
        ],
    )
    .await?;

    let mut result = Vec::new();
    for line in output.lines() {
        let parts: Vec<&str> = line.split('\u{1f}').collect();
        if parts.len() < 5 {
            continue;
        }
        result.push(RebaseCandidate {
            sha: parts[0].to_string(),
            short_sha: parts[1].to_string(),
            subject: parts[2].to_string(),
            author: parts[3].to_string(),
            date: parts[4].to_string(),
        });
    }
    Ok(result)
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct RebaseCandidate {
    pub sha: String,
    pub short_sha: String,
    pub subject: String,
    pub author: String,
    pub date: String,
}
