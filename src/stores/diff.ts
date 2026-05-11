import { create } from "zustand";
import { gitDiffFile } from "../lib/git";
import type { FileChange, FileDiff, Repository } from "../types/git";

type DiffMode = "split" | "inline";

export interface OpenTab {
  /** Stable identity: `<staged|unstaged>:<repoId>:<path>` */
  key: string;
  repo: Repository;
  change: FileChange;
  staged: boolean;
  /** A "preview" tab is replaced when the user single-clicks a different file
      (matches VS Code's preview-tab semantics). Double-click pins. */
  preview: boolean;
}

interface DiffStore {
  mode: DiffMode;
  tabs: OpenTab[];
  activeTabKey: string | null;
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
  pinActiveTab: () => void;
  selectTab: (key: string) => Promise<void>;
  closeTab: (key: string) => Promise<void>;
  reorderTab: (fromKey: string, toKey: string, position: "before" | "after") => void;
  refreshActiveDiff: () => Promise<void>;
  clear: () => void;
}

function tabKey(repo: Repository, change: FileChange, staged: boolean) {
  return `${staged ? "s" : "u"}:${repo.id}:${change.path}`;
}

export const useDiffStore = create<DiffStore>((set, get) => ({
  mode: "split",
  tabs: [],
  activeTabKey: null,
  activeRepo: null,
  activeChange: null,
  activeDiff: null,
  staged: false,
  activeHunkIndex: 0,

  setMode(mode) {
    set({ mode });
  },

  setActiveDiff(repo, change, staged, diff) {
    const key = tabKey(repo, change, staged);
    set((state) => {
      const tabs = [...state.tabs];
      const existingIndex = tabs.findIndex((tab) => tab.key === key);

      if (existingIndex >= 0) {
        // Same file reopened — keep its pinned status, just make it active and
        // refresh repo/change/staged in case the underlying objects changed.
        tabs[existingIndex] = {
          ...tabs[existingIndex]!,
          repo,
          change,
          staged
        };
      } else {
        // New file. If the currently-active tab is a preview, replace it
        // (VS Code's preview-tab semantics).
        const activeIndex = state.activeTabKey
          ? tabs.findIndex((tab) => tab.key === state.activeTabKey)
          : -1;
        const newTab: OpenTab = { key, repo, change, staged, preview: true };
        if (activeIndex >= 0 && tabs[activeIndex]!.preview) {
          tabs[activeIndex] = newTab;
        } else {
          tabs.push(newTab);
        }
      }

      return {
        tabs,
        activeTabKey: key,
        activeRepo: repo,
        activeChange: change,
        activeDiff: diff,
        staged,
        activeHunkIndex: 0
      };
    });
  },

  setActiveHunkIndex(index) {
    set({ activeHunkIndex: index });
  },

  pinActiveTab() {
    set((state) => {
      if (!state.activeTabKey) return state;
      return {
        tabs: state.tabs.map((tab) =>
          tab.key === state.activeTabKey ? { ...tab, preview: false } : tab
        )
      };
    });
  },

  async selectTab(key) {
    const state = get();
    const tab = state.tabs.find((entry) => entry.key === key);
    if (!tab) return;
    if (state.activeTabKey === key && state.activeDiff) {
      return;
    }

    const diff = await gitDiffFile(tab.repo.path, tab.change.path, tab.staged).catch(
      () => null
    );
    if (!diff) return;
    set({
      activeTabKey: key,
      activeRepo: tab.repo,
      activeChange: tab.change,
      activeDiff: diff,
      staged: tab.staged,
      activeHunkIndex: 0
    });
  },

  reorderTab(fromKey, toKey, position) {
    set((state) => {
      if (fromKey === toKey) return state;
      const tabs = [...state.tabs];
      const fromIndex = tabs.findIndex((tab) => tab.key === fromKey);
      if (fromIndex < 0) return state;
      const [moving] = tabs.splice(fromIndex, 1);
      if (!moving) return state;
      // Pinned the moving tab — drag-reorder also pins (matches VS Code).
      const pinned = { ...moving, preview: false };
      const targetIndex = tabs.findIndex((tab) => tab.key === toKey);
      if (targetIndex < 0) {
        tabs.push(pinned);
      } else {
        tabs.splice(position === "before" ? targetIndex : targetIndex + 1, 0, pinned);
      }
      return { tabs };
    });
  },

  async closeTab(key) {
    const state = get();
    const tabs = state.tabs.filter((tab) => tab.key !== key);

    if (state.activeTabKey !== key) {
      set({ tabs });
      return;
    }

    if (tabs.length === 0) {
      set({
        tabs: [],
        activeTabKey: null,
        activeRepo: null,
        activeChange: null,
        activeDiff: null,
        staged: false,
        activeHunkIndex: 0
      });
      return;
    }

    // Activate the tab next-door (prefer the previous one).
    const closingIndex = state.tabs.findIndex((tab) => tab.key === key);
    const fallback = tabs[Math.min(closingIndex, tabs.length - 1)] ?? tabs[0]!;
    set({ tabs, activeTabKey: fallback.key });
    await get().selectTab(fallback.key);
  },

  async refreshActiveDiff() {
    const state = get();
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
      tabs: [],
      activeTabKey: null,
      activeRepo: null,
      activeChange: null,
      activeDiff: null,
      staged: false,
      activeHunkIndex: 0
    });
  }
}));
