import { GitBranch, Pencil, Trash2 } from "lucide-react";
import type { BranchInfo } from "../../types/git";

interface BranchRowProps {
  branch: BranchInfo;
  onSwitch: (branch: BranchInfo) => void;
  onRename: (branch: BranchInfo) => void;
  onDelete: (branch: BranchInfo) => void;
}

export function BranchRow({ branch, onSwitch, onRename, onDelete }: BranchRowProps) {
  return (
    <div className={`file-row ${branch.isCurrent ? "is-active" : ""}`}>
      <div className="file-row__left">
        <div className="badge">
          <GitBranch size={13} />
          {branch.isCurrent ? "HEAD" : branch.isRemote ? "Remote" : "Local"}
        </div>
        <div>
          <div className="file-row__name">{branch.name}</div>
          <div className="file-row__path">
            {branch.upstream ?? "No upstream"} • {branch.lastCommitDate || "Unknown date"}
          </div>
        </div>
      </div>
      <div className="file-row__actions">
        {!branch.isCurrent ? (
          <button className="panel-button" onClick={() => onSwitch(branch)} type="button">
            Checkout
          </button>
        ) : null}
        {!branch.isRemote ? (
          <button className="icon-button" onClick={() => onRename(branch)} type="button">
            <Pencil size={14} />
          </button>
        ) : null}
        {!branch.isCurrent ? (
          <button className="icon-button" onClick={() => onDelete(branch)} type="button">
            <Trash2 size={14} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
