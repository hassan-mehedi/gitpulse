import { useEffect, useMemo, useState } from "react";
import { Codicon } from "../shared/Codicon";
import {
  gitContinueMerge,
  gitGetConflictContent,
  gitMarkResolved,
  gitSetConflictContent
} from "../../lib/git";
import {
  buildResolvedConflictContent,
  parseConflictSegments,
  type ConflictChoice
} from "../../lib/conflicts";
import { useGit } from "../../hooks/useGit";
import { useWorkspaceStore } from "../../stores/workspace";

interface MergeEditorProps {
  filePath: string;
  repoPath: string;
}

export function MergeEditor({ filePath, repoPath }: MergeEditorProps) {
  const runGit = useGit();
  const refreshRepo = useWorkspaceStore((state) => state.refreshRepo);
  const [base, setBase] = useState("");
  const [ours, setOurs] = useState("");
  const [theirs, setTheirs] = useState("");
  const [raw, setRaw] = useState("");
  const [choices, setChoices] = useState<Record<number, ConflictChoice | undefined>>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    void runGit(async () => {
      const content = await gitGetConflictContent(repoPath, filePath);
      if (cancelled) return;
      setBase(content.base);
      setOurs(content.ours);
      setTheirs(content.theirs);
      setRaw(content.raw);
      setChoices({});
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
        (segment): segment is Extract<(typeof segments)[number], { type: "conflict" }> =>
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

  function acceptAll(choice: ConflictChoice) {
    const next: Record<number, ConflictChoice> = {};
    for (const region of conflictRegions) {
      next[region.region.id] = choice;
    }
    setChoices(next);
  }

  function chooseFor(id: number, choice: ConflictChoice) {
    setChoices((state) => ({ ...state, [id]: choice }));
  }

  async function handleMarkResolved() {
    if (!resolvedContent) {
      return;
    }

    await runGit(async () => {
      await gitSetConflictContent(repoPath, filePath, resolvedContent);
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

  const segments_path = filePath.split("/");
  const name = segments_path.pop() ?? filePath;
  const dir = segments_path.join("/");

  return (
    <div className="merge-editor">
      <div className="diff-viewer__header">
        <div className="diff-viewer__title">
          <span className="diff-viewer__filename">{name}</span>
          {dir ? <span className="diff-viewer__dir">{dir}</span> : null}
          <span className="diff-viewer__meta">
            {resolvedCount} / {conflictCount} resolved
          </span>
        </div>
        <div className="diff-viewer__toolbar">
          <button
            className="vscode-button"
            onClick={() => acceptAll("ours")}
            disabled={conflictCount === 0}
            title="Accept All Current"
            type="button"
          >
            <Codicon name="arrow-left" size={14} /> Accept All Current
          </button>
          <button
            className="vscode-button"
            onClick={() => acceptAll("theirs")}
            disabled={conflictCount === 0}
            title="Accept All Incoming"
            type="button"
          >
            <Codicon name="arrow-right" size={14} /> Accept All Incoming
          </button>
          <button
            className="vscode-button"
            onClick={() => acceptAll("both")}
            disabled={conflictCount === 0}
            title="Accept All Combination"
            type="button"
          >
            <Codicon name="arrow-both" size={14} /> Accept Combination
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="merge-editor__loading">Loading conflict content…</div>
      ) : (
        <>
          <div className="merge-editor__panes">
            <MergePane label="Current (Ours)" tone="ours" body={ours} />
            <MergePane
              label="Result"
              tone="result"
              body={
                resolvedContent ??
                "Choose an action for every conflict region to build the resolved file."
              }
            />
            <MergePane label="Incoming (Theirs)" tone="theirs" body={theirs} />
          </div>

          {base ? (
            <details className="merge-editor__base">
              <summary>Common ancestor (base)</summary>
              <pre className="merge-pane__code">{base}</pre>
            </details>
          ) : null}

          <div className="merge-editor__regions">
            {conflictRegions.map((segment) => {
              const choice = choices[segment.region.id];
              return (
                <section className="merge-region" key={segment.region.id}>
                  <header className="merge-region__header">
                    <span className="merge-region__title">
                      Conflict {segment.region.id + 1}
                    </span>
                    <div className="merge-region__actions">
                      <button
                        className={`vscode-button${choice === "ours" ? " vscode-button--primary" : ""}`}
                        onClick={() => chooseFor(segment.region.id, "ours")}
                        type="button"
                      >
                        <Codicon name="arrow-left" size={14} /> Current
                      </button>
                      <button
                        className={`vscode-button${choice === "theirs" ? " vscode-button--primary" : ""}`}
                        onClick={() => chooseFor(segment.region.id, "theirs")}
                        type="button"
                      >
                        <Codicon name="arrow-right" size={14} /> Incoming
                      </button>
                      <button
                        className={`vscode-button${choice === "both" ? " vscode-button--primary" : ""}`}
                        onClick={() => chooseFor(segment.region.id, "both")}
                        type="button"
                      >
                        <Codicon name="arrow-both" size={14} /> Both
                      </button>
                    </div>
                  </header>
                  <div className="merge-region__panes">
                    <pre className="merge-pane__code merge-pane__code--ours">
                      {segment.region.ours || "(empty)"}
                    </pre>
                    <pre className="merge-pane__code merge-pane__code--theirs">
                      {segment.region.theirs || "(empty)"}
                    </pre>
                  </div>
                </section>
              );
            })}
          </div>

          <div className="merge-editor__footer">
            <button
              className="vscode-button vscode-button--primary"
              disabled={!resolvedContent || resolvedCount < conflictCount}
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

function MergePane({
  label,
  tone,
  body
}: {
  label: string;
  tone: "ours" | "result" | "theirs";
  body: string;
}) {
  return (
    <section className={`merge-pane merge-pane--${tone}`}>
      <div className="merge-pane__title">{label}</div>
      <pre className="merge-pane__code">{body}</pre>
    </section>
  );
}
