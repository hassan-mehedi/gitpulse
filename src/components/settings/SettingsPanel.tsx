import { useEffect, useRef, useState } from "react";
import { useSettingsStore } from "../../stores/settings";
import { useRuntimeStore } from "../../stores/runtime";
import { useWorkspaceStore } from "../../stores/workspace";
import { useNotificationStore } from "../../stores/notifications";
import { useRepo } from "../../hooks/useRepo";
import { formatIdentity, resolveCommitIdentity, validateIdentityFields } from "../../lib/commitIdentity";
import { gitGetUserInfo } from "../../lib/git";
import { THEME_OPTIONS, type ThemeMode } from "../../lib/theme";
import { checkForUpdate, openReleasePage } from "../../lib/updates";
import { createId } from "../../lib/ids";
import type { UserInfo } from "../../types/git";

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
  const aiCommitEnabled = useSettingsStore((state) => state.aiCommitEnabled);
  const aiCommitProvider = useSettingsStore((state) => state.aiCommitProvider);
  const aiCommitApiKey = useSettingsStore((state) => state.aiCommitApiKey);
  const aiCommitBaseUrl = useSettingsStore((state) => state.aiCommitBaseUrl);
  const aiCommitModel = useSettingsStore((state) => state.aiCommitModel);
  const aiCommitStyle = useSettingsStore((state) => state.aiCommitStyle);
  const aiCommitIncludeBody = useSettingsStore((state) => state.aiCommitIncludeBody);
  const aiCommitMaxDiffChars = useSettingsStore((state) => state.aiCommitMaxDiffChars);
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
  const setAiCommitEnabled = useSettingsStore((state) => state.setAiCommitEnabled);
  const setAiCommitProvider = useSettingsStore((state) => state.setAiCommitProvider);
  const setAiCommitApiKey = useSettingsStore((state) => state.setAiCommitApiKey);
  const setAiCommitBaseUrl = useSettingsStore((state) => state.setAiCommitBaseUrl);
  const setAiCommitModel = useSettingsStore((state) => state.setAiCommitModel);
  const setAiCommitStyle = useSettingsStore((state) => state.setAiCommitStyle);
  const setAiCommitIncludeBody = useSettingsStore((state) => state.setAiCommitIncludeBody);
  const setAiCommitMaxDiffChars = useSettingsStore((state) => state.setAiCommitMaxDiffChars);
  const addCommitIdentity = useSettingsStore((state) => state.addCommitIdentity);
  const removeCommitIdentity = useSettingsStore((state) => state.removeCommitIdentity);
  const assignRepoIdentity = useSettingsStore((state) => state.assignRepoIdentity);
  const gitVersion = useRuntimeStore((state) => state.gitVersion);
  const repositories = useWorkspaceStore((state) => state.repositories);
  const [gitUser, setGitUser] = useState<UserInfo | null>(null);
  const [identityLabel, setIdentityLabel] = useState("");
  const [identityName, setIdentityName] = useState("");
  const [identityEmail, setIdentityEmail] = useState("");
  const [identityError, setIdentityError] = useState<string | null>(null);
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

  function addIdentity() {
    const error = validateIdentityFields(identityLabel, identityName, identityEmail);
    if (error) {
      setIdentityError(error);
      return;
    }
    const identity = addCommitIdentity({
      label: identityLabel.trim(),
      name: identityName.trim(),
      email: identityEmail.trim()
    });
    if (activeRepo && !repoIdentityAssignments[activeRepo.path]) {
      assignRepoIdentity(activeRepo.path, identity.id);
    }
    setIdentityLabel("");
    setIdentityName("");
    setIdentityEmail("");
    setIdentityError(null);
  }

  function importActiveGitConfig() {
    if (!gitUser?.name || !gitUser.email) return;
    setIdentityLabel(activeRepo ? `${activeRepo.name} identity` : "Git config identity");
    setIdentityName(gitUser.name);
    setIdentityEmail(gitUser.email);
    setIdentityError(null);
  }

  return (
    <>
      <div className="view-title">
        <h2 className="view-title__label">Settings</h2>
      </div>

      <div className="scm-body settings-panel">
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

        <section className="settings-section">
          <div className="settings-section__title">Git</div>
          <SettingRow
            label="Commit identity for this repository"
            hint={
              activeRepo
                ? "GitPulse uses the selected identity for commits in this repository only."
                : "Open a repository to assign an identity."
            }
          >
            <SettingsSelect
              disabled={!activeRepo}
              onChange={(value) =>
                activeRepo
                  ? assignRepoIdentity(activeRepo.path, value || null)
                  : undefined
              }
              options={[
                {
                  value: "",
                  label:
                    gitUser?.name && gitUser.email
                      ? `Use Git config: ${formatIdentity(gitUser.name, gitUser.email)}`
                      : "No GitPulse identity assigned"
                },
                ...commitIdentities.map((identity) => ({
                  value: identity.id,
                  label: `${identity.label} — ${formatIdentity(identity.name, identity.email)}`
                }))
              ]}
              value={activeRepo ? repoIdentityAssignments[activeRepo.path] ?? "" : ""}
            />
          </SettingRow>
          <SettingRow
            label="Effective identity"
            hint={
              effectiveIdentity.source === "gitpulse"
                ? "GitPulse overrides repository Git config for commits."
                : effectiveIdentity.source === "git-config"
                  ? "GitPulse is using this repository's Git config."
                  : "Commits will fail until Git config or a GitPulse identity is available."
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

        <section className="settings-section">
          <div className="settings-section__title">AI Commit Messages</div>
          <SettingRow
            label="Enable AI commit messages"
            hint="Generate a suggested subject and optional body from the staged diff."
          >
            <SettingsCheckbox checked={aiCommitEnabled} onChange={setAiCommitEnabled} />
          </SettingRow>
          <SettingRow label="Provider">
            <SettingsSelect
              disabled={!aiCommitEnabled}
              onChange={(value) => setAiCommitProvider(value as typeof aiCommitProvider)}
              options={[
                { value: "ollama", label: "Ollama" },
                { value: "openai", label: "OpenAI" },
                { value: "anthropic", label: "Anthropic" },
                { value: "deepseek", label: "DeepSeek" },
                { value: "openai-compatible", label: "OpenAI-compatible" }
              ]}
              value={aiCommitProvider}
            />
          </SettingRow>
          <SettingRow
            label="Model"
            hint={
              aiCommitProvider === "ollama"
                ? "Name of a local Ollama model."
                : "Provider model ID."
            }
          >
            <input
              className="settings-control"
              disabled={!aiCommitEnabled}
              onChange={(event) => setAiCommitModel(event.target.value)}
              placeholder={
                aiCommitProvider === "ollama"
                  ? "llama3.2"
                  : aiCommitProvider === "anthropic"
                    ? "claude-sonnet-4-..."
                    : aiCommitProvider === "deepseek"
                      ? "deepseek-v4-flash"
                    : "model-id"
              }
              value={aiCommitModel}
            />
          </SettingRow>
          {aiCommitProvider !== "openai" &&
          aiCommitProvider !== "anthropic" &&
          aiCommitProvider !== "deepseek" ? (
            <SettingRow
              label="Base URL"
              hint={
                aiCommitProvider === "ollama"
                  ? "Local Ollama server URL."
                  : "Server URL ending before `/responses`."
              }
            >
              <input
                className="settings-control"
                disabled={!aiCommitEnabled}
                onChange={(event) => setAiCommitBaseUrl(event.target.value)}
                placeholder={
                  aiCommitProvider === "ollama"
                    ? "http://localhost:11434"
                    : "https://example.com/v1"
                }
                value={aiCommitBaseUrl}
              />
            </SettingRow>
          ) : null}
          {aiCommitProvider !== "ollama" ? (
            <SettingRow label="API key" hint="Stored in the operating system credential store.">
              <input
                className="settings-control"
                disabled={!aiCommitEnabled}
                onChange={(event) => setAiCommitApiKey(event.target.value)}
                placeholder="API key"
                type="password"
                value={aiCommitApiKey}
              />
            </SettingRow>
          ) : null}
          <SettingRow label="Message style">
            <SettingsSelect
              disabled={!aiCommitEnabled}
              onChange={(value) => setAiCommitStyle(value as typeof aiCommitStyle)}
              options={[
                { value: "conventional", label: "Conventional Commit" },
                { value: "plain", label: "Plain" }
              ]}
              value={aiCommitStyle}
            />
          </SettingRow>
          <SettingRow label="Include description" hint="Allow the model to add a short commit body.">
            <SettingsCheckbox
              checked={aiCommitIncludeBody}
              disabled={!aiCommitEnabled}
              onChange={setAiCommitIncludeBody}
            />
          </SettingRow>
          <SettingRow
            label="Maximum diff size"
            hint="Characters sent from the staged diff. Keep local models near 8000 unless they have a larger context window."
          >
            <input
              className="settings-control settings-control--narrow"
              disabled={!aiCommitEnabled}
              min={2000}
              max={100000}
              onChange={(event) => setAiCommitMaxDiffChars(Number(event.target.value))}
              type="number"
              value={aiCommitMaxDiffChars}
            />
          </SettingRow>
        </section>

        <section className="settings-section">
          <div className="settings-section__title">Commit Identities</div>
          <div className="identity-manager">
            {commitIdentities.length === 0 ? (
              <div className="identity-manager__empty">
                Create at least one GitPulse identity to make commit authorship explicit.
              </div>
            ) : (
              <div className="identity-manager__list">
                {commitIdentities.map((identity) => (
                  <div className="identity-card" key={identity.id}>
                    <div>
                      <div className="identity-card__label">{identity.label}</div>
                      <div className="identity-card__meta">
                        {formatIdentity(identity.name, identity.email)}
                      </div>
                    </div>
                    <button
                      className="vscode-button vscode-button--secondary"
                      onClick={() => removeCommitIdentity(identity.id)}
                      type="button"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
            {repositories.length > 0 ? (
              <div className="identity-assignments">
                {repositories.map((repo) => {
                  const assigned = commitIdentities.find(
                    (identity) => identity.id === repoIdentityAssignments[repo.path]
                  );
                  return (
                    <div className="identity-assignment" key={repo.path}>
                      <span>{repo.name}</span>
                      <span>{assigned?.label ?? "Git config"}</span>
                    </div>
                  );
                })}
              </div>
            ) : null}
            <div className="identity-form">
              <input
                className="settings-control"
                onChange={(event) => setIdentityLabel(event.target.value)}
                placeholder="Label, e.g. Work GitLab"
                value={identityLabel}
              />
              <input
                className="settings-control"
                onChange={(event) => setIdentityName(event.target.value)}
                placeholder="Git user.name"
                value={identityName}
              />
              <input
                className="settings-control"
                onChange={(event) => setIdentityEmail(event.target.value)}
                placeholder="Git user.email"
                value={identityEmail}
              />
              {identityError ? <div className="identity-form__error">{identityError}</div> : null}
              <div className="identity-form__actions">
                <button className="vscode-button vscode-button--primary" onClick={addIdentity} type="button">
                  Add Identity
                </button>
                <button
                  className="vscode-button vscode-button--secondary"
                  disabled={!gitUser?.name || !gitUser.email}
                  onClick={importActiveGitConfig}
                  type="button"
                >
                  Import Active Git Config
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="settings-section">
          <div className="settings-section__title">About</div>
          <SettingRow label="Git binary">
            <span className="settings-readonly">{gitVersion ?? "Detecting…"}</span>
          </SettingRow>
          <SettingRow label="GitPulse">
            <UpdateCheck />
          </SettingRow>
        </section>
      </div>
    </>
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
