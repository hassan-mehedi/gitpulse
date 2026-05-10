import { create } from "zustand";

interface RuntimeStore {
  gitVersion: string | null;
  setGitVersion: (version: string | null) => void;
}

export const useRuntimeStore = create<RuntimeStore>((set) => ({
  gitVersion: null,
  setGitVersion(version) {
    set({ gitVersion: version });
  }
}));
