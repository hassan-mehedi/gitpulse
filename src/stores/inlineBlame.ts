import { create } from "zustand";
import { gitBlameLine } from "../lib/git";
import type { BlameLine } from "../types/git";

interface BlameTarget {
  repoPath: string;
  file: string;
  line: number;
}

interface InlineBlameStore {
  target: BlameTarget | null;
  result: BlameLine | null;
  isLoading: boolean;
  setTarget: (target: BlameTarget | null) => void;
  fetch: () => Promise<void>;
}

let activeFetchId = 0;

export const useInlineBlameStore = create<InlineBlameStore>((set, get) => ({
  target: null,
  result: null,
  isLoading: false,

  setTarget(target) {
    const current = get().target;
    if (
      current?.repoPath === target?.repoPath &&
      current?.file === target?.file &&
      current?.line === target?.line
    ) {
      return;
    }
    set({ target, result: null });
    if (target) {
      void get().fetch();
    }
  },

  async fetch() {
    const { target } = get();
    if (!target) return;
    const fetchId = ++activeFetchId;
    set({ isLoading: true });
    try {
      const result = await gitBlameLine(target.repoPath, target.file, target.line);
      if (fetchId !== activeFetchId) return; // stale
      set({ result, isLoading: false });
    } catch {
      if (fetchId !== activeFetchId) return;
      set({ result: null, isLoading: false });
    }
  }
}));
