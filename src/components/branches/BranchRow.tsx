import { memo } from "react";
import { Codicon } from "../shared/Codicon";
import type { BranchInfo } from "../../types/git";

interface BranchRowProps {
  branch: BranchInfo;
  onSelect: (branch: BranchInfo) => void;
  onContextMenu: (branch: BranchInfo, position: { x: number; y: number }) => void;
}

function BranchRowImpl({ branch, onSelect, onContextMenu }: BranchRowProps) {
  const shortName = branch.isRemote
    ? branch.name.split("/").slice(1).join("/") || branch.name
    : branch.name;

  function openMenu(position: { x: number; y: number }) {
    onContextMenu(branch, position);
  }

  return (
    <div
      className={`scm-row branch-row${branch.isCurrent ? " is-current" : ""}`}
      onClick={() => onSelect(branch)}
      onContextMenu={(event) => {
        event.preventDefault();
        openMenu({ x: event.clientX, y: event.clientY });
      }}
      role="treeitem"
      title={branch.isCurrent ? `${branch.name} (current)` : branch.name}
    >
      <Codicon
        name={branch.isCurrent ? "check" : "git-branch"}
        size={14}
        className="scm-row__icon"
      />
      <span className="scm-row__name">{shortName}</span>
      {branch.upstream && !branch.isRemote ? (
        <span className="scm-row__path" title={branch.upstream}>
          {branch.upstream}
        </span>
      ) : null}
      <span className="scm-row__actions">
        <button
          className="scm-row__action"
          onClick={(event) => {
            event.stopPropagation();
            const rect = event.currentTarget.getBoundingClientRect();
            openMenu({ x: rect.right, y: rect.bottom });
          }}
          title="More Actions…"
          aria-label="Branch actions"
          type="button"
        >
          <Codicon name="ellipsis" size={14} />
        </button>
      </span>
    </div>
  );
}

export const BranchRow = memo(BranchRowImpl);
