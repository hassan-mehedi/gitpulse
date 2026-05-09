import type { BranchInfo } from "../../types/git";
import { BranchRow } from "./BranchRow";

interface BranchListProps {
  title: string;
  branches: BranchInfo[];
  isLoading: boolean;
  onSwitch: (branch: BranchInfo) => void;
  onRename: (branch: BranchInfo) => void;
  onDelete: (branch: BranchInfo) => void;
}

export function BranchList({
  title,
  branches,
  isLoading,
  onSwitch,
  onRename,
  onDelete
}: BranchListProps) {
  return (
    <section className="repo-card__section">
      <div className="repo-card__section-header">
        <span>{title}</span>
      </div>
      <div className="file-list">
        {isLoading ? (
          <div className="file-row">
            <div className="file-row__left">
              <span className="file-row__path">Loading branches…</span>
            </div>
          </div>
        ) : null}
        {!isLoading && branches.length === 0 ? (
          <div className="file-row">
            <div className="file-row__left">
              <span className="file-row__path">No branches</span>
            </div>
          </div>
        ) : null}
        {branches.map((branch) => (
          <BranchRow
            branch={branch}
            key={branch.name}
            onDelete={onDelete}
            onRename={onRename}
            onSwitch={onSwitch}
          />
        ))}
      </div>
    </section>
  );
}
