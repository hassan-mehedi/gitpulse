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
}

export function GraphToolbar({
  repositories,
  selectedRepoId,
  onRepoChange,
  query,
  onQueryChange,
  onReload,
  includeAll,
  onIncludeAllChange
}: GraphToolbarProps) {
  const [isRepoMenuOpen, setIsRepoMenuOpen] = useState(false);
  const repoMenuRef = useRef<HTMLDivElement | null>(null);
  const selectedRepo = useMemo(
    () => repositories.find((repo) => repo.id === selectedRepoId) ?? repositories[0] ?? null,
    [repositories, selectedRepoId]
  );

  useEffect(() => {
    if (!isRepoMenuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!repoMenuRef.current?.contains(event.target as Node)) {
        setIsRepoMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsRepoMenuOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isRepoMenuOpen]);

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
      <button
        className={`view-action${includeAll ? " is-active" : ""}`}
        onClick={() => onIncludeAllChange(!includeAll)}
        title={includeAll ? "Showing all branches" : "Showing current branch"}
        type="button"
        aria-pressed={includeAll}
      >
        <Codicon name="git-branch" size={16} />
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
