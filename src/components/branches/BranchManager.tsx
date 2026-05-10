import { useEffect, useMemo, useState } from "react";
import { GitBranchPlus, RefreshCcw } from "lucide-react";
import {
  gitAddWorktree,
  gitBranches,
  gitCreateBranch,
  gitDeleteBranch,
  gitListWorktrees,
  gitPruneWorktrees,
  gitRenameBranch,
  gitRemoveWorktree,
  gitSwitchBranch
} from "../../lib/git";
import { useGit } from "../../hooks/useGit";
import { useRepo } from "../../hooks/useRepo";
import { useWorkspaceStore } from "../../stores/workspace";
import type { BranchInfo, WorktreeInfo } from "../../types/git";
import { BranchList } from "./BranchList";

export function BranchManager() {
  const { activeRepo } = useRepo();
  const refreshRepo = useWorkspaceStore((state) => state.refreshRepo);
  const runGit = useGit();
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [worktrees, setWorktrees] = useState<WorktreeInfo[]>([]);
  const [query, setQuery] = useState("");
  const [newBranchName, setNewBranchName] = useState("");
  const [newWorktreePath, setNewWorktreePath] = useState("");
  const [newWorktreeBranch, setNewWorktreeBranch] = useState("");
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

  async function loadWorktrees() {
    if (!activeRepo) {
      setWorktrees([]);
      return;
    }

    const nextWorktrees = await runGit(() => gitListWorktrees(activeRepo.path));
    setWorktrees(nextWorktrees);
  }

  useEffect(() => {
    void Promise.all([loadBranches(), loadWorktrees()]).catch(() => {});
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
      await loadWorktrees();
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
      await loadWorktrees();
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
      await loadWorktrees();
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
      await loadWorktrees();
    });
  }

  async function handleCreateWorktree() {
    if (!activeRepo || !newWorktreePath.trim()) {
      return;
    }

    await runGit(async () => {
      await gitAddWorktree(
        activeRepo.path,
        newWorktreePath.trim(),
        newWorktreeBranch.trim() || undefined
      );
      setNewWorktreePath("");
      setNewWorktreeBranch("");
      await loadWorktrees();
    });
  }

  async function handleRemoveWorktree(worktree: WorktreeInfo) {
    if (!activeRepo || worktree.isMain) {
      return;
    }

    await runGit(async () => {
      await gitRemoveWorktree(activeRepo.path, worktree.path);
      await loadWorktrees();
    });
  }

  async function handlePruneWorktrees() {
    if (!activeRepo) {
      return;
    }

    await runGit(async () => {
      await gitPruneWorktrees(activeRepo.path);
      await loadWorktrees();
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

              <div className="repo-card__section">
                <div className="repo-card__section-header">
                  <span>Worktrees ({worktrees.length})</span>
                  <button className="panel-button" onClick={() => void handlePruneWorktrees()} type="button">
                    Prune
                  </button>
                </div>
                <div className="toolbar__actions">
                  <input
                    className="text-input"
                    onChange={(event) => setNewWorktreePath(event.target.value)}
                    placeholder="/path/to/worktree"
                    value={newWorktreePath}
                  />
                  <input
                    className="text-input"
                    onChange={(event) => setNewWorktreeBranch(event.target.value)}
                    placeholder="Optional branch"
                    value={newWorktreeBranch}
                  />
                  <button className="panel-button" onClick={() => void handleCreateWorktree()} type="button">
                    Create
                  </button>
                </div>
                <div className="file-list">
                  {worktrees.length === 0 ? (
                    <div className="file-row">
                      <div className="file-row__left">
                        <span className="file-row__path">No worktrees</span>
                      </div>
                    </div>
                  ) : null}
                  {worktrees.map((worktree) => (
                    <div className="file-row" key={worktree.path}>
                      <div className="file-row__left">
                        <div>
                          <div className="file-row__name">{worktree.branch}</div>
                          <div className="file-row__path">
                            {worktree.path} • {worktree.sha.slice(0, 7)}
                          </div>
                        </div>
                        {worktree.isMain ? <div className="badge">Main</div> : null}
                      </div>
                      <div className="file-row__actions">
                        {!worktree.isMain ? (
                          <button
                            className="panel-button"
                            onClick={() => void handleRemoveWorktree(worktree)}
                            type="button"
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
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
