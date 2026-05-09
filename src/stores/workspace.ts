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
    const nextStatus = await gitStatus(repoPath);
    set((state) => ({
      repositories: state.repositories.map((repo) =>
        repo.path === repoPath
          ? {
              ...repo,
              branch: nextStatus.branch,
              upstream: nextStatus.upstream,
              ahead: nextStatus.ahead,
              behind: nextStatus.behind,
              changes: nextStatus.changes,
              staged: nextStatus.staged,
              hasConflicts: nextStatus.hasConflicts
            }
          : repo
      )
    }));
  },
  async openDiff(repo, change, staged) {
    const fileDiff: FileDiff = await gitDiffFile(repo.path, change.path, staged);
    useDiffStore.getState().setActiveDiff(repo, change, staged, fileDiff);
  }
}));
