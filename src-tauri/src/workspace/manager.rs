use std::path::Path;
use std::sync::Mutex;

use tauri::{AppHandle, Runtime};

use crate::error::GitError;
use crate::git::status;
use crate::git::types::{Repository, WorkspaceState};
use crate::workspace::watcher::{create_watchers, RepoDebouncer};

pub struct WorkspaceManager {
    inner: Mutex<WorkspaceState>,
    watchers: Mutex<Vec<RepoDebouncer>>,
}

impl Default for WorkspaceManager {
    fn default() -> Self {
        Self {
            inner: Mutex::new(WorkspaceState::default()),
            watchers: Mutex::new(Vec::new()),
        }
    }
}

impl WorkspaceManager {
    pub async fn open_single_repo<R: Runtime>(
        &self,
        app_handle: &AppHandle<R>,
        path: &Path,
    ) -> Result<WorkspaceState, GitError> {
        let repo = scan_repo(path).await?;
        let state = WorkspaceState {
            mode: "single".to_string(),
            workspace_file_path: None,
            active_repo_id: Some(repo.id.clone()),
            repositories: vec![repo],
        };
        self.set_workspace(app_handle, state)
    }

    pub async fn open_multi_repo<R: Runtime>(
        &self,
        app_handle: &AppHandle<R>,
        root: &Path,
    ) -> Result<WorkspaceState, GitError> {
        let mut repositories = Vec::new();
        for entry in std::fs::read_dir(root)? {
            let entry = entry?;
            if entry.file_type()?.is_dir() {
                let path = entry.path();
                if is_git_repo(&path).await {
                    repositories.push(scan_repo(&path).await?);
                }
            }
        }

        repositories.sort_by(|left, right| left.name.cmp(&right.name));
        let active_repo_id = repositories.first().map(|repo| repo.id.clone());
        let state = WorkspaceState {
            mode: "multi".to_string(),
            workspace_file_path: None,
            active_repo_id,
            repositories,
        };
        self.set_workspace(app_handle, state)
    }

    pub fn open_workspace_file<R: Runtime>(
        &self,
        app_handle: &AppHandle<R>,
        workspace_file_path: String,
        repositories: Vec<Repository>,
    ) -> Result<WorkspaceState, GitError> {
        let active_repo_id = repositories.first().map(|repo| repo.id.clone());
        let state = WorkspaceState {
            mode: "workspace-file".to_string(),
            workspace_file_path: Some(workspace_file_path),
            repositories,
            active_repo_id,
        };
        self.set_workspace(app_handle, state)
    }

    pub fn append_repositories<R: Runtime>(
        &self,
        app_handle: &AppHandle<R>,
        repositories: Vec<Repository>,
    ) -> Result<WorkspaceState, GitError> {
        let current = self.current()?;
        let mut merged = current.repositories.clone();

        for repository in repositories {
            if let Some(existing) = merged
                .iter_mut()
                .find(|entry| entry.path == repository.path)
            {
                *existing = repository;
            } else {
                merged.push(repository);
            }
        }

        let active_repo_id = if current
            .active_repo_id
            .as_ref()
            .is_some_and(|active_id| merged.iter().any(|repo| &repo.id == active_id))
        {
            current.active_repo_id
        } else {
            merged.first().map(|repo| repo.id.clone())
        };

        let state = WorkspaceState {
            mode: if merged.len() <= 1 {
                "single".to_string()
            } else {
                "multi".to_string()
            },
            workspace_file_path: None,
            repositories: merged,
            active_repo_id,
        };

        self.set_workspace(app_handle, state)
    }

    pub fn current(&self) -> Result<WorkspaceState, GitError> {
        let guard = self
            .inner
            .lock()
            .map_err(|err| GitError::Io(err.to_string()))?;
        Ok(guard.clone())
    }

    fn set_workspace<R: Runtime>(
        &self,
        app_handle: &AppHandle<R>,
        state: WorkspaceState,
    ) -> Result<WorkspaceState, GitError> {
        let repo_paths = state
            .repositories
            .iter()
            .map(|repo| repo.path.clone())
            .collect::<Vec<_>>();
        let next_watchers = create_watchers(app_handle, &repo_paths)?;

        let mut watchers = self
            .watchers
            .lock()
            .map_err(|err| GitError::Io(err.to_string()))?;
        *watchers = next_watchers;

        let mut guard = self
            .inner
            .lock()
            .map_err(|err| GitError::Io(err.to_string()))?;
        *guard = state;
        Ok(guard.clone())
    }
}

pub async fn scan_repo(path: &Path) -> Result<Repository, GitError> {
    let repo_status = status::status(path).await?;
    let path_string = path.canonicalize()?.display().to_string();
    let id = hash_path(&path_string);
    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("repository")
        .to_string();

    Ok(Repository {
        id,
        name,
        path: path_string,
        branch: repo_status.branch,
        upstream: repo_status.upstream,
        ahead: repo_status.ahead,
        behind: repo_status.behind,
        stash_count: repo_status.stash_count,
        changes: repo_status.changes,
        staged: repo_status.staged,
        has_conflicts: repo_status.has_conflicts,
    })
}

pub async fn is_git_repo(path: &Path) -> bool {
    tokio::process::Command::new("git")
        .arg("rev-parse")
        .arg("--git-dir")
        .current_dir(path)
        .output()
        .await
        .map(|output| output.status.success())
        .unwrap_or(false)
}

pub async fn collect_multi_repos(root: &Path) -> Result<Vec<Repository>, GitError> {
    let mut repositories = Vec::new();
    for entry in std::fs::read_dir(root)? {
        let entry = entry?;
        if entry.file_type()?.is_dir() {
            let path = entry.path();
            if is_git_repo(&path).await {
                repositories.push(scan_repo(&path).await?);
            }
        }
    }

    repositories.sort_by(|left, right| left.name.cmp(&right.name));
    Ok(repositories)
}

fn hash_path(path: &str) -> String {
    use std::hash::{Hash, Hasher};

    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    path.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}
