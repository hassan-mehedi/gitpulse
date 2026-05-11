import { useCallback, useEffect, useMemo, useState } from "react";
import { Codicon } from "../shared/Codicon";
import {
  gitAddWorktree,
  gitBranches,
  gitCreateBranch,
  gitDeleteBranch,
  gitListTags,
  gitListWorktrees,
  gitPruneWorktrees,
  gitRenameBranch,
  gitRemoveWorktree,
  gitSwitchBranch
} from "../../lib/git";
import { useGit } from "../../hooks/useGit";
import { useRepo } from "../../hooks/useRepo";
import { useWorkspaceStore } from "../../stores/workspace";
import type { BranchInfo, TagInfo, WorktreeInfo } from "../../types/git";
import { BranchRow } from "./BranchRow";

export function BranchManager() {
  const { activeRepo } = useRepo();
  const refreshRepo = useWorkspaceStore((state) => state.refreshRepo);
  const runGit = useGit();
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [worktrees, setWorktrees] = useState<WorktreeInfo[]>([]);
  const [tags, setTags] = useState<TagInfo[]>([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sectionsCollapsed, setSectionsCollapsed] = useState<Record<string, boolean>>(
    {}
  );

  const reload = useCallback(async () => {
    if (!activeRepo) {
      setBranches([]);
      setWorktrees([]);
      setTags([]);
      return;
    }
    setIsLoading(true);
    try {
      const [nextBranches, nextWorktrees, nextTags] = await Promise.all([
        gitBranches(activeRepo.path),
        gitListWorktrees(activeRepo.path),
        gitListTags(activeRepo.path).catch(() => [] as TagInfo[])
      ]);
      setBranches(nextBranches);
      setWorktrees(nextWorktrees);
      setTags(nextTags);
    } finally {
      setIsLoading(false);
    }
  }, [activeRepo]);

  useEffect(() => {
    void reload().catch(() => {});
  }, [reload]);

  const filteredBranches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return branches;
    return branches.filter((branch) => branch.name.toLowerCase().includes(needle));
  }, [branches, query]);

  const localBranches = filteredBranches.filter((branch) => !branch.isRemote);

  const remoteGroups = useMemo(() => {
    const groups = new Map<string, BranchInfo[]>();
    for (const branch of filteredBranches) {
      if (!branch.isRemote) continue;
      const remote = branch.name.split("/")[0] ?? "remote";
      const list = groups.get(remote) ?? [];
      list.push(branch);
      groups.set(remote, list);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filteredBranches]);

  function toggle(section: string) {
    setSectionsCollapsed((prev) => ({ ...prev, [section]: !prev[section] }));
  }

  function withRefresh(operation: () => Promise<unknown>) {
    runGit(async () => {
      await operation();
      if (activeRepo) {
        await refreshRepo(activeRepo.path);
      }
      await reload();
    }).catch(() => {});
  }

  async function handleCreateBranch() {
    if (!activeRepo) return;
    const name = window.prompt("New branch name:", "")?.trim();
    if (!name) return;
    withRefresh(() => gitCreateBranch(activeRepo.path, name));
  }

  async function handleAddWorktree() {
    if (!activeRepo) return;
    const path = window.prompt("Worktree path (absolute):", "")?.trim();
    if (!path) return;
    const branch = window.prompt("Branch to check out (optional):", "")?.trim() || undefined;
    withRefresh(() => gitAddWorktree(activeRepo.path, path, branch));
  }

  function switchBranch(branch: BranchInfo) {
    if (!activeRepo) return;
    withRefresh(() => gitSwitchBranch(activeRepo.path, branch.name));
  }

  function renameBranch(branch: BranchInfo) {
    if (!activeRepo) return;
    const next = window.prompt(`Rename "${branch.name}" to:`, branch.name)?.trim();
    if (!next || next === branch.name) return;
    withRefresh(() => gitRenameBranch(activeRepo.path, branch.name, next));
  }

  function deleteBranch(branch: BranchInfo) {
    if (!activeRepo) return;
    if (!window.confirm(`Delete branch "${branch.name}"?`)) return;
    withRefresh(() => gitDeleteBranch(activeRepo.path, branch.name, !branch.isCurrent));
  }

  function removeWorktree(worktree: WorktreeInfo) {
    if (!activeRepo || worktree.isMain) return;
    if (!window.confirm(`Remove worktree at ${worktree.path}?`)) return;
    withRefresh(() => gitRemoveWorktree(activeRepo.path, worktree.path));
  }

  function pruneWorktrees() {
    if (!activeRepo) return;
    withRefresh(() => gitPruneWorktrees(activeRepo.path));
  }

  return (
    <>
      <div className="view-title">
        <h2 className="view-title__label">Branches</h2>
        <div className="view-title__actions">
          <button
            className="view-action"
            onClick={() => void reload()}
            title="Refresh"
            type="button"
            disabled={!activeRepo}
          >
            <Codicon name="refresh" size={16} />
          </button>
          <button
            className="view-action"
            onClick={() => void handleCreateBranch()}
            title="Create Branch"
            type="button"
            disabled={!activeRepo}
          >
            <Codicon name="plus" size={16} />
          </button>
        </div>
      </div>

      <div className="scm-body">
        {!activeRepo ? (
          <div className="scm-welcome">
            <p className="scm-welcome__lead">No repository loaded.</p>
          </div>
        ) : null}

        {activeRepo ? (
          <>
            <div className="branches-filter">
              <Codicon name="search" size={14} />
              <input
                className="branches-filter__input"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filter branches"
                value={query}
              />
            </div>

            <BranchSection
              title="Local"
              count={localBranches.length}
              collapsed={!!sectionsCollapsed.local}
              onToggle={() => toggle("local")}
              isLoading={isLoading}
            >
              {localBranches.map((branch) => (
                <BranchRow
                  key={branch.name}
                  branch={branch}
                  onSwitch={switchBranch}
                  onRename={renameBranch}
                  onDelete={deleteBranch}
                />
              ))}
            </BranchSection>

            {remoteGroups.map(([remoteName, list]) => (
              <BranchSection
                key={remoteName}
                title={`Remote: ${remoteName}`}
                count={list.length}
                collapsed={!!sectionsCollapsed[`remote:${remoteName}`]}
                onToggle={() => toggle(`remote:${remoteName}`)}
                isLoading={isLoading}
              >
                {list.map((branch) => (
                  <BranchRow
                    key={branch.name}
                    branch={branch}
                    onSwitch={switchBranch}
                    onRename={renameBranch}
                    onDelete={deleteBranch}
                  />
                ))}
              </BranchSection>
            ))}

            <WorktreeSection
              worktrees={worktrees}
              collapsed={!!sectionsCollapsed.worktrees}
              onToggle={() => toggle("worktrees")}
              onAdd={() => void handleAddWorktree()}
              onPrune={pruneWorktrees}
              onRemove={removeWorktree}
            />

            <TagSection
              tags={tags}
              collapsed={!!sectionsCollapsed.tags}
              onToggle={() => toggle("tags")}
            />
          </>
        ) : null}
      </div>
    </>
  );
}

interface BranchSectionProps {
  title: string;
  count: number;
  collapsed: boolean;
  isLoading?: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function BranchSection({
  title,
  count,
  collapsed,
  isLoading,
  onToggle,
  children
}: BranchSectionProps) {
  return (
    <section className="scm-section">
      <header className="scm-section__header">
        <button className="scm-section__toggle" onClick={onToggle} type="button">
          <Codicon name={collapsed ? "chevron-right" : "chevron-down"} size={14} />
          <span className="scm-section__title">{title}</span>
        </button>
        <span className="scm-section__count">{count}</span>
      </header>
      {!collapsed ? (
        <div className="scm-section__body">
          {isLoading && count === 0 ? (
            <div className="scm-row scm-row--placeholder">
              <span className="scm-row__path">Loading…</span>
            </div>
          ) : null}
          {children}
        </div>
      ) : null}
    </section>
  );
}

interface WorktreeSectionProps {
  worktrees: WorktreeInfo[];
  collapsed: boolean;
  onToggle: () => void;
  onAdd: () => void;
  onPrune: () => void;
  onRemove: (worktree: WorktreeInfo) => void;
}

function WorktreeSection({
  worktrees,
  collapsed,
  onToggle,
  onAdd,
  onPrune,
  onRemove
}: WorktreeSectionProps) {
  return (
    <section className="scm-section">
      <header className="scm-section__header">
        <button className="scm-section__toggle" onClick={onToggle} type="button">
          <Codicon name={collapsed ? "chevron-right" : "chevron-down"} size={14} />
          <span className="scm-section__title">Worktrees</span>
        </button>
        <div className="scm-section__actions">
          <button
            className="scm-section__action"
            onClick={onAdd}
            title="Add Worktree"
            type="button"
          >
            <Codicon name="plus" size={16} />
          </button>
          <button
            className="scm-section__action"
            onClick={onPrune}
            title="Prune Worktrees"
            type="button"
          >
            <Codicon name="trash" size={16} />
          </button>
        </div>
        <span className="scm-section__count">{worktrees.length}</span>
      </header>
      {!collapsed ? (
        <div className="scm-section__body">
          {worktrees.map((worktree) => (
            <div className="scm-row" key={worktree.path}>
              <Codicon name="folder" size={16} className="scm-row__icon" />
              <span className="scm-row__name" title={worktree.path}>
                {worktree.branch}
              </span>
              <span className="scm-row__path" title={worktree.path}>
                {worktree.path}
              </span>
              {worktree.isMain ? (
                <span className="scm-row__status" style={{ color: "var(--vscode-descriptionForeground)" }}>
                  main
                </span>
              ) : (
                <span className="scm-row__actions">
                  <button
                    className="scm-row__action"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRemove(worktree);
                    }}
                    title="Remove Worktree"
                    type="button"
                  >
                    <Codicon name="trash" size={14} />
                  </button>
                </span>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function TagSection({
  tags,
  collapsed,
  onToggle
}: {
  tags: TagInfo[];
  collapsed: boolean;
  onToggle: () => void;
}) {
  if (tags.length === 0) {
    return null;
  }

  return (
    <section className="scm-section">
      <header className="scm-section__header">
        <button className="scm-section__toggle" onClick={onToggle} type="button">
          <Codicon name={collapsed ? "chevron-right" : "chevron-down"} size={14} />
          <span className="scm-section__title">Tags</span>
        </button>
        <span className="scm-section__count">{tags.length}</span>
      </header>
      {!collapsed ? (
        <div className="scm-section__body">
          {tags.map((tag) => (
            <div className="scm-row" key={tag.name} title={tag.message}>
              <Codicon name="tag" size={16} className="scm-row__icon" />
              <span className="scm-row__name">{tag.name}</span>
              <span className="scm-row__path">{tag.sha.slice(0, 7)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
