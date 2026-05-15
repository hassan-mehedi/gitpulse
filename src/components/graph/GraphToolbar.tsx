import { useEffect, useMemo, useRef, useState } from "react";
import type { Repository } from "../../types/git";
import { Codicon } from "../shared/Codicon";
import { SettingsCheckbox } from "../settings/SettingsPanel";

interface GraphToolbarProps {
  repositories: Repository[];
  selectedRepoId: string;
  onRepoChange: (repoId: string) => void;
  query: string;
  onQueryChange: (value: string) => void;
  authorQuery: string;
  onAuthorQueryChange: (value: string) => void;
  pathQuery: string;
  onPathQueryChange: (value: string) => void;
  sinceDays: string;
  onSinceDaysChange: (value: string) => void;
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
  onOpenReflog: () => void;
}

export function GraphToolbar({
  repositories,
  selectedRepoId,
  onRepoChange,
  query,
  onQueryChange,
  authorQuery,
  onAuthorQueryChange,
  pathQuery,
  onPathQueryChange,
  sinceDays,
  onSinceDaysChange,
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
  onDateModeChange,
  onOpenReflog
}: GraphToolbarProps) {
  const [isRepoMenuOpen, setIsRepoMenuOpen] = useState(false);
  const [isRefMenuOpen, setIsRefMenuOpen] = useState(false);
  const [isDateMenuOpen, setIsDateMenuOpen] = useState(false);
  const [toolbarWidth, setToolbarWidth] = useState(0);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const repoMenuRef = useRef<HTMLDivElement | null>(null);
  const refMenuRef = useRef<HTMLDivElement | null>(null);
  const dateMenuRef = useRef<HTMLDivElement | null>(null);
  const selectedRepo = useMemo(
    () => repositories.find((repo) => repo.id === selectedRepoId) ?? repositories[0] ?? null,
    [repositories, selectedRepoId]
  );

  useEffect(() => {
    if (!isRepoMenuOpen && !isRefMenuOpen && !isDateMenuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!repoMenuRef.current?.contains(event.target as Node)) {
        setIsRepoMenuOpen(false);
      }
      if (!refMenuRef.current?.contains(event.target as Node)) {
        setIsRefMenuOpen(false);
      }
      if (!dateMenuRef.current?.contains(event.target as Node)) {
        setIsDateMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsRepoMenuOpen(false);
        setIsRefMenuOpen(false);
        setIsDateMenuOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isDateMenuOpen, isRepoMenuOpen, isRefMenuOpen]);

  useEffect(() => {
    const element = toolbarRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setToolbarWidth(entry?.contentRect.width ?? 0);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const isNarrow = toolbarWidth > 0 && toolbarWidth <= 720;
  const isVeryNarrow = toolbarWidth > 0 && toolbarWidth <= 420;

  return (
    <div
      className={`graph-toolbar${isNarrow ? " is-narrow" : ""}${isVeryNarrow ? " is-very-narrow" : ""}`}
      ref={toolbarRef}
    >
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
      <div className="graph-toolbar__filter graph-toolbar__filter--compact">
        <Codicon name="account" size={14} />
        <input
          className="graph-toolbar__input"
          onChange={(event) => onAuthorQueryChange(event.target.value)}
          placeholder="Author"
          value={authorQuery}
        />
      </div>
      <div className="graph-toolbar__filter graph-toolbar__filter--compact">
        <Codicon name="file" size={14} />
        <input
          className="graph-toolbar__input"
          onChange={(event) => onPathQueryChange(event.target.value)}
          placeholder="Path"
          value={pathQuery}
        />
      </div>
      <div className="graph-toolbar__date-filter" ref={dateMenuRef}>
        <button
          className="graph-toolbar__date-button"
          onClick={() => setIsDateMenuOpen((value) => !value)}
          title="Limit by commit age"
          type="button"
        >
          <span>{dateRangeLabel(sinceDays)}</span>
          <Codicon name={isDateMenuOpen ? "chevron-up" : "chevron-down"} size={14} />
        </button>
        {isDateMenuOpen ? (
          <div className="graph-toolbar__date-menu">
            {[
              ["", "Any time"],
              ["7", "7 days"],
              ["30", "30 days"],
              ["90", "90 days"],
              ["365", "1 year"]
            ].map(([value, label]) => (
              <button
                className={`graph-toolbar__date-option${sinceDays === value ? " is-selected" : ""}`}
                key={value}
                onClick={() => {
                  onSinceDaysChange(value);
                  setIsDateMenuOpen(false);
                }}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}
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
                <div className="graph-toolbar__ref-option" key={ref}>
                  <SettingsCheckbox
                    checked={!hiddenRefs.includes(ref)}
                    onChange={() => onToggleRef(ref)}
                  />
                  <span>{ref.replace(/^HEAD -> /, "")}</span>
                </div>
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
        onClick={onOpenReflog}
        title="Open Reflog"
        type="button"
      >
        <Codicon name="history" size={16} />
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

function dateRangeLabel(value: string) {
  switch (value) {
    case "7":
      return "7 days";
    case "30":
      return "30 days";
    case "90":
      return "90 days";
    case "365":
      return "1 year";
    default:
      return "Any time";
  }
}
