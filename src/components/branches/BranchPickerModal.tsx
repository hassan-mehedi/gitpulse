import { useEffect, useMemo, useState } from "react";
import { Codicon } from "../shared/Codicon";
import { gitBranches, gitCreateBranch, gitSwitchBranch } from "../../lib/git";
import { findTrackedLocalBranch, formatBranchMeta, inferLocalBranchName } from "../../lib/branches";
import { useGit } from "../../hooks/useGit";
import { useRepo } from "../../hooks/useRepo";
import { useWorkspaceStore } from "../../stores/workspace";
import type { BranchInfo } from "../../types/git";
import { Modal } from "../shared/Modal";

interface BranchPickerModalProps {
  isOpen: boolean;
  initialCreateMode?: boolean;
  onClose: () => void;
}

export function BranchPickerModal({
  isOpen,
  initialCreateMode = false,
  onClose
}: BranchPickerModalProps) {
  const { activeRepo } = useRepo();
  const refreshRepo = useWorkspaceStore((state) => state.refreshRepo);
  const runGit = useGit();
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [query, setQuery] = useState("");
  const [createMode, setCreateMode] = useState(initialCreateMode);
  const [newBranchName, setNewBranchName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

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
    return branches.filter((branch) => branch.name.toLowerCase().includes(normalizedQuery));
  }, [branches, query]);

  async function handleCheckout(branch: BranchInfo) {
    if (!activeRepo) {
      return;
    }

    await runGit(async () => {
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
      await gitCreateBranch(activeRepo.path, newBranchName.trim());
      await refreshRepo(activeRepo.path);
      setNewBranchName("");
      onClose();
    });
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Branch Picker">
      {!activeRepo ? (
        <div className="empty-state__body">No repository loaded.</div>
      ) : (
        <div className="repo-card__section">
          <div className="toolbar__actions">
            <input
              className="text-input"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search branches"
              value={query}
            />
            <button className="panel-button" onClick={() => setCreateMode((value) => !value)} type="button">
              <Codicon name="plus" size={14} />
              {createMode ? "Hide Create" : "Create Branch"}
            </button>
          </div>

          {createMode ? (
            <div className="repo-card__section">
              <input
                className="text-input"
                onChange={(event) => setNewBranchName(event.target.value)}
                placeholder="feature/new-branch"
                value={newBranchName}
              />
              <button className="panel-button" onClick={() => void handleCreate()} type="button">
                Create and Checkout
              </button>
            </div>
          ) : null}

          <div className="file-list">
            {isLoading ? (
              <div className="file-row">
                <div className="file-row__left">
                  <span className="file-row__path">Loading branches…</span>
                </div>
              </div>
            ) : null}

            {!isLoading && loadError ? (
              <div className="file-row">
                <div className="file-row__left">
                  <span className="file-row__path">Failed to load branches: {loadError}</span>
                </div>
              </div>
            ) : null}

            {!isLoading && !loadError && filteredBranches.length === 0 ? (
              <div className="file-row">
                <div className="file-row__left">
                  <span className="file-row__path">
                    {query.trim()
                      ? "No matching branches"
                      : "No branches available yet. Create the first branch or commit to this repository."}
                  </span>
                </div>
              </div>
            ) : null}

            {filteredBranches.map((branch) => (
              <button
                className={`file-row ${branch.isCurrent ? "is-active" : ""}`}
                key={branch.name}
                onClick={() => void handleCheckout(branch)}
                type="button"
              >
                <div className="file-row__left">
                  <div className="badge">{branch.isRemote ? "Remote" : branch.isCurrent ? "HEAD" : "Local"}</div>
                  <div>
                    <div className="file-row__name">{branch.name}</div>
                    <div className="file-row__path">{formatBranchMeta(branch)}</div>
                  </div>
                </div>
                <div className="file-row__actions">
                  {!branch.isCurrent ? (
                    <span className="panel-button">
                      {branch.isRemote && findTrackedLocalBranch(branches, branch) ? "Checkout" : branch.isRemote ? "Track" : "Checkout"}
                    </span>
                  ) : null}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
