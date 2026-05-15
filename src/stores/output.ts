import { create } from "zustand";
import type { ProgressPayload } from "../types/git";

interface OutputStore {
  items: ProgressPayload[];
  pushOutput: (item: ProgressPayload) => void;
}

export const useOutputStore = create<OutputStore>((set) => ({
  items: [],
  pushOutput(item) {
    set((state) => ({ items: [item, ...state.items].slice(0, 300) }));
  }
}));
