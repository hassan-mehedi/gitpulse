import { useEffect, useState } from "react";
import { useRepo } from "../../hooks/useRepo";
import { formatIdentity, validateIdentityFields } from "../../lib/commitIdentity";
import { gitGetUserInfo } from "../../lib/git";
import { useSettingsStore } from "../../stores/settings";
import type { UserInfo } from "../../types/git";
import { Modal } from "../shared/Modal";

export function CommitIdentityOnboarding() {
  const { activeRepo } = useRepo();
  const hydrated = useSettingsStore((state) => state.hydrated);
  const identities = useSettingsStore((state) => state.commitIdentities);
  const addCommitIdentity = useSettingsStore((state) => state.addCommitIdentity);
  const assignRepoIdentity = useSettingsStore((state) => state.assignRepoIdentity);
  const [gitUser, setGitUser] = useState<UserInfo | null>(null);
  const [label, setLabel] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeRepo) {
      setGitUser(null);
      return;
    }

    let cancelled = false;
    void gitGetUserInfo(activeRepo.path)
      .then((user) => {
        if (cancelled) return;
        setGitUser(user);
        if (user.name && user.email) {
          setLabel((value) => value || `${activeRepo.name} identity`);
          setName((value) => value || user.name || "");
          setEmail((value) => value || user.email || "");
        }
      })
      .catch(() => {
        if (!cancelled) setGitUser(null);
      });

    return () => {
      cancelled = true;
    };
  }, [activeRepo]);

  if (!hydrated || identities.length > 0) {
    return null;
  }

  function createIdentity() {
    const validationError = validateIdentityFields(label, name, email);
    if (validationError) {
      setError(validationError);
      return;
    }
    const identity = addCommitIdentity({
      label: label.trim(),
      name: name.trim(),
      email: email.trim()
    });
    if (activeRepo) {
      assignRepoIdentity(activeRepo.path, identity.id);
    }
    setError(null);
  }

  return (
    <Modal isOpen title="Create Commit Identity" onClose={() => {}} className="identity-onboarding">
      <div className="identity-onboarding__content">
        <p>
          GitPulse needs at least one commit identity. This is only used for commit authorship;
          push and pull authentication still use your normal Git credentials.
        </p>
        {gitUser?.name && gitUser.email ? (
          <div className="identity-onboarding__detected">
            Detected from Git config: {formatIdentity(gitUser.name, gitUser.email)}
          </div>
        ) : null}
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
        <button className="vscode-button vscode-button--primary" onClick={createIdentity} type="button">
          Create Identity
        </button>
      </div>
    </Modal>
  );
}
