import { useState } from "react";
import { Codicon } from "../shared/Codicon";
import { useGit } from "../../hooks/useGit";
import { useWorkspaceStore } from "../../stores/workspace";
import { useDiffStore } from "../../stores/diff";
import { gitDiscardFile, gitStageFile, gitUnstageFile } from "../../lib/git";
import type { FileChange, Repository } from "../../types/git";
import { ContextMenu } from "../shared/ContextMenu";

interface FileChangeRowProps {
  repo: Repository;
  change: FileChange;
  staged: boolean;
  indent?: number;
}

const STATUS_COLOR: Record<string, string> = {
  M: "var(--vscode-gitDecoration-modifiedResourceForeground)",
  A: "var(--vscode-gitDecoration-addedResourceForeground)",
  D: "var(--vscode-gitDecoration-deletedResourceForeground)",
  R: "var(--vscode-gitDecoration-renamedResourceForeground)",
  C: "var(--vscode-gitDecoration-renamedResourceForeground)",
  "?": "var(--vscode-gitDecoration-untrackedResourceForeground)",
  "!": "var(--vscode-gitDecoration-ignoredResourceForeground)",
  U: "var(--vscode-gitDecoration-conflictingResourceForeground)"
};

const STATUS_TITLE: Record<string, string> = {
  M: "Modified",
  A: "Added",
  D: "Deleted",
  R: "Renamed",
  C: "Copied",
  "?": "Untracked",
  "!": "Ignored",
  U: "Conflict"
};

export function FileChangeRow({ repo, change, staged, indent = 0 }: FileChangeRowProps) {
  const runGit = useGit();
  const refreshRepo = useWorkspaceStore((state) => state.refreshRepo);
  const openDiff = useWorkspaceStore((state) => state.openDiff);
  const activeChange = useDiffStore((state) => state.activeChange);
  const activeStaged = useDiffStore((state) => state.staged);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);

  const segments = change.path.split("/");
  const name = segments.pop() ?? change.path;
  const directory = segments.join("/");

  const isSelected =
    activeChange?.path === change.path && activeStaged === staged;

  function handleSelect() {
    void runGit(async () => {
      await openDiff(repo, change, staged);
    });
  }

  function handleStageToggle() {
    void runGit(async () => {
      if (staged) {
        await gitUnstageFile(repo.path, change.path);
      } else {
        await gitStageFile(repo.path, change.path);
      }
      await refreshRepo(repo.path);
    });
  }

  function handleDiscard() {
    void runGit(async () => {
      await gitDiscardFile(repo.path, change.path);
      await refreshRepo(repo.path);
    });
  }

  return (
    <>
      <div
        className={`scm-row${isSelected ? " is-selected" : ""}`}
        onClick={handleSelect}
        onContextMenu={(event) => {
          event.preventDefault();
          setMenuPosition({ x: event.clientX, y: event.clientY });
        }}
        style={indent > 0 ? { paddingLeft: `${22 + indent * 12}px` } : undefined}
        role="treeitem"
      >
        <Codicon name="file" size={16} className="scm-row__icon" />
        <span className="scm-row__name" title={change.path}>
          {name}
        </span>
        {directory ? (
          <span className="scm-row__path" title={change.path}>
            {directory}
          </span>
        ) : null}

        <span className="scm-row__actions">
          {staged ? (
            <button
              className="scm-row__action"
              onClick={(event) => {
                event.stopPropagation();
                handleStageToggle();
              }}
              title="Unstage Changes"
              aria-label="Unstage Changes"
              type="button"
            >
              <Codicon name="remove" size={14} />
            </button>
          ) : (
            <>
              <button
                className="scm-row__action"
                onClick={(event) => {
                  event.stopPropagation();
                  handleDiscard();
                }}
                title="Discard Changes"
                aria-label="Discard Changes"
                type="button"
              >
                <Codicon name="discard" size={14} />
              </button>
              <button
                className="scm-row__action"
                onClick={(event) => {
                  event.stopPropagation();
                  handleStageToggle();
                }}
                title="Stage Changes"
                aria-label="Stage Changes"
                type="button"
              >
                <Codicon name="add" size={14} />
              </button>
            </>
          )}
        </span>

        <span
          className="scm-row__status"
          style={{ color: STATUS_COLOR[change.status] ?? "var(--vscode-foreground)" }}
          title={STATUS_TITLE[change.status] ?? change.status}
        >
          {change.status}
        </span>
      </div>

      <ContextMenu
        items={[
          { label: "Open Diff", onSelect: handleSelect },
          {
            label: staged ? "Unstage Changes" : "Stage Changes",
            onSelect: handleStageToggle
          },
          {
            danger: true,
            disabled: staged,
            label: "Discard Changes",
            onSelect: handleDiscard
          }
        ]}
        onClose={() => setMenuPosition(null)}
        position={menuPosition}
      />
    </>
  );
}
