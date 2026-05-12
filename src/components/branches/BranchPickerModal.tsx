import { useEffect, useMemo, useState } from "react";
import { Codicon } from "../shared/Codicon";
import { gitBranches, gitCreateBranch, gitSwitchBranch } from "../../lib/git";
import { findTrackedLocalBranch, formatBranchMeta, inferLocalBranchName } from "../../lib/branches";
import { useGit } from "../../hooks/useGit";
import { useWorkspaceStore } from "../../stores/workspace";
import type { BranchInfo } from "../../types/git";
import { Modal } from "../shared/Modal";

interface BranchPickerModalProps {
  isOpen: boolean;
  targetRepoId?: string | null;
  initialCreateMode?: boolean;
  onClose: () => void;
}

export function BranchPickerModal({
  isOpen,
  targetRepoId,
  initialCreateMode = false,
  onClose
}: BranchPickerModalProps) {
  const repositories = useWorkspaceStore((state) => state.repositories);
  const activeRepoId = useWorkspaceStore((state) => state.activeRepoId);
  const refreshRepo = useWorkspaceStore((state) => state.refreshRepo);
  const setActiveRepo = useWorkspaceStore((state) => state.setActiveRepo);
  const runGit = useGit();
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [query, setQuery] = useState("");
  const [createMode, setCreateMode] = useState(initialCreateMode);
  const [newBranchName, setNewBranchName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const activeRepo =
    repositories.find((repo) => repo.id === (targetRepoId ?? activeRepoId)) ??
    repositories.find((repo) => repo.id === activeRepoId) ??
    repositories[0] ??
    null;

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setCreateMode(initialCreateMode);
    setQuery("");
    setNewBranchName("");
    setLoadError(null);
  }, [initialCreateMode, isOpen]);

  useEffect(() => {
    if (!isOpen || !activeRepo) {
      setBranches([]);
      setLoadError(null);
      return;
    }

    setIsLoading(true);
    setLoadError(null);
    void runGit(() => gitBranches(activeRepo.path))
      .then((nextBranches) => setBranches(nextBranches))
      .catch((error) => {
        const detail =
          (error as { message?: string; stderr?: string })?.message ??
          (error as { stderr?: string })?.stderr ??
          String(error);
        setLoadError(detail);
        setBranches([]);
      })
      .finally(() => setIsLoading(false));
  }, [activeRepo?.path, isOpen, runGit]);

  const filteredBranches = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = branches.filter((branch) => branch.name.toLowerCase().includes(normalizedQuery));
    return [...filtered].sort((left, right) => {
      if (left.isCurrent !== right.isCurrent) return left.isCurrent ? -1 : 1;
      if (left.isRemote !== right.isRemote) return left.isRemote ? 1 : -1;
      return left.name.localeCompare(right.name);
    });
  }, [branches, query]);

  const localBranches = filteredBranches.filter((branch) => !branch.isRemote);
  const remoteBranches = filteredBranches.filter((branch) => branch.isRemote);
  const canCreateFromQuery = query.trim().length > 0 && !branches.some((branch) => branch.name === query.trim());

  async function handleCheckout(branch: BranchInfo) {
    if (!activeRepo) {
      return;
    }

    await runGit(async () => {
      setActiveRepo(activeRepo.id);
      if (branch.isRemote) {
        const trackedLocal = findTrackedLocalBranch(branches, branch);
        if (trackedLocal && !trackedLocal.isRemote) {
          await gitSwitchBranch(activeRepo.path, trackedLocal.name);
        } else {
          const localName = inferLocalBranchName(branch.name);
          await gitCreateBranch(activeRepo.path, localName, branch.name);
        }
      } else {
        await gitSwitchBranch(activeRepo.path, branch.name);
      }

      await refreshRepo(activeRepo.path);
      onClose();
    });
  }

  async function handleCreate() {
    if (!activeRepo || !newBranchName.trim()) {
      return;
    }

    await runGit(async () => {
      setActiveRepo(activeRepo.id);
      await gitCreateBranch(activeRepo.path, newBranchName.trim());
      await refreshRepo(activeRepo.path);
      setNewBranchName("");
      onClose();
    });
  }

  async function handleCreateFromCurrentQuery() {
    if (!activeRepo || !query.trim()) {
      return;
    }

    await runGit(async () => {
      setActiveRepo(activeRepo.id);
      await gitCreateBranch(activeRepo.path, query.trim());
      await refreshRepo(activeRepo.path);
      onClose();
    });
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Branch Picker"
      className="branch-picker-modal"
      bodyClassName="branch-picker-modal__body"
    >
      {!activeRepo ? (
        <div className="empty-state__body">No repository loaded.</div>
      ) : (
        <div className="branch-picker">
          <div className="branch-picker__toolbar">
            <input
              autoFocus
              className="branch-picker__input"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Select a branch or tag to checkout"
              value={query}
            />
          </div>

          <div className="branch-picker__list" role="listbox" aria-label={`Branches for ${activeRepo.name}`}>
            <button
              className="branch-picker__action"
              onClick={() => setCreateMode((value) => !value)}
              type="button"
            >
              <Codicon name="plus" size={14} />
              <span>{createMode ? "Hide create branch…" : "Create new branch…"}</span>
            </button>

            {canCreateFromQuery ? (
              <button
                className="branch-picker__action"
                onClick={() => void handleCreateFromCurrentQuery()}
                type="button"
              >
                <Codicon name="git-branch" size={14} />
                <span>Create branch '{query.trim()}'</span>
              </button>
            ) : null}

            {createMode ? (
              <div className="branch-picker__create">
                <label className="branch-picker__create-label">
                  <span>New branch name</span>
                  <input
                    className="branch-picker__input"
                    onChange={(event) => setNewBranchName(event.target.value)}
                    placeholder="feature/new-branch"
                    value={newBranchName}
                  />
                </label>
                <button
                  className="vscode-button vscode-button--primary"
                  onClick={() => void handleCreate()}
                  type="button"
                >
                  Create and Checkout
                </button>
              </div>
            ) : null}

            {isLoading ? (
              <div className="branch-picker__empty">Loading branches…</div>
            ) : null}

            {!isLoading && loadError ? (
              <div className="branch-picker__empty">Failed to load branches: {loadError}</div>
            ) : null}

            {!isLoading && !loadError && filteredBranches.length === 0 ? (
              <div className="branch-picker__empty">
                {query.trim()
                  ? "No matching branches"
                  : "No branches available yet. Create the first branch or commit to this repository."}
              </div>
            ) : null}

            {!isLoading && !loadError && localBranches.length > 0 ? (
              <>
                <div className="branch-picker__section-label">Branches</div>
                {localBranches.map((branch) => (
                  <button
                    className={`branch-picker__item${branch.isCurrent ? " is-current" : ""}`}
                    key={branch.name}
                    onClick={() => void handleCheckout(branch)}
                    type="button"
                  >
                    <div className="branch-picker__item-main">
                      <div className="branch-picker__item-title">
                        <Codicon
                          name={branch.isCurrent ? "check" : "git-branch"}
                          size={14}
                        />
                        <span>{branch.name}</span>
                        {branch.isCurrent ? (
                          <span className="branch-picker__badge">HEAD</span>
                        ) : null}
                      </div>
                      <div className="branch-picker__item-meta">{formatBranchMeta(branch)}</div>
                    </div>
                  </button>
                ))}
              </>
            ) : null}

            {!isLoading && !loadError && remoteBranches.length > 0 ? (
              <>
                <div className="branch-picker__section-label">Remote Branches</div>
                {remoteBranches.map((branch) => (
                  <button
                    className="branch-picker__item"
                    key={branch.name}
                    onClick={() => void handleCheckout(branch)}
                    type="button"
                  >
                    <div className="branch-picker__item-main">
                      <div className="branch-picker__item-title">
                        <Codicon name="remote" size={14} />
                        <span>{branch.name}</span>
                      </div>
                      <div className="branch-picker__item-meta">{formatBranchMeta(branch)}</div>
                    </div>
                  </button>
                ))}
              </>
            ) : null}
          </div>
        </div>
      )}
    </Modal>
  );
}
