import { create } from "zustand";
import { addRepositoryTarget, gitDiffFile, gitStatus, gitSync, openRepositoryTarget } from "../lib/git";
import { createId } from "../lib/ids";
import type { FileDiff, FileChange, GitError, Repository, WorkspaceState } from "../types/git";
import { useDiffStore } from "./diff";
import { useInlineBlameStore } from "./inlineBlame";
import { useNotificationStore } from "./notifications";
import { useSettingsStore } from "./settings";

interface WorkspaceStore extends WorkspaceState {
  isLoading: boolean;
  initialize: () => Promise<void>;
  loadTarget: (path: string) => Promise<void>;
  addTarget: (path: string) => Promise<void>;
  setActiveRepo: (repoId: string) => void;
  refreshRepo: (repoPath: string) => Promise<void>;
  openDiff: (repo: Repository, change: FileChange, staged: boolean) => Promise<void>;
}

const emptyState: WorkspaceState = {
  mode: "single",
  repositories: [],
  activeRepoId: null
};

function detailFromError(error: unknown) {
  const gitError = error as GitError;
  return gitError.message ?? gitError.stderr ?? gitError.kind ?? String(error);
}

function notifyWorkspaceError(title: string, error: unknown) {
  useNotificationStore.getState().pushNotification({
    id: createId(),
    tone: "error",
    title,
    message: detailFromError(error)
  });
}

// Per-repo refresh dedup: collapses bursts of refresh calls (e.g. one from the user
// action followed by 2-3 from the filesystem watcher firing for the same git op).
// If a refresh is in flight for a path, subsequent calls reuse the same promise.
// If a request arrives while a refresh is running, a single trailing refresh is
// scheduled for after it completes.
const refreshInFlight = new Map<string, Promise<void>>();
const refreshPending = new Set<string>();
const lastSyncToastByRepo = new Map<string, string>();

function statusEqual(prev: Repository, nextStatus: Awaited<ReturnType<typeof gitStatus>>) {
  if (
    prev.branch !== nextStatus.branch ||
    prev.headSha !== nextStatus.headSha ||
    prev.upstream !== nextStatus.upstream ||
    prev.ahead !== nextStatus.ahead ||
    prev.behind !== nextStatus.behind ||
    prev.stashCount !== nextStatus.stashCount ||
    prev.hasConflicts !== nextStatus.hasConflicts ||
    prev.changes.length !== nextStatus.changes.length ||
    prev.staged.length !== nextStatus.staged.length
  ) {
    return false;
  }
  for (let i = 0; i < prev.changes.length; i++) {
    const a = prev.changes[i];
    const b = nextStatus.changes[i];
    if (a.path !== b.path || a.status !== b.status || a.staged !== b.staged) {
      return false;
    }
  }
  for (let i = 0; i < prev.staged.length; i++) {
    const a = prev.staged[i];
    const b = nextStatus.staged[i];
    if (a.path !== b.path || a.status !== b.status || a.staged !== b.staged) {
      return false;
    }
  }
  return true;
}

function maybeNotifySyncStatus(repo: Repository, nextStatus: Awaited<ReturnType<typeof gitStatus>>) {
  const key = `${nextStatus.ahead}/${nextStatus.behind}`;
  if (nextStatus.ahead === 0 && nextStatus.behind === 0) {
    lastSyncToastByRepo.delete(repo.path);
    return;
  }
  if (
    repo.ahead === nextStatus.ahead &&
    repo.behind === nextStatus.behind &&
    lastSyncToastByRepo.get(repo.path) === key
  ) {
    return;
  }

  lastSyncToastByRepo.set(repo.path, key);
  const parts = [];
  if (nextStatus.ahead > 0) {
    parts.push(`${nextStatus.ahead} commit${nextStatus.ahead === 1 ? "" : "s"} ahead`);
  }
  if (nextStatus.behind > 0) {
    parts.push(`${nextStatus.behind} commit${nextStatus.behind === 1 ? "" : "s"} behind`);
  }
  useNotificationStore.getState().pushNotification({
    id: createId(),
    tone: "info",
    title: `${repo.name} is out of sync`,
    message: `${parts.join(" / ")}${nextStatus.upstream ? ` of ${nextStatus.upstream}` : ""} — sync?`,
    actionLabel: "Sync",
    onAction: () => {
      void gitSync(repo.path)
        .then(() => useWorkspaceStore.getState().refreshRepo(repo.path))
        .catch((error) => notifyWorkspaceError("Sync failed", error));
    }
  });
}

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  ...emptyState,
  isLoading: false,
  async initialize() {
    const params = new URLSearchParams(window.location.search);
    const target = params.get("target");
    if (!target) {
      return;
    }

    await get().loadTarget(target);
  },
  async loadTarget(path) {
    set({ isLoading: true });
    try {
      const workspace = await openRepositoryTarget(path);
      useDiffStore.getState().clear();
      useInlineBlameStore.getState().setTarget(null);
      set({
        ...workspace,
        isLoading: false
      });
      for (const repo of workspace.repositories) {
        useSettingsStore.getState().rememberRepository(repo.path);
      }
    } catch (error) {
      set({ isLoading: false });
      notifyWorkspaceError("Open target failed", error);
    }
  },
  async addTarget(path) {
    set({ isLoading: true });
    try {
      const workspace = await addRepositoryTarget(path);
      useDiffStore.getState().reconcileWorkspace(workspace.repositories);
      set({
        ...workspace,
        isLoading: false
      });
      for (const repo of workspace.repositories) {
        useSettingsStore.getState().rememberRepository(repo.path);
      }
    } catch (error) {
      set({ isLoading: false });
      notifyWorkspaceError("Add repository failed", error);
    }
  },
  setActiveRepo(repoId) {
    set({ activeRepoId: repoId });
  },
  async refreshRepo(repoPath) {
    const existing = refreshInFlight.get(repoPath);
    if (existing) {
      // A refresh is already running. Mark that we want a trailing refresh after
      // it completes (collapses N concurrent callers into at most 2 total runs).
      refreshPending.add(repoPath);
      return existing;
    }

    const run = (async () => {
      try {
        const nextStatus = await gitStatus(repoPath);
        set((state) => {
          const existingRepo = state.repositories.find((repo) => repo.path === repoPath);
          // Bail entirely if nothing observable changed — avoids creating a new
          // repositories array (and re-rendering every subscriber) for no reason.
          if (existingRepo && statusEqual(existingRepo, nextStatus)) {
            return state;
          }
          if (existingRepo) {
            maybeNotifySyncStatus(existingRepo, nextStatus);
          }
          const repositories = state.repositories.map((repo) =>
            repo.path === repoPath
              ? {
                  ...repo,
                  branch: nextStatus.branch,
                  headSha: nextStatus.headSha,
                  upstream: nextStatus.upstream,
                  ahead: nextStatus.ahead,
                  behind: nextStatus.behind,
                  stashCount: nextStatus.stashCount,
                  changes: nextStatus.changes,
                  staged: nextStatus.staged,
                  hasConflicts: nextStatus.hasConflicts
                }
              : repo
          );
          useDiffStore.getState().reconcileWorkspace(repositories);
          return {
            repositories
          };
        });
      } finally {
        refreshInFlight.delete(repoPath);
      }
    })();

    refreshInFlight.set(repoPath, run);
    await run;

    if (refreshPending.delete(repoPath)) {
      // Coalesce any callers that arrived during the run into one more refresh.
      await get().refreshRepo(repoPath);
    }
  },
  async openDiff(repo, change, staged) {
    const fileDiff: FileDiff = await gitDiffFile(repo.path, change.path, staged);
    set({ activeRepoId: repo.id });
    useDiffStore.getState().setActiveDiff(repo, change, staged, fileDiff);
  }
}));
