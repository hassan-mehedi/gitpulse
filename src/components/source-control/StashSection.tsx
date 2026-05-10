import { useEffect, useState } from "react";
import { Codicon } from "../shared/Codicon";
import {
  gitStashApply,
  gitStashClear,
  gitStashDrop,
  gitStashList,
  gitStashPop
} from "../../lib/git";
import { useGit } from "../../hooks/useGit";
import { useWorkspaceStore } from "../../stores/workspace";
import type { Repository, StashEntry } from "../../types/git";

interface StashSectionProps {
  repo: Repository;
}

export function StashSection({ repo }: StashSectionProps) {
  const runGit = useGit();
  const refreshRepo = useWorkspaceStore((state) => state.refreshRepo);
  const [stashes, setStashes] = useState<StashEntry[]>([]);
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void gitStashList(repo.path)
      .then((entries) => {
        if (!cancelled) setStashes(entries);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [repo.path, repo.stashCount]);

  async function reload() {
    const entries = await gitStashList(repo.path).catch(() => [] as StashEntry[]);
    setStashes(entries);
  }

  async function withRefresh(operation: () => Promise<unknown>) {
    await runGit(async () => {
      await operation();
      await refreshRepo(repo.path);
      await reload();
    });
  }

  return (
    <section className="scm-section">
      <header className="scm-section__header">
        <button
          className="scm-section__toggle"
          onClick={() => setCollapsed((value) => !value)}
          type="button"
        >
          <Codicon name={collapsed ? "chevron-right" : "chevron-down"} size={14} />
          <span className="scm-section__title">Stashes</span>
        </button>
        <div className="scm-section__actions">
          <button
            className="scm-section__action"
            onClick={() => void reload()}
            title="Refresh"
            type="button"
          >
            <Codicon name="refresh" size={16} />
          </button>
          <button
            className="scm-section__action"
            onClick={() => void withRefresh(() => gitStashClear(repo.path))}
            title="Clear All Stashes"
            disabled={stashes.length === 0}
            type="button"
          >
            <Codicon name="trash" size={16} />
          </button>
        </div>
        <span className="scm-section__count">{repo.stashCount}</span>
      </header>

      {!collapsed ? (
        <div className="scm-section__body">
          {stashes.map((stash) => (
            <div className="scm-row" key={stash.stashRef} title={stash.message}>
              <Codicon name="archive" size={16} className="scm-row__icon" />
              <span className="scm-row__name">{stash.message || stash.stashRef}</span>
              <span className="scm-row__path">{stash.stashRef}</span>
              <span className="scm-row__actions">
                <button
                  className="scm-row__action"
                  onClick={(event) => {
                    event.stopPropagation();
                    void withRefresh(() => gitStashApply(repo.path, stash.stashRef));
                  }}
                  title="Apply Stash"
                  type="button"
                >
                  <Codicon name="arrow-up" size={14} />
                </button>
                <button
                  className="scm-row__action"
                  onClick={(event) => {
                    event.stopPropagation();
                    void withRefresh(() => gitStashPop(repo.path, stash.stashRef));
                  }}
                  title="Pop Stash"
                  type="button"
                >
                  <Codicon name="play" size={14} />
                </button>
                <button
                  className="scm-row__action"
                  onClick={(event) => {
                    event.stopPropagation();
                    void withRefresh(() => gitStashDrop(repo.path, stash.stashRef));
                  }}
                  title="Drop Stash"
                  type="button"
                >
                  <Codicon name="trash" size={14} />
                </button>
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
