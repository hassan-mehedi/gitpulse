import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Codicon } from "../shared/Codicon";
import { ConfirmModal } from "../shared/ConfirmModal";
import {
  gitAbortMerge,
  gitContinueMerge,
  gitGetConflictContent,
  gitMarkResolved,
  gitSetConflictContent
} from "../../lib/git";
import {
  buildResolvedConflictContent,
  parseConflictSegments,
  type ConflictChoice,
  type ConflictSegment
} from "../../lib/conflicts";
import { useGit } from "../../hooks/useGit";
import { useWorkspaceStore } from "../../stores/workspace";
import { useSettingsStore } from "../../stores/settings";
import { useMergeDraftStore } from "../../stores/mergeDrafts";
import { HighlightedLineContent } from "../diff/HighlightedLineContent";

interface MergeEditorProps {
  filePath: string;
  repoPath: string;
}

type PaneSide = "ours" | "theirs" | "result";

export function MergeEditor({ filePath, repoPath }: MergeEditorProps) {
  const runGit = useGit();
  const theme = useSettingsStore((state) => state.theme);
  const refreshRepo = useWorkspaceStore((state) => state.refreshRepo);
  const [base, setBase] = useState("");
  const [raw, setRaw] = useState("");
  const [choices, setChoices] = useState<Record<number, ConflictChoice | undefined>>({});
  const [resultDraft, setResultDraft] = useState("");
  const [isResultEdited, setIsResultEdited] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeConflict, setActiveConflict] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const panesContainerRef = useRef<HTMLDivElement | null>(null);
  const paneRefs = useRef<Array<HTMLDivElement | null>>([]);
  const isSyncingScroll = useRef(false);
  const draftKey = `${repoPath}:${filePath}`;
  const saveDraft = useMergeDraftStore((state) => state.setDraft);
  const clearDraft = useMergeDraftStore((state) => state.clearDraft);

  const [paneFractions, setPaneFractions] = useState<[number, number, number]>(
    () => loadStoredPaneFractions()
  );
  const fractionsAtDragStartRef = useRef<[number, number, number]>(paneFractions);
  const [isAbortConfirmOpen, setIsAbortConfirmOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        PANE_FRACTIONS_STORAGE_KEY,
        JSON.stringify(paneFractions)
      );
    } catch {
      // localStorage may be unavailable (private mode); silent.
    }
  }, [paneFractions]);

  function handleSashStart() {
    fractionsAtDragStartRef.current = paneFractions;
  }

  function handleSashDrag(sashIndex: 0 | 1, dx: number) {
    const container = panesContainerRef.current;
    if (!container) return;
    const width = container.clientWidth;
    if (width <= 0) return;
    const deltaFraction = dx / width;
    const [a, b, c] = fractionsAtDragStartRef.current;
    const MIN = 0.1;
    if (sashIndex === 0) {
      const newA = clamp(a + deltaFraction, MIN, a + b - MIN);
      setPaneFractions([newA, a + b - newA, c]);
    } else {
      const newB = clamp(b + deltaFraction, MIN, b + c - MIN);
      setPaneFractions([a, newB, b + c - newB]);
    }
  }

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    void runGit(async () => {
      const content = await gitGetConflictContent(repoPath, filePath);
      if (cancelled) return;
      setBase(content.base);
      setRaw(content.raw);
      const savedDraft = useMergeDraftStore.getState().drafts[draftKey];
      const draft = savedDraft?.raw === content.raw ? savedDraft : null;
      setChoices(draft?.choices ?? {});
      setResultDraft(draft?.resultDraft ?? content.raw);
      setIsResultEdited(draft?.isResultEdited ?? false);
      setActiveConflict(0);
      setIsLoading(false);
    }).catch(() => {
      if (!cancelled) setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [draftKey, filePath, repoPath, runGit]);

  const segments = useMemo(() => parseConflictSegments(raw), [raw]);
  const conflictRegions = useMemo(
    () =>
      segments.filter(
        (segment): segment is Extract<ConflictSegment, { type: "conflict" }> =>
          segment.type === "conflict"
      ),
    [segments]
  );
  const conflictCount = conflictRegions.length;
  const resolvedCount = conflictRegions.filter(
    (segment) => choices[segment.region.id]
  ).length;
  const resolvedContent = useMemo(
    () => buildResolvedConflictContent(segments, choices),
    [choices, segments]
  );
  const resultPreview = useMemo(
    () => buildResultPreview(segments, choices),
    [choices, segments]
  );

  useEffect(() => {
    if (!isResultEdited) {
      setResultDraft(resultPreview);
    }
  }, [isResultEdited, resultPreview]);

  useEffect(() => {
    if (!raw) return;
    saveDraft(draftKey, {
      raw,
      choices,
      resultDraft,
      isResultEdited
    });
  }, [choices, draftKey, isResultEdited, raw, resultDraft, saveDraft]);

  const navigateConflict = useCallback(
    (direction: 1 | -1) => {
      if (conflictCount === 0) return;
      setActiveConflict((current) => {
        const idx = current ?? 0;
        const next = (idx + direction + conflictCount) % conflictCount;
        scrollConflictIntoView(containerRef.current, next);
        return next;
      });
    },
    [conflictCount]
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!event.altKey) return;
      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        navigateConflict(1);
      } else if (event.key.toLowerCase() === "p") {
        event.preventDefault();
        navigateConflict(-1);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigateConflict]);

  function chooseFor(id: number, choice: ConflictChoice) {
    setIsResultEdited(false);
    setChoices((state) => ({ ...state, [id]: choice }));
  }

  function syncScroll(sourceIndex: number) {
    if (isSyncingScroll.current) return;
    const source = paneRefs.current[sourceIndex];
    if (!source) return;
    const topRatio =
      source.scrollHeight === source.clientHeight
        ? 0
        : source.scrollTop / (source.scrollHeight - source.clientHeight);
    const leftRatio =
      source.scrollWidth === source.clientWidth
        ? 0
        : source.scrollLeft / (source.scrollWidth - source.clientWidth);
    isSyncingScroll.current = true;
    for (const [index, pane] of paneRefs.current.entries()) {
      if (!pane || index === sourceIndex) continue;
      pane.scrollTop = topRatio * Math.max(0, pane.scrollHeight - pane.clientHeight);
      pane.scrollLeft = leftRatio * Math.max(0, pane.scrollWidth - pane.clientWidth);
    }
    window.requestAnimationFrame(() => {
      isSyncingScroll.current = false;
    });
  }

  async function handleMarkResolved() {
    const content = resultDraft;
    if (hasConflictMarkers(content)) return;
    await runGit(async () => {
      await gitSetConflictContent(repoPath, filePath, content);
      await gitMarkResolved(repoPath, filePath);
      clearDraft(draftKey);
      await refreshRepo(repoPath);
    });
  }

  async function handleContinueMerge() {
    await runGit(async () => {
      await gitContinueMerge(repoPath);
      await refreshRepo(repoPath);
    });
  }

  async function performAbortMerge() {
    await runGit(async () => {
      await gitAbortMerge(repoPath);
      clearDraft(draftKey);
      await refreshRepo(repoPath);
    });
  }

  function resetConflictChoices() {
    setChoices({});
    setIsResultEdited(false);
  }

  const pathParts = filePath.split("/");
  const name = pathParts.pop() ?? filePath;
  const dir = pathParts.join("/");
  const allResolved = conflictCount > 0 && resolvedCount === conflictCount;
  const canMarkResolved =
    conflictCount > 0 &&
    !hasConflictMarkers(resultDraft) &&
    (allResolved || isResultEdited || resolvedContent !== null);

  return (
    <div className="merge-editor" ref={containerRef}>
      <div className="merge-editor__header">
        <div className="merge-editor__title">
          <Codicon name="git-merge" size={14} />
          <span className="merge-editor__filename">{name}</span>
          {dir ? <span className="merge-editor__dir">{dir}</span> : null}
          <span className="merge-editor__meta">
            {resolvedCount} / {conflictCount} resolved
          </span>
        </div>
        <div className="merge-editor__toolbar">
          <button
            className="vscode-button vscode-button--ghost"
            onClick={() => navigateConflict(-1)}
            disabled={conflictCount === 0}
            title="Previous Conflict (Alt+P)"
            type="button"
          >
            <Codicon name="arrow-up" size={14} />
          </button>
          <button
            className="vscode-button vscode-button--ghost"
            onClick={() => navigateConflict(1)}
            disabled={conflictCount === 0}
            title="Next Conflict (Alt+N)"
            type="button"
          >
            <Codicon name="arrow-down" size={14} />
          </button>
          <span className="merge-editor__divider" aria-hidden />
          <button
            className="vscode-button vscode-button--ghost"
            onClick={() => {
              if (Object.keys(choices).length === 0 && !isResultEdited) return;
              setIsResetConfirmOpen(true);
            }}
            disabled={
              conflictCount === 0 ||
              (Object.keys(choices).length === 0 && !isResultEdited)
            }
            title="Reset all conflict choices and manual edits in this file"
            type="button"
          >
            <Codicon name="discard" size={14} /> Reset
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="merge-editor__loading">Loading conflict content…</div>
      ) : conflictCount === 0 ? (
        <div className="merge-editor__loading">No conflicts detected in this file.</div>
      ) : (
        <>
          <div
            className="merge-editor__panes"
            ref={panesContainerRef}
            style={
              {
                "--pane-1": `${paneFractions[0]}fr`,
                "--pane-2": `${paneFractions[1]}fr`,
                "--pane-3": `${paneFractions[2]}fr`
              } as React.CSSProperties
            }
          >
            <MergePane
              segments={segments}
              side="theirs"
              label="Incoming"
              choices={choices}
              activeConflict={activeConflict}
              onActivate={setActiveConflict}
              onChoose={chooseFor}
              filePath={filePath}
              theme={theme}
              bodyRef={(node) => {
                paneRefs.current[0] = node;
              }}
              onScroll={() => syncScroll(0)}
            />
            <MergePaneSash
              onStart={handleSashStart}
              onDrag={(dx) => handleSashDrag(0, dx)}
            />
            <MergePane
              segments={segments}
              side="ours"
              label="Current (HEAD)"
              choices={choices}
              activeConflict={activeConflict}
              onActivate={setActiveConflict}
              onChoose={chooseFor}
              filePath={filePath}
              theme={theme}
              bodyRef={(node) => {
                paneRefs.current[1] = node;
              }}
              onScroll={() => syncScroll(1)}
            />
            <MergePaneSash
              onStart={handleSashStart}
              onDrag={(dx) => handleSashDrag(1, dx)}
            />
            <MergeResultPane
              content={resultDraft}
              hasConflictMarkers={hasConflictMarkers(resultDraft)}
              isManualEdit={isResultEdited}
              label="Result"
              onChange={(value) => {
                setResultDraft(value);
                setIsResultEdited(true);
              }}
              filePath={filePath}
              theme={theme}
              bodyRef={(node) => {
                paneRefs.current[2] = node;
              }}
              onScroll={() => syncScroll(2)}
            />
          </div>

          {base ? (
            <details className="merge-editor__base">
              <summary>Common ancestor (base)</summary>
              <CodeBlock content={base} filePath={filePath} theme={theme} className="merge-pane__code" />
            </details>
          ) : null}

          <div className="merge-editor__footer">
            <button
              className="vscode-button vscode-button--danger"
              onClick={() => setIsAbortConfirmOpen(true)}
              type="button"
            >
              <Codicon name="discard" size={14} /> Abort Merge
            </button>
            <div className="merge-editor__footer-spacer" />
            <button
              className="vscode-button vscode-button--primary"
              disabled={!canMarkResolved}
              onClick={() => void handleMarkResolved()}
              type="button"
            >
              <Codicon name="check" size={14} /> Mark Resolved
            </button>
            <button
              className="vscode-button"
              onClick={() => void handleContinueMerge()}
              type="button"
            >
              <Codicon name="git-merge" size={14} /> Continue Merge
            </button>
          </div>
        </>
      )}
      <ConfirmModal
        isOpen={isAbortConfirmOpen}
        title="Abort merge"
        body={
          <>
            <p>
              Abort the in-progress merge? Your working tree and HEAD will be
              restored to the state before the merge started.
            </p>
            <p>
              All uncommitted resolutions in <strong>every</strong> conflicted
              file will be discarded.
            </p>
          </>
        }
        confirmLabel="Abort Merge"
        danger
        onConfirm={() => void performAbortMerge()}
        onClose={() => setIsAbortConfirmOpen(false)}
      />
      <ConfirmModal
        isOpen={isResetConfirmOpen}
        title="Reset conflict resolution"
        body={
          <>
            <p>
              Discard your accept choices and manual edits in this file and
              restore the original conflict markers?
            </p>
            <p>
              Other files in the merge are not affected. The merge stays in
              progress.
            </p>
          </>
        }
        confirmLabel="Reset"
        danger
        onConfirm={resetConflictChoices}
        onClose={() => setIsResetConfirmOpen(false)}
      />
    </div>
  );
}

interface MergePaneProps {
  segments: ConflictSegment[];
  side: PaneSide;
  label: string;
  choices: Record<number, ConflictChoice | undefined>;
  activeConflict: number | null;
  filePath: string;
  theme: ReturnType<typeof useSettingsStore.getState>["theme"];
  bodyRef: (node: HTMLDivElement | null) => void;
  onScroll: () => void;
  onActivate: (id: number) => void;
  onChoose: (id: number, choice: ConflictChoice) => void;
}

function MergePane({
  segments,
  side,
  label,
  choices,
  activeConflict,
  filePath,
  theme,
  bodyRef,
  onScroll,
  onActivate,
  onChoose
}: MergePaneProps) {
  return (
    <section className={`merge-pane merge-pane--${side}`}>
      <div className="merge-pane__title">{label}</div>
      <div className="merge-pane__body" ref={bodyRef} onScroll={onScroll}>
        {segments.map((segment, index) => {
          if (segment.type === "context") {
            return (
              <ContextLines
                key={`ctx-${index}`}
                content={segment.content}
                filePath={filePath}
                theme={theme}
              />
            );
          }
          const region = segment.region;
          const choice = choices[region.id];
          const isActive = activeConflict === region.id;

          if (side === "ours") {
            return (
              <ConflictBlock
                key={`c-${region.id}`}
                conflictId={region.id}
                content={region.ours}
                filePath={filePath}
                theme={theme}
                tone="ours"
                active={isActive}
                accepted={
                  choice === "ours" ||
                  choice === "both-ours-first" ||
                  choice === "both-theirs-first"
                }
                rejected={choice === "theirs"}
                actions={[
                  { label: "Accept Current", choice: "ours" },
                  { label: "Accept Both (Current First)", choice: "both-ours-first" }
                ]}
                onChoose={(choice) => onChoose(region.id, choice)}
                onClick={() => onActivate(region.id)}
              />
            );
          }
          if (side === "theirs") {
            return (
              <ConflictBlock
                key={`c-${region.id}`}
                conflictId={region.id}
                content={region.theirs}
                filePath={filePath}
                theme={theme}
                tone="theirs"
                active={isActive}
                accepted={
                  choice === "theirs" ||
                  choice === "both-ours-first" ||
                  choice === "both-theirs-first"
                }
                rejected={choice === "ours"}
                actions={[
                  { label: "Accept Incoming", choice: "theirs" },
                  { label: "Accept Both (Incoming First)", choice: "both-theirs-first" }
                ]}
                onChoose={(choice) => onChoose(region.id, choice)}
                onClick={() => onActivate(region.id)}
              />
            );
          }
          return null;
        })}
      </div>
    </section>
  );
}

interface MergeResultPaneProps {
  content: string;
  hasConflictMarkers: boolean;
  isManualEdit: boolean;
  label: string;
  filePath: string;
  theme: ReturnType<typeof useSettingsStore.getState>["theme"];
  bodyRef: (node: HTMLDivElement | null) => void;
  onScroll: () => void;
  onChange: (value: string) => void;
}

function MergeResultPane({
  content,
  hasConflictMarkers: containsConflictMarkers,
  isManualEdit,
  label,
  filePath,
  theme,
  bodyRef,
  onScroll,
  onChange
}: MergeResultPaneProps) {
  const lineCount = Math.max(1, content.split("\n").length);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Custom undo/redo stack. Native textarea undo gets reset every time the
  // controlled `value` prop is updated programmatically (Accept Incoming,
  // Reset, the resultPreview sync effect), so we maintain our own.
  const undoStackRef = useRef<string[]>([]);
  const redoStackRef = useRef<string[]>([]);
  const lastSnapshotTimeRef = useRef(0);
  const lastCommittedRef = useRef(content);
  const UNDO_GROUPING_MS = 500;
  const UNDO_MAX = 200;

  // Detect external content changes (Accept buttons, Reset, file switch) and
  // clear our undo history so undo can't take you across that boundary into
  // a state that doesn't belong to the current "edit session".
  useEffect(() => {
    if (content !== lastCommittedRef.current) {
      undoStackRef.current = [];
      redoStackRef.current = [];
      lastSnapshotTimeRef.current = 0;
      lastCommittedRef.current = content;
    }
  }, [content]);

  function commitChange(nextContent: string, nextSelection?: { start: number; end: number }) {
    const now = Date.now();
    const top = undoStackRef.current[undoStackRef.current.length - 1];
    const outsideGroupingWindow = now - lastSnapshotTimeRef.current >= UNDO_GROUPING_MS;
    if (top !== content && (outsideGroupingWindow || undoStackRef.current.length === 0)) {
      undoStackRef.current.push(content);
      if (undoStackRef.current.length > UNDO_MAX) undoStackRef.current.shift();
    }
    redoStackRef.current = [];
    lastSnapshotTimeRef.current = now;
    lastCommittedRef.current = nextContent;
    onChange(nextContent);
    if (nextSelection) {
      requestAnimationFrame(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        textarea.setSelectionRange(nextSelection.start, nextSelection.end);
      });
    }
  }

  function undo() {
    if (undoStackRef.current.length === 0) return;
    const previous = undoStackRef.current.pop()!;
    redoStackRef.current.push(content);
    if (redoStackRef.current.length > UNDO_MAX) redoStackRef.current.shift();
    lastSnapshotTimeRef.current = 0;
    lastCommittedRef.current = previous;
    onChange(previous);
  }

  function redo() {
    if (redoStackRef.current.length === 0) return;
    const next = redoStackRef.current.pop()!;
    undoStackRef.current.push(content);
    if (undoStackRef.current.length > UNDO_MAX) undoStackRef.current.shift();
    lastSnapshotTimeRef.current = 0;
    lastCommittedRef.current = next;
    onChange(next);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    const isMod = event.ctrlKey || event.metaKey;

    // VS Code parity: Ctrl/Cmd+C or Ctrl/Cmd+X with no selection acts on
    // the current line (including its trailing newline). We expand the
    // textarea selection here, then let the browser's native copy/cut
    // handle the clipboard part — that path is the one we already know
    // works. For copy, restore the caret on the next frame so the cursor
    // doesn't jump.
    if (
      isMod &&
      !event.shiftKey &&
      !event.altKey &&
      (event.key.toLowerCase() === "c" || event.key.toLowerCase() === "x")
    ) {
      const textarea = event.currentTarget;
      if (textarea.selectionStart === textarea.selectionEnd) {
        const value = textarea.value;
        const caret = textarea.selectionStart;
        const lineStart = value.lastIndexOf("\n", caret - 1) + 1;
        let lineEnd = value.indexOf("\n", caret);
        if (lineEnd === -1) {
          lineEnd = value.length;
        } else {
          lineEnd += 1; // include the trailing newline
        }
        if (lineStart === lineEnd) {
          // Empty line with no trailing newline (end of file) — nothing to do.
          return;
        }
        textarea.setSelectionRange(lineStart, lineEnd);
        if (event.key.toLowerCase() === "c") {
          // Copy doesn't mutate, so restore caret after the native copy runs.
          requestAnimationFrame(() => {
            const node = textareaRef.current;
            if (!node) return;
            node.setSelectionRange(caret, caret);
          });
        }
        // Fall through — native cut/copy uses the expanded selection. The
        // textarea's onChange (for cut) goes through commitChange, so undo
        // still works.
      }
      return;
    }

    // Ctrl/Cmd+Z — undo
    if (isMod && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "z") {
      event.preventDefault();
      undo();
      return;
    }
    // Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z — redo
    if (
      isMod &&
      !event.altKey &&
      (event.key.toLowerCase() === "y" ||
        (event.shiftKey && event.key.toLowerCase() === "z"))
    ) {
      event.preventDefault();
      redo();
      return;
    }

    if (event.key !== "Tab" || isMod || event.altKey) {
      return;
    }
    const textarea = event.currentTarget;
    const value = textarea.value;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const TAB = "\t";

    // Multi-line selection: indent or outdent every line in the selection.
    const selectedRegion = value.slice(start, end);
    if (start !== end && selectedRegion.includes("\n")) {
      event.preventDefault();
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const head = value.slice(0, lineStart);
      const body = value.slice(lineStart, end);
      const tail = value.slice(end);

      let nextBody: string;
      let firstLineDelta = 0;
      if (event.shiftKey) {
        const lines = body.split("\n");
        const outdented = lines.map((line, idx) => {
          if (line.startsWith(TAB)) {
            if (idx === 0) firstLineDelta = -1;
            return line.slice(1);
          }
          const spaces = line.match(/^ {1,2}/);
          if (spaces) {
            if (idx === 0) firstLineDelta = -spaces[0].length;
            return line.slice(spaces[0].length);
          }
          return line;
        });
        nextBody = outdented.join("\n");
      } else {
        const lines = body.split("\n");
        firstLineDelta = 1;
        nextBody = lines.map((line) => TAB + line).join("\n");
      }

      const totalDelta = nextBody.length - body.length;
      commitChange(head + nextBody + tail, {
        start: start + firstLineDelta,
        end: end + totalDelta
      });
      return;
    }

    if (event.shiftKey) {
      // Shift+Tab on a single line — strip leading tab or 1–2 spaces if any.
      event.preventDefault();
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const rest = value.slice(lineStart);
      let removed = 0;
      if (rest.startsWith(TAB)) {
        removed = 1;
      } else {
        const spaces = rest.match(/^ {1,2}/);
        if (spaces) removed = spaces[0].length;
      }
      if (removed === 0) return;
      const next = value.slice(0, lineStart) + value.slice(lineStart + removed);
      const caret = Math.max(lineStart, start - removed);
      commitChange(next, { start: caret, end: caret });
      return;
    }

    // Plain Tab — insert a tab character (or replace a single-line selection).
    event.preventDefault();
    const next = value.slice(0, start) + TAB + value.slice(end);
    const caret = start + TAB.length;
    commitChange(next, { start: caret, end: caret });
  }

  return (
    <section className="merge-pane merge-pane--result">
      <div className="merge-pane__title">
        <span>{label}</span>
        <span className="merge-pane__title-status">
          {containsConflictMarkers
            ? "contains conflict markers"
            : isManualEdit
              ? "manual edit"
              : "auto result"}
        </span>
      </div>
      <div className="merge-pane__body merge-pane__body--result" ref={bodyRef} onScroll={onScroll}>
        <div className="merge-result-editor">
          <div className="merge-result-editor__gutter" aria-hidden>
            {Array.from({ length: lineCount }, (_, index) => (
              <span key={index}>{index + 1}</span>
            ))}
          </div>
          <div className="merge-result-editor__surface">
            <CodeBlock
              content={content || " "}
              filePath={filePath}
              theme={theme}
              className="merge-result-editor__highlight"
            />
            <textarea
              ref={textareaRef}
              className="merge-result-editor__textarea"
              value={content}
              onChange={(event) => commitChange(event.target.value)}
              onKeyDown={handleKeyDown}
              rows={lineCount}
              spellCheck={false}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function ContextLines({
  content,
  filePath,
  theme
}: {
  content: string;
  filePath: string;
  theme: ReturnType<typeof useSettingsStore.getState>["theme"];
}) {
  if (!content) return null;
  return <CodeBlock content={content} filePath={filePath} theme={theme} className="merge-pane__context" />;
}

interface ConflictBlockProps {
  conflictId: number;
  content: string;
  filePath: string;
  theme: ReturnType<typeof useSettingsStore.getState>["theme"];
  tone: "ours" | "theirs";
  active: boolean;
  accepted: boolean;
  rejected: boolean;
  actions: Array<{ label: string; choice: ConflictChoice }>;
  onChoose: (choice: ConflictChoice) => void;
  onClick: () => void;
}

function ConflictBlock({
  conflictId,
  content,
  filePath,
  theme,
  tone,
  active,
  accepted,
  rejected,
  actions,
  onChoose,
  onClick
}: ConflictBlockProps) {
  const classes = [
    "merge-conflict",
    `merge-conflict--${tone}`,
    active ? "is-active" : "",
    accepted ? "is-accepted" : "",
    rejected ? "is-rejected" : ""
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div
      className={classes}
      data-conflict-id={conflictId}
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      <div className="merge-conflict__label">
        Conflict {conflictId + 1}
        {accepted ? <Codicon name="check" size={11} /> : null}
      </div>
      <div className="merge-conflict__codelens merge-conflict__codelens--input">
        {actions.map((action, index) => (
          <span key={action.choice}>
            {index > 0 ? <span className="merge-codelens-sep">|</span> : null}
            <button
              className="merge-codelens-action"
              onClick={(event) => {
                event.stopPropagation();
                onChoose(action.choice);
              }}
              type="button"
            >
              {action.label}
            </button>
          </span>
        ))}
      </div>
      <CodeBlock content={content || "(empty)"} filePath={filePath} theme={theme} className="merge-pane__code" />
    </div>
  );
}

const PANE_FRACTIONS_STORAGE_KEY = "gitpulse:mergePaneFractions";

function loadStoredPaneFractions(): [number, number, number] {
  const fallback: [number, number, number] = [1 / 3, 1 / 3, 1 / 3];
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(PANE_FRACTIONS_STORAGE_KEY);
    if (!stored) return fallback;
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed) || parsed.length !== 3) return fallback;
    const values = parsed.map((n) => Number(n));
    if (!values.every((n) => Number.isFinite(n) && n > 0)) return fallback;
    const sum = values[0]! + values[1]! + values[2]!;
    return [values[0]! / sum, values[1]! / sum, values[2]! / sum];
  } catch {
    return fallback;
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

interface MergePaneSashProps {
  onStart: () => void;
  onDrag: (dx: number) => void;
}

function MergePaneSash({ onStart, onDrag }: MergePaneSashProps) {
  const startXRef = useRef(0);
  const draggingRef = useRef(false);

  const handleMove = useCallback(
    (event: PointerEvent) => {
      if (!draggingRef.current) return;
      onDrag(event.clientX - startXRef.current);
    },
    [onDrag]
  );

  const handleUp = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    document.body.classList.remove("is-resizing-sidebar");
  }, []);

  useEffect(() => {
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [handleMove, handleUp]);

  function handleDown(event: React.PointerEvent<HTMLDivElement>) {
    draggingRef.current = true;
    startXRef.current = event.clientX;
    document.body.classList.add("is-resizing-sidebar");
    onStart();
    event.preventDefault();
  }

  return (
    <div
      className="merge-pane-sash"
      onPointerDown={handleDown}
      role="separator"
      aria-orientation="vertical"
    />
  );
}

function scrollConflictIntoView(container: HTMLElement | null, conflictId: number) {
  if (!container) return;
  const target = container.querySelector<HTMLElement>(
    `[data-conflict-id="${conflictId}"]`
  );
  target?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function buildResultPreview(
  segments: ConflictSegment[],
  choices: Record<number, ConflictChoice | undefined>
) {
  const parts: string[] = [];

  for (const segment of segments) {
    if (segment.type === "context") {
      parts.push(segment.content);
      continue;
    }

    const { id, ours, theirs } = segment.region;
    const choice = choices[id];
    if (choice === "ours") {
      parts.push(ours);
    } else if (choice === "theirs") {
      parts.push(theirs);
    } else if (choice === "both-ours-first") {
      parts.push(ours, theirs);
    } else if (choice === "both-theirs-first") {
      parts.push(theirs, ours);
    } else {
      parts.push("<<<<<<< Current", ours, "=======", theirs, ">>>>>>> Incoming");
    }
  }

  return parts.join("\n");
}

function hasConflictMarkers(content: string) {
  return /^(<<<<<<<|=======|>>>>>>>)/m.test(content);
}

function CodeBlock({
  content,
  filePath,
  theme,
  className
}: {
  content: string;
  filePath: string;
  theme: ReturnType<typeof useSettingsStore.getState>["theme"];
  className: string;
}) {
  const lines = content.split("\n");
  return (
    <pre className={className}>
      {lines.map((line, index) => (
        <span className="merge-pane__highlighted-line" key={`${index}:${line}`}>
          <HighlightedLineContent content={line} filePath={filePath} theme={theme} />
          {index < lines.length - 1 ? "\n" : null}
        </span>
      ))}
    </pre>
  );
}
