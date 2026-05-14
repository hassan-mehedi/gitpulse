import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Codicon } from "../shared/Codicon";
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
  const paneRefs = useRef<Array<HTMLDivElement | null>>([]);
  const isSyncingScroll = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    void runGit(async () => {
      const content = await gitGetConflictContent(repoPath, filePath);
      if (cancelled) return;
      setBase(content.base);
      setRaw(content.raw);
      setChoices({});
      setResultDraft(content.raw);
      setIsResultEdited(false);
      setActiveConflict(0);
      setIsLoading(false);
    }).catch(() => {
      if (!cancelled) setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [filePath, repoPath, runGit]);

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

  function acceptAll(choice: ConflictChoice) {
    const next: Record<number, ConflictChoice> = {};
    for (const region of conflictRegions) {
      next[region.region.id] = choice;
    }
    setIsResultEdited(false);
    setChoices(next);
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
      await refreshRepo(repoPath);
    });
  }

  async function handleContinueMerge() {
    await runGit(async () => {
      await gitContinueMerge(repoPath);
      await refreshRepo(repoPath);
    });
  }

  async function handleAbortMerge() {
    if (!window.confirm("Abort the in-progress merge? Uncommitted resolutions will be lost.")) {
      return;
    }
    await runGit(async () => {
      await gitAbortMerge(repoPath);
      await refreshRepo(repoPath);
    });
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
            className="vscode-button"
            onClick={() => acceptAll("ours")}
            disabled={conflictCount === 0}
            title="Accept All Current"
            type="button"
          >
            Accept All Current
          </button>
          <button
            className="vscode-button"
            onClick={() => acceptAll("theirs")}
            disabled={conflictCount === 0}
            title="Accept All Incoming"
            type="button"
          >
            Accept All Incoming
          </button>
          <button
            className="vscode-button"
            onClick={() => acceptAll("both")}
            disabled={conflictCount === 0}
            title="Accept All Combination"
            type="button"
          >
            Accept Both
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="merge-editor__loading">Loading conflict content…</div>
      ) : conflictCount === 0 ? (
        <div className="merge-editor__loading">No conflicts detected in this file.</div>
      ) : (
        <>
          <div className="merge-editor__panes">
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
                paneRefs.current[0] = node;
              }}
              onScroll={() => syncScroll(0)}
            />
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
                paneRefs.current[1] = node;
              }}
              onScroll={() => syncScroll(1)}
            />
            <MergeResultPane
              content={resultDraft}
              hasConflictMarkers={hasConflictMarkers(resultDraft)}
              activeConflict={activeConflict}
              label="Result"
              onChange={(value) => {
                setResultDraft(value);
                setIsResultEdited(true);
              }}
              onChoose={chooseFor}
              regions={conflictRegions.map((segment) => segment.region)}
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
              onClick={() => void handleAbortMerge()}
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
                accepted={choice === "ours" || choice === "both"}
                rejected={choice === "theirs"}
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
                accepted={choice === "theirs" || choice === "both"}
                rejected={choice === "ours"}
                onClick={() => onActivate(region.id)}
              />
            );
          }
          return (
            <ResultConflict
              key={`c-${region.id}`}
              regionId={region.id}
              ours={region.ours}
              theirs={region.theirs}
              choice={choice}
              active={isActive}
              onActivate={() => onActivate(region.id)}
              onChoose={onChoose}
            />
          );
        })}
      </div>
    </section>
  );
}

interface MergeResultPaneProps {
  content: string;
  hasConflictMarkers: boolean;
  label: string;
  regions: Array<{ id: number; ours: string; theirs: string }>;
  activeConflict: number | null;
  bodyRef: (node: HTMLDivElement | null) => void;
  onScroll: () => void;
  onChange: (value: string) => void;
  onChoose: (id: number, choice: ConflictChoice) => void;
}

function MergeResultPane({
  content,
  hasConflictMarkers: containsConflictMarkers,
  label,
  regions,
  activeConflict,
  bodyRef,
  onScroll,
  onChange,
  onChoose
}: MergeResultPaneProps) {
  const activeRegion = regions.find((region) => region.id === activeConflict) ?? regions[0];

  function choose(choice: ConflictChoice) {
    if (!activeRegion) return;
    onChoose(activeRegion.id, choice);
  }

  return (
    <section className="merge-pane merge-pane--result">
      <div className="merge-pane__title">
        <span>{label}</span>
        <span className="merge-pane__title-status">
          {containsConflictMarkers ? "contains conflict markers" : "editable"}
        </span>
      </div>
      <div className="merge-pane__body merge-pane__body--result" ref={bodyRef} onScroll={onScroll}>
        {activeRegion ? (
          <div className="merge-conflict__codelens merge-conflict__codelens--result">
            <button
              className="merge-codelens-action"
              onClick={() => choose("ours")}
              type="button"
            >
              Accept Current
            </button>
            <span className="merge-codelens-sep">|</span>
            <button
              className="merge-codelens-action"
              onClick={() => choose("theirs")}
              type="button"
            >
              Accept Incoming
            </button>
            <span className="merge-codelens-sep">|</span>
            <button
              className="merge-codelens-action"
              onClick={() => choose("both")}
              type="button"
            >
              Accept Both
            </button>
            <span className="merge-codelens-label">
              Conflict {activeRegion.id + 1}
            </span>
          </div>
        ) : null}
        <textarea
          className="merge-pane__textarea"
          value={content}
          onChange={(event) => onChange(event.target.value)}
          spellCheck={false}
        />
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
      <CodeBlock content={content || "(empty)"} filePath={filePath} theme={theme} className="merge-pane__code" />
    </div>
  );
}

interface ResultConflictProps {
  regionId: number;
  ours: string;
  theirs: string;
  choice: ConflictChoice | undefined;
  active: boolean;
  onActivate: () => void;
  onChoose: (id: number, choice: ConflictChoice) => void;
}

function ResultConflict({
  regionId,
  ours,
  theirs,
  choice,
  active,
  onActivate,
  onChoose
}: ResultConflictProps) {
  const classes = [
    "merge-conflict",
    "merge-conflict--result",
    active ? "is-active" : "",
    choice ? "is-resolved" : "is-unresolved"
  ]
    .filter(Boolean)
    .join(" ");

  function choose(value: ConflictChoice) {
    onActivate();
    onChoose(regionId, value);
  }

  return (
    <div
      className={classes}
      data-conflict-id={regionId}
      onClick={onActivate}
    >
      <div className="merge-conflict__codelens">
        <button
          className={`merge-codelens-action${choice === "ours" ? " is-selected" : ""}`}
          onClick={(event) => {
            event.stopPropagation();
            choose("ours");
          }}
          type="button"
        >
          Accept Current
        </button>
        <span className="merge-codelens-sep">|</span>
        <button
          className={`merge-codelens-action${choice === "theirs" ? " is-selected" : ""}`}
          onClick={(event) => {
            event.stopPropagation();
            choose("theirs");
          }}
          type="button"
        >
          Accept Incoming
        </button>
        <span className="merge-codelens-sep">|</span>
        <button
          className={`merge-codelens-action${choice === "both" ? " is-selected" : ""}`}
          onClick={(event) => {
            event.stopPropagation();
            choose("both");
          }}
          type="button"
        >
          Accept Both
        </button>
        <span className="merge-codelens-label">Conflict {regionId + 1}</span>
      </div>
      {choice === "ours" ? (
        <pre className="merge-pane__code merge-pane__code--ours">{ours || "(empty)"}</pre>
      ) : choice === "theirs" ? (
        <pre className="merge-pane__code merge-pane__code--theirs">{theirs || "(empty)"}</pre>
      ) : choice === "both" ? (
        <>
          <pre className="merge-pane__code merge-pane__code--ours">{ours || "(empty)"}</pre>
          <pre className="merge-pane__code merge-pane__code--theirs">{theirs || "(empty)"}</pre>
        </>
      ) : (
        <>
          <div className="merge-conflict__marker">&lt;&lt;&lt;&lt;&lt;&lt;&lt; Current</div>
          <pre className="merge-pane__code merge-pane__code--ours">{ours || "(empty)"}</pre>
          <div className="merge-conflict__marker">=======</div>
          <pre className="merge-pane__code merge-pane__code--theirs">{theirs || "(empty)"}</pre>
          <div className="merge-conflict__marker">&gt;&gt;&gt;&gt;&gt;&gt;&gt; Incoming</div>
        </>
      )}
    </div>
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
    } else if (choice === "both") {
      parts.push(ours, theirs);
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
