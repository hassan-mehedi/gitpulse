import { useCallback, useEffect, useRef, useState } from "react";
import { Codicon } from "../shared/Codicon";
import { DiffHunk } from "../diff/DiffHunk";
import { gitCommitDiff, gitLog, gitRestoreFileFromCommit } from "../../lib/git";
import { getCommitDetail } from "../../lib/commitDetails";
import { useGit } from "../../hooks/useGit";
import { useWorkspaceStore } from "../../stores/workspace";
import { useSettingsStore } from "../../stores/settings";
import { ConfirmModal } from "../shared/ConfirmModal";
import type { CommitDetail, CommitInfo, FileDiff, Repository } from "../../types/git";

interface FileHistoryPanelProps {
  filePath: string;
  repo: Repository;
}

const LIST_HEIGHT_STORAGE_KEY = "gitpulse:fileHistoryListHeight";
const MIN_LIST_HEIGHT = 96;
const MIN_DETAIL_HEIGHT = 120;
const DEFAULT_LIST_HEIGHT = 240;

function readInitialListHeight(): number {
  if (typeof window === "undefined") return DEFAULT_LIST_HEIGHT;
  const raw = window.localStorage?.getItem(LIST_HEIGHT_STORAGE_KEY);
  if (!raw) return DEFAULT_LIST_HEIGHT;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= MIN_LIST_HEIGHT ? parsed : DEFAULT_LIST_HEIGHT;
}

export function FileHistoryPanel({ filePath, repo }: FileHistoryPanelProps) {
  const runGit = useGit();
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [selectedCommitSha, setSelectedCommitSha] = useState<string | null>(null);
  const [selectedCommit, setSelectedCommit] = useState<CommitDetail | null>(null);
  const [selectedDiff, setSelectedDiff] = useState<FileDiff | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDiffLoading, setIsDiffLoading] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const refreshRepo = useWorkspaceStore((state) => state.refreshRepo);
  const theme = useSettingsStore((state) => state.theme);
  const splitRef = useRef<HTMLDivElement | null>(null);
  const [listHeight, setListHeight] = useState<number>(readInitialListHeight);
  const [isDraggingSash, setIsDraggingSash] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage?.setItem(LIST_HEIGHT_STORAGE_KEY, String(listHeight));
  }, [listHeight]);

  const handleSashPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const sash = event.currentTarget;
      const container = splitRef.current;
      if (!container) return;
      sash.setPointerCapture(event.pointerId);
      setIsDraggingSash(true);

      const onMove = (moveEvent: PointerEvent) => {
        const rect = container.getBoundingClientRect();
        const next = moveEvent.clientY - rect.top;
        const maxHeight = rect.height - MIN_DETAIL_HEIGHT;
        const clamped = Math.max(MIN_LIST_HEIGHT, Math.min(next, maxHeight));
        setListHeight(clamped);
      };

      const onUp = (upEvent: PointerEvent) => {
        try {
          sash.releasePointerCapture(upEvent.pointerId);
        } catch {
          /* pointer may already be released */
        }
        sash.removeEventListener("pointermove", onMove);
        sash.removeEventListener("pointerup", onUp);
        sash.removeEventListener("pointercancel", onUp);
        setIsDraggingSash(false);
      };

      sash.addEventListener("pointermove", onMove);
      sash.addEventListener("pointerup", onUp);
      sash.addEventListener("pointercancel", onUp);
    },
    []
  );

  async function loadCommit(sha: string) {
    setIsDiffLoading(true);
    const detail = await getCommitDetail(repo.path, sha);
    setSelectedCommit(detail);
    try {
      const diffs = await gitCommitDiff(repo.path, sha);
      const match =
        diffs.find((entry) => entry.file === filePath) ??
        diffs.find((entry) => entry.oldFile === filePath) ??
        null;
      setSelectedDiff(match);
    } finally {
      setIsDiffLoading(false);
    }
  }

  useEffect(() => {
    setIsLoading(true);
    setSelectedDiff(null);
    void runGit(async () => {
      const nextCommits = await gitLog(repo.path, 80, undefined, filePath);
      setCommits(nextCommits);
      const firstCommit = nextCommits[0];
      setSelectedCommitSha(firstCommit?.sha ?? null);
      if (firstCommit) {
        await loadCommit(firstCommit.sha);
      } else {
        setSelectedCommit(null);
        setSelectedDiff(null);
      }
      setIsLoading(false);
    }).catch(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filePath, repo.path, runGit]);

  async function handleSelectCommit(commit: CommitInfo) {
    setSelectedCommitSha(commit.sha);
    setSelectedDiff(null);
    await runGit(() => loadCommit(commit.sha));
  }

  return (
    <div className="graph-view">
      <div className="diff-viewer__header">
        <div>
          <div>File History</div>
          <div className="diff-viewer__meta">{filePath}</div>
        </div>
      </div>

      <div className="file-history__split" ref={splitRef}>
        <section
          className="graph-list file-history__list"
          style={{ flex: `0 0 ${listHeight}px` }}
        >
          {isLoading ? (
            <div className="file-row">
              <div className="file-row__left">
                <span className="file-row__path">Loading history…</span>
              </div>
            </div>
          ) : null}

          {!isLoading && commits.length === 0 ? (
            <div className="file-row">
              <div className="file-row__left">
                <span className="file-row__path">No history for this file yet</span>
              </div>
            </div>
          ) : null}

          {commits.map((commit) => (
            <button
              className={`graph-row ${commit.sha === selectedCommitSha ? "is-active" : ""}`}
              key={commit.sha}
              onClick={() => void handleSelectCommit(commit)}
              type="button"
            >
              <div className="graph-row__content">
                <div className="graph-row__title">
                  <span>{commit.message}</span>
                  <span className="file-row__path">{commit.shortSha}</span>
                </div>
                <div className="graph-row__meta">
                  <span>{commit.author}</span>
                  <span>{commit.date}</span>
                  {commit.refs.map((ref) => (
                    <span className="badge" key={`${commit.sha}-${ref}`}>
                      {ref}
                    </span>
                  ))}
                </div>
              </div>
            </button>
          ))}
        </section>

        <div
          className={`file-history__sash${isDraggingSash ? " is-dragging" : ""}`}
          onPointerDown={handleSashPointerDown}
          role="separator"
          aria-orientation="horizontal"
        />

        <aside className="graph-detail file-history__detail">
          {selectedCommit ? (
            <>
              <div className="graph-detail__header">
                <div>{selectedCommit.message}</div>
                <div className="file-row__path">{selectedCommit.sha}</div>
              </div>
              <div className="graph-detail__meta">
                <span>{selectedCommit.author}</span>
                <span>{selectedCommit.authorEmail}</span>
                <span>{selectedCommit.date}</span>
              </div>
              {selectedCommit.body ? (
                <pre className="graph-detail__body">{selectedCommit.body}</pre>
              ) : null}
              <button
                className="vscode-button"
                onClick={() => setConfirmRestore(true)}
                type="button"
              >
                Restore This File From Commit
              </button>
              <div className="repo-card__section file-history__diff-section">
                <div className="repo-card__section-header">
                  <span>Diff · {filePath}</span>
                </div>
                {isDiffLoading ? (
                  <div className="diff-viewer__placeholder">Loading diff…</div>
                ) : !selectedDiff ? (
                  <div className="diff-viewer__placeholder">
                    This commit did not modify {filePath}.
                  </div>
                ) : selectedDiff.hunks.length === 0 ? (
                  <div className="diff-viewer__placeholder">
                    {selectedDiff.isBinary
                      ? "Binary file — no textual diff to display."
                      : "No textual changes to display."}
                  </div>
                ) : (
                  <div className="diff-viewer__content">
                    {selectedDiff.hunks.map((hunk, index) => (
                      <DiffHunk
                        key={`${selectedCommit.sha}-${hunk.header}-${index}`}
                        filePath={selectedDiff.file}
                        repoPath={repo.path}
                        enableBlame={false}
                        hunk={hunk}
                        hunkIndex={index}
                        isActive={false}
                        mode="inline"
                        theme={theme}
                        onFocus={() => undefined}
                        allowLineSelection={false}
                        selectedLineIndices={[]}
                        onToggleLine={() => undefined}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-state__card">
                <div className="empty-state__title">
                  <Codicon name="git-commit" size={16} /> Select a commit
                </div>
                <div className="empty-state__body">
                  Choose any file commit to inspect its metadata and affected files.
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>
      <ConfirmModal
        isOpen={confirmRestore}
        title="Restore File"
        body={
          <>
            Restore <strong>{filePath}</strong> from commit{" "}
            <strong>{selectedCommit?.shortSha}</strong>? This updates the working tree copy.
          </>
        }
        confirmLabel="Restore"
        onConfirm={() => {
          if (!selectedCommit) return;
          void runGit(async () => {
            await gitRestoreFileFromCommit(repo.path, selectedCommit.sha, filePath);
            await refreshRepo(repo.path);
          });
        }}
        onClose={() => setConfirmRestore(false)}
      />
    </div>
  );
}
