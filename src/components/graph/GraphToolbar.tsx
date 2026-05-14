import { useEffect, useMemo, useRef, useState } from "react";
import type { Repository } from "../../types/git";
import { Codicon } from "../shared/Codicon";

interface GraphToolbarProps {
  repositories: Repository[];
  selectedRepoId: string;
  onRepoChange: (repoId: string) => void;
  query: string;
  onQueryChange: (value: string) => void;
  onReload: () => void;
  includeAll: boolean;
  onIncludeAllChange: (value: boolean) => void;
  activeRepo: Repository | null;
  onPull?: () => void;
  onPush?: () => void;
  onForcePush?: () => void;
  availableRefs: string[];
  hiddenRefs: string[];
  onToggleRef: (ref: string) => void;
  dateMode: "relative" | "absolute";
  onDateModeChange: (mode: "relative" | "absolute") => void;
}

export function GraphToolbar({
  repositories,
  selectedRepoId,
  onRepoChange,
  query,
  onQueryChange,
  onReload,
  includeAll,
  onIncludeAllChange,
  activeRepo,
  onPull,
  onPush,
  onForcePush,
  availableRefs,
  hiddenRefs,
  onToggleRef,
  dateMode,
  onDateModeChange
}: GraphToolbarProps) {
  const [isRepoMenuOpen, setIsRepoMenuOpen] = useState(false);
  const [isRefMenuOpen, setIsRefMenuOpen] = useState(false);
  const repoMenuRef = useRef<HTMLDivElement | null>(null);
  const refMenuRef = useRef<HTMLDivElement | null>(null);
  const selectedRepo = useMemo(
    () => repositories.find((repo) => repo.id === selectedRepoId) ?? repositories[0] ?? null,
    [repositories, selectedRepoId]
  );

  useEffect(() => {
    if (!isRepoMenuOpen && !isRefMenuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!repoMenuRef.current?.contains(event.target as Node)) {
        setIsRepoMenuOpen(false);
      }
      if (!refMenuRef.current?.contains(event.target as Node)) {
        setIsRefMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsRepoMenuOpen(false);
        setIsRefMenuOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isRepoMenuOpen, isRefMenuOpen]);

  return (
    <div className="graph-toolbar">
      <div className="graph-toolbar__repo-picker" ref={repoMenuRef}>
        <button
          className="graph-toolbar__repo-button"
          onClick={() => setIsRepoMenuOpen((value) => !value)}
          aria-haspopup="listbox"
          aria-expanded={isRepoMenuOpen}
          type="button"
        >
          <span className="graph-toolbar__repo-button-label">
            {selectedRepo ? `${selectedRepo.name} (${selectedRepo.branch})` : "Select repository"}
          </span>
          <Codicon name={isRepoMenuOpen ? "chevron-up" : "chevron-down"} size={14} />
        </button>
        {isRepoMenuOpen ? (
          <div className="graph-toolbar__repo-menu" role="listbox" aria-label="Graph repository">
            {repositories.map((repo) => {
              const isSelected = repo.id === selectedRepoId;
              return (
                <button
                  key={repo.id}
                  className={`graph-toolbar__repo-option${isSelected ? " is-selected" : ""}`}
                  onClick={() => {
                    onRepoChange(repo.id);
                    setIsRepoMenuOpen(false);
                  }}
                  role="option"
                  aria-selected={isSelected}
                  type="button"
                >
                  <span className="graph-toolbar__repo-option-name">{repo.name}</span>
                  <span className="graph-toolbar__repo-option-branch">{repo.branch}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
      <div className="graph-toolbar__filter">
        <Codicon name="search" size={14} />
        <input
          className="graph-toolbar__input"
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search commits, authors, refs"
          value={query}
        />
      </div>
      {activeRepo?.upstream &&
      (activeRepo.ahead > 0 || activeRepo.behind > 0) ? (
        <div
          className="graph-toolbar__sync"
          title={`${activeRepo.behind} behind / ${activeRepo.ahead} ahead of ${activeRepo.upstream}`}
        >
          {activeRepo.behind > 0 ? (
            <button
              className="graph-toolbar__sync-button"
              onClick={onPull}
              type="button"
              title={`Pull ${activeRepo.behind} commit${activeRepo.behind === 1 ? "" : "s"}`}
            >
              <Codicon name="arrow-down" size={12} />
              <span>{activeRepo.behind}</span>
            </button>
          ) : null}
          {activeRepo.ahead > 0 ? (
            <button
              className="graph-toolbar__sync-button"
              onClick={onPush}
              type="button"
              title={`Push ${activeRepo.ahead} commit${activeRepo.ahead === 1 ? "" : "s"}`}
            >
              <Codicon name="arrow-up" size={12} />
              <span>{activeRepo.ahead}</span>
            </button>
          ) : null}
          <button
            className="graph-toolbar__sync-button graph-toolbar__sync-button--danger"
            onClick={onForcePush}
            type="button"
            title="Force Push With Lease"
          >
            <Codicon name="warning" size={12} />
          </button>
        </div>
      ) : null}
      <button
        className={`view-action${includeAll ? " is-active" : ""}`}
        onClick={() => onIncludeAllChange(!includeAll)}
        title={includeAll ? "Showing all branches" : "Showing current branch"}
        type="button"
        aria-pressed={includeAll}
      >
        <Codicon name="git-branch" size={16} />
      </button>
      <div className="graph-toolbar__ref-filter" ref={refMenuRef}>
        <button
          className={`view-action${hiddenRefs.length > 0 ? " is-active" : ""}`}
          onClick={() => setIsRefMenuOpen((value) => !value)}
          title="Show/hide branch refs"
          type="button"
        >
          <Codicon name="filter" size={16} />
        </button>
        {isRefMenuOpen ? (
          <div className="graph-toolbar__ref-menu">
            {availableRefs.length === 0 ? (
              <div className="graph-toolbar__ref-empty">No refs loaded</div>
            ) : (
              availableRefs.map((ref) => (
                <label className="graph-toolbar__ref-option" key={ref}>
                  <input
                    type="checkbox"
                    checked={!hiddenRefs.includes(ref)}
                    onChange={() => onToggleRef(ref)}
                  />
                  <span>{ref.replace(/^HEAD -> /, "")}</span>
                </label>
              ))
            )}
          </div>
        ) : null}
      </div>
      <button
        className="view-action"
        onClick={() => onDateModeChange(dateMode === "relative" ? "absolute" : "relative")}
        title={dateMode === "relative" ? "Show absolute dates" : "Show relative dates"}
        type="button"
      >
        <Codicon name="calendar" size={16} />
      </button>
      <button
        className="view-action"
        onClick={onReload}
        title="Reload"
        type="button"
      >
        <Codicon name="refresh" size={16} />
      </button>
    </div>
  );
}
