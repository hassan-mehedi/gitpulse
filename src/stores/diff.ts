import { create } from "zustand";
import { gitDiffFile } from "../lib/git";
import type { FileChange, FileDiff, Repository } from "../types/git";

type DiffMode = "split" | "inline";

interface DiffStore {
  mode: DiffMode;
  activeRepo: Repository | null;
  activeChange: FileChange | null;
  activeDiff: FileDiff | null;
  staged: boolean;
  activeHunkIndex: number;
  setMode: (mode: DiffMode) => void;
  setActiveDiff: (
    repo: Repository,
    change: FileChange,
    staged: boolean,
    diff: FileDiff
  ) => void;
  setActiveHunkIndex: (index: number) => void;
  refreshActiveDiff: () => Promise<void>;
  clear: () => void;
}

export const useDiffStore = create<DiffStore>((set) => ({
  mode: "split",
  activeRepo: null,
  activeChange: null,
  activeDiff: null,
  staged: false,
  activeHunkIndex: 0,
  setMode(mode) {
    set({ mode });
  },
  setActiveDiff(repo, change, staged, diff) {
    set({
      activeRepo: repo,
      activeChange: change,
      activeDiff: diff,
      staged,
      activeHunkIndex: 0
    });
  },
  setActiveHunkIndex(index) {
    set({ activeHunkIndex: index });
  },
  async refreshActiveDiff() {
    const state = useDiffStore.getState();
    if (!state.activeRepo || !state.activeChange) {
      return;
    }

    const activeDiff = await gitDiffFile(
      state.activeRepo.path,
      state.activeChange.path,
      state.staged
    );
    set((current) => ({
      activeDiff,
      activeHunkIndex:
        activeDiff.hunks.length === 0
          ? 0
          : Math.min(current.activeHunkIndex, activeDiff.hunks.length - 1)
    }));
  },
  clear() {
    set({
      activeRepo: null,
      activeChange: null,
      activeDiff: null,
      staged: false,
      activeHunkIndex: 0
    });
  }
}));
