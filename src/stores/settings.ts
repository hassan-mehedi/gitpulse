import { create } from "zustand";
import { LazyStore } from "@tauri-apps/plugin-store";
import type { ThemeMode } from "../lib/theme";
import { getAiApiKey, setAiApiKey } from "../lib/secrets";
import { isTauriRuntime } from "../lib/runtime";
import { reportBackgroundError } from "../lib/errors";

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
  recentWorkspacePaths: string[];
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

export type ApiKeySaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; at: number }
  | { kind: "error"; message: string };

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
  recentWorkspacePaths: string[];
  aiCommitEnabled: boolean;
  aiCommitProvider: AiCommitProvider;
  aiCommitProviderConfigs: AiCommitProviderConfigs;
  aiCommitApiKey: string;
  aiCommitApiKeySaveState: ApiKeySaveState;
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
  rememberWorkspace: (workspacePath: string) => void;
  forgetRepository: (repoPath: string) => void;
  forgetWorkspace: (workspacePath: string) => void;
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
  recentWorkspacePaths: [],
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
  aiCommitApiKeySaveState: { kind: "idle" } as ApiKeySaveState,
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
        recentWorkspacePaths,
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
          settingsStore.get<string[]>("recentWorkspacePaths"),
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
        recentWorkspacePaths:
          recentWorkspacePaths ?? DEFAULT_SETTINGS.recentWorkspacePaths,
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

    const localStorage = getLocalStorage();
    if (!localStorage) {
      set({ hydrated: true });
      return;
    }

    const serialized = localStorage.getItem("gitpulse-settings");
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
        recentWorkspacePaths:
          nextSettings.recentWorkspacePaths ?? DEFAULT_SETTINGS.recentWorkspacePaths,
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
    persistSettingsSafely({ theme });
  },
  setAutoFetch(value) {
    set({ autoFetch: value });
    persistSettingsSafely({ autoFetch: value });
  },
  setAutoFetchIntervalSeconds(value) {
    set({ autoFetchIntervalSeconds: value });
    persistSettingsSafely({ autoFetchIntervalSeconds: value });
  },
  setSmartCommit(value) {
    set({ smartCommit: value });
    persistSettingsSafely({ smartCommit: value });
  },
  setStageAllOnCommit(value) {
    set({ stageAllOnCommit: value });
    persistSettingsSafely({ stageAllOnCommit: value });
  },
  setSignCommits(value) {
    set({ signCommits: value });
    persistSettingsSafely({ signCommits: value });
  },
  setExternalEditorCommand(value) {
    set({ externalEditorCommand: value });
    persistSettingsSafely({ externalEditorCommand: value });
  },
  setConfirmSyncBeforeOperation(value) {
    set({ confirmSyncBeforeOperation: value });
    persistSettingsSafely({ confirmSyncBeforeOperation: value });
  },
  addCommitIdentity(identity) {
    const nextIdentity = {
      ...identity,
      id: createIdentityId()
    };
    set((state) => {
      const commitIdentities = [...state.commitIdentities, nextIdentity];
      persistSettingsSafely({ commitIdentities });
      return { commitIdentities };
    });
    return nextIdentity;
  },
  updateCommitIdentity(id, identity) {
    set((state) => {
      const commitIdentities = state.commitIdentities.map((item) =>
        item.id === id ? { ...identity, id } : item
      );
      persistSettingsSafely({ commitIdentities });
      return { commitIdentities };
    });
  },
  removeCommitIdentity(id) {
    set((state) => {
      const commitIdentities = state.commitIdentities.filter((identity) => identity.id !== id);
      const repoIdentityAssignments = Object.fromEntries(
        Object.entries(state.repoIdentityAssignments).filter(([, identityId]) => identityId !== id)
      );
      persistSettingsSafely({ commitIdentities, repoIdentityAssignments });
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
      persistSettingsSafely({ repoIdentityAssignments });
      return { repoIdentityAssignments };
    });
  },
  rememberRepository(repoPath) {
    set((state) => {
      const recentRepositoryPaths = [
        repoPath,
        ...state.recentRepositoryPaths.filter((path) => path !== repoPath)
      ].slice(0, 10);
      persistSettingsSafely({ recentRepositoryPaths });
      return { recentRepositoryPaths };
    });
  },
  rememberWorkspace(workspacePath) {
    set((state) => {
      const recentWorkspacePaths = [
        workspacePath,
        ...state.recentWorkspacePaths.filter((path) => path !== workspacePath)
      ].slice(0, 10);
      persistSettingsSafely({ recentWorkspacePaths });
      return { recentWorkspacePaths };
    });
  },
  forgetRepository(repoPath) {
    set((state) => {
      const recentRepositoryPaths = state.recentRepositoryPaths.filter(
        (path) => path !== repoPath
      );
      persistSettingsSafely({ recentRepositoryPaths });
      return { recentRepositoryPaths };
    });
  },
  forgetWorkspace(workspacePath) {
    set((state) => {
      const recentWorkspacePaths = state.recentWorkspacePaths.filter(
        (path) => path !== workspacePath
      );
      persistSettingsSafely({ recentWorkspacePaths });
      return { recentWorkspacePaths };
    });
  },
  setAiCommitEnabled(value) {
    set({ aiCommitEnabled: value });
    persistSettingsSafely({ aiCommitEnabled: value });
  },
  setAiCommitProvider(value) {
    const config = useSettingsStore.getState().aiCommitProviderConfigs[value];
    set({
      aiCommitProvider: value,
      aiCommitBaseUrl: config.baseUrl,
      aiCommitModel: config.model,
      aiCommitMaxDiffChars: config.maxDiffChars,
      aiCommitApiKeySaveState: { kind: "idle" }
    });
    persistSettingsSafely({ aiCommitProvider: value });
    void loadAiApiKey(value).then((aiCommitApiKey) => set({ aiCommitApiKey }));
  },
  setAiCommitApiKey(value) {
    set({ aiCommitApiKey: value, aiCommitApiKeySaveState: { kind: "saving" } });
    const provider = useSettingsStore.getState().aiCommitProvider;
    void setAiApiKey(provider, value)
      .then(() => {
        // Only mark "saved" if this is still the value the user expects.
        if (useSettingsStore.getState().aiCommitApiKey === value) {
          set({ aiCommitApiKeySaveState: { kind: "saved", at: Date.now() } });
        }
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        set({ aiCommitApiKeySaveState: { kind: "error", message } });
        reportBackgroundError(error, {
          operation: "Save AI API key",
          title: "Settings save failed",
          notify: false
        });
      });
  },
  setAiCommitBaseUrl(value) {
    set((state) => {
      const aiCommitProviderConfigs = updateAiProviderConfig(state, { baseUrl: value });
      persistSettingsSafely({ aiCommitProviderConfigs });
      return { aiCommitBaseUrl: value, aiCommitProviderConfigs };
    });
  },
  setAiCommitModel(value) {
    set((state) => {
      const aiCommitProviderConfigs = updateAiProviderConfig(state, { model: value });
      persistSettingsSafely({ aiCommitProviderConfigs });
      return { aiCommitModel: value, aiCommitProviderConfigs };
    });
  },
  setAiCommitStyle(value) {
    set({ aiCommitStyle: value });
    persistSettingsSafely({ aiCommitStyle: value });
  },
  setAiCommitIncludeBody(value) {
    set({ aiCommitIncludeBody: value });
    persistSettingsSafely({ aiCommitIncludeBody: value });
  },
  setAiCommitMaxDiffChars(value) {
    set((state) => {
      const aiCommitMaxDiffChars = sanitizeAiMaxDiff(value, state.aiCommitProvider);
      const aiCommitProviderConfigs = updateAiProviderConfig(state, {
        maxDiffChars: aiCommitMaxDiffChars
      });
      persistSettingsSafely({ aiCommitProviderConfigs });
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

  const localStorage = getLocalStorage();
  if (!localStorage) {
    return;
  }

  const existing = localStorage.getItem("gitpulse-settings");
  const parsed = existing ? (JSON.parse(existing) as Partial<PersistedSettings>) : {};
  localStorage.setItem("gitpulse-settings", JSON.stringify({ ...parsed, ...update }));
}

function persistSettingsSafely(update: Partial<PersistedSettings>) {
  void persistSettings(update).catch((error) =>
    reportBackgroundError(error, {
      operation: "Save settings",
      title: "Settings save failed"
    })
  );
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

function getLocalStorage() {
  if (typeof window === "undefined" || !("localStorage" in window)) {
    return null;
  }
  return window.localStorage ?? null;
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
    await setAiApiKey(provider, legacyValue).catch((error) => {
      reportBackgroundError(error, {
        operation: "Migrate AI API key",
        notify: false
      });
    });
    if (fromTauriStore && settingsStore) {
      await settingsStore.delete("aiCommitApiKey").catch((error) => {
        reportBackgroundError(error, {
          operation: "Delete legacy AI API key",
          notify: false
        });
      });
    }
  } else {
    const localStorage = getLocalStorage();
    const existing = localStorage?.getItem("gitpulse-settings");
    if (localStorage && existing) {
      const parsed = JSON.parse(existing) as Record<string, unknown>;
      delete parsed.aiCommitApiKey;
      localStorage.setItem("gitpulse-settings", JSON.stringify(parsed));
    }
  }
  return legacyValue;
}
