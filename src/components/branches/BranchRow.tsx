import { memo } from "react";
import { Codicon } from "../shared/Codicon";
import type { BranchInfo } from "../../types/git";

interface BranchRowProps {
  branch: BranchInfo;
  onSwitch: (branch: BranchInfo) => void;
  onRename: (branch: BranchInfo) => void;
  onDelete: (branch: BranchInfo) => void;
  onContextMenu: (branch: BranchInfo, position: { x: number; y: number }) => void;
}

function BranchRowImpl({
  branch,
  onSwitch,
  onRename,
  onDelete,
  onContextMenu
}: BranchRowProps) {
  const shortName = branch.isRemote
    ? branch.name.split("/").slice(1).join("/") || branch.name
    : branch.name;

  return (
    <div
      className={`scm-row${branch.isCurrent ? " is-selected" : ""}`}
      onClick={() => !branch.isCurrent && onSwitch(branch)}
      onContextMenu={(event) => {
        event.preventDefault();
        onContextMenu(branch, { x: event.clientX, y: event.clientY });
      }}
      role="treeitem"
    >
      <Codicon
        name={branch.isCurrent ? "check" : "git-branch"}
        size={14}
        className="scm-row__icon"
      />
      <span className="scm-row__name" title={branch.name}>
        {shortName}
      </span>
      {branch.upstream ? (
        <span className="scm-row__path" title={branch.upstream}>
          {branch.upstream}
        </span>
      ) : null}
      <span className="scm-row__actions">
        {!branch.isRemote && !branch.isCurrent ? (
          <button
            className="scm-row__action"
            onClick={(event) => {
              event.stopPropagation();
              onRename(branch);
            }}
            title="Rename Branch"
            type="button"
          >
            <Codicon name="edit" size={14} />
          </button>
        ) : null}
        {!branch.isCurrent ? (
          <button
            className="scm-row__action"
            onClick={(event) => {
              event.stopPropagation();
              onDelete(branch);
            }}
            title="Delete Branch"
            type="button"
          >
            <Codicon name="trash" size={14} />
          </button>
        ) : null}
        <button
          className="scm-row__action"
          onClick={(event) => {
            event.stopPropagation();
            event.preventDefault();
            const rect = event.currentTarget.getBoundingClientRect();
            onContextMenu(branch, { x: rect.right, y: rect.bottom });
          }}
          title="More Actions…"
          type="button"
        >
          <Codicon name="ellipsis" size={14} />
        </button>
      </span>
    </div>
  );
}

export const BranchRow = memo(BranchRowImpl);
