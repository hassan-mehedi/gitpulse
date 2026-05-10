import { useEffect, useMemo, useState } from "react";
import { CheckCheck, GitMerge } from "lucide-react";
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
    setIsLoading(true);
    void runGit(async () => {
      const content = await gitGetConflictContent(repoPath, filePath);
      setBase(content.base);
      setOurs(content.ours);
      setTheirs(content.theirs);
      setRaw(content.raw);
      setChoices({});
      setIsLoading(false);
    }).catch(() => setIsLoading(false));
  }, [filePath, repoPath, runGit]);

  const segments = useMemo(() => parseConflictSegments(raw), [raw]);
  const conflictCount = segments.filter((segment) => segment.type === "conflict").length;
  const resolvedContent = useMemo(
    () => buildResolvedConflictContent(segments, choices),
    [choices, segments]
  );

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

  return (
    <div className="merge-editor">
      <div className="diff-viewer__header">
        <div>
          <div>Merge Conflict</div>
          <div className="diff-viewer__meta">
            {filePath} • {conflictCount} regions
          </div>
        </div>
        <div className="toolbar__actions">
          <button
            className="panel-button"
            disabled={!resolvedContent}
            onClick={() => void handleMarkResolved()}
            type="button"
          >
            <CheckCheck size={15} /> Mark Resolved
          </button>
          <button className="panel-button" onClick={() => void handleContinueMerge()} type="button">
            <GitMerge size={15} /> Continue Merge
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="empty-state">
          <div className="empty-state__card">
            <div className="empty-state__title">Loading conflict content…</div>
          </div>
        </div>
      ) : (
        <div className="merge-editor__body">
          <div className="merge-editor__references">
            <section className="merge-pane">
              <div className="merge-pane__title">Base</div>
              <pre className="merge-pane__code">{base || "No common ancestor snapshot available"}</pre>
            </section>
            <section className="merge-pane">
              <div className="merge-pane__title">Ours</div>
              <pre className="merge-pane__code">{ours}</pre>
            </section>
            <section className="merge-pane">
              <div className="merge-pane__title">Theirs</div>
              <pre className="merge-pane__code">{theirs}</pre>
            </section>
          </div>

          <div className="merge-editor__regions">
            {segments
              .filter((segment): segment is Extract<(typeof segments)[number], { type: "conflict" }> => segment.type === "conflict")
              .map((segment) => (
                <section className="repo-card" key={segment.region.id}>
                  <div className="repo-card__body">
                    <div className="repo-card__section-header">
                      <span>Conflict {segment.region.id + 1}</span>
                      <div className="toolbar__actions">
                        <button
                          className="panel-button"
                          onClick={() =>
                            setChoices((state) => ({ ...state, [segment.region.id]: "ours" }))
                          }
                          type="button"
                        >
                          Accept Ours
                        </button>
                        <button
                          className="panel-button"
                          onClick={() =>
                            setChoices((state) => ({ ...state, [segment.region.id]: "theirs" }))
                          }
                          type="button"
                        >
                          Accept Theirs
                        </button>
                        <button
                          className="panel-button"
                          onClick={() =>
                            setChoices((state) => ({ ...state, [segment.region.id]: "both" }))
                          }
                          type="button"
                        >
                          Accept Both
                        </button>
                      </div>
                    </div>
                    <div className="merge-editor__region-grid">
                      <pre className="merge-pane__code">{segment.region.ours}</pre>
                      <pre className="merge-pane__code">{segment.region.theirs}</pre>
                    </div>
                  </div>
                </section>
              ))}
          </div>

          <section className="merge-pane merge-pane--resolved">
            <div className="merge-pane__title">Resolved Preview</div>
            <pre className="merge-pane__code">
              {resolvedContent ?? "Choose an action for every conflict region to build the resolved file."}
            </pre>
          </section>
        </div>
      )}
    </div>
  );
}
