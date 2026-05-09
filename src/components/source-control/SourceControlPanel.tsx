import { FolderTree, Rows3, GitBranchPlus, RefreshCcw } from "lucide-react";
import { useState } from "react";
import { useWorkspaceStore } from "../../stores/workspace";
import { RepoSection } from "./RepoSection";
import type { ActivityView } from "../../types/git";

interface SourceControlPanelProps {
  activeView: ActivityView;
}

export function SourceControlPanel({ activeView }: SourceControlPanelProps) {
  const repositories = useWorkspaceStore((state) => state.repositories);
  const [viewMode, setViewMode] = useState<"tree" | "list">("list");

  if (activeView !== "source-control") {
    return (
      <div className="empty-state">
        <div className="empty-state__card">
          <div className="empty-state__title">View not implemented yet</div>
          <div className="empty-state__body">
            The shell is ready for {activeView}. The next feature slices can plug into this panel
            without restructuring the layout.
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="panel-header">
        <div>
          <div className="panel-header__eyebrow">Source Control</div>
          <div className="panel-header__title">Tracked Changes</div>
        </div>
        <div className="toolbar__actions">
          <button className="icon-button" type="button">
            <RefreshCcw size={16} />
          </button>
          <button className="icon-button" type="button">
            <GitBranchPlus size={16} />
          </button>
          <button
            className="icon-button"
            onClick={() => setViewMode((value) => (value === "list" ? "tree" : "list"))}
            type="button"
          >
            {viewMode === "list" ? <FolderTree size={16} /> : <Rows3 size={16} />}
          </button>
        </div>
      </div>

      <div className="repo-section-list">
        {repositories.length === 0 ? (
          <div className="empty-state__card">
            <div className="empty-state__title">No repository loaded</div>
            <div className="empty-state__body">
              Launch GitPulse with a repo path or a `.code-workspace` file target.
            </div>
          </div>
        ) : null}
        {repositories.map((repo) => (
          <RepoSection key={repo.id} repo={repo} viewMode={viewMode} />
        ))}
      </div>
    </>
  );
}
