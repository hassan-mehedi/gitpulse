import { create } from "zustand";
import { LazyStore } from "@tauri-apps/plugin-store";
import type { ThemeMode } from "../lib/theme";

interface PersistedSettings {
  theme: ThemeMode;
  autoFetch: boolean;
  autoFetchIntervalSeconds: number;
}

type PersistedStoreDefaults = Record<string, unknown> & PersistedSettings;

interface SettingsStore {
  theme: ThemeMode;
  autoFetch: boolean;
  autoFetchIntervalSeconds: number;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setTheme: (theme: ThemeMode) => void;
  setAutoFetch: (value: boolean) => void;
  setAutoFetchIntervalSeconds: (value: number) => void;
}

const DEFAULT_SETTINGS: PersistedSettings = {
  theme: "dark",
  autoFetch: true,
  autoFetchIntervalSeconds: 180
};

const STORE_DEFAULTS: PersistedStoreDefaults = {
  ...DEFAULT_SETTINGS
};

const settingsStore = isTauriRuntime()
  ? new LazyStore("settings.json", {
      defaults: STORE_DEFAULTS,
      autoSave: 100
    })
  : null;

export const useSettingsStore = create<SettingsStore>((set) => ({
  ...DEFAULT_SETTINGS,
  hydrated: false,
  async hydrate() {
    if (settingsStore) {
      await settingsStore.init();
      const [theme, autoFetch, autoFetchIntervalSeconds] = await Promise.all([
        settingsStore.get<ThemeMode>("theme"),
        settingsStore.get<boolean>("autoFetch"),
        settingsStore.get<number>("autoFetchIntervalSeconds")
      ]);

      set({
        theme: theme ?? DEFAULT_SETTINGS.theme,
        autoFetch: autoFetch ?? DEFAULT_SETTINGS.autoFetch,
        autoFetchIntervalSeconds:
          autoFetchIntervalSeconds ?? DEFAULT_SETTINGS.autoFetchIntervalSeconds,
        hydrated: true
      });
      return;
    }

    const serialized = window.localStorage.getItem("gitpulse-settings");
    if (serialized) {
      const nextSettings = JSON.parse(serialized) as Partial<PersistedSettings>;
      set({
        theme: nextSettings.theme ?? DEFAULT_SETTINGS.theme,
        autoFetch: nextSettings.autoFetch ?? DEFAULT_SETTINGS.autoFetch,
        autoFetchIntervalSeconds:
          nextSettings.autoFetchIntervalSeconds ?? DEFAULT_SETTINGS.autoFetchIntervalSeconds,
        hydrated: true
      });
      return;
    }

    set({ hydrated: true });
  },
  setTheme(theme) {
    set({ theme });
    void persistSettings({ theme }).catch(() => {});
  },
  setAutoFetch(value) {
    set({ autoFetch: value });
    void persistSettings({ autoFetch: value }).catch(() => {});
  },
  setAutoFetchIntervalSeconds(value) {
    set({ autoFetchIntervalSeconds: value });
    void persistSettings({ autoFetchIntervalSeconds: value }).catch(() => {});
  }
}));

async function persistSettings(update: Partial<PersistedSettings>) {
  if (settingsStore) {
    await settingsStore.init();
    for (const [key, value] of Object.entries(update)) {
      await settingsStore.set(key, value);
    }
    return;
  }

  const existing = window.localStorage.getItem("gitpulse-settings");
  const parsed = existing ? (JSON.parse(existing) as Partial<PersistedSettings>) : {};
  window.localStorage.setItem("gitpulse-settings", JSON.stringify({ ...parsed, ...update }));
}

function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
