import { create } from "zustand";
import type { ConflictChoice } from "../lib/conflicts";

export interface MergeDraft {
  raw: string;
  choices: Record<number, ConflictChoice | undefined>;
  resultDraft: string;
  isResultEdited: boolean;
}

interface MergeDraftStore {
  drafts: Record<string, MergeDraft>;
  setDraft: (key: string, draft: MergeDraft) => void;
  clearDraft: (key: string) => void;
}

export const useMergeDraftStore = create<MergeDraftStore>((set) => ({
  drafts: {},

  setDraft(key, draft) {
    set((state) => ({
      drafts: {
        ...state.drafts,
        [key]: draft
      }
    }));
  },

  clearDraft(key) {
    set((state) => {
      if (!(key in state.drafts)) return state;
      const drafts = { ...state.drafts };
      delete drafts[key];
      return { drafts };
    });
  }
}));
