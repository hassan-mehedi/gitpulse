import { useEffect, useState } from "react";
import { Codicon } from "../shared/Codicon";
import { gitLog, gitShowCommit } from "../../lib/git";
import { useGit } from "../../hooks/useGit";
import type { CommitDetail, CommitInfo, Repository } from "../../types/git";

interface FileHistoryPanelProps {
  filePath: string;
  repo: Repository;
}

export function FileHistoryPanel({ filePath, repo }: FileHistoryPanelProps) {
  const runGit = useGit();
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [selectedCommitSha, setSelectedCommitSha] = useState<string | null>(null);
  const [selectedCommit, setSelectedCommit] = useState<CommitDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    void runGit(async () => {
      const nextCommits = await gitLog(repo.path, 80, undefined, filePath);
      setCommits(nextCommits);
      const firstCommit = nextCommits[0];
      setSelectedCommitSha(firstCommit?.sha ?? null);
      if (firstCommit) {
        const detail = await gitShowCommit(repo.path, firstCommit.sha);
        setSelectedCommit(detail);
      } else {
        setSelectedCommit(null);
      }
      setIsLoading(false);
    }).catch(() => setIsLoading(false));
  }, [filePath, repo.path, runGit]);

  async function handleSelectCommit(commit: CommitInfo) {
    setSelectedCommitSha(commit.sha);
    await runGit(async () => {
      const detail = await gitShowCommit(repo.path, commit.sha);
      setSelectedCommit(detail);
    });
  }

  return (
    <div className="graph-view">
      <div className="diff-viewer__header">
        <div>
          <div>File History</div>
          <div className="diff-viewer__meta">{filePath}</div>
        </div>
      </div>

      <div className="graph-view__body">
        <section className="graph-list">
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
              <div className="repo-card__section">
                <div className="repo-card__section-header">
                  <span>Changed Files</span>
                </div>
                <div className="file-list">
                  {selectedCommit.files.map((file) => (
                    <div className="file-row" key={`${selectedCommit.sha}-${file.file}`}>
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
    </div>
  );
}
