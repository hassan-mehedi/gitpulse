import { create } from "zustand";
import { gitGraph } from "../lib/git";
import { getCommitDetail } from "../lib/commitDetails";
import { buildGraphNodes } from "../lib/graphLayout";
import type { CommitDetail, CommitInfo, GraphNode, Repository } from "../types/git";

const GRAPH_REPO_STORAGE_KEY = "gitpulse:graphRepoId";
const GRAPH_INCLUDE_ALL_STORAGE_KEY = "gitpulse:graphIncludeAll";

interface GraphStore {
  repoId: string | null;
  repoPath: string | null;
  commits: CommitInfo[];
  nodes: GraphNode[];
  selectedCommitSha: string | null;
  selectedCommitDetail: CommitDetail | null;
  isLoading: boolean;
  includeAll: boolean;
  setRepoId: (repoId: string | null) => void;
  setIncludeAll: (value: boolean) => void;
  loadGraph: (repo: Repository, file?: string) => Promise<void>;
  selectCommit: (repo: Repository, sha: string) => Promise<void>;
  clear: () => void;
}

function readStoredRepoId() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage.getItem(GRAPH_REPO_STORAGE_KEY);
  } catch {
    return null;
  }
}

function persistRepoId(repoId: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (repoId) {
      window.localStorage.setItem(GRAPH_REPO_STORAGE_KEY, repoId);
    } else {
      window.localStorage.removeItem(GRAPH_REPO_STORAGE_KEY);
    }
  } catch {
    // localStorage may be unavailable.
  }
}

function readStoredIncludeAll() {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return window.localStorage.getItem(GRAPH_INCLUDE_ALL_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function persistIncludeAll(value: boolean) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(GRAPH_INCLUDE_ALL_STORAGE_KEY, value ? "1" : "0");
  } catch {
    // localStorage may be unavailable.
  }
}

export const useGraphStore = create<GraphStore>((set, get) => ({
  repoId: readStoredRepoId(),
  repoPath: null,
  commits: [],
  nodes: [],
  selectedCommitSha: null,
  selectedCommitDetail: null,
  isLoading: false,
  includeAll: readStoredIncludeAll(),
  setIncludeAll(value) {
    persistIncludeAll(value);
    set({ includeAll: value });
  },
  setRepoId(repoId) {
    persistRepoId(repoId);
    set((state) => {
      if (state.repoId === repoId) {
        return state;
      }

      return {
        repoId,
        repoPath: null,
        commits: [],
        nodes: [],
        selectedCommitSha: null,
        selectedCommitDetail: null,
        isLoading: false
      };
    });
  },
  async loadGraph(repo, file) {
    persistRepoId(repo.id);
    set({
      repoId: repo.id,
      repoPath: repo.path,
      isLoading: true,
      selectedCommitSha: null,
      selectedCommitDetail: null
    });

    try {
      const commits = await gitGraph(repo.path, 500, get().includeAll, file || undefined);
      const nodes = buildGraphNodes(commits);
      set({
        repoId: repo.id,
        repoPath: repo.path,
        commits,
        nodes,
        isLoading: false,
        selectedCommitSha: nodes[0]?.sha ?? null,
        selectedCommitDetail: null
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },
  async selectCommit(repo, sha) {
    const detail = await getCommitDetail(repo.path, sha);
    set({
      repoId: repo.id,
      repoPath: repo.path,
      selectedCommitSha: sha,
      selectedCommitDetail: detail
    });
  },
  clear() {
    set({
      repoPath: null,
      commits: [],
      nodes: [],
      selectedCommitSha: null,
      selectedCommitDetail: null,
      isLoading: false
    });
  }
}));
