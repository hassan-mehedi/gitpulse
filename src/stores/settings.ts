import { create } from "zustand";
import { LazyStore } from "@tauri-apps/plugin-store";
import type { ThemeMode } from "../lib/theme";
import { getAiApiKey, setAiApiKey } from "../lib/secrets";

export interface CommitIdentityProfile {
  id: string;
  label: string;
  name: string;
  email: string;
}

export type StageAllOnCommitMode = "ask" | "always" | "never";
export type AiCommitProvider =
  | "ollama"
  | "openai"
  | "anthropic"
  | "deepseek"
  | "openai-compatible";
export type AiCommitStyle = "conventional" | "plain";

export interface AiCommitProviderConfig {
  model: string;
  baseUrl: string;
  maxDiffChars: number;
}

type AiCommitProviderConfigs = Record<AiCommitProvider, AiCommitProviderConfig>;

interface PersistedSettings {
  theme: ThemeMode;
  autoFetch: boolean;
  autoFetchIntervalSeconds: number;
  smartCommit: boolean;
  stageAllOnCommit: StageAllOnCommitMode;
  signCommits: boolean;
  externalEditorCommand: string;
  confirmSyncBeforeOperation: boolean;
  commitIdentities: CommitIdentityProfile[];
  repoIdentityAssignments: Record<string, string>;
  recentRepositoryPaths: string[];
  aiCommitEnabled: boolean;
  aiCommitProvider: AiCommitProvider;
  aiCommitProviderConfigs: AiCommitProviderConfigs;
  aiCommitBaseUrl: string;
  aiCommitModel: string;
  aiCommitStyle: AiCommitStyle;
  aiCommitIncludeBody: boolean;
  aiCommitMaxDiffChars: number;
}

type PersistedStoreDefaults = Record<string, unknown> & PersistedSettings;

interface SettingsStore {
  theme: ThemeMode;
  autoFetch: boolean;
  autoFetchIntervalSeconds: number;
  smartCommit: boolean;
  stageAllOnCommit: StageAllOnCommitMode;
  signCommits: boolean;
  externalEditorCommand: string;
  confirmSyncBeforeOperation: boolean;
  commitIdentities: CommitIdentityProfile[];
  repoIdentityAssignments: Record<string, string>;
  recentRepositoryPaths: string[];
  aiCommitEnabled: boolean;
  aiCommitProvider: AiCommitProvider;
  aiCommitProviderConfigs: AiCommitProviderConfigs;
  aiCommitApiKey: string;
  aiCommitBaseUrl: string;
  aiCommitModel: string;
  aiCommitStyle: AiCommitStyle;
  aiCommitIncludeBody: boolean;
  aiCommitMaxDiffChars: number;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setTheme: (theme: ThemeMode) => void;
  setAutoFetch: (value: boolean) => void;
  setAutoFetchIntervalSeconds: (value: number) => void;
  setSmartCommit: (value: boolean) => void;
  setStageAllOnCommit: (value: StageAllOnCommitMode) => void;
  setSignCommits: (value: boolean) => void;
  setExternalEditorCommand: (value: string) => void;
  setConfirmSyncBeforeOperation: (value: boolean) => void;
  addCommitIdentity: (identity: Omit<CommitIdentityProfile, "id">) => CommitIdentityProfile;
  updateCommitIdentity: (id: string, identity: Omit<CommitIdentityProfile, "id">) => void;
  removeCommitIdentity: (id: string) => void;
  assignRepoIdentity: (repoPath: string, identityId: string | null) => void;
  rememberRepository: (repoPath: string) => void;
  setAiCommitEnabled: (value: boolean) => void;
  setAiCommitProvider: (value: AiCommitProvider) => void;
  setAiCommitApiKey: (value: string) => void;
  setAiCommitBaseUrl: (value: string) => void;
  setAiCommitModel: (value: string) => void;
  setAiCommitStyle: (value: AiCommitStyle) => void;
  setAiCommitIncludeBody: (value: boolean) => void;
  setAiCommitMaxDiffChars: (value: number) => void;
}

const DEFAULT_SETTINGS: PersistedSettings = {
  theme: "dark",
  autoFetch: true,
  autoFetchIntervalSeconds: 180,
  smartCommit: true,
  stageAllOnCommit: "ask",
  signCommits: false,
  externalEditorCommand: "",
  confirmSyncBeforeOperation: true,
  commitIdentities: [],
  repoIdentityAssignments: {},
  recentRepositoryPaths: [],
  aiCommitEnabled: false,
  aiCommitProvider: "ollama",
  aiCommitProviderConfigs: createDefaultAiProviderConfigs(),
  aiCommitBaseUrl: "http://localhost:11434",
  aiCommitModel: "",
  aiCommitStyle: "conventional",
  aiCommitIncludeBody: true,
  aiCommitMaxDiffChars: 8000
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
  aiCommitApiKey: "",
  hydrated: false,
  async hydrate() {
    if (settingsStore) {
      await settingsStore.init();
      const [
        theme,
        autoFetch,
        autoFetchIntervalSeconds,
        smartCommit,
        stageAllOnCommit,
        signCommits,
        externalEditorCommand,
        confirmSyncBeforeOperation,
        commitIdentities,
        repoIdentityAssignments,
        recentRepositoryPaths,
        aiCommitEnabled,
        aiCommitProvider,
        aiCommitProviderConfigs,
        aiCommitBaseUrl,
        aiCommitModel,
        aiCommitStyle,
        aiCommitIncludeBody,
        aiCommitMaxDiffChars,
        legacyAiCommitApiKey
      ] =
        await Promise.all([
          settingsStore.get<ThemeMode>("theme"),
          settingsStore.get<boolean>("autoFetch"),
          settingsStore.get<number>("autoFetchIntervalSeconds"),
          settingsStore.get<boolean>("smartCommit"),
          settingsStore.get<StageAllOnCommitMode>("stageAllOnCommit"),
          settingsStore.get<boolean>("signCommits"),
          settingsStore.get<string>("externalEditorCommand"),
          settingsStore.get<boolean>("confirmSyncBeforeOperation"),
          settingsStore.get<CommitIdentityProfile[]>("commitIdentities"),
          settingsStore.get<Record<string, string>>("repoIdentityAssignments"),
          settingsStore.get<string[]>("recentRepositoryPaths"),
          settingsStore.get<boolean>("aiCommitEnabled"),
          settingsStore.get<AiCommitProvider>("aiCommitProvider"),
          settingsStore.get<AiCommitProviderConfigs>("aiCommitProviderConfigs"),
          settingsStore.get<string>("aiCommitBaseUrl"),
          settingsStore.get<string>("aiCommitModel"),
          settingsStore.get<AiCommitStyle>("aiCommitStyle"),
          settingsStore.get<boolean>("aiCommitIncludeBody"),
          settingsStore.get<number>("aiCommitMaxDiffChars"),
          settingsStore.get<string>("aiCommitApiKey")
        ]);

      const activeProvider = sanitizeAiProvider(aiCommitProvider);
      const providerConfigs = sanitizeAiProviderConfigs(
        aiCommitProviderConfigs,
        activeProvider,
        aiCommitModel,
        aiCommitBaseUrl,
        aiCommitMaxDiffChars
      );
      const activeProviderConfig = providerConfigs[activeProvider];
      set({
        theme: theme ?? DEFAULT_SETTINGS.theme,
        autoFetch: autoFetch ?? DEFAULT_SETTINGS.autoFetch,
        autoFetchIntervalSeconds:
          autoFetchIntervalSeconds ?? DEFAULT_SETTINGS.autoFetchIntervalSeconds,
        smartCommit: smartCommit ?? DEFAULT_SETTINGS.smartCommit,
        stageAllOnCommit: sanitizeStageAllMode(stageAllOnCommit),
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
        recentRepositoryPaths:
          recentRepositoryPaths ?? DEFAULT_SETTINGS.recentRepositoryPaths,
        aiCommitEnabled: aiCommitEnabled ?? DEFAULT_SETTINGS.aiCommitEnabled,
        aiCommitProvider: activeProvider,
        aiCommitProviderConfigs: providerConfigs,
        aiCommitApiKey: await migrateLegacyAiApiKey(
          activeProvider,
          legacyAiCommitApiKey ?? "",
          true
        ),
        aiCommitBaseUrl: activeProviderConfig.baseUrl,
        aiCommitModel: activeProviderConfig.model,
        aiCommitStyle: sanitizeAiStyle(aiCommitStyle),
        aiCommitIncludeBody: aiCommitIncludeBody ?? DEFAULT_SETTINGS.aiCommitIncludeBody,
        aiCommitMaxDiffChars: activeProviderConfig.maxDiffChars,
        hydrated: true
      });
      await persistSettings({ aiCommitProviderConfigs: providerConfigs });
      return;
    }

    const serialized = window.localStorage.getItem("gitpulse-settings");
    if (serialized) {
      const nextSettings = JSON.parse(serialized) as Partial<PersistedSettings> & {
        aiCommitApiKey?: string;
      };
      const activeProvider = sanitizeAiProvider(nextSettings.aiCommitProvider);
      const providerConfigs = sanitizeAiProviderConfigs(
        nextSettings.aiCommitProviderConfigs,
        activeProvider,
        nextSettings.aiCommitModel,
        nextSettings.aiCommitBaseUrl,
        nextSettings.aiCommitMaxDiffChars
      );
      const activeProviderConfig = providerConfigs[activeProvider];
      set({
        theme: nextSettings.theme ?? DEFAULT_SETTINGS.theme,
        autoFetch: nextSettings.autoFetch ?? DEFAULT_SETTINGS.autoFetch,
        autoFetchIntervalSeconds:
          nextSettings.autoFetchIntervalSeconds ?? DEFAULT_SETTINGS.autoFetchIntervalSeconds,
        smartCommit: nextSettings.smartCommit ?? DEFAULT_SETTINGS.smartCommit,
        stageAllOnCommit: sanitizeStageAllMode(nextSettings.stageAllOnCommit),
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
        recentRepositoryPaths:
          nextSettings.recentRepositoryPaths ?? DEFAULT_SETTINGS.recentRepositoryPaths,
        aiCommitEnabled: nextSettings.aiCommitEnabled ?? DEFAULT_SETTINGS.aiCommitEnabled,
        aiCommitProvider: activeProvider,
        aiCommitProviderConfigs: providerConfigs,
        aiCommitApiKey: await migrateLegacyAiApiKey(
          activeProvider,
          typeof nextSettings.aiCommitApiKey === "string" ? nextSettings.aiCommitApiKey : ""
        ),
        aiCommitBaseUrl: activeProviderConfig.baseUrl,
        aiCommitModel: activeProviderConfig.model,
        aiCommitStyle: sanitizeAiStyle(nextSettings.aiCommitStyle),
        aiCommitIncludeBody:
          nextSettings.aiCommitIncludeBody ?? DEFAULT_SETTINGS.aiCommitIncludeBody,
        aiCommitMaxDiffChars: activeProviderConfig.maxDiffChars,
        hydrated: true
      });
      await persistSettings({ aiCommitProviderConfigs: providerConfigs });
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
  setStageAllOnCommit(value) {
    set({ stageAllOnCommit: value });
    void persistSettings({ stageAllOnCommit: value }).catch(() => {});
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
  },
  rememberRepository(repoPath) {
    set((state) => {
      const recentRepositoryPaths = [
        repoPath,
        ...state.recentRepositoryPaths.filter((path) => path !== repoPath)
      ].slice(0, 10);
      void persistSettings({ recentRepositoryPaths }).catch(() => {});
      return { recentRepositoryPaths };
    });
  },
  setAiCommitEnabled(value) {
    set({ aiCommitEnabled: value });
    void persistSettings({ aiCommitEnabled: value }).catch(() => {});
  },
  setAiCommitProvider(value) {
    const config = useSettingsStore.getState().aiCommitProviderConfigs[value];
    set({
      aiCommitProvider: value,
      aiCommitBaseUrl: config.baseUrl,
      aiCommitModel: config.model,
      aiCommitMaxDiffChars: config.maxDiffChars
    });
    void persistSettings({ aiCommitProvider: value }).catch(() => {});
    void loadAiApiKey(value).then((aiCommitApiKey) => set({ aiCommitApiKey }));
  },
  setAiCommitApiKey(value) {
    set({ aiCommitApiKey: value });
    const provider = useSettingsStore.getState().aiCommitProvider;
    void setAiApiKey(provider, value).catch(() => {});
  },
  setAiCommitBaseUrl(value) {
    set((state) => {
      const aiCommitProviderConfigs = updateAiProviderConfig(state, { baseUrl: value });
      void persistSettings({ aiCommitProviderConfigs }).catch(() => {});
      return { aiCommitBaseUrl: value, aiCommitProviderConfigs };
    });
  },
  setAiCommitModel(value) {
    set((state) => {
      const aiCommitProviderConfigs = updateAiProviderConfig(state, { model: value });
      void persistSettings({ aiCommitProviderConfigs }).catch(() => {});
      return { aiCommitModel: value, aiCommitProviderConfigs };
    });
  },
  setAiCommitStyle(value) {
    set({ aiCommitStyle: value });
    void persistSettings({ aiCommitStyle: value }).catch(() => {});
  },
  setAiCommitIncludeBody(value) {
    set({ aiCommitIncludeBody: value });
    void persistSettings({ aiCommitIncludeBody: value }).catch(() => {});
  },
  setAiCommitMaxDiffChars(value) {
    set((state) => {
      const aiCommitMaxDiffChars = sanitizeAiMaxDiff(value, state.aiCommitProvider);
      const aiCommitProviderConfigs = updateAiProviderConfig(state, {
        maxDiffChars: aiCommitMaxDiffChars
      });
      void persistSettings({ aiCommitProviderConfigs }).catch(() => {});
      return { aiCommitMaxDiffChars, aiCommitProviderConfigs };
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

function sanitizeStageAllMode(value: unknown): StageAllOnCommitMode {
  return value === "always" || value === "never" ? value : DEFAULT_SETTINGS.stageAllOnCommit;
}

function sanitizeAiProvider(value: unknown): AiCommitProvider {
  return value === "openai" ||
    value === "anthropic" ||
    value === "deepseek" ||
    value === "openai-compatible"
    ? value
    : DEFAULT_SETTINGS.aiCommitProvider;
}

function sanitizeAiStyle(value: unknown): AiCommitStyle {
  return value === "plain" ? value : DEFAULT_SETTINGS.aiCommitStyle;
}

function sanitizeAiMaxDiff(value: unknown, provider: AiCommitProvider = DEFAULT_SETTINGS.aiCommitProvider) {
  const sanitized =
    typeof value === "number" && Number.isFinite(value)
      ? Math.max(2000, Math.min(100000, value))
      : DEFAULT_SETTINGS.aiCommitMaxDiffChars;

  // Migrate the first shipped Ollama default, which routinely overflowed a 4k context.
  return provider === "ollama" && sanitized === 24000
    ? DEFAULT_SETTINGS.aiCommitMaxDiffChars
    : sanitized;
}

function createDefaultAiProviderConfigs(): AiCommitProviderConfigs {
  return {
    ollama: {
      model: "",
      baseUrl: "http://localhost:11434",
      maxDiffChars: 8000
    },
    openai: {
      model: "",
      baseUrl: "",
      maxDiffChars: 24000
    },
    anthropic: {
      model: "",
      baseUrl: "",
      maxDiffChars: 24000
    },
    deepseek: {
      model: "",
      baseUrl: "",
      maxDiffChars: 24000
    },
    "openai-compatible": {
      model: "",
      baseUrl: "",
      maxDiffChars: 24000
    }
  };
}

function sanitizeAiProviderConfigs(
  value: unknown,
  activeProvider: AiCommitProvider,
  legacyModel: unknown,
  legacyBaseUrl: unknown,
  legacyMaxDiffChars: unknown
): AiCommitProviderConfigs {
  const defaults = createDefaultAiProviderConfigs();
  const raw = isRecord(value) ? value : {};
  const migratedLegacyConfig =
    Object.keys(raw).length === 0
      ? {
          model: typeof legacyModel === "string" ? legacyModel : defaults[activeProvider].model,
          baseUrl:
            typeof legacyBaseUrl === "string"
              ? legacyBaseUrl
              : defaults[activeProvider].baseUrl,
          maxDiffChars: sanitizeAiMaxDiff(legacyMaxDiffChars, activeProvider)
        }
      : null;

  return Object.fromEntries(
    (Object.keys(defaults) as AiCommitProvider[]).map((provider) => {
      const candidate = isRecord(raw[provider]) ? raw[provider] : {};
      const fallback =
        provider === activeProvider && migratedLegacyConfig
          ? migratedLegacyConfig
          : defaults[provider];
      return [
        provider,
        {
          model: typeof candidate.model === "string" ? candidate.model : fallback.model,
          baseUrl:
            typeof candidate.baseUrl === "string" ? candidate.baseUrl : fallback.baseUrl,
          maxDiffChars:
            candidate.maxDiffChars === undefined
              ? fallback.maxDiffChars
              : sanitizeAiMaxDiff(candidate.maxDiffChars, provider)
        }
      ];
    })
  ) as AiCommitProviderConfigs;
}

function updateAiProviderConfig(
  state: Pick<
    SettingsStore,
    "aiCommitProvider" | "aiCommitProviderConfigs"
  >,
  update: Partial<AiCommitProviderConfig>
) {
  return {
    ...state.aiCommitProviderConfigs,
    [state.aiCommitProvider]: {
      ...state.aiCommitProviderConfigs[state.aiCommitProvider],
      ...update
    }
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function loadAiApiKey(provider: AiCommitProvider) {
  if (!isTauriRuntime()) return "";
  return (await getAiApiKey(provider).catch(() => null)) ?? "";
}

async function migrateLegacyAiApiKey(
  provider: AiCommitProvider,
  legacyValue: string,
  fromTauriStore = false
) {
  if (!legacyValue) {
    return loadAiApiKey(provider);
  }
  if (isTauriRuntime()) {
    await setAiApiKey(provider, legacyValue).catch(() => {});
    if (fromTauriStore && settingsStore) {
      await settingsStore.delete("aiCommitApiKey").catch(() => {});
    }
  } else {
    const existing = window.localStorage.getItem("gitpulse-settings");
    if (existing) {
      const parsed = JSON.parse(existing) as Record<string, unknown>;
      delete parsed.aiCommitApiKey;
      window.localStorage.setItem("gitpulse-settings", JSON.stringify(parsed));
    }
  }
  return legacyValue;
}
