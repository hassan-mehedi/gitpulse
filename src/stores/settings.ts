import { create } from "zustand";
import { LazyStore } from "@tauri-apps/plugin-store";
import type { ThemeMode } from "../lib/theme";

export interface CommitIdentityProfile {
  id: string;
  label: string;
  name: string;
  email: string;
}

interface PersistedSettings {
  theme: ThemeMode;
  autoFetch: boolean;
  autoFetchIntervalSeconds: number;
  smartCommit: boolean;
  signCommits: boolean;
  externalEditorCommand: string;
  confirmSyncBeforeOperation: boolean;
  commitIdentities: CommitIdentityProfile[];
  repoIdentityAssignments: Record<string, string>;
}

type PersistedStoreDefaults = Record<string, unknown> & PersistedSettings;

interface SettingsStore {
  theme: ThemeMode;
  autoFetch: boolean;
  autoFetchIntervalSeconds: number;
  smartCommit: boolean;
  signCommits: boolean;
  externalEditorCommand: string;
  confirmSyncBeforeOperation: boolean;
  commitIdentities: CommitIdentityProfile[];
  repoIdentityAssignments: Record<string, string>;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setTheme: (theme: ThemeMode) => void;
  setAutoFetch: (value: boolean) => void;
  setAutoFetchIntervalSeconds: (value: number) => void;
  setSmartCommit: (value: boolean) => void;
  setSignCommits: (value: boolean) => void;
  setExternalEditorCommand: (value: string) => void;
  setConfirmSyncBeforeOperation: (value: boolean) => void;
  addCommitIdentity: (identity: Omit<CommitIdentityProfile, "id">) => CommitIdentityProfile;
  updateCommitIdentity: (id: string, identity: Omit<CommitIdentityProfile, "id">) => void;
  removeCommitIdentity: (id: string) => void;
  assignRepoIdentity: (repoPath: string, identityId: string | null) => void;
}

const DEFAULT_SETTINGS: PersistedSettings = {
  theme: "dark",
  autoFetch: true,
  autoFetchIntervalSeconds: 180,
  smartCommit: true,
  signCommits: false,
  externalEditorCommand: "",
  confirmSyncBeforeOperation: true,
  commitIdentities: [],
  repoIdentityAssignments: {}
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
      const [
        theme,
        autoFetch,
        autoFetchIntervalSeconds,
        smartCommit,
        signCommits,
        externalEditorCommand,
        confirmSyncBeforeOperation,
        commitIdentities,
        repoIdentityAssignments
      ] =
        await Promise.all([
          settingsStore.get<ThemeMode>("theme"),
          settingsStore.get<boolean>("autoFetch"),
          settingsStore.get<number>("autoFetchIntervalSeconds"),
          settingsStore.get<boolean>("smartCommit"),
          settingsStore.get<boolean>("signCommits"),
          settingsStore.get<string>("externalEditorCommand"),
          settingsStore.get<boolean>("confirmSyncBeforeOperation"),
          settingsStore.get<CommitIdentityProfile[]>("commitIdentities"),
          settingsStore.get<Record<string, string>>("repoIdentityAssignments")
        ]);

      set({
        theme: theme ?? DEFAULT_SETTINGS.theme,
        autoFetch: autoFetch ?? DEFAULT_SETTINGS.autoFetch,
        autoFetchIntervalSeconds:
          autoFetchIntervalSeconds ?? DEFAULT_SETTINGS.autoFetchIntervalSeconds,
        smartCommit: smartCommit ?? DEFAULT_SETTINGS.smartCommit,
        signCommits: signCommits ?? DEFAULT_SETTINGS.signCommits,
        externalEditorCommand:
          externalEditorCommand ?? DEFAULT_SETTINGS.externalEditorCommand,
        confirmSyncBeforeOperation:
          confirmSyncBeforeOperation ?? DEFAULT_SETTINGS.confirmSyncBeforeOperation,
        commitIdentities: sanitizeIdentities(
          commitIdentities ?? DEFAULT_SETTINGS.commitIdentities
        ),
        repoIdentityAssignments:
          repoIdentityAssignments ?? DEFAULT_SETTINGS.repoIdentityAssignments,
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
        smartCommit: nextSettings.smartCommit ?? DEFAULT_SETTINGS.smartCommit,
        signCommits: nextSettings.signCommits ?? DEFAULT_SETTINGS.signCommits,
        externalEditorCommand:
          nextSettings.externalEditorCommand ?? DEFAULT_SETTINGS.externalEditorCommand,
        confirmSyncBeforeOperation:
          nextSettings.confirmSyncBeforeOperation ?? DEFAULT_SETTINGS.confirmSyncBeforeOperation,
        commitIdentities: sanitizeIdentities(
          nextSettings.commitIdentities ?? DEFAULT_SETTINGS.commitIdentities
        ),
        repoIdentityAssignments:
          nextSettings.repoIdentityAssignments ?? DEFAULT_SETTINGS.repoIdentityAssignments,
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
  },
  setSmartCommit(value) {
    set({ smartCommit: value });
    void persistSettings({ smartCommit: value }).catch(() => {});
  },
  setSignCommits(value) {
    set({ signCommits: value });
    void persistSettings({ signCommits: value }).catch(() => {});
  },
  setExternalEditorCommand(value) {
    set({ externalEditorCommand: value });
    void persistSettings({ externalEditorCommand: value }).catch(() => {});
  },
  setConfirmSyncBeforeOperation(value) {
    set({ confirmSyncBeforeOperation: value });
    void persistSettings({ confirmSyncBeforeOperation: value }).catch(() => {});
  },
  addCommitIdentity(identity) {
    const nextIdentity = {
      ...identity,
      id: createIdentityId()
    };
    set((state) => {
      const commitIdentities = [...state.commitIdentities, nextIdentity];
      void persistSettings({ commitIdentities }).catch(() => {});
      return { commitIdentities };
    });
    return nextIdentity;
  },
  updateCommitIdentity(id, identity) {
    set((state) => {
      const commitIdentities = state.commitIdentities.map((item) =>
        item.id === id ? { ...identity, id } : item
      );
      void persistSettings({ commitIdentities }).catch(() => {});
      return { commitIdentities };
    });
  },
  removeCommitIdentity(id) {
    set((state) => {
      const commitIdentities = state.commitIdentities.filter((identity) => identity.id !== id);
      const repoIdentityAssignments = Object.fromEntries(
        Object.entries(state.repoIdentityAssignments).filter(([, identityId]) => identityId !== id)
      );
      void persistSettings({ commitIdentities, repoIdentityAssignments }).catch(() => {});
      return { commitIdentities, repoIdentityAssignments };
    });
  },
  assignRepoIdentity(repoPath, identityId) {
    set((state) => {
      const repoIdentityAssignments = { ...state.repoIdentityAssignments };
      if (identityId) {
        repoIdentityAssignments[repoPath] = identityId;
      } else {
        delete repoIdentityAssignments[repoPath];
      }
      void persistSettings({ repoIdentityAssignments }).catch(() => {});
      return { repoIdentityAssignments };
    });
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

function createIdentityId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `identity-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function sanitizeIdentities(identities: CommitIdentityProfile[]) {
  if (!Array.isArray(identities)) {
    return [];
  }
  return identities.filter(
    (identity) =>
      typeof identity.id === "string" &&
      typeof identity.label === "string" &&
      typeof identity.name === "string" &&
      typeof identity.email === "string"
  );
}
