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
import { useGit } from "../../hooks/useGit";
import { useRepo } from "../../hooks/useRepo";
import { useWorkspaceStore } from "../../stores/workspace";
import type { BranchInfo } from "../../types/git";
import { BranchRow } from "./BranchRow";

interface BranchMenuTarget {
  branch: BranchInfo;
  position: { x: number; y: number };
}

interface InputModalState {
  kind: "create" | "create-from" | "rename" | "publish";
  title: string;
  label: string;
  initialValue?: string;
  placeholder?: string;
  /** Extra context the submit handler may need (e.g. the source branch). */
  context?: BranchInfo;
}

interface ConfirmModalState {
  title: string;
  body: React.ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
}

export function BranchManager() {
  const { activeRepo } = useRepo();
  const refreshRepo = useWorkspaceStore((state) => state.refreshRepo);
  const runGit = useGit();
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [menu, setMenu] = useState<BranchMenuTarget | null>(null);
  const [inputModal, setInputModal] = useState<InputModalState | null>(null);
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState | null>(null);
  const [sectionsCollapsed, setSectionsCollapsed] = useState<Record<string, boolean>>(
    {}
  );

  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!activeRepo) {
      setBranches([]);
      setLoadError(null);
      return;
    }
    setIsLoading(true);
    setLoadError(null);
    try {
      const nextBranches = await gitBranches(activeRepo.path);
      setBranches(nextBranches);
    } catch (error) {
      const detail =
        (error as { message?: string; stderr?: string })?.message ??
        (error as { stderr?: string })?.stderr ??
        String(error);
      setLoadError(detail);
      console.error("[branches] gitBranches failed", error);
      setBranches([]);
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
        withRefresh(() =>
          gitDeleteBranch(activeRepo.path, branch.name, !branch.isCurrent)
        )
    });
  }

  function mergeFrom(branch: BranchInfo) {
    if (!activeRepo) return;
    setConfirmModal({
      title: "Merge Branch",
      body: (
        <>
          Merge <strong>{branch.name}</strong> into the current branch?
        </>
      ),
      confirmLabel: "Merge",
      onConfirm: () => withRefresh(() => gitMerge(activeRepo.path, branch.name))
    });
  }

  function rebaseOnto(branch: BranchInfo) {
    if (!activeRepo) return;
    setConfirmModal({
      title: "Rebase Branch",
      body: (
        <>
          Rebase the current branch onto <strong>{branch.name}</strong>?
        </>
      ),
      confirmLabel: "Rebase",
      onConfirm: () => withRefresh(() => gitRebase(activeRepo.path, branch.name))
    });
  }

  function deleteRemoteBranch(branch: BranchInfo) {
    if (!activeRepo || !branch.isRemote) return;
    const [remote, ...rest] = branch.name.split("/");
    if (!remote || rest.length === 0) return;
    const remoteBranchName = rest.join("/");
    setConfirmModal({
      title: "Delete Remote Branch",
      body: (
        <>
          Delete remote branch <strong>{remoteBranchName}</strong> on{" "}
          <strong>{remote}</strong>? This pushes a deletion to the remote and is
          irreversible.
        </>
      ),
      confirmLabel: "Delete from remote",
      danger: true,
      onConfirm: () =>
        withRefresh(() =>
          gitDeleteRemoteBranch(activeRepo.path, remote, remoteBranchName)
        )
    });
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
    }
  }

  function pullCurrent() {
    if (!activeRepo) return;
    withRefresh(() => gitPull(activeRepo.path));
  }

  function pushCurrent() {
    if (!activeRepo) return;
    withRefresh(() => gitPush(activeRepo.path));
  }

  function syncCurrent() {
    if (!activeRepo) return;
    withRefresh(() => gitSync(activeRepo.path));
  }

  function fetchForBranch(branch: BranchInfo) {
    if (!activeRepo) return;
    const remote = branch.isRemote
      ? branch.name.split("/")[0]
      : branch.upstream?.split("/")[0];
    withRefresh(() => gitFetch(activeRepo.path, remote));
  }

  function buildMenuItems(branch: BranchInfo): ContextMenuItem[] {
    const items: ContextMenuItem[] = [];

    if (!branch.isCurrent) {
      items.push({ label: "Checkout", onSelect: () => switchBranch(branch) });
    }

    // Remote-sync actions for the CURRENT branch (Pull / Push / Sync / Fetch
    // operate on `HEAD`, so they only meaningfully sit under the current row).
    if (branch.isCurrent) {
      items.push({
        label: "Pull",
        onSelect: pullCurrent
      });
      items.push({
        label: "Push",
        onSelect: pushCurrent
      });
      items.push({
        label: "Sync (Pull, then Push)",
        onSelect: syncCurrent
      });
    }

    items.push({
      label: "Fetch",
      onSelect: () => fetchForBranch(branch)
    });

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
                loadError
                  ? `Failed to load branches: ${loadError}`
                  : branches.length === 0
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
                  onContextMenu={openBranchMenu}
                />
              ))}
            </BranchSection>

            {remoteGroups.map(([remoteName, list]) => (
              <BranchSection
                key={remoteName}
                title={remoteName.charAt(0).toUpperCase() + remoteName.slice(1)}
                count={list.length}
                collapsed={!!sectionsCollapsed[`remote:${remoteName}`]}
                onToggle={() => toggle(`remote:${remoteName}`)}
                isLoading={isLoading}
              >
                {list.map((branch) => (
                  <BranchRow
                    key={branch.name}
                    branch={branch}
                    onContextMenu={openBranchMenu}
                  />
                ))}
              </BranchSection>
            ))}
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

