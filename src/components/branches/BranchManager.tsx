import { useCallback, useEffect, useMemo, useState } from "react";
import { Codicon } from "../shared/Codicon";
import { ConfirmModal } from "../shared/ConfirmModal";
import { ContextMenu, type ContextMenuItem } from "../shared/ContextMenu";
import { InputModal } from "../shared/InputModal";
import {
  gitBranches,
  gitCreateBranch,
  gitDeleteBranch,
  gitDeleteRemoteBranch,
  gitFetch,
  gitMerge,
  gitPull,
  gitPush,
  gitPushSetUpstream,
  gitRebase,
  gitRenameBranch,
  gitSwitchBranch,
  gitSync
} from "../../lib/git";
import { findTrackedLocalBranch, inferLocalBranchName } from "../../lib/branches";
import { useGit } from "../../hooks/useGit";
import { useWorkspaceStore } from "../../stores/workspace";
import type { BranchInfo, Repository } from "../../types/git";
import { BranchRow } from "./BranchRow";

interface RepoBranchState {
  branches: BranchInfo[];
  isLoading: boolean;
  loadError: string | null;
}

interface BranchMenuTarget {
  repo: Repository;
  branches: BranchInfo[];
  branch: BranchInfo;
  position: { x: number; y: number };
}

interface InputModalState {
  repo: Repository;
  kind: "create" | "create-from" | "rename" | "publish";
  title: string;
  label: string;
  initialValue?: string;
  placeholder?: string;
  context?: BranchInfo;
}

interface ConfirmModalState {
  title: string;
  body: React.ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
}

const EMPTY_REPO_STATE: RepoBranchState = {
  branches: [],
  isLoading: false,
  loadError: null
};

interface BranchManagerProps {
  onOpenBranchPicker: (repo: Repository) => void;
}

export function BranchManager({ onOpenBranchPicker }: BranchManagerProps) {
  const repositories = useWorkspaceStore((state) => state.repositories);
  const refreshRepo = useWorkspaceStore((state) => state.refreshRepo);
  const setActiveRepo = useWorkspaceStore((state) => state.setActiveRepo);
  const runGit = useGit();
  const [branchStateByRepo, setBranchStateByRepo] = useState<Record<string, RepoBranchState>>({});
  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState<BranchMenuTarget | null>(null);
  const [inputModal, setInputModal] = useState<InputModalState | null>(null);
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState | null>(null);
  const [sectionsCollapsed, setSectionsCollapsed] = useState<Record<string, boolean>>({});

  const setRepoState = useCallback((repoPath: string, next: Partial<RepoBranchState>) => {
    setBranchStateByRepo((state) => ({
      ...state,
      [repoPath]: {
        ...(state[repoPath] ?? EMPTY_REPO_STATE),
        ...next
      }
    }));
  }, []);

  const reloadRepo = useCallback(
    async (repo: Repository) => {
      setRepoState(repo.path, { isLoading: true, loadError: null });
      try {
        const branches = await gitBranches(repo.path);
        setRepoState(repo.path, {
          branches,
          isLoading: false,
          loadError: null
        });
      } catch (error) {
        const detail =
          (error as { message?: string; stderr?: string })?.message ??
          (error as { stderr?: string })?.stderr ??
          String(error);
        setRepoState(repo.path, {
          branches: [],
          isLoading: false,
          loadError: detail
        });
      }
    },
    [setRepoState]
  );

  useEffect(() => {
    if (repositories.length === 0) {
      setBranchStateByRepo({});
      return;
    }

    const repoPaths = new Set(repositories.map((repo) => repo.path));
    setBranchStateByRepo((state) => {
      const next = { ...state };
      let changed = false;
      for (const path of Object.keys(next)) {
        if (!repoPaths.has(path)) {
          delete next[path];
          changed = true;
        }
      }
      return changed ? next : state;
    });

    for (const repo of repositories) {
      if (!branchStateByRepo[repo.path]) {
        void reloadRepo(repo);
      }
    }
  }, [branchStateByRepo, reloadRepo, repositories]);

  function toggle(section: string) {
    setSectionsCollapsed((prev) => ({ ...prev, [section]: !prev[section] }));
  }

  function withRepoRefresh(repo: Repository, operation: () => Promise<unknown>) {
    setActiveRepo(repo.id);
    runGit(async () => {
      await operation();
      await refreshRepo(repo.path);
      await reloadRepo(repo);
    }).catch(() => {});
  }

  function switchBranch(repo: Repository, branches: BranchInfo[], branch: BranchInfo) {
    if (branch.isCurrent) {
      return;
    }

    if (branch.isRemote) {
      const trackedLocal = findTrackedLocalBranch(branches, branch);
      if (trackedLocal && !trackedLocal.isRemote) {
        withRepoRefresh(repo, () => gitSwitchBranch(repo.path, trackedLocal.name));
      } else {
        const localName = inferLocalBranchName(branch.name);
        withRepoRefresh(repo, () => gitCreateBranch(repo.path, localName, branch.name));
      }
      return;
    }

    withRepoRefresh(repo, () => gitSwitchBranch(repo.path, branch.name));
  }

  function deleteBranch(repo: Repository, branch: BranchInfo) {
    setConfirmModal({
      title: "Delete Branch",
      body: (
        <>
          Delete local branch <strong>{branch.name}</strong>? This cannot be undone.
        </>
      ),
      confirmLabel: "Delete",
      danger: true,
      onConfirm: () =>
        withRepoRefresh(repo, () => gitDeleteBranch(repo.path, branch.name, !branch.isCurrent))
    });
  }

  function mergeFrom(repo: Repository, branch: BranchInfo) {
    setConfirmModal({
      title: "Merge Branch",
      body: (
        <>
          Merge <strong>{branch.name}</strong> into the current branch?
        </>
      ),
      confirmLabel: "Merge",
      onConfirm: () => withRepoRefresh(repo, () => gitMerge(repo.path, branch.name))
    });
  }

  function rebaseOnto(repo: Repository, branch: BranchInfo) {
    setConfirmModal({
      title: "Rebase Branch",
      body: (
        <>
          Rebase the current branch onto <strong>{branch.name}</strong>?
        </>
      ),
      confirmLabel: "Rebase",
      onConfirm: () => withRepoRefresh(repo, () => gitRebase(repo.path, branch.name))
    });
  }

  function deleteRemoteBranch(repo: Repository, branch: BranchInfo) {
    const [remote, ...rest] = branch.name.split("/");
    if (!remote || rest.length === 0) {
      return;
    }

    const remoteBranchName = rest.join("/");
    setConfirmModal({
      title: "Delete Remote Branch",
      body: (
        <>
          Delete remote branch <strong>{remoteBranchName}</strong> on <strong>{remote}</strong>?
        </>
      ),
      confirmLabel: "Delete from remote",
      danger: true,
      onConfirm: () =>
        withRepoRefresh(repo, () => gitDeleteRemoteBranch(repo.path, remote, remoteBranchName))
    });
  }

  function openInput(kind: InputModalState["kind"], options: Omit<InputModalState, "kind">) {
    setInputModal({ kind, ...options });
  }

  function handleInputSubmit(value: string) {
    if (!inputModal) {
      return;
    }

    const repo = inputModal.repo;
    const repoPath = repo.path;
    switch (inputModal.kind) {
      case "create":
        withRepoRefresh(repo, () => gitCreateBranch(repoPath, value));
        break;
      case "create-from":
        if (inputModal.context) {
          withRepoRefresh(repo, () => gitCreateBranch(repoPath, value, inputModal.context!.name));
        }
        break;
      case "rename":
        if (inputModal.context) {
          withRepoRefresh(repo, () => gitRenameBranch(repoPath, inputModal.context!.name, value));
        }
        break;
      case "publish":
        if (inputModal.context) {
          withRepoRefresh(repo, () =>
            gitPushSetUpstream(repoPath, value, inputModal.context!.name)
          );
        }
        break;
    }
  }

  function fetchForBranch(repo: Repository, branch: BranchInfo) {
    const remote = branch.isRemote ? branch.name.split("/")[0] : branch.upstream?.split("/")[0];
    withRepoRefresh(repo, () => gitFetch(repo.path, remote));
  }

  function buildMenuItems(
    repo: Repository,
    branches: BranchInfo[],
    branch: BranchInfo
  ): ContextMenuItem[] {
    const items: ContextMenuItem[] = [];

    if (!branch.isCurrent) {
      const checkoutLabel =
        branch.isRemote && !findTrackedLocalBranch(branches, branch)
          ? "Track and Checkout"
          : "Checkout";
      items.push({ label: checkoutLabel, onSelect: () => switchBranch(repo, branches, branch) });
    }

    if (branch.isCurrent) {
      items.push({ label: "Pull", onSelect: () => withRepoRefresh(repo, () => gitPull(repo.path)) });
      items.push({ label: "Push", onSelect: () => withRepoRefresh(repo, () => gitPush(repo.path)) });
      items.push({ label: "Sync (Pull, then Push)", onSelect: () => withRepoRefresh(repo, () => gitSync(repo.path)) });
    }

    items.push({
      label: "Fetch",
      onSelect: () => fetchForBranch(repo, branch)
    });

    if (!branch.isCurrent) {
      items.push({
        label: `Merge "${branch.name}" into current`,
        onSelect: () => mergeFrom(repo, branch)
      });
      items.push({
        label: `Rebase current onto "${branch.name}"`,
        onSelect: () => rebaseOnto(repo, branch)
      });
    }

    items.push({
      label: "Create Branch From…",
      onSelect: () =>
        openInput("create-from", {
          repo,
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
            repo,
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
            repo,
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
        onSelect: () => deleteBranch(repo, branch)
      });
    }

    if (branch.isRemote) {
      items.push({
        danger: true,
        label: "Delete Remote Branch",
        onSelect: () => deleteRemoteBranch(repo, branch)
      });
    }

    return items;
  }

  const hasRepositories = repositories.length > 0;
  const openBranchMenu = useCallback(
    (
      repo: Repository,
      branches: BranchInfo[],
      branch: BranchInfo,
      position: { x: number; y: number }
    ) => {
      setMenu({ repo, branches, branch, position });
    },
    []
  );

  const anyLoading = useMemo(
    () => repositories.some((repo) => branchStateByRepo[repo.path]?.isLoading),
    [branchStateByRepo, repositories]
  );

  return (
    <>
      <div className="view-title">
        <h2 className="view-title__label">Branches</h2>
        <div className="view-title__actions">
          <button
            className="view-action"
            onClick={() => {
              for (const repo of repositories) {
                void reloadRepo(repo);
              }
            }}
            title="Refresh All"
            type="button"
            disabled={!hasRepositories || anyLoading}
          >
            <Codicon name="refresh" size={16} />
          </button>
        </div>
      </div>

      <div className="scm-body">
        {!hasRepositories ? (
          <div className="scm-welcome">
            <p className="scm-welcome__lead">No repository loaded.</p>
          </div>
        ) : (
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

            {repositories.map((repo) => {
              const repoState = branchStateByRepo[repo.path] ?? EMPTY_REPO_STATE;
              const filteredBranches = filterBranches(repoState.branches, query);
              const localBranches = filteredBranches.filter((branch) => !branch.isRemote);
              const remoteGroups = groupRemoteBranches(filteredBranches);
              const repoKey = `repo:${repo.id}`;
              return (
                <section className="repo-section" key={repo.id}>
                  <button
                    className="repo-section__header"
                    onClick={() => toggle(repoKey)}
                    type="button"
                  >
                    <Codicon
                      name={sectionsCollapsed[repoKey] ? "chevron-right" : "chevron-down"}
                      size={14}
                    />
                    <Codicon name="repo" size={14} />
                    <span className="repo-section__meta">
                      <span className="repo-section__name" title={repo.name}>
                        {repo.name}
                      </span>
                      <span className="repo-section__branch" title={repo.branch}>
                        <Codicon name="git-branch" size={12} />
                        <span className="repo-section__branch-label">{repo.branch}</span>
                      </span>
                    </span>
                    <span
                      className="repo-section__actions"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <button
                        className="repo-section__action"
                        onClick={() => onOpenBranchPicker(repo)}
                        title="Switch Branch"
                        aria-label={`Switch branch in ${repo.name}`}
                        type="button"
                      >
                        <Codicon name="git-branch" size={14} />
                      </button>
                      <button
                        className="repo-section__action"
                        onClick={() => void reloadRepo(repo)}
                        title="Refresh"
                        aria-label={`Refresh ${repo.name} branches`}
                        type="button"
                      >
                        <Codicon name="refresh" size={14} />
                      </button>
                      <button
                        className="repo-section__action"
                        onClick={() =>
                          openInput("create", {
                            repo,
                            title: "Create Branch",
                            label: `New branch name for ${repo.name}:`,
                            placeholder: "feature/my-branch"
                          })
                        }
                        title="Create Branch"
                        aria-label={`Create branch in ${repo.name}`}
                        type="button"
                      >
                        <Codicon name="plus" size={14} />
                      </button>
                    </span>
                  </button>

                  {!sectionsCollapsed[repoKey] ? (
                    <>
                      <BranchSection
                        title="Local"
                        count={localBranches.length}
                        collapsed={!!sectionsCollapsed[`${repoKey}:local`]}
                        onToggle={() => toggle(`${repoKey}:local`)}
                        isLoading={repoState.isLoading}
                        emptyMessage={
                          repoState.loadError
                            ? `Failed to load branches: ${repoState.loadError}`
                            : repoState.branches.length === 0
                              ? "No branches available yet. Create the first branch or commit to this repository."
                              : query.trim()
                                ? "No local branches match the filter."
                                : null
                        }
                      >
                        {localBranches.map((branch) => (
                          <BranchRow
                            key={`${repo.id}:${branch.name}`}
                            branch={branch}
                            onSelect={(selectedBranch) =>
                              switchBranch(repo, repoState.branches, selectedBranch)
                            }
                            onContextMenu={(selectedBranch, position) =>
                              openBranchMenu(repo, repoState.branches, selectedBranch, position)
                            }
                          />
                        ))}
                      </BranchSection>

                      {remoteGroups.map(([remoteName, list]) => (
                        <BranchSection
                          key={`${repo.id}:${remoteName}`}
                          title={remoteName.charAt(0).toUpperCase() + remoteName.slice(1)}
                          count={list.length}
                          collapsed={!!sectionsCollapsed[`${repoKey}:remote:${remoteName}`]}
                          onToggle={() => toggle(`${repoKey}:remote:${remoteName}`)}
                          isLoading={repoState.isLoading}
                        >
                          {list.map((branch) => (
                            <BranchRow
                              key={`${repo.id}:${branch.name}`}
                              branch={branch}
                              onSelect={(selectedBranch) =>
                                switchBranch(repo, repoState.branches, selectedBranch)
                              }
                              onContextMenu={(selectedBranch, position) =>
                                openBranchMenu(
                                  repo,
                                  repoState.branches,
                                  selectedBranch,
                                  position
                                )
                              }
                            />
                          ))}
                        </BranchSection>
                      ))}
                    </>
                  ) : null}
                </section>
              );
            })}
          </>
        )}
      </div>

      <ContextMenu
        items={menu ? buildMenuItems(menu.repo, menu.branches, menu.branch) : []}
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

      <ConfirmModal
        isOpen={confirmModal !== null}
        title={confirmModal?.title ?? ""}
        body={confirmModal?.body ?? null}
        confirmLabel={confirmModal?.confirmLabel}
        danger={confirmModal?.danger}
        onConfirm={() => confirmModal?.onConfirm()}
        onClose={() => setConfirmModal(null)}
      />
    </>
  );
}

function filterBranches(branches: BranchInfo[], query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return branches;
  }

  return branches.filter((branch) => branch.name.toLowerCase().includes(needle));
}

function groupRemoteBranches(branches: BranchInfo[]) {
  const groups = new Map<string, BranchInfo[]>();
  for (const branch of branches) {
    if (!branch.isRemote) {
      continue;
    }

    const remote = branch.name.split("/")[0] ?? "remote";
    const list = groups.get(remote) ?? [];
    list.push(branch);
    groups.set(remote, list);
  }

  return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right));
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
