import { create } from "zustand";
import type { ProgressPayload } from "../types/git";

export interface ProgressItem extends ProgressPayload {
  id: string;
  updatedAt: number;
}

interface ProgressStore {
  items: ProgressItem[];
  upsertProgress: (payload: ProgressPayload) => void;
  removeProgress: (id: string) => void;
}

export function progressId(payload: Pick<ProgressPayload, "repoPath" | "operation">) {
  return `${payload.repoPath}:${payload.operation}`;
}

export const useProgressStore = create<ProgressStore>((set) => ({
  items: [],
  upsertProgress(payload) {
    const id = progressId(payload);
    set((state) => {
      const nextItem: ProgressItem = {
        ...payload,
        id,
        updatedAt: Date.now()
      };

      const existingIndex = state.items.findIndex((item) => item.id === id);
      if (existingIndex === -1) {
        return { items: [...state.items, nextItem] };
      }

      const items = [...state.items];
      items[existingIndex] = nextItem;
      return { items };
    });
  },
  removeProgress(id) {
    set((state) => ({ items: state.items.filter((item) => item.id !== id) }));
  }
}));
