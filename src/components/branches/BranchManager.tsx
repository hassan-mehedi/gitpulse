import { useCallback, useEffect, useMemo, useState } from "react";
import { Codicon } from "../shared/Codicon";
import { ContextMenu, type ContextMenuItem } from "../shared/ContextMenu";
import { InputModal } from "../shared/InputModal";
import {
  gitAddWorktree,
  gitBranches,
  gitCreateBranch,
  gitDeleteBranch,
  gitDeleteRemoteBranch,
  gitListTags,
  gitListWorktrees,
  gitMerge,
  gitPruneWorktrees,
  gitPushSetUpstream,
  gitRebase,
  gitRenameBranch,
  gitRemoveWorktree,
  gitSwitchBranch
} from "../../lib/git";
import { useGit } from "../../hooks/useGit";
import { useRepo } from "../../hooks/useRepo";
import { useWorkspaceStore } from "../../stores/workspace";
import type { BranchInfo, TagInfo, WorktreeInfo } from "../../types/git";
import { BranchRow } from "./BranchRow";

interface BranchMenuTarget {
  branch: BranchInfo;
  position: { x: number; y: number };
}

interface InputModalState {
  kind: "create" | "create-from" | "rename" | "publish" | "add-worktree";
  title: string;
  label: string;
  initialValue?: string;
  placeholder?: string;
  /** Extra context the submit handler may need (e.g. the source branch). */
  context?: BranchInfo;
}

export function BranchManager() {
  const { activeRepo } = useRepo();
  const refreshRepo = useWorkspaceStore((state) => state.refreshRepo);
  const runGit = useGit();
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [worktrees, setWorktrees] = useState<WorktreeInfo[]>([]);
  const [tags, setTags] = useState<TagInfo[]>([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [menu, setMenu] = useState<BranchMenuTarget | null>(null);
  const [inputModal, setInputModal] = useState<InputModalState | null>(null);
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
        gitBranches(activeRepo.path).catch(() => [] as BranchInfo[]),
        gitListWorktrees(activeRepo.path).catch(() => [] as WorktreeInfo[]),
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

  const localBranches = useMemo(
    () => filteredBranches.filter((branch) => !branch.isRemote),
    [filteredBranches]
  );

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

  const currentBranch = useMemo(
    () => branches.find((branch) => branch.isCurrent) ?? null,
    [branches]
  );

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

  function switchBranch(branch: BranchInfo) {
    if (!activeRepo || branch.isCurrent) return;
    withRefresh(() => gitSwitchBranch(activeRepo.path, branch.name));
  }

  function deleteBranch(branch: BranchInfo) {
    if (!activeRepo) return;
    if (!window.confirm(`Delete branch "${branch.name}"?`)) return;
    withRefresh(() => gitDeleteBranch(activeRepo.path, branch.name, !branch.isCurrent));
  }

  function mergeFrom(branch: BranchInfo) {
    if (!activeRepo) return;
    if (!window.confirm(`Merge "${branch.name}" into the current branch?`)) return;
    withRefresh(() => gitMerge(activeRepo.path, branch.name));
  }

  function rebaseOnto(branch: BranchInfo) {
    if (!activeRepo) return;
    if (!window.confirm(`Rebase the current branch onto "${branch.name}"?`)) return;
    withRefresh(() => gitRebase(activeRepo.path, branch.name));
  }

  function deleteRemoteBranch(branch: BranchInfo) {
    if (!activeRepo || !branch.isRemote) return;
    const [remote, ...rest] = branch.name.split("/");
    if (!remote || rest.length === 0) return;
    const remoteBranchName = rest.join("/");
    if (
      !window.confirm(
        `Delete remote branch "${remoteBranchName}" on "${remote}"? This is irreversible.`
      )
    ) {
      return;
    }
    withRefresh(() =>
      gitDeleteRemoteBranch(activeRepo.path, remote, remoteBranchName)
    );
  }

  function openInput(kind: InputModalState["kind"], options: Omit<InputModalState, "kind">) {
    setInputModal({ kind, ...options });
  }

  function handleInputSubmit(value: string) {
    if (!inputModal || !activeRepo) return;
    const repoPath = activeRepo.path;
    switch (inputModal.kind) {
      case "create":
        withRefresh(() => gitCreateBranch(repoPath, value));
        break;
      case "create-from":
        if (inputModal.context) {
          withRefresh(() =>
            gitCreateBranch(repoPath, value, inputModal.context!.name)
          );
        }
        break;
      case "rename":
        if (inputModal.context) {
          withRefresh(() =>
            gitRenameBranch(repoPath, inputModal.context!.name, value)
          );
        }
        break;
      case "publish":
        if (inputModal.context) {
          withRefresh(() =>
            gitPushSetUpstream(repoPath, value, inputModal.context!.name)
          );
        }
        break;
      case "add-worktree":
        withRefresh(() => gitAddWorktree(repoPath, value));
        break;
    }
  }

  function buildMenuItems(branch: BranchInfo): ContextMenuItem[] {
    const items: ContextMenuItem[] = [];

    if (!branch.isCurrent) {
      items.push({ label: "Checkout", onSelect: () => switchBranch(branch) });
    }

    if (!branch.isCurrent) {
      items.push({
        label: `Merge "${branch.name}" into current`,
        onSelect: () => mergeFrom(branch)
      });
      items.push({
        label: `Rebase current onto "${branch.name}"`,
        onSelect: () => rebaseOnto(branch)
      });
    }

    items.push({
      label: "Create Branch From…",
      onSelect: () =>
        openInput("create-from", {
          title: "Create Branch",
          label: `Create new branch from "${branch.name}":`,
          placeholder: "branch-name",
          context: branch
        })
    });

    if (!branch.isRemote) {
      items.push({
        label: "Rename Branch…",
        onSelect: () =>
          openInput("rename", {
            title: "Rename Branch",
            label: `Rename "${branch.name}" to:`,
            initialValue: branch.name,
            context: branch
          })
      });
    }

    if (!branch.isRemote && !branch.upstream) {
      items.push({
        label: "Publish Branch…",
        onSelect: () =>
          openInput("publish", {
            title: "Publish Branch",
            label: `Push "${branch.name}" to remote:`,
            initialValue: "origin",
            context: branch
          })
      });
    }

    if (!branch.isCurrent && !branch.isRemote) {
      items.push({
        danger: true,
        label: "Delete Branch",
        onSelect: () => deleteBranch(branch)
      });
    }

    if (branch.isRemote) {
      items.push({
        danger: true,
        label: "Delete Remote Branch",
        onSelect: () => deleteRemoteBranch(branch)
      });
    }

    return items;
  }

  const openBranchMenu = useCallback(
    (branch: BranchInfo, position: { x: number; y: number }) => {
      setMenu({ branch, position });
    },
    []
  );

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
            onClick={() =>
              openInput("create", {
                title: "Create Branch",
                label: "New branch name:",
                placeholder: "feature/my-branch"
              })
            }
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
            {currentBranch ? (
              <CurrentBranchHeader
                branch={currentBranch}
                onCreateFrom={() =>
                  openInput("create-from", {
                    title: "Create Branch",
                    label: `Create new branch from "${currentBranch.name}":`,
                    placeholder: "branch-name",
                    context: currentBranch
                  })
                }
                onRename={() =>
                  openInput("rename", {
                    title: "Rename Branch",
                    label: `Rename "${currentBranch.name}" to:`,
                    initialValue: currentBranch.name,
                    context: currentBranch
                  })
                }
                onPublish={() =>
                  openInput("publish", {
                    title: "Publish Branch",
                    label: `Push "${currentBranch.name}" to remote:`,
                    initialValue: "origin",
                    context: currentBranch
                  })
                }
              />
            ) : null}

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
              emptyMessage={
                branches.length === 0
                  ? "No branches yet. Use + above to create one."
                  : query.trim()
                    ? "No local branches match the filter."
                    : null
              }
            >
              {localBranches.map((branch) => (
                <BranchRow
                  key={branch.name}
                  branch={branch}
                  onSwitch={switchBranch}
                  onRename={(b) =>
                    openInput("rename", {
                      title: "Rename Branch",
                      label: `Rename "${b.name}" to:`,
                      initialValue: b.name,
                      context: b
                    })
                  }
                  onDelete={deleteBranch}
                  onContextMenu={openBranchMenu}
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
                    onRename={(b) =>
                      openInput("rename", {
                        title: "Rename Branch",
                        label: `Rename "${b.name}" to:`,
                        initialValue: b.name,
                        context: b
                      })
                    }
                    onDelete={deleteBranch}
                    onContextMenu={openBranchMenu}
                  />
                ))}
              </BranchSection>
            ))}

            <WorktreeSection
              worktrees={worktrees}
              collapsed={!!sectionsCollapsed.worktrees}
              onToggle={() => toggle("worktrees")}
              onAdd={() =>
                openInput("add-worktree", {
                  title: "Add Worktree",
                  label: "Worktree path (absolute):",
                  placeholder: "/path/to/new/worktree"
                })
              }
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

      <ContextMenu
        items={menu ? buildMenuItems(menu.branch) : []}
        position={menu?.position ?? null}
        onClose={() => setMenu(null)}
      />

      <InputModal
        isOpen={inputModal !== null}
        title={inputModal?.title ?? ""}
        label={inputModal?.label ?? ""}
        initialValue={inputModal?.initialValue}
        placeholder={inputModal?.placeholder}
        onSubmit={handleInputSubmit}
        onClose={() => setInputModal(null)}
      />
    </>
  );
}

interface CurrentBranchHeaderProps {
  branch: BranchInfo;
  onCreateFrom: () => void;
  onRename: () => void;
  onPublish: () => void;
}

function CurrentBranchHeader({
  branch,
  onCreateFrom,
  onRename,
  onPublish
}: CurrentBranchHeaderProps) {
  return (
    <div className="current-branch">
      <div className="current-branch__heading">
        <Codicon name="check" size={14} />
        <span className="current-branch__label">Current branch</span>
      </div>
      <div className="current-branch__name" title={branch.name}>
        <Codicon name="git-branch" size={16} />
        <span>{branch.name}</span>
      </div>
      {branch.upstream ? (
        <div className="current-branch__upstream">
          Tracking <strong>{branch.upstream}</strong>
        </div>
      ) : (
        <div className="current-branch__upstream current-branch__upstream--missing">
          No upstream configured
        </div>
      )}
      <div className="current-branch__actions">
        <button
          className="vscode-button vscode-button--primary"
          onClick={onCreateFrom}
          type="button"
        >
          <Codicon name="plus" size={14} />
          Create branch from here
        </button>
        {!branch.upstream ? (
          <button className="vscode-button" onClick={onPublish} type="button">
            <Codicon name="repo-push" size={14} />
            Publish
          </button>
        ) : null}
        <button className="vscode-button" onClick={onRename} type="button">
          <Codicon name="edit" size={14} />
          Rename
        </button>
      </div>
    </div>
  );
}

interface BranchSectionProps {
  title: string;
  count: number;
  collapsed: boolean;
  isLoading?: boolean;
  emptyMessage?: string | null;
  onToggle: () => void;
  children: React.ReactNode;
}

function BranchSection({
  title,
  count,
  collapsed,
  isLoading,
  emptyMessage,
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
          {!isLoading && count === 0 && emptyMessage ? (
            <div className="scm-row scm-row--placeholder">
              <span className="scm-row__path">{emptyMessage}</span>
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
                <span
                  className="scm-row__status"
                  style={{ color: "var(--vscode-descriptionForeground)" }}
                >
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
