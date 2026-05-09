import { useEffect, useMemo, useState } from "react";
import { GitCommitHorizontal } from "lucide-react";
import { useRepo } from "../../hooks/useRepo";
import { useGit } from "../../hooks/useGit";
import { useGraphStore } from "../../stores/graph";
import { GraphToolbar } from "./GraphToolbar";

const lanePalette = ["#66d9ef", "#5edb95", "#f2c572", "#ff7b72", "#8aa7ff", "#ff9dd6"];

export function CommitGraph() {
  const { activeRepo } = useRepo();
  const runGit = useGit();
  const [query, setQuery] = useState("");
  const { nodes, selectedCommitSha, selectedCommitDetail, isLoading, loadGraph, selectCommit } =
    useGraphStore();
  const maxLane = useMemo(
    () => visibleLaneCount(nodes),
    [nodes]
  );

  useEffect(() => {
    if (!activeRepo) {
      return;
    }

    void runGit(() => loadGraph(activeRepo));
  }, [activeRepo?.path]);

  const visibleNodes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return nodes;
    }

    return nodes.filter((node) => {
      const haystack = `${node.message} ${node.author} ${node.refs.join(" ")}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [nodes, query]);

  async function handleSelectCommit(sha: string) {
    if (!activeRepo) {
      return;
    }

    await runGit(() => selectCommit(activeRepo, sha));
  }

  if (!activeRepo) {
    return (
      <div className="empty-state">
        <div className="empty-state__card">
          <div className="empty-state__title">No repository loaded</div>
          <div className="empty-state__body">Load a repository to inspect its history graph.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="graph-view">
      <GraphToolbar
        onQueryChange={setQuery}
        onReload={() => {
          void runGit(() => loadGraph(activeRepo));
        }}
        query={query}
      />

      <div className="graph-view__body">
        <section className="graph-list">
          {isLoading ? (
            <div className="file-row">
              <div className="file-row__left">
                <span className="file-row__path">Loading history…</span>
              </div>
            </div>
          ) : null}

          {visibleNodes.map((node) => {
            return (
              <button
                className={`graph-row ${node.sha === selectedCommitSha ? "is-active" : ""}`}
                key={node.sha}
                onClick={() => void handleSelectCommit(node.sha)}
                type="button"
              >
                <div className="graph-row__lane">
                  <svg
                    className="graph-row__svg"
                    height="56"
                    viewBox={`0 0 ${(maxLane + 1) * 18} 56`}
                    width={(maxLane + 1) * 18}
                  >
                    {Array.from({ length: maxLane + 1 }).map((_, lane) => (
                      <line
                        key={`${node.sha}-lane-${lane}`}
                        stroke="rgba(139, 161, 182, 0.18)"
                        strokeWidth="1"
                        x1={lane * 18 + 9}
                        x2={lane * 18 + 9}
                        y1="0"
                        y2="56"
                      />
                    ))}
                    {node.connections.map((connection, index) => {
                      const fromX = connection.fromLane * 18 + 9;
                      const toX = connection.toLane * 18 + 9;
                      const stroke = lanePalette[connection.fromLane % lanePalette.length];
                      return (
                        <path
                          d={`M ${fromX} 10 L ${fromX} 28 ${toX === fromX ? "" : `L ${toX} 46`}`}
                          fill="none"
                          key={`${node.sha}-edge-${index}`}
                          stroke={stroke}
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />
                      );
                    })}
                    <circle
                      cx={node.lane * 18 + 9}
                      cy="10"
                      fill={lanePalette[node.lane % lanePalette.length]}
                      r="6"
                    />
                  </svg>
                </div>
                <div className="graph-row__content">
                  <div className="graph-row__title">
                    <span>{node.message}</span>
                    <span className="file-row__path">{node.shortSha}</span>
                  </div>
                  <div className="graph-row__meta">
                    <span>{node.author}</span>
                    <span>{node.date}</span>
                    {node.refs.map((ref) => (
                      <span className="badge" key={`${node.sha}-${ref}`}>
                        {ref}
                      </span>
                    ))}
                  </div>
                </div>
              </button>
            );
          })}
        </section>

        <aside className="graph-detail">
          {selectedCommitDetail ? (
            <>
              <div className="graph-detail__header">
                <div>{selectedCommitDetail.message}</div>
                <div className="file-row__path">{selectedCommitDetail.sha}</div>
              </div>
              <div className="graph-detail__meta">
                <span>{selectedCommitDetail.author}</span>
                <span>{selectedCommitDetail.authorEmail}</span>
                <span>{selectedCommitDetail.date}</span>
              </div>
              {selectedCommitDetail.body ? (
                <pre className="graph-detail__body">{selectedCommitDetail.body}</pre>
              ) : null}
              <div className="repo-card__section">
                <div className="repo-card__section-header">
                  <span>Changed Files</span>
                </div>
                <div className="file-list">
                  {selectedCommitDetail.files.map((file) => (
                    <div className="file-row" key={`${selectedCommitDetail.sha}-${file.file}`}>
                      <div className="file-row__left">
                        <div className="badge">{file.status}</div>
                        <div>
                          <div className="file-row__name">{file.file}</div>
                          <div className="file-row__path">
                            +{file.additions} -{file.deletions}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-state__card">
                <div className="empty-state__title">
                  <GitCommitHorizontal size={18} /> Select a commit
                </div>
                <div className="empty-state__body">
                  Click any graph row to load commit details and changed files.
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function visibleLaneCount(nodes: typeof useGraphStore extends never ? never : Array<{ lane: number; connections: Array<{ toLane: number }> }>) {
  return nodes.reduce((max, node) => {
    const connectionMax = node.connections.reduce(
      (innerMax, connection) => Math.max(innerMax, connection.toLane),
      node.lane
    );
    return Math.max(max, connectionMax);
  }, 0);
}
