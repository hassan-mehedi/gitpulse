import { useEffect, useMemo, useState } from "react";
import { GitBranchPlus, RefreshCcw } from "lucide-react";
import {
  gitBranches,
  gitCreateBranch,
  gitDeleteBranch,
  gitRenameBranch,
  gitSwitchBranch
} from "../../lib/git";
import { useGit } from "../../hooks/useGit";
import { useRepo } from "../../hooks/useRepo";
import { useWorkspaceStore } from "../../stores/workspace";
import type { BranchInfo } from "../../types/git";
import { BranchList } from "./BranchList";

export function BranchManager() {
  const { activeRepo } = useRepo();
  const refreshRepo = useWorkspaceStore((state) => state.refreshRepo);
  const runGit = useGit();
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [query, setQuery] = useState("");
  const [newBranchName, setNewBranchName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function loadBranches() {
    if (!activeRepo) {
      setBranches([]);
      return;
    }

    setIsLoading(true);
    try {
      const nextBranches = await runGit(() => gitBranches(activeRepo.path));
      setBranches(nextBranches);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadBranches();
  }, [activeRepo?.path]);

  const filteredBranches = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return branches.filter((branch) => branch.name.toLowerCase().includes(normalizedQuery));
  }, [branches, query]);

  const localBranches = filteredBranches.filter((branch) => !branch.isRemote);
  const remoteBranches = filteredBranches.filter((branch) => branch.isRemote);

  async function handleCreateBranch() {
    if (!activeRepo || !newBranchName.trim()) {
      return;
    }

    await runGit(async () => {
      await gitCreateBranch(activeRepo.path, newBranchName.trim());
      setNewBranchName("");
      await refreshRepo(activeRepo.path);
      await loadBranches();
    });
  }

  async function handleSwitchBranch(branch: BranchInfo) {
    if (!activeRepo) {
      return;
    }

    await runGit(async () => {
      await gitSwitchBranch(activeRepo.path, branch.name);
      await refreshRepo(activeRepo.path);
      await loadBranches();
    });
  }

  async function handleRenameBranch(branch: BranchInfo) {
    if (!activeRepo) {
      return;
    }

    const nextName = window.prompt(`Rename branch "${branch.name}" to:`, branch.name);
    if (!nextName || nextName.trim() === branch.name) {
      return;
    }

    await runGit(async () => {
      await gitRenameBranch(activeRepo.path, branch.name, nextName.trim());
      await refreshRepo(activeRepo.path);
      await loadBranches();
    });
  }

  async function handleDeleteBranch(branch: BranchInfo) {
    if (!activeRepo) {
      return;
    }

    await runGit(async () => {
      await gitDeleteBranch(activeRepo.path, branch.name, !branch.isCurrent);
      await refreshRepo(activeRepo.path);
      await loadBranches();
    });
  }

  return (
    <>
      <div className="panel-header">
        <div>
          <div className="panel-header__eyebrow">Branches</div>
          <div className="panel-header__title">Branch Manager</div>
        </div>
        <div className="toolbar__actions">
          <button className="icon-button" onClick={() => void loadBranches()} type="button">
            <RefreshCcw size={16} />
          </button>
        </div>
      </div>

      <div className="repo-section-list">
        {!activeRepo ? (
          <div className="empty-state__card">
            <div className="empty-state__title">No repository loaded</div>
            <div className="empty-state__body">Load a repository to manage branches.</div>
          </div>
        ) : null}

        {activeRepo ? (
          <section className="repo-card">
            <div className="repo-card__body">
              <div className="repo-card__section">
                <div className="repo-card__section-header">
                  <span>Create Branch</span>
                </div>
                <div className="toolbar__actions">
                  <input
                    className="text-input"
                    onChange={(event) => setNewBranchName(event.target.value)}
                    placeholder="feature/new-branch"
                    value={newBranchName}
                  />
                  <button className="panel-button" onClick={() => void handleCreateBranch()} type="button">
                    <GitBranchPlus size={14} />
                    Create
                  </button>
                </div>
              </div>

              <div className="repo-card__section">
                <div className="repo-card__section-header">
                  <span>Filter</span>
                </div>
                <input
                  className="text-input"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search branches"
                  value={query}
                />
              </div>

              <BranchList
                branches={localBranches}
                isLoading={isLoading}
                onDelete={handleDeleteBranch}
                onRename={handleRenameBranch}
                onSwitch={handleSwitchBranch}
                title={`Local (${localBranches.length})`}
              />
              <BranchList
                branches={remoteBranches}
                isLoading={isLoading}
                onDelete={handleDeleteBranch}
                onRename={handleRenameBranch}
                onSwitch={handleSwitchBranch}
                title={`Remote (${remoteBranches.length})`}
              />
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}
