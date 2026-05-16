import { useEffect, useMemo, useState } from "react";
import { Codicon } from "../shared/Codicon";
import { gitBlame } from "../../lib/git";
import { getCommitDetail } from "../../lib/commitDetails";
import { useGit } from "../../hooks/useGit";
import { ignoreReportedError } from "../../lib/errors";
import { useDiffStore } from "../../stores/diff";
import { useRepo } from "../../hooks/useRepo";
import type { BlameLine, CommitDetail } from "../../types/git";
import { BlameAnnotation } from "./BlameAnnotation";

function isUncommittedSha(sha: string) {
  return /^0+$/.test(sha);
}

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
      if (firstLine && !isUncommittedSha(firstLine.sha)) {
        const detail = await getCommitDetail(activeRepo.path, firstLine.sha);
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
    // The all-zero SHA is git's marker for uncommitted changes; `git show 0000…`
    // returns "fatal: bad object". Render a placeholder instead.
    if (isUncommittedSha(line.sha)) {
      setSelectedCommit(null);
      return;
    }
    await runGit(async () => {
      const detail = await getCommitDetail(activeRepo.path, line.sha);
      setSelectedCommit(detail);
    }).catch(ignoreReportedError);
  }

  const groupedCount = useMemo(() => new Set(blameLines.map((line) => line.sha)).size, [blameLines]);
  const selectedIsUncommitted = selectedSha ? isUncommittedSha(selectedSha) : false;

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

  const fileSegments = activeChange.path.split("/");
  const fileName = fileSegments.pop() ?? activeChange.path;
  const fileDir = fileSegments.join("/");

  return (
    <div className="diff-viewer">
      <div className="diff-viewer__header">
        <div className="diff-viewer__title">
          <span className="diff-viewer__filename">{fileName}</span>
          {fileDir ? <span className="diff-viewer__dir">{fileDir}</span> : null}
          <span className="diff-viewer__meta">{groupedCount} commits</span>
        </div>
        <div className="diff-viewer__toolbar">
          <button
            className={`view-action${ignoreWhitespace ? " is-active" : ""}`}
            onClick={() => setIgnoreWhitespace((v) => !v)}
            title="Ignore Whitespace"
            type="button"
          >
            <Codicon name="filter" size={16} />
          </button>
        </div>
      </div>

      <div className="blame-view">
        <section className="blame-view__list">
          {isLoading ? (
            <div className="scm-row scm-row--placeholder">
              <span className="scm-row__path">Loading blame…</span>
            </div>
          ) : null}
          {blameLines.map((line, index) => (
            <BlameAnnotation
              isGrouped={index > 0 && blameLines[index - 1]!.sha === line.sha}
              isSelected={line.sha === selectedSha && line.lineNumber === selectedLineNumber}
              key={`${line.sha}-${line.lineNumber}`}
              line={line}
              onSelect={() => void handleSelectLine(line)}
            />
          ))}
        </section>

        <aside className="blame-view__detail">
          {selectedCommit ? (
            <>
              <div className="blame-view__detail-header">
                <div className="blame-view__detail-message">{selectedCommit.message}</div>
                <div className="blame-view__detail-sha">{selectedCommit.sha}</div>
              </div>
              <div className="blame-view__detail-meta">
                <span>{selectedCommit.author}</span>
                <span>{selectedCommit.authorEmail}</span>
                <span>{selectedCommit.date}</span>
              </div>
              {selectedCommit.body ? (
                <pre className="blame-view__detail-body">{selectedCommit.body}</pre>
              ) : null}
            </>
          ) : selectedIsUncommitted ? (
            <div className="blame-view__empty">
              <Codicon name="circle-slash" size={16} />
              <span>Uncommitted change</span>
            </div>
          ) : (
            <div className="blame-view__empty">
              <Codicon name="git-commit" size={16} />
              <span>Select a blamed line</span>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
