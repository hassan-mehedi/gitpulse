import { useEffect, useState } from "react";
import { useSettingsStore } from "../../stores/settings";
import { useRuntimeStore } from "../../stores/runtime";
import { useRepo } from "../../hooks/useRepo";
import { formatIdentity, validateIdentityFields } from "../../lib/commitIdentity";
import { gitGetUserInfo } from "../../lib/git";
import { THEME_OPTIONS, type ThemeMode } from "../../lib/theme";
import type { UserInfo } from "../../types/git";

export function SettingsPanel() {
  const { activeRepo } = useRepo();
  const theme = useSettingsStore((state) => state.theme);
  const autoFetch = useSettingsStore((state) => state.autoFetch);
  const autoFetchIntervalSeconds = useSettingsStore((state) => state.autoFetchIntervalSeconds);
  const smartCommit = useSettingsStore((state) => state.smartCommit);
  const signCommits = useSettingsStore((state) => state.signCommits);
  const externalEditorCommand = useSettingsStore((state) => state.externalEditorCommand);
  const commitIdentities = useSettingsStore((state) => state.commitIdentities);
  const repoIdentityAssignments = useSettingsStore((state) => state.repoIdentityAssignments);
  const setTheme = useSettingsStore((state) => state.setTheme);
  const setAutoFetch = useSettingsStore((state) => state.setAutoFetch);
  const setAutoFetchIntervalSeconds = useSettingsStore(
    (state) => state.setAutoFetchIntervalSeconds
  );
  const setSmartCommit = useSettingsStore((state) => state.setSmartCommit);
  const setSignCommits = useSettingsStore((state) => state.setSignCommits);
  const setExternalEditorCommand = useSettingsStore((state) => state.setExternalEditorCommand);
  const addCommitIdentity = useSettingsStore((state) => state.addCommitIdentity);
  const removeCommitIdentity = useSettingsStore((state) => state.removeCommitIdentity);
  const assignRepoIdentity = useSettingsStore((state) => state.assignRepoIdentity);
  const gitVersion = useRuntimeStore((state) => state.gitVersion);
  const [gitUser, setGitUser] = useState<UserInfo | null>(null);
  const [identityLabel, setIdentityLabel] = useState("");
  const [identityName, setIdentityName] = useState("");
  const [identityEmail, setIdentityEmail] = useState("");
  const [identityError, setIdentityError] = useState<string | null>(null);

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
            <select
              className="settings-control"
              onChange={(event) => setTheme(event.target.value as ThemeMode)}
              value={theme}
            >
              {THEME_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
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
            <select
              className="settings-control"
              disabled={!activeRepo}
              onChange={(event) =>
                activeRepo
                  ? assignRepoIdentity(activeRepo.path, event.target.value || null)
                  : undefined
              }
              value={activeRepo ? repoIdentityAssignments[activeRepo.path] ?? "" : ""}
            >
              <option value="">
                {gitUser?.name && gitUser.email
                  ? `Use Git config: ${formatIdentity(gitUser.name, gitUser.email)}`
                  : "No GitPulse identity assigned"}
              </option>
              {commitIdentities.map((identity) => (
                <option key={identity.id} value={identity.id}>
                  {identity.label} — {formatIdentity(identity.name, identity.email)}
                </option>
              ))}
            </select>
          </SettingRow>
          <SettingRow
            label="Smart Commit"
            hint="When nothing is staged, auto-stage tracked modified/deleted files before committing."
          >
            <SettingsCheckbox checked={smartCommit} onChange={setSmartCommit} />
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
            <span className="settings-readonly">0.1.0 — dev</span>
          </SettingRow>
        </section>
      </div>
    </>
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
