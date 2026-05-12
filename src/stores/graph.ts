import { create } from "zustand";
import { gitGraph, gitShowCommit } from "../lib/git";
import { buildGraphNodes } from "../lib/graphLayout";
import type { CommitDetail, CommitInfo, GraphNode, Repository } from "../types/git";

const GRAPH_REPO_STORAGE_KEY = "gitpulse:graphRepoId";

interface GraphStore {
  repoId: string | null;
  repoPath: string | null;
  commits: CommitInfo[];
  nodes: GraphNode[];
  selectedCommitSha: string | null;
  selectedCommitDetail: CommitDetail | null;
  isLoading: boolean;
  setRepoId: (repoId: string | null) => void;
  loadGraph: (repo: Repository) => Promise<void>;
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

export const useGraphStore = create<GraphStore>((set) => ({
  repoId: readStoredRepoId(),
  repoPath: null,
  commits: [],
  nodes: [],
  selectedCommitSha: null,
  selectedCommitDetail: null,
  isLoading: false,
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
  async loadGraph(repo) {
    persistRepoId(repo.id);
    set({
      repoId: repo.id,
      repoPath: repo.path,
      isLoading: true,
      selectedCommitSha: null,
      selectedCommitDetail: null
    });

    try {
      const commits = await gitGraph(repo.path);
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
    const detail = await gitShowCommit(repo.path, sha);
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
