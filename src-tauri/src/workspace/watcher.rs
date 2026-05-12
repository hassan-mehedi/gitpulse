use std::path::{Path, PathBuf};
use std::time::Duration;

use ignore::WalkBuilder;
use notify_debouncer_full::notify::RecursiveMode;
use notify_debouncer_full::{new_debouncer, DebouncedEvent, Debouncer, RecommendedCache};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Runtime};

use crate::error::GitError;

pub type RepoDebouncer =
    Debouncer<notify_debouncer_full::notify::RecommendedWatcher, RecommendedCache>;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoEventPayload {
    pub repo_path: String,
}

/// Directory basenames we never watch regardless of .gitignore.
/// These are dependency / build artifact directories that explode the inotify
/// watch count on Linux and bloat notify's path-dedup cache.
const ALWAYS_IGNORED_DIRS: &[&str] = &[
    "node_modules",
    "target",
    "dist",
    "build",
    ".next",
    ".venv",
    "venv",
    ".tox",
    ".cache",
    "__pycache__",
    ".pytest_cache",
];

pub fn create_watchers<R: Runtime>(
    app_handle: &AppHandle<R>,
    repo_paths: &[String],
) -> Result<Vec<RepoDebouncer>, GitError> {
    let mut watchers = Vec::new();

    for repo_path in repo_paths {
        let repo_root = PathBuf::from(repo_path);
        let repo_root_for_events = repo_root.clone();
        let app_handle = app_handle.clone();

        let mut debouncer = new_debouncer(
            Duration::from_millis(300),
            None,
            move |events: Result<
                Vec<DebouncedEvent>,
                Vec<notify_debouncer_full::notify::Error>,
            >| {
                if let Ok(events) = events {
                    for event in events {
                        emit_repo_event(&app_handle, &repo_root_for_events, &event);
                    }
                }
            },
        )
        .map_err(|err| GitError::Io(err.to_string()))?;

        // Walk the repo tree honoring .gitignore + ALWAYS_IGNORED_DIRS, registering a
        // non-recursive watch on each surviving directory. This bypasses notify's
        // default recursive watch — which on a self-hosted repo would walk
        // node_modules/ and target/ and consume tens of thousands of inotify watches.
        let walker = WalkBuilder::new(&repo_root)
            .hidden(false) // we want .git/HEAD and .git/refs/remotes/* events
            .git_ignore(true)
            .git_exclude(true)
            .git_global(true)
            .filter_entry(|entry| !is_always_ignored(entry.path()))
            .build();

        for entry in walker.flatten() {
            let path = entry.path();
            let is_dir = entry
                .file_type()
                .map(|file_type| file_type.is_dir())
                .unwrap_or(false);
            if !is_dir {
                continue;
            }

            // Skip .git/objects and .git/logs (too noisy, filtered downstream anyway)
            if let Ok(rel) = path.strip_prefix(&repo_root) {
                let rel_str = rel.to_string_lossy();
                if rel_str.starts_with(".git/objects")
                    || rel_str.starts_with(".git/logs")
                    || rel_str == ".git/objects"
                    || rel_str == ".git/logs"
                {
                    continue;
                }
            }

            // Best-effort: a failed watch on a single directory shouldn't abort
            // the whole watcher (e.g. an inotify limit hit mid-tree).
            let _ = debouncer.watch(path, RecursiveMode::NonRecursive);
        }

        watchers.push(debouncer);
    }

    Ok(watchers)
}

fn is_always_ignored(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .map(|name| ALWAYS_IGNORED_DIRS.contains(&name))
        .unwrap_or(false)
}

fn emit_repo_event<R: Runtime>(
    app_handle: &AppHandle<R>,
    repo_root: &Path,
    event: &DebouncedEvent,
) {
    if is_ignored_event(event) {
        return;
    }

    let payload = RepoEventPayload {
        repo_path: repo_root.display().to_string(),
    };

    let event_name = if touches_head(event) {
        "repo:head-changed"
    } else if touches_remote_refs(event) {
        "repo:remotes-changed"
    } else {
        "repo:status-changed"
    };

    let _ = app_handle.emit(event_name, payload);
}

fn is_ignored_event(event: &DebouncedEvent) -> bool {
    event.paths.iter().any(|path| {
        let path = path.to_string_lossy();
        path.contains("/.git/objects/") || path.contains("/.git/logs/")
    })
}

fn touches_head(event: &DebouncedEvent) -> bool {
    event
        .paths
        .iter()
        .any(|path| path.to_string_lossy().ends_with("/.git/HEAD"))
}

fn touches_remote_refs(event: &DebouncedEvent) -> bool {
    event
        .paths
        .iter()
        .any(|path| path.to_string_lossy().contains("/.git/refs/remotes/"))
}
