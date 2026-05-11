import { create } from "zustand";
import { gitDiffFile, gitStatus, openRepositoryTarget } from "../lib/git";
import type { FileDiff, FileChange, Repository, WorkspaceState } from "../types/git";
import { useDiffStore } from "./diff";

interface WorkspaceStore extends WorkspaceState {
  isLoading: boolean;
  initialize: () => Promise<void>;
  loadTarget: (path: string) => Promise<void>;
  setActiveRepo: (repoId: string) => void;
  refreshRepo: (repoPath: string) => Promise<void>;
  openDiff: (repo: Repository, change: FileChange, staged: boolean) => Promise<void>;
}

const emptyState: WorkspaceState = {
  mode: "single",
  repositories: [],
  activeRepoId: null
};

// Per-repo refresh dedup: collapses bursts of refresh calls (e.g. one from the user
// action followed by 2-3 from the filesystem watcher firing for the same git op).
// If a refresh is in flight for a path, subsequent calls reuse the same promise.
// If a request arrives while a refresh is running, a single trailing refresh is
// scheduled for after it completes.
const refreshInFlight = new Map<string, Promise<void>>();
const refreshPending = new Set<string>();

function statusEqual(prev: Repository, nextStatus: Awaited<ReturnType<typeof gitStatus>>) {
  if (
    prev.branch !== nextStatus.branch ||
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
      set({
        ...workspace,
        isLoading: false
      });
    } catch {
      set({ isLoading: false });
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
          return {
            repositories: state.repositories.map((repo) =>
              repo.path === repoPath
                ? {
                    ...repo,
                    branch: nextStatus.branch,
                    upstream: nextStatus.upstream,
                    ahead: nextStatus.ahead,
                    behind: nextStatus.behind,
                    stashCount: nextStatus.stashCount,
                    changes: nextStatus.changes,
                    staged: nextStatus.staged,
                    hasConflicts: nextStatus.hasConflicts
                  }
                : repo
            )
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
    useDiffStore.getState().setActiveDiff(repo, change, staged, fileDiff);
  }
}));
