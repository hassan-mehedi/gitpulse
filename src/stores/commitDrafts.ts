import { create } from "zustand";

interface CommitDraftStore {
  drafts: Record<string, string>;
  getDraft: (repoPath: string) => string;
  setDraft: (repoPath: string, message: string) => void;
  clearDraft: (repoPath: string) => void;
}

export const useCommitDraftStore = create<CommitDraftStore>((set, get) => ({
  drafts: {},

  getDraft(repoPath) {
    return get().drafts[repoPath] ?? "";
  },

  setDraft(repoPath, message) {
    set((state) => ({
      drafts: {
        ...state.drafts,
        [repoPath]: message
      }
    }));
  },

  clearDraft(repoPath) {
    set((state) => {
      if (!(repoPath in state.drafts)) return state;
      const drafts = { ...state.drafts };
      delete drafts[repoPath];
      return { drafts };
    });
  }
}));
