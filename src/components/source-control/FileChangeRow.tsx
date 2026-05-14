import { memo } from "react";
import { Codicon } from "../shared/Codicon";
import { FileIcon } from "../shared/FileIcon";
import type { FileChange, Repository } from "../../types/git";

interface FileChangeRowProps {
  repo: Repository;
  change: FileChange;
  staged: boolean;
  isSelected: boolean;
  indent?: number;
  onSelect: (repo: Repository, change: FileChange, staged: boolean) => void;
  onStageToggle: (repo: Repository, change: FileChange, staged: boolean) => void;
  onDiscard: (repo: Repository, change: FileChange) => void;
  onContextMenu: (
    repo: Repository,
    change: FileChange,
    staged: boolean,
    position: { x: number; y: number }
  ) => void;
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

function FileChangeRowImpl({
  repo,
  change,
  staged,
  isSelected,
  indent = 0,
  onSelect,
  onStageToggle,
  onDiscard,
  onContextMenu
}: FileChangeRowProps) {
  const segments = change.path.split("/");
  const name = segments.pop() ?? change.path;
  const directory = segments.join("/");

  return (
    <div
      className={`scm-row${isSelected ? " is-selected" : ""}`}
      onClick={() => onSelect(repo, change, staged)}
      onContextMenu={(event) => {
        event.preventDefault();
        onContextMenu(repo, change, staged, { x: event.clientX, y: event.clientY });
      }}
      style={indent > 0 ? { paddingLeft: `${22 + indent * 12}px` } : undefined}
      role="treeitem"
    >
      <span
        className="scm-row__gutter-status"
        style={{ color: STATUS_COLOR[change.status] ?? "var(--vscode-foreground)" }}
        title={STATUS_TITLE[change.status] ?? change.status}
      >
        {change.status}
      </span>
      <FileIcon path={change.path} size={16} className="scm-row__icon" />
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
              onStageToggle(repo, change, staged);
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
                onDiscard(repo, change);
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
                onStageToggle(repo, change, staged);
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
  );
}

export const FileChangeRow = memo(
  FileChangeRowImpl,
  (prev, next) =>
    prev.change.path === next.change.path &&
    prev.change.status === next.change.status &&
    prev.staged === next.staged &&
    prev.isSelected === next.isSelected &&
    prev.indent === next.indent &&
    prev.repo.path === next.repo.path &&
    prev.onSelect === next.onSelect &&
    prev.onStageToggle === next.onStageToggle &&
    prev.onDiscard === next.onDiscard &&
    prev.onContextMenu === next.onContextMenu
);
