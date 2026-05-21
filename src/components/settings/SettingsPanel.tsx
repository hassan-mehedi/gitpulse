import { useEffect, useMemo, useRef, useState } from "react";
import { useSettingsStore, type ApiKeySaveState } from "../../stores/settings";
import { useRuntimeStore } from "../../stores/runtime";
import { useWorkspaceStore } from "../../stores/workspace";
import { useNotificationStore } from "../../stores/notifications";
import { useRepo } from "../../hooks/useRepo";
import { Codicon } from "../shared/Codicon";
import {
  formatIdentity,
  resolveCommitIdentity,
  validateIdentityFields
} from "../../lib/commitIdentity";
import { gitGetUserInfo } from "../../lib/git";
import { THEME_OPTIONS, type ThemeMode } from "../../lib/theme";
import { checkForUpdate, openReleasePage } from "../../lib/updates";
import { generateCommitMessage } from "../../lib/aiCommit";
import { errorMessage } from "../../lib/errors";
import { createId } from "../../lib/ids";
import type { UserInfo, Repository } from "../../types/git";
import type { AiCommitProvider, AiCommitStyle, CommitIdentityProfile } from "../../stores/settings";

const SETTINGS_NAV: { id: string; label: string }[] = [
  { id: "application", label: "Application" },
  { id: "auto-fetch", label: "Auto Fetch" },
  { id: "git", label: "Git" },
  { id: "ai", label: "AI Commit Messages" },
  { id: "identities", label: "Commit Identities" },
  { id: "about", label: "About" }
];

const AI_PROVIDER_OPTIONS: { value: AiCommitProvider; label: string; hint: string }[] = [
  { value: "ollama", label: "Ollama", hint: "Local — no API key" },
  { value: "openai", label: "OpenAI", hint: "api.openai.com" },
  { value: "anthropic", label: "Anthropic", hint: "api.anthropic.com" },
  { value: "deepseek", label: "DeepSeek", hint: "api.deepseek.com" },
  { value: "openai-compatible", label: "OpenAI-compat", hint: "Custom base URL" }
];

function providerNeedsApiKey(provider: AiCommitProvider) {
  return provider !== "ollama";
}

function providerShowsBaseUrl(provider: AiCommitProvider) {
  return provider === "ollama" || provider === "openai-compatible";
}

export function SettingsPanel() {
  const { activeRepo } = useRepo();
  const theme = useSettingsStore((state) => state.theme);
  const autoFetch = useSettingsStore((state) => state.autoFetch);
  const autoFetchIntervalSeconds = useSettingsStore((state) => state.autoFetchIntervalSeconds);
  const smartCommit = useSettingsStore((state) => state.smartCommit);
  const stageAllOnCommit = useSettingsStore((state) => state.stageAllOnCommit);
  const signCommits = useSettingsStore((state) => state.signCommits);
  const externalEditorCommand = useSettingsStore((state) => state.externalEditorCommand);
  const confirmSyncBeforeOperation = useSettingsStore(
    (state) => state.confirmSyncBeforeOperation
  );
  const commitIdentities = useSettingsStore((state) => state.commitIdentities);
  const repoIdentityAssignments = useSettingsStore((state) => state.repoIdentityAssignments);
  const setTheme = useSettingsStore((state) => state.setTheme);
  const setAutoFetch = useSettingsStore((state) => state.setAutoFetch);
  const setAutoFetchIntervalSeconds = useSettingsStore(
    (state) => state.setAutoFetchIntervalSeconds
  );
  const setSmartCommit = useSettingsStore((state) => state.setSmartCommit);
  const setStageAllOnCommit = useSettingsStore((state) => state.setStageAllOnCommit);
  const setSignCommits = useSettingsStore((state) => state.setSignCommits);
  const setExternalEditorCommand = useSettingsStore((state) => state.setExternalEditorCommand);
  const setConfirmSyncBeforeOperation = useSettingsStore(
    (state) => state.setConfirmSyncBeforeOperation
  );
  const gitVersion = useRuntimeStore((state) => state.gitVersion);
  const repositories = useWorkspaceStore((state) => state.repositories);
  const [gitUser, setGitUser] = useState<UserInfo | null>(null);
  const effectiveIdentity = resolveCommitIdentity(
    activeRepo?.path,
    commitIdentities,
    repoIdentityAssignments,
    gitUser
  );

  useEffect(() => {
    if (!activeRepo) {
      setGitUser(null);
      return;
    }

    let cancelled = false;
    void gitGetUserInfo(activeRepo.path)
      .then((user) => {
        if (!cancelled) setGitUser(user);
      })
      .catch(() => {
        if (!cancelled) setGitUser(null);
      });

    return () => {
      cancelled = true;
    };
  }, [activeRepo]);

  const [activeSection, setActiveSection] = useState<string>(SETTINGS_NAV[0]!.id);
  const contentRef = useRef<HTMLDivElement | null>(null);

  // Reset the content pane to the top whenever the active section changes,
  // so a previous section's scroll position doesn't leak into the new one.
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
  }, [activeSection]);

  return (
    <>
      <div className="view-title">
        <h2 className="view-title__label">Settings</h2>
      </div>

      <div className="scm-body settings-panel">
        <nav className="settings-nav" aria-label="Settings sections">
          {SETTINGS_NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`settings-nav__item${activeSection === item.id ? " is-active" : ""}`}
              onClick={() => setActiveSection(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="settings-content" ref={contentRef}>
        {activeSection === "application" ? (
        <section className="settings-section">
          <div className="settings-section__title">Application</div>
          <SettingRow label="Theme" hint="Color palette used across the UI.">
            <SettingsSelect
              options={THEME_OPTIONS}
              onChange={(value) => setTheme(value as ThemeMode)}
              value={theme}
            />
          </SettingRow>
        </section>
        ) : null}

        {activeSection === "auto-fetch" ? (
        <section className="settings-section">
          <div className="settings-section__title">Auto Fetch</div>
          <SettingRow
            label="Enable background fetch"
            hint="Periodically run `git fetch --all` for every open repository."
          >
            <SettingsCheckbox checked={autoFetch} onChange={setAutoFetch} />
          </SettingRow>
          <SettingRow
            label="Fetch interval"
            hint="Seconds between background fetches (minimum 30)."
          >
            <input
              className="settings-control settings-control--narrow"
              disabled={!autoFetch}
              min={30}
              onChange={(event) =>
                setAutoFetchIntervalSeconds(Math.max(30, Number(event.target.value) || 30))
              }
              type="number"
              value={autoFetchIntervalSeconds}
            />
          </SettingRow>
        </section>
        ) : null}

        {activeSection === "git" ? (
        <section className="settings-section">
          <div className="settings-section__title">Git</div>
          <SettingRow
            label="Effective commit identity"
            hint={
              effectiveIdentity.source === "gitpulse"
                ? "GitPulse identity overrides this repository's Git config."
                : effectiveIdentity.source === "git-config"
                  ? "Using this repository's Git config."
                  : "No identity available — commits will fail until one is configured below."
            }
          >
            <span className="settings-readonly">{effectiveIdentity.label}</span>
          </SettingRow>
          <SettingRow
            label="Smart Commit"
            hint="When nothing is staged, auto-stage tracked modified/deleted files before committing."
          >
            <SettingsCheckbox checked={smartCommit} onChange={setSmartCommit} />
          </SettingRow>
          <SettingRow
            label="Commit with unstaged changes"
            hint="Choose whether GitPulse should ask before staging all changes when a commit has no staged files."
          >
            <SettingsSelect
              onChange={(value) => setStageAllOnCommit(value as typeof stageAllOnCommit)}
              options={[
                { value: "ask", label: "Ask every time" },
                { value: "always", label: "Always stage all" },
                { value: "never", label: "Never stage all" }
              ]}
              value={stageAllOnCommit}
            />
          </SettingRow>
          <SettingRow
            label="Sign commits"
            hint="Pass `-S` to commit commands. Requires your Git signing key to be configured."
          >
            <SettingsCheckbox checked={signCommits} onChange={setSignCommits} />
          </SettingRow>
          <SettingRow
            label="External editor"
            hint="Command used for Open File in Editor. Use `code`, `code-insiders`, `codium`, `subl`, or leave empty for auto."
          >
            <input
              className="settings-control"
              onChange={(event) => setExternalEditorCommand(event.target.value)}
              placeholder="Auto"
              value={externalEditorCommand}
            />
          </SettingRow>
          <SettingRow
            label="Confirm sync"
            hint="Ask before pushing/pulling from the SCM sync button."
          >
            <SettingsCheckbox
              checked={confirmSyncBeforeOperation}
              onChange={setConfirmSyncBeforeOperation}
            />
          </SettingRow>
        </section>
        ) : null}

        {activeSection === "ai" ? <AiCommitSection /> : null}

        {activeSection === "identities" ? (
          <CommitIdentitySection
            activeRepo={activeRepo}
            gitUser={gitUser}
            repositories={repositories}
          />
        ) : null}

        {activeSection === "about" ? (
        <section className="settings-section">
          <div className="settings-section__title">About</div>
          <SettingRow label="Git binary">
            <span className="settings-readonly">{gitVersion ?? "Detecting…"}</span>
          </SettingRow>
          <SettingRow label="GitPulse">
            <UpdateCheck />
          </SettingRow>
        </section>
        ) : null}
        </div>
      </div>
    </>
  );
}

function AiCommitSection() {
  const enabled = useSettingsStore((state) => state.aiCommitEnabled);
  const provider = useSettingsStore((state) => state.aiCommitProvider);
  const apiKey = useSettingsStore((state) => state.aiCommitApiKey);
  const saveState = useSettingsStore((state) => state.aiCommitApiKeySaveState);
  const baseUrl = useSettingsStore((state) => state.aiCommitBaseUrl);
  const model = useSettingsStore((state) => state.aiCommitModel);
  const style = useSettingsStore((state) => state.aiCommitStyle);
  const includeBody = useSettingsStore((state) => state.aiCommitIncludeBody);
  const maxDiff = useSettingsStore((state) => state.aiCommitMaxDiffChars);

  const setEnabled = useSettingsStore((state) => state.setAiCommitEnabled);
  const setProvider = useSettingsStore((state) => state.setAiCommitProvider);
  const setApiKey = useSettingsStore((state) => state.setAiCommitApiKey);
  const setBaseUrl = useSettingsStore((state) => state.setAiCommitBaseUrl);
  const setModel = useSettingsStore((state) => state.setAiCommitModel);
  const setStyle = useSettingsStore((state) => state.setAiCommitStyle);
  const setIncludeBody = useSettingsStore((state) => state.setAiCommitIncludeBody);
  const setMaxDiff = useSettingsStore((state) => state.setAiCommitMaxDiffChars);

  const [testState, setTestState] = useState<
    | { kind: "idle" }
    | { kind: "running" }
    | { kind: "ok"; message: string }
    | { kind: "fail"; message: string }
  >({ kind: "idle" });
  const [showApiKey, setShowApiKey] = useState(false);

  const needsApiKey = providerNeedsApiKey(provider);
  const showsBaseUrl = providerShowsBaseUrl(provider);
  const disabled = !enabled;

  async function runTest() {
    setTestState({ kind: "running" });
    try {
      const sampleDiff =
        "diff --git a/README.md b/README.md\n@@ -1,1 +1,1 @@\n-Hello world.\n+Hello GitPulse.\n";
      const result = await generateCommitMessage(sampleDiff, {
        provider,
        apiKey,
        baseUrl,
        model,
        style,
        includeBody,
        maxDiffChars: maxDiff
      });
      const preview = result.subject || "(empty)";
      setTestState({ kind: "ok", message: `Connection OK — sample subject: ${preview}` });
    } catch (error) {
      setTestState({ kind: "fail", message: errorMessage(error) });
    }
  }

  return (
    <section className="settings-section">
      <div className="settings-section__title">AI Commit Messages</div>

      <SettingRow
        label="Enable AI commit messages"
        hint="Generate a suggested subject and optional body from the staged diff."
      >
        <SettingsCheckbox checked={enabled} onChange={setEnabled} />
      </SettingRow>

      <div className="ai-provider-block">
        <div className="ai-provider-block__heading">Provider</div>
        <div className="ai-provider-chooser">
          {AI_PROVIDER_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`ai-provider-chooser__chip${provider === option.value ? " is-active" : ""}`}
              disabled={disabled}
              onClick={() => setProvider(option.value)}
            >
              <span className="ai-provider-chooser__label">{option.label}</span>
              <span className="ai-provider-chooser__hint">{option.hint}</span>
            </button>
          ))}
        </div>

        <div className="ai-config-card">
          <div className="ai-config-card__row">
            <label className="ai-config-card__label" htmlFor="ai-model">
              Model
            </label>
            <input
              id="ai-model"
              className="settings-control"
              disabled={disabled}
              onChange={(event) => setModel(event.target.value)}
              placeholder={modelPlaceholder(provider)}
              value={model}
            />
          </div>

          {showsBaseUrl ? (
            <div className="ai-config-card__row">
              <label className="ai-config-card__label" htmlFor="ai-base-url">
                Base URL
              </label>
              <input
                id="ai-base-url"
                className="settings-control"
                disabled={disabled}
                onChange={(event) => setBaseUrl(event.target.value)}
                placeholder={baseUrlPlaceholder(provider)}
                value={baseUrl}
              />
            </div>
          ) : null}

          {needsApiKey ? (
            <div className="ai-config-card__row">
              <label className="ai-config-card__label" htmlFor="ai-api-key">
                API key
              </label>
              <div className="ai-config-card__field-with-status">
                <div className="ai-config-card__api-key-input">
                  <input
                    id="ai-api-key"
                    className="settings-control"
                    disabled={disabled}
                    onChange={(event) => setApiKey(event.target.value)}
                    placeholder={`${provider} API key`}
                    type={showApiKey ? "text" : "password"}
                    autoComplete="off"
                    spellCheck={false}
                    value={apiKey}
                  />
                  <button
                    type="button"
                    className="ai-config-card__reveal-toggle"
                    disabled={disabled}
                    onClick={() => setShowApiKey((value) => !value)}
                    title={showApiKey ? "Hide API key" : "Show API key"}
                    aria-label={showApiKey ? "Hide API key" : "Show API key"}
                    aria-pressed={showApiKey}
                  >
                    <Codicon name={showApiKey ? "eye-closed" : "eye"} size={14} />
                  </button>
                </div>
                <ApiKeyStatus state={saveState} hasValue={apiKey.trim().length > 0} />
              </div>
            </div>
          ) : null}

          <div className="ai-config-card__row">
            <label className="ai-config-card__label">Message style</label>
            <SettingsSelect
              disabled={disabled}
              onChange={(value) => setStyle(value as AiCommitStyle)}
              options={[
                { value: "conventional", label: "Conventional Commit" },
                { value: "plain", label: "Plain" }
              ]}
              value={style}
            />
          </div>

          <div className="ai-config-card__row">
            <label className="ai-config-card__label">Include description</label>
            <SettingsCheckbox
              checked={includeBody}
              disabled={disabled}
              onChange={setIncludeBody}
            />
          </div>

          <div className="ai-config-card__row">
            <label className="ai-config-card__label" htmlFor="ai-max-diff">
              Maximum diff size
            </label>
            <input
              id="ai-max-diff"
              className="settings-control settings-control--narrow"
              disabled={disabled}
              min={2000}
              max={100000}
              onChange={(event) => setMaxDiff(Number(event.target.value))}
              type="number"
              value={maxDiff}
            />
          </div>

          <div className="ai-config-card__test">
            <button
              type="button"
              className="vscode-button vscode-button--secondary"
              disabled={
                disabled ||
                testState.kind === "running" ||
                !model.trim() ||
                (needsApiKey && !apiKey.trim())
              }
              onClick={() => void runTest()}
            >
              {testState.kind === "running" ? "Testing…" : "Test connection"}
            </button>
            {testState.kind === "ok" ? (
              <span className="ai-config-card__test-result is-ok" title={testState.message}>
                <Codicon name="check" size={12} /> Connected
              </span>
            ) : null}
            {testState.kind === "fail" ? (
              <span className="ai-config-card__test-result is-fail" title={testState.message}>
                <Codicon name="error" size={12} /> {truncate(testState.message, 80)}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function ApiKeyStatus({ state, hasValue }: { state: ApiKeySaveState; hasValue: boolean }) {
  if (state.kind === "saving") {
    return (
      <span className="ai-config-card__save-state is-saving">
        <Codicon name="sync" size={12} /> Saving…
      </span>
    );
  }
  if (state.kind === "saved") {
    return (
      <span className="ai-config-card__save-state is-saved">
        <Codicon name="check" size={12} /> Saved
      </span>
    );
  }
  if (state.kind === "error") {
    return (
      <span
        className="ai-config-card__save-state is-error"
        title={state.message}
      >
        <Codicon name="error" size={12} /> Save failed
      </span>
    );
  }
  if (hasValue) {
    return <span className="ai-config-card__save-state is-stored">Stored</span>;
  }
  return null;
}

function modelPlaceholder(provider: AiCommitProvider) {
  switch (provider) {
    case "ollama":
      return "llama3.2";
    case "anthropic":
      return "claude-sonnet-4-...";
    case "deepseek":
      return "deepseek-chat";
    case "openai":
      return "gpt-4o-mini";
    default:
      return "model-id";
  }
}

function baseUrlPlaceholder(provider: AiCommitProvider) {
  return provider === "ollama" ? "http://localhost:11434" : "https://example.com/v1";
}

function truncate(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

interface CommitIdentitySectionProps {
  activeRepo: Repository | null;
  gitUser: UserInfo | null;
  repositories: Repository[];
}

function CommitIdentitySection({
  activeRepo,
  gitUser,
  repositories
}: CommitIdentitySectionProps) {
  const commitIdentities = useSettingsStore((state) => state.commitIdentities);
  const repoIdentityAssignments = useSettingsStore(
    (state) => state.repoIdentityAssignments
  );
  const addCommitIdentity = useSettingsStore((state) => state.addCommitIdentity);
  const updateCommitIdentity = useSettingsStore((state) => state.updateCommitIdentity);
  const removeCommitIdentity = useSettingsStore((state) => state.removeCommitIdentity);
  const assignRepoIdentity = useSettingsStore((state) => state.assignRepoIdentity);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Open the form by default when there are no identities yet.
  useEffect(() => {
    if (commitIdentities.length === 0) {
      setShowAddForm(true);
    }
  }, [commitIdentities.length]);

  const gitConfigSummary = useMemo(() => {
    if (gitUser?.name && gitUser.email) {
      return `Use Git config: ${formatIdentity(gitUser.name, gitUser.email)}`;
    }
    return "Use Git config";
  }, [gitUser]);

  return (
    <section className="settings-section">
      <div className="settings-section__title">Commit Identities</div>

      <div className="identity-manager">
        {commitIdentities.length === 0 ? (
          <div className="identity-manager__empty">
            Create at least one GitPulse identity to commit under a name and email that
            differs from your Git config. Each open repository can be assigned its own
            identity below.
          </div>
        ) : (
          <div className="identity-manager__list">
            {commitIdentities.map((identity) =>
              editingId === identity.id ? (
                <IdentityEditor
                  key={identity.id}
                  identity={identity}
                  defaultName={gitUser?.name}
                  defaultEmail={gitUser?.email}
                  submitLabel="Save"
                  onCancel={() => setEditingId(null)}
                  onSubmit={(next) => {
                    updateCommitIdentity(identity.id, next);
                    setEditingId(null);
                  }}
                />
              ) : (
                <div className="identity-card" key={identity.id}>
                  <div className="identity-card__body">
                    <div className="identity-card__label">{identity.label}</div>
                    <div className="identity-card__meta">
                      {formatIdentity(identity.name, identity.email)}
                    </div>
                  </div>
                  <div className="identity-card__actions">
                    <button
                      className="vscode-button vscode-button--secondary"
                      onClick={() => setEditingId(identity.id)}
                      type="button"
                    >
                      Edit
                    </button>
                    <button
                      className="vscode-button vscode-button--secondary"
                      onClick={() => removeCommitIdentity(identity.id)}
                      type="button"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        )}

        {showAddForm ? (
          <IdentityEditor
            defaultLabel={activeRepo ? `${activeRepo.name} identity` : ""}
            defaultName={gitUser?.name}
            defaultEmail={gitUser?.email}
            submitLabel="Add Identity"
            onCancel={commitIdentities.length === 0 ? undefined : () => setShowAddForm(false)}
            onSubmit={(next) => {
              const identity = addCommitIdentity(next);
              if (activeRepo && !repoIdentityAssignments[activeRepo.path]) {
                assignRepoIdentity(activeRepo.path, identity.id);
              }
              if (commitIdentities.length > 0) {
                setShowAddForm(false);
              }
            }}
          />
        ) : (
          <button
            type="button"
            className="vscode-button vscode-button--secondary identity-manager__add-toggle"
            onClick={() => setShowAddForm(true)}
          >
            <Codicon name="add" size={12} /> Add identity
          </button>
        )}

        {repositories.length > 0 ? (
          <div className="identity-assignments-table">
            <div className="identity-assignments-table__heading">
              Per-repository assignment
            </div>
            {repositories.map((repo) => (
              <div className="identity-assignments-table__row" key={repo.path}>
                <div className="identity-assignments-table__repo" title={repo.path}>
                  {repo.name}
                </div>
                <div className="identity-assignments-table__select">
                  <SettingsSelect
                    onChange={(value) =>
                      assignRepoIdentity(repo.path, value === "" ? null : value)
                    }
                    options={[
                      { value: "", label: gitConfigSummary },
                      ...commitIdentities.map((identity) => ({
                        value: identity.id,
                        label: `${identity.label} — ${formatIdentity(identity.name, identity.email)}`
                      }))
                    ]}
                    value={repoIdentityAssignments[repo.path] ?? ""}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

interface IdentityEditorProps {
  identity?: CommitIdentityProfile;
  defaultLabel?: string;
  defaultName?: string;
  defaultEmail?: string;
  submitLabel: string;
  onSubmit: (next: { label: string; name: string; email: string }) => void;
  onCancel?: () => void;
}

function IdentityEditor({
  identity,
  defaultLabel,
  defaultName,
  defaultEmail,
  submitLabel,
  onSubmit,
  onCancel
}: IdentityEditorProps) {
  const [label, setLabel] = useState(identity?.label ?? defaultLabel ?? "");
  const [name, setName] = useState(identity?.name ?? defaultName ?? "");
  const [email, setEmail] = useState(identity?.email ?? defaultEmail ?? "");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const message = validateIdentityFields(label, name, email);
    if (message) {
      setError(message);
      return;
    }
    onSubmit({ label: label.trim(), name: name.trim(), email: email.trim() });
  }

  return (
    <div className="identity-form">
      <input
        className="settings-control"
        onChange={(event) => setLabel(event.target.value)}
        placeholder="Label, e.g. Work GitLab"
        value={label}
      />
      <input
        className="settings-control"
        onChange={(event) => setName(event.target.value)}
        placeholder="Git user.name"
        value={name}
      />
      <input
        className="settings-control"
        onChange={(event) => setEmail(event.target.value)}
        placeholder="Git user.email"
        value={email}
      />
      {error ? <div className="identity-form__error">{error}</div> : null}
      <div className="identity-form__actions">
        <button
          className="vscode-button vscode-button--primary"
          onClick={submit}
          type="button"
        >
          {submitLabel}
        </button>
        {onCancel ? (
          <button
            className="vscode-button vscode-button--secondary"
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </div>
  );
}

function UpdateCheck() {
  const pushNotification = useNotificationStore((state) => state.pushNotification);
  const [status, setStatus] = useState<
    | { kind: "idle"; version: string | null }
    | { kind: "checking" }
    | { kind: "up-to-date"; version: string }
    | { kind: "available"; current: string; latest: string; url: string | null }
    | { kind: "error"; message: string }
  >({ kind: "idle", version: null });

  async function runCheck() {
    setStatus({ kind: "checking" });
    try {
      const result = await checkForUpdate();
      if (result.hasUpdate && result.latestVersion) {
        setStatus({
          kind: "available",
          current: result.currentVersion,
          latest: result.latestVersion,
          url: result.releaseUrl
        });
        pushNotification({
          id: createId(),
          title: `GitPulse v${result.latestVersion} is available`,
          message: `You are on v${result.currentVersion}.`,
          tone: "info",
          actionLabel: result.releaseUrl ? "Open release page" : undefined,
          onAction: result.releaseUrl
            ? () => {
                void openReleasePage(result.releaseUrl!);
              }
            : undefined
        });
      } else {
        setStatus({ kind: "up-to-date", version: result.currentVersion });
      }
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }

  const label = (() => {
    switch (status.kind) {
      case "idle":
        return status.version ? `v${status.version}` : "—";
      case "checking":
        return "Checking…";
      case "up-to-date":
        return `v${status.version} — up to date`;
      case "available":
        return `v${status.current} → v${status.latest} available`;
      case "error":
        return `Check failed: ${status.message}`;
    }
  })();

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span className="settings-readonly">{label}</span>
      <button
        type="button"
        className="vscode-button"
        onClick={() => void runCheck()}
        disabled={status.kind === "checking"}
      >
        {status.kind === "available" && status.url ? "Open release page" : "Check for updates"}
      </button>
      {status.kind === "available" && status.url ? (
        <button
          type="button"
          className="vscode-button vscode-button--primary"
          onClick={() => {
            void openReleasePage(status.url!);
          }}
        >
          Open release page
        </button>
      ) : null}
    </div>
  );
}

export function SettingsCheckbox({
  checked,
  disabled,
  onChange
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="settings-checkbox">
      <input
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <span className="settings-checkbox__box" aria-hidden>
        <svg className="settings-checkbox__check" viewBox="0 0 16 16" width="12" height="12">
          <path
            d="M3.5 8.5L6.5 11.5L12.5 5.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </label>
  );
}

interface SettingsSelectOption {
  value: string;
  label: string;
}

function SettingsSelect({
  value,
  options,
  disabled = false,
  onChange
}: {
  value: string;
  options: SettingsSelectOption[];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div className="settings-select" ref={rootRef}>
      <button
        className="settings-control settings-select__button"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <span>{selected?.label ?? ""}</span>
        <span aria-hidden>{open ? "▴" : "▾"}</span>
      </button>
      {open ? (
        <div className="settings-select__menu">
          {options.map((option) => (
            <button
              className={`settings-select__option${option.value === value ? " is-selected" : ""}`}
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SettingRow({
  label,
  hint,
  children
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="settings-row">
      <div className="settings-row__label">
        <div className="settings-row__name">{label}</div>
        {hint ? <div className="settings-row__hint">{hint}</div> : null}
      </div>
      <div className="settings-row__control">{children}</div>
    </div>
  );
}
