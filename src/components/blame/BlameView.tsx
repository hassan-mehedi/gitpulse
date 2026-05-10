import { useEffect, useMemo, useState } from "react";
import { GitCommitHorizontal } from "lucide-react";
import { gitBlame, gitShowCommit } from "../../lib/git";
import { useGit } from "../../hooks/useGit";
import { useDiffStore } from "../../stores/diff";
import { useRepo } from "../../hooks/useRepo";
import type { BlameLine, CommitDetail } from "../../types/git";
import { BlameAnnotation } from "./BlameAnnotation";

export function BlameView() {
  const { activeRepo } = useRepo();
  const activeChange = useDiffStore((state) => state.activeChange);
  const runGit = useGit();
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false);
  const [blameLines, setBlameLines] = useState<BlameLine[]>([]);
  const [selectedSha, setSelectedSha] = useState<string | null>(null);
  const [selectedLineNumber, setSelectedLineNumber] = useState<number | null>(null);
  const [selectedCommit, setSelectedCommit] = useState<CommitDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!activeRepo || !activeChange) {
      setBlameLines([]);
      setSelectedSha(null);
      setSelectedLineNumber(null);
      setSelectedCommit(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    void runGit(async () => {
      const nextLines = await gitBlame(activeRepo.path, activeChange.path, ignoreWhitespace);
      if (cancelled) return;
      setBlameLines(nextLines);
      const firstLine = nextLines[0];
      setSelectedSha(firstLine?.sha ?? null);
      setSelectedLineNumber(firstLine?.lineNumber ?? null);
      if (firstLine) {
        const detail = await gitShowCommit(activeRepo.path, firstLine.sha);
        if (cancelled) return;
        setSelectedCommit(detail);
      } else {
        setSelectedCommit(null);
      }
      setIsLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [activeRepo?.path, activeChange?.path, ignoreWhitespace, runGit]);

  async function handleSelectLine(line: BlameLine) {
    if (!activeRepo) {
      return;
    }

    setSelectedSha(line.sha);
    setSelectedLineNumber(line.lineNumber);
    await runGit(async () => {
      const detail = await gitShowCommit(activeRepo.path, line.sha);
      setSelectedCommit(detail);
    });
  }

  const groupedCount = useMemo(() => new Set(blameLines.map((line) => line.sha)).size, [blameLines]);

  if (!activeRepo || !activeChange) {
    return (
      <div className="empty-state">
        <div className="empty-state__card">
          <div className="empty-state__title">Select a file first</div>
          <div className="empty-state__body">
            Use the file actions in Source Control to choose a file, then switch to Blame.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="graph-view">
      <div className="diff-viewer__header">
        <div>
          <div>Blame</div>
          <div className="diff-viewer__meta">
            {activeChange.path} • {groupedCount} commits
          </div>
        </div>
        <label className="settings-row" style={{ minWidth: 220 }}>
          <span>Ignore whitespace</span>
          <input
            checked={ignoreWhitespace}
            onChange={(event) => setIgnoreWhitespace(event.target.checked)}
            type="checkbox"
          />
        </label>
      </div>

      <div className="graph-view__body">
        <section className="graph-list">
          {isLoading ? (
            <div className="file-row">
              <div className="file-row__left">
                <span className="file-row__path">Loading blame…</span>
              </div>
            </div>
          ) : null}
          {blameLines.map((line) => (
            <BlameAnnotation
              isSelected={line.sha === selectedSha && line.lineNumber === selectedLineNumber}
              key={`${line.sha}-${line.lineNumber}`}
              line={line}
              onSelect={() => void handleSelectLine(line)}
            />
          ))}
        </section>

        <aside className="graph-detail">
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
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-state__card">
                <div className="empty-state__title">
                  <GitCommitHorizontal size={18} /> Select a blamed line
                </div>
                <div className="empty-state__body">
                  Click any blame annotation to inspect the associated commit.
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
