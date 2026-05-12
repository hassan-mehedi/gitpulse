import { create } from "zustand";
import { gitDiffFile } from "../lib/git";
import type { ActivityView, CommitInfo, FileChange, FileDiff, Repository } from "../types/git";

type DiffMode = "split" | "inline";
type DiffTabScope = Extract<ActivityView, "source-control" | "graph">;

interface WorkingTreeOpenTab {
  key: string;
  scope: "source-control";
  kind: "working-tree";
  repo: Repository;
  filePath: string;
  change: FileChange;
  staged: boolean;
  preview: boolean;
}

interface CommitOpenTab {
  key: string;
  scope: "graph";
  kind: "commit";
  repo: Repository;
  filePath: string;
  commit: Pick<CommitInfo, "sha" | "shortSha" | "message">;
  diff: FileDiff;
  staged: false;
  preview: boolean;
}

export type OpenTab = WorkingTreeOpenTab | CommitOpenTab;

interface DiffStore {
  mode: DiffMode;
  tabs: OpenTab[];
  activeTabKey: string | null;
  activeScope: DiffTabScope | null;
  activeSourceKind: OpenTab["kind"] | null;
  activeRepo: Repository | null;
  activeFilePath: string | null;
  activeChange: FileChange | null;
  activeDiff: FileDiff | null;
  activeCommit: Pick<CommitInfo, "sha" | "shortSha" | "message"> | null;
  staged: boolean;
  activeHunkIndex: number;
  setMode: (mode: DiffMode) => void;
  setActiveDiff: (
    repo: Repository,
    change: FileChange,
    staged: boolean,
    diff: FileDiff
  ) => void;
  setActiveCommitDiff: (
    repo: Repository,
    commit: Pick<CommitInfo, "sha" | "shortSha" | "message">,
    diff: FileDiff
  ) => void;
  setActiveHunkIndex: (index: number) => void;
  pinActiveTab: () => void;
  selectTab: (key: string) => Promise<void>;
  closeTab: (key: string) => Promise<void>;
  reorderTab: (fromKey: string, toKey: string, position: "before" | "after") => void;
  refreshActiveDiff: () => Promise<void>;
  reconcileWorkspace: (repositories: Repository[]) => void;
  clear: () => void;
}

function tabKey(repo: Repository, change: FileChange, staged: boolean) {
  return `${staged ? "s" : "u"}:${repo.id}:${change.path}`;
}

function commitTabKey(
  repo: Repository,
  commit: Pick<CommitInfo, "sha">,
  diff: Pick<FileDiff, "file">
) {
  return `c:${repo.id}:${commit.sha}:${diff.file}`;
}

function clearActiveState() {
  return {
    activeTabKey: null,
    activeScope: null,
    activeSourceKind: null,
    activeRepo: null,
    activeFilePath: null,
    activeChange: null,
    activeDiff: null,
    activeCommit: null,
    staged: false,
    activeHunkIndex: 0
  } satisfies Partial<DiffStore>;
}

export const useDiffStore = create<DiffStore>((set, get) => ({
  mode: "split",
  tabs: [],
  ...clearActiveState(),

  setMode(mode) {
    set({ mode });
  },

  setActiveDiff(repo, change, staged, diff) {
    const key = tabKey(repo, change, staged);
    set((state) => {
      const tabs = [...state.tabs];
      const existingIndex = tabs.findIndex((tab) => tab.key === key);
      const newTab: WorkingTreeOpenTab = {
        key,
        scope: "source-control",
        kind: "working-tree",
        repo,
        filePath: change.path,
        change,
        staged,
        preview: true
      };

      if (existingIndex >= 0) {
        tabs[existingIndex] = {
          ...tabs[existingIndex],
          repo,
          filePath: change.path,
          change,
          staged
        } as WorkingTreeOpenTab;
      } else {
        const activeIndex = state.activeTabKey
          ? tabs.findIndex(
              (tab) => tab.key === state.activeTabKey && tab.scope === "source-control"
            )
          : -1;
        if (activeIndex >= 0 && tabs[activeIndex]?.preview) {
          tabs[activeIndex] = newTab;
        } else {
          tabs.push(newTab);
        }
      }

      return {
        tabs,
        activeTabKey: key,
        activeScope: "source-control",
        activeSourceKind: "working-tree",
        activeRepo: repo,
        activeFilePath: change.path,
        activeChange: change,
        activeDiff: diff,
        activeCommit: null,
        staged,
        activeHunkIndex: 0
      };
    });
  },

  setActiveCommitDiff(repo, commit, diff) {
    const key = commitTabKey(repo, commit, diff);
    set((state) => {
      const tabs = [...state.tabs];
      const existingIndex = tabs.findIndex((tab) => tab.key === key);
      const newTab: CommitOpenTab = {
        key,
        scope: "graph",
        kind: "commit",
        repo,
        filePath: diff.file,
        commit,
        diff,
        staged: false,
        preview: true
      };

      if (existingIndex >= 0) {
        tabs[existingIndex] = {
          ...tabs[existingIndex],
          repo,
          filePath: diff.file,
          commit,
          diff
        } as CommitOpenTab;
      } else {
        const activeIndex = state.activeTabKey
          ? tabs.findIndex((tab) => tab.key === state.activeTabKey && tab.scope === "graph")
          : -1;
        if (activeIndex >= 0 && tabs[activeIndex]?.preview) {
          tabs[activeIndex] = newTab;
        } else {
          tabs.push(newTab);
        }
      }

      return {
        tabs,
        activeTabKey: key,
        activeScope: "graph",
        activeSourceKind: "commit",
        activeRepo: repo,
        activeFilePath: diff.file,
        activeChange: null,
        activeDiff: diff,
        activeCommit: commit,
        staged: false,
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

    if (tab.kind === "commit") {
      set({
        activeTabKey: key,
        activeScope: "graph",
        activeSourceKind: "commit",
        activeRepo: tab.repo,
        activeFilePath: tab.filePath,
        activeChange: null,
        activeDiff: tab.diff,
        activeCommit: tab.commit,
        staged: false,
        activeHunkIndex: 0
      });
      return;
    }

    const diff = await gitDiffFile(tab.repo.path, tab.change.path, tab.staged).catch(() => null);
    if (!diff) return;
    set({
      activeTabKey: key,
      activeScope: "source-control",
      activeSourceKind: "working-tree",
      activeRepo: tab.repo,
      activeFilePath: tab.filePath,
      activeChange: tab.change,
      activeDiff: diff,
      activeCommit: null,
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
        ...clearActiveState()
      });
      return;
    }

    const closingIndex = state.tabs.findIndex((tab) => tab.key === key);
    const fallback = tabs[Math.min(closingIndex, tabs.length - 1)] ?? tabs[0];
    if (!fallback) {
      set({
        tabs: [],
        ...clearActiveState()
      });
      return;
    }

    set({ tabs, activeTabKey: fallback.key });
    await get().selectTab(fallback.key);
  },

  async refreshActiveDiff() {
    const state = get();
    if (
      !state.activeRepo ||
      !state.activeChange ||
      state.activeSourceKind !== "working-tree"
    ) {
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

  reconcileWorkspace(repositories) {
    set((state) => {
      const repositoriesByPath = new Map(
        repositories.map((repository) => [repository.path, repository])
      );

      const tabs = state.tabs
        .filter((tab) => {
          const repository = repositoriesByPath.get(tab.repo.path);
          if (!repository) {
            return false;
          }

          if (tab.kind === "commit") {
            return true;
          }

          const changes = tab.staged ? repository.staged : repository.changes;
          return changes.some((change) => change.path === tab.change.path);
        })
        .map((tab) => {
          const repository = repositoriesByPath.get(tab.repo.path);
          if (!repository) {
            return tab;
          }

          if (tab.kind === "commit") {
            return {
              ...tab,
              repo: repository
            };
          }

          const changes = tab.staged ? repository.staged : repository.changes;
          const change = changes.find((entry) => entry.path === tab.change.path) ?? tab.change;
          return {
            ...tab,
            repo: repository,
            change
          };
        });

      const activeTab =
        state.activeTabKey ? tabs.find((tab) => tab.key === state.activeTabKey) ?? null : null;

      if (!activeTab) {
        if (tabs.length === 0) {
          return {
            tabs: [],
            ...clearActiveState()
          };
        }

        return {
          tabs,
          ...clearActiveState()
        };
      }

      const activeRepo = repositoriesByPath.get(activeTab.repo.path) ?? activeTab.repo;

      if (activeTab.kind === "commit") {
        return {
          tabs,
          activeRepo,
          activeFilePath: activeTab.filePath,
          activeCommit: activeTab.commit,
          activeChange: null,
          activeDiff: activeTab.diff,
          activeScope: "graph",
          activeSourceKind: "commit",
          staged: false
        };
      }

      return {
        tabs,
        activeRepo,
        activeFilePath: activeTab.filePath,
        activeChange: activeTab.change,
        activeCommit: null,
        activeScope: "source-control",
        activeSourceKind: "working-tree",
        staged: activeTab.staged
      };
    });
  },

  clear() {
    set({
      tabs: [],
      ...clearActiveState()
    });
  }
}));
