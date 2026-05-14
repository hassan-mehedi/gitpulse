import { useEffect, useMemo, useState } from "react";
import { Codicon } from "../shared/Codicon";
import {
  gitDiffFile,
  gitDiscardLines,
  gitFileBytes,
  gitGetConflictContent,
  gitMarkResolved,
  gitSetConflictContent,
  gitStageLines,
  gitUnstageLines
} from "../../lib/git";
import {
  buildResolvedConflictContent,
  parseConflictSegments,
  type ConflictChoice
} from "../../lib/conflicts";
import { buildPatch, buildPatchFromSelectedLines } from "../../lib/patch";
import { useGit } from "../../hooks/useGit";
import { useWorkspaceStore } from "../../stores/workspace";
import { useDiffStore } from "../../stores/diff";
import { useSettingsStore } from "../../stores/settings";
import { FileHistoryPanel } from "../source-control/FileHistoryPanel";
import { MergeEditor } from "../merge/MergeEditor";
import { DiffGutter } from "./DiffGutter";
import { DiffHunk } from "./DiffHunk";
import type { ActivityView, FileDiff } from "../../types/git";

interface DiffViewerProps {
  activeView: ActivityView;
}

export function DiffViewer({ activeView }: DiffViewerProps) {
  const activeChange = useDiffStore((state) => state.activeChange);
  const activeCommit = useDiffStore((state) => state.activeCommit);
  const activeDiff = useDiffStore((state) => state.activeDiff);
  const activeFilePath = useDiffStore((state) => state.activeFilePath);
  const activeRepo = useDiffStore((state) => state.activeRepo);
  const activeScope = useDiffStore((state) => state.activeScope);
  const activeSourceKind = useDiffStore((state) => state.activeSourceKind);
  const staged = useDiffStore((state) => state.staged);
  const mode = useDiffStore((state) => state.mode);
  const activeHunkIndex = useDiffStore((state) => state.activeHunkIndex);
  const setMode = useDiffStore((state) => state.setMode);
  const setActiveHunkIndex = useDiffStore((state) => state.setActiveHunkIndex);
  const refreshActiveDiff = useDiffStore((state) => state.refreshActiveDiff);
  const refreshRepo = useWorkspaceStore((state) => state.refreshRepo);
  const theme = useSettingsStore((state) => state.theme);
  const runGit = useGit();
  const [selectedLinesByHunk, setSelectedLinesByHunk] = useState<Record<number, number[]>>({});
  const [surface, setSurface] = useState<"diff" | "history">("diff");
  const [showOutline, setShowOutline] = useState(false);
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false);
  const [whitespaceDiff, setWhitespaceDiff] = useState<FileDiff | null>(null);
  const [binaryPreview, setBinaryPreview] = useState<{ url: string; kind: "image" | "binary"; size: number } | null>(null);
  const diffState = ignoreWhitespace ? whitespaceDiff ?? activeDiff : activeDiff;
  const repoState = activeRepo;
  const isReadOnly = activeSourceKind === "commit";
  const activeHunk = diffState?.hunks[activeHunkIndex] ?? null;
  const selectedActiveLineIndices = selectedLinesByHunk[activeHunkIndex] ?? [];
  const canStage = Boolean(activeHunk && !isReadOnly);
  const canDiscard = Boolean(activeHunk && !staged && !isReadOnly);
  const canStageSelection = !isReadOnly && selectedActiveLineIndices.length > 0;
  const isSupportedView = activeView === "source-control" || activeView === "graph";

  useEffect(() => {
    if (!diffState || !repoState) {
      return;
    }

    setSelectedLinesByHunk({});
  }, [diffState, repoState, staged]);

  useEffect(() => {
    setIgnoreWhitespace(false);
    setWhitespaceDiff(null);
    setBinaryPreview(null);
  }, [activeFilePath, activeRepo?.path, staged]);

  useEffect(() => {
    if (!ignoreWhitespace || !activeChange || !repoState) return;
    let cancelled = false;
    void runGit(() => gitDiffFile(repoState.path, activeChange.path, staged, true))
      .then((nextDiff) => {
        if (!cancelled) setWhitespaceDiff(nextDiff);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeChange, ignoreWhitespace, repoState, runGit, staged]);

  useEffect(() => {
    if (!activeFilePath || !repoState) {
      return;
    }

    setSurface("diff");
  }, [activeFilePath, repoState]);

  const summary = useMemo(() => {
    if (!diffState) {
      return [];
    }

    return diffState.hunks.map((hunk, index) => ({
      index,
      additions: hunk.lines.filter((line) => line.lineType === "add").length,
      deletions: hunk.lines.filter((line) => line.lineType === "remove").length
    }));
  }, [diffState]);

  const hunkCount = diffState?.hunks.length ?? 0;
  useEffect(() => {
    if (activeView !== "source-control" || hunkCount === 0) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (!(event.altKey && !event.ctrlKey && !event.metaKey)) {
        return;
      }

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.closest("input, textarea, select, [contenteditable='true']") !== null ||
          target.isContentEditable)
      ) {
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveHunkIndex((activeHunkIndex - 1 + hunkCount) % hunkCount);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveHunkIndex((activeHunkIndex + 1) % hunkCount);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeHunkIndex, activeView, hunkCount, setActiveHunkIndex]);

  if (!isSupportedView) {
    return <WelcomeHints />;
  }

  if (!activeDiff || !activeRepo || !activeFilePath || activeScope !== activeView) {
    return activeView === "graph" ? <GraphDiffPlaceholder /> : <WelcomeHints />;
  }

  const diff = diffState ?? activeDiff;
  const repo = activeRepo;
  const filePath = activeFilePath;

  async function applyHunkAction(action: "stage" | "unstage" | "discard") {
    if (!activeHunk || !activeChange || isReadOnly) {
      return;
    }

    const patch = buildPatch(activeChange.path, [activeHunk], diff.oldFile);
    await runGit(async () => {
      if (action === "stage") {
        await gitStageLines(repo.path, activeChange.path, patch);
      } else if (action === "unstage") {
        await gitUnstageLines(repo.path, activeChange.path, patch);
      } else {
        await gitDiscardLines(repo.path, activeChange.path, patch);
      }

      await refreshRepo(repo.path);
      await refreshActiveDiff();
      setSelectedLinesByHunk({});
    });
  }

  async function applySelectionAction(action: "stage" | "unstage" | "discard") {
    if (!activeHunk || !activeChange || isReadOnly || selectedActiveLineIndices.length === 0) {
      return;
    }

    const patch = buildPatchFromSelectedLines(
      activeChange.path,
      activeHunk,
      selectedActiveLineIndices,
      diff.oldFile
    );
    await runGit(async () => {
      if (action === "stage") {
        await gitStageLines(repo.path, activeChange.path, patch);
      } else if (action === "unstage") {
        await gitUnstageLines(repo.path, activeChange.path, patch);
      } else {
        await gitDiscardLines(repo.path, activeChange.path, patch);
      }

      await refreshRepo(repo.path);
      await refreshActiveDiff();
      setSelectedLinesByHunk((state) => ({
        ...state,
        [activeHunkIndex]: []
      }));
    });
  }

  function toggleLineSelection(hunkIndex: number, lineIndex: number) {
    if (isReadOnly) {
      return;
    }

    const line = diff.hunks[hunkIndex]?.lines[lineIndex];
    if (!line || line.lineType === "context") {
      return;
    }

    setSelectedLinesByHunk((state) => {
      const current = new Set(state[hunkIndex] ?? []);
      if (current.has(lineIndex)) {
        current.delete(lineIndex);
      } else {
        current.add(lineIndex);
      }

      return {
        ...state,
        [hunkIndex]: Array.from(current).sort((left, right) => left - right)
      };
    });
  }

  function goToPreviousHunk() {
    if (diff.hunks.length === 0) {
      return;
    }
    setActiveHunkIndex((activeHunkIndex - 1 + diff.hunks.length) % diff.hunks.length);
  }

  function goToNextHunk() {
    if (diff.hunks.length === 0) {
      return;
    }
    setActiveHunkIndex((activeHunkIndex + 1) % diff.hunks.length);
  }

  function revealActiveHunk() {
    const line = activeHunk?.newStart ?? activeHunk?.oldStart ?? 1;
    const target = document.querySelector<HTMLElement>(
      `[data-diff-line="${filePath}:${line}"]`
    );
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const segments = filePath.split("/");
  const fileName = segments.pop() ?? filePath;
  const fileDir = segments.join("/");
  const metaLabel = isReadOnly
    ? `commit ${activeCommit?.shortSha ?? ""}`.trim()
    : staged
      ? "staged"
      : "working tree";

  async function loadBinaryPreview() {
    if (!repoState || !filePath) return;
    const revision = isReadOnly ? activeCommit?.sha : staged ? "HEAD" : undefined;
    const bytes = await runGit(() => gitFileBytes(repoState.path, filePath, revision));
    const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
    const mime = imageMime(ext);
    if (!mime) {
      setBinaryPreview({ url: "", kind: "binary", size: bytes.length });
      return;
    }
    const blob = new Blob([new Uint8Array(bytes)], { type: mime });
    setBinaryPreview((current) => {
      if (current?.url) URL.revokeObjectURL(current.url);
      return { url: URL.createObjectURL(blob), kind: "image", size: bytes.length };
    });
  }

  async function applyConflictQuickFix(choice: ConflictChoice) {
    if (!activeChange || !repoState) return;
    await runGit(async () => {
      const content = await gitGetConflictContent(repoState.path, activeChange.path);
      const segments = parseConflictSegments(content.raw);
      const choices: Record<number, ConflictChoice> = {};
      for (const segment of segments) {
        if (segment.type === "conflict") {
          choices[segment.region.id] = choice;
        }
      }
      const resolved = buildResolvedConflictContent(segments, choices);
      if (!resolved) return;
      await gitSetConflictContent(repoState.path, activeChange.path, resolved);
      await gitMarkResolved(repoState.path, activeChange.path);
      await refreshRepo(repoState.path);
      await refreshActiveDiff();
    });
  }

  return (
    <div className="diff-viewer">
      <div className="diff-viewer__header">
        <div className="diff-viewer__title">
          <span className="diff-viewer__filename">{fileName}</span>
          {fileDir ? <span className="diff-viewer__dir">{fileDir}</span> : null}
          <span className="diff-viewer__meta">{metaLabel}</span>
          {canStageSelection ? (
            <span className="diff-viewer__selection-count">
              {selectedActiveLineIndices.length} selected
            </span>
          ) : null}
        </div>
        <div className="diff-viewer__toolbar">
          <button
            className={`diff-viewer__tab${surface === "diff" ? " is-active" : ""}`}
            onClick={() => setSurface("diff")}
            title="Diff"
            type="button"
          >
            <Codicon name="diff-single" size={14} />
          </button>
          <button
            className={`diff-viewer__tab${surface === "history" ? " is-active" : ""}`}
            onClick={() => setSurface("history")}
            title="History"
            type="button"
          >
            <Codicon name="history" size={14} />
          </button>
          {surface === "diff" ? (
            <>
              <span className="diff-viewer__divider" />
              <button
                className="view-action"
                onClick={goToPreviousHunk}
                title="Previous Change (Alt+Up)"
                aria-label="Previous Change"
                disabled={diff.hunks.length === 0}
                type="button"
              >
                <Codicon name="arrow-up" size={16} />
              </button>
              <button
                className="view-action"
                onClick={goToNextHunk}
                title="Next Change (Alt+Down)"
                aria-label="Next Change"
                disabled={diff.hunks.length === 0}
                type="button"
              >
                <Codicon name="arrow-down" size={16} />
              </button>
              <span className="diff-viewer__hunk-counter">
                {diff.hunks.length === 0 ? "0 hunks" : `${activeHunkIndex + 1} / ${diff.hunks.length}`}
              </span>
              <span className="diff-viewer__divider" />
              <button
                className={`view-action${mode === "split" ? " is-active" : ""}`}
                onClick={() => setMode("split")}
                title="Side-by-side"
                aria-label="Side-by-side"
                type="button"
              >
                <Codicon name="split-horizontal" size={16} />
              </button>
              <button
                className={`view-action${mode === "inline" ? " is-active" : ""}`}
                onClick={() => setMode("inline")}
                title="Inline"
                aria-label="Inline"
                type="button"
              >
                <Codicon name="list-flat" size={16} />
              </button>
              <span className="diff-viewer__divider" />
              <button
                className={`view-action${showOutline ? " is-active" : ""}`}
                onClick={() => setShowOutline((value) => !value)}
                title={showOutline ? "Hide Hunk Outline" : "Show Hunk Outline"}
                aria-label="Toggle Hunk Outline"
                type="button"
              >
                <Codicon name="list-tree" size={16} />
              </button>
              <button
                className={`view-action${ignoreWhitespace ? " is-active" : ""}`}
                onClick={() => setIgnoreWhitespace((value) => !value)}
                title="Toggle whitespace changes"
                aria-label="Toggle whitespace changes"
                type="button"
              >
                <Codicon name="whitespace" size={16} />
              </button>
              <button
                className="view-action"
                onClick={revealActiveHunk}
                title="Reveal active line"
                aria-label="Reveal active line"
                disabled={!activeHunk}
                type="button"
              >
                <Codicon name="go-to-file" size={16} />
              </button>
            </>
          ) : null}
        </div>
      </div>

      {surface === "history" ? (
        <FileHistoryPanel filePath={filePath} repo={repo} />
      ) : activeChange?.status === "U" ? (
        <>
          <div className="conflict-quickfix">
            <span>Conflict quick fixes</span>
            <button className="merge-codelens-action" onClick={() => void applyConflictQuickFix("ours")} type="button">
              Accept All Current
            </button>
            <button className="merge-codelens-action" onClick={() => void applyConflictQuickFix("theirs")} type="button">
              Accept All Incoming
            </button>
            <button className="merge-codelens-action" onClick={() => void applyConflictQuickFix("both")} type="button">
              Accept All Both
            </button>
          </div>
          <MergeEditor filePath={activeChange.path} repoPath={repo.path} />
        </>
      ) : (
        <div
          className={`diff-viewer__body${showOutline ? "" : " diff-viewer__body--no-outline"}`}
        >
          {showOutline ? (
            <aside className="diff-viewer__sidebar">
              <DiffGutter
                canDiscard={canDiscard}
                canStage={canStage}
                canStageSelection={canStageSelection}
                onDiscard={() => void applyHunkAction("discard")}
                onSelectionDiscard={() => void applySelectionAction("discard")}
                onSelectionToggle={() => void applySelectionAction(staged ? "unstage" : "stage")}
                onStageToggle={() => void applyHunkAction(staged ? "unstage" : "stage")}
                staged={staged}
              />
              <div className="diff-outline">
                {summary.map((item) => (
                  <button
                    key={item.index}
                    className={`diff-outline__item ${item.index === activeHunkIndex ? "is-active" : ""}`}
                    onClick={() => setActiveHunkIndex(item.index)}
                    type="button"
                  >
                    <span>Hunk {item.index + 1}</span>
                    <span className="diff-outline__meta">
                      +{item.additions} -{item.deletions}
                    </span>
                  </button>
                ))}
              </div>
            </aside>
          ) : null}

          <div className="diff-viewer__content">
            {diff.hunks.length === 0 ? (
              <div className="diff-viewer__placeholder">
                {diff.isBinary ? (
                  <BinaryPreview
                    preview={binaryPreview}
                    onLoad={() => void loadBinaryPreview()}
                    fileName={fileName}
                  />
                ) : (
                  "No textual changes to display."
                )}
              </div>
            ) : (
              diff.hunks.map((hunk, index) => (
                <DiffHunk
                  filePath={filePath}
                  repoPath={repo.path}
                  enableBlame={!isReadOnly}
                  key={`${hunk.header}-${index}`}
                  hunk={hunk}
                  hunkIndex={index}
                  isActive={index === activeHunkIndex}
                  mode={mode}
                  theme={theme}
                  onFocus={() => setActiveHunkIndex(index)}
                  onToggleLine={toggleLineSelection}
                  allowLineSelection={!isReadOnly}
                  selectedLineIndices={isReadOnly ? [] : selectedLinesByHunk[index] ?? []}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function WelcomeHints() {
  return (
    <div className="welcome-hints">
      <div className="welcome-hints__row">
        <span>Show Source Control</span>
        <kbd>Ctrl</kbd>
        <span className="welcome-hints__plus">+</span>
        <kbd>Shift</kbd>
        <span className="welcome-hints__plus">+</span>
        <kbd>G</kbd>
      </div>
      <div className="welcome-hints__row">
        <span>Switch Branch</span>
        <kbd>Ctrl</kbd>
        <span className="welcome-hints__plus">+</span>
        <kbd>Shift</kbd>
        <span className="welcome-hints__plus">+</span>
        <kbd>B</kbd>
      </div>
      <div className="welcome-hints__row">
        <span>Show All Shortcuts</span>
        <kbd>Ctrl</kbd>
        <span className="welcome-hints__plus">+</span>
        <kbd>K</kbd>
        <span className="welcome-hints__plus">,</span>
        <kbd>Ctrl</kbd>
        <span className="welcome-hints__plus">+</span>
        <kbd>S</kbd>
      </div>
    </div>
  );
}

function GraphDiffPlaceholder() {
  return (
    <div className="commit-detail__diff-placeholder">
      Select a file on the left to view its diff.
    </div>
  );
}

function BinaryPreview({
  preview,
  onLoad,
  fileName
}: {
  preview: { url: string; kind: "image" | "binary"; size: number } | null;
  onLoad: () => void;
  fileName: string;
}) {
  if (!preview) {
    return (
      <div className="binary-preview">
        <div>Binary file - no textual diff.</div>
        <button className="vscode-button" onClick={onLoad} type="button">
          Preview
        </button>
      </div>
    );
  }
  if (preview.kind === "image") {
    return (
      <div className="binary-preview">
        <img src={preview.url} alt={fileName} />
        <span>{formatBytes(preview.size)}</span>
      </div>
    );
  }
  return (
    <div className="binary-preview">
      <div>Binary preview is not available for this file type.</div>
      <span>{formatBytes(preview.size)}</span>
    </div>
  );
}

function imageMime(ext: string) {
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  if (ext === "svg") return "image/svg+xml";
  return null;
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
