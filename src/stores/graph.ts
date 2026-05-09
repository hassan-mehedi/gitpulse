import { create } from "zustand";
import { gitGraph, gitShowCommit } from "../lib/git";
import { buildGraphNodes } from "../lib/graphLayout";
import type { CommitDetail, CommitInfo, GraphNode, Repository } from "../types/git";

interface GraphStore {
  commits: CommitInfo[];
  nodes: GraphNode[];
  selectedCommitSha: string | null;
  selectedCommitDetail: CommitDetail | null;
  isLoading: boolean;
  setCommits: (commits: CommitInfo[]) => void;
  loadGraph: (repo: Repository) => Promise<void>;
  selectCommit: (repo: Repository, sha: string) => Promise<void>;
}

export const useGraphStore = create<GraphStore>((set) => ({
  commits: [],
  nodes: [],
  selectedCommitSha: null,
  selectedCommitDetail: null,
  isLoading: false,
  setCommits(commits) {
    set({ commits, nodes: buildGraphNodes(commits) });
  },
  async loadGraph(repo) {
    set({ isLoading: true });
    try {
      const commits = await gitGraph(repo.path);
      const nodes = buildGraphNodes(commits);
      set({
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
      selectedCommitSha: sha,
      selectedCommitDetail: detail
    });
  }
}));
