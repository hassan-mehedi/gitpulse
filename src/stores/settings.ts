import { create } from "zustand";
import type { ThemeMode } from "../lib/theme";

interface SettingsStore {
  theme: ThemeMode;
  autoFetch: boolean;
  autoFetchIntervalSeconds: number;
  setTheme: (theme: ThemeMode) => void;
  setAutoFetch: (value: boolean) => void;
  setAutoFetchIntervalSeconds: (value: number) => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  theme: "dark",
  autoFetch: true,
  autoFetchIntervalSeconds: 180,
  setTheme(theme) {
    set({ theme });
  },
  setAutoFetch(value) {
    set({ autoFetch: value });
  },
  setAutoFetchIntervalSeconds(value) {
    set({ autoFetchIntervalSeconds: value });
  }
}));
