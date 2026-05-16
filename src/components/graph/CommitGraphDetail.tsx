import { useEffect, useMemo, useState } from "react";
import { Codicon } from "../shared/Codicon";
import { FileIcon } from "../shared/FileIcon";
import { FileTree } from "../shared/FileTree";
import { DiffViewer } from "../diff/DiffViewer";
import { TabStrip } from "../diff/TabStrip";
import { useGraphStore } from "../../stores/graph";
import { useDiffStore } from "../../stores/diff";
import { useWorkspaceStore } from "../../stores/workspace";
import { gitCommitDiff } from "../../lib/git";
import type { CommitDetail, CommitFileStat, FileDiff, Repository } from "../../types/git";

export function CommitGraphDetail() {
  const repositories = useWorkspaceStore((state) => state.repositories);
  const graphRepoId = useGraphStore((state) => state.repoId);
  const activeRepo = repositories.find((repo) => repo.id === graphRepoId) ?? null;
  const selectedCommitDetail = useGraphStore((state) => state.selectedCommitDetail);
  const selectedCommitSha = useGraphStore((state) => state.selectedCommitSha);
  const activeFilePath = useDiffStore((state) => state.activeFilePath);
  const activeScope = useDiffStore((state) => state.activeScope);
  const setActiveCommitDiff = useDiffStore((state) => state.setActiveCommitDiff);
  const [commitFileDiffs, setCommitFileDiffs] = useState<FileDiff[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [filesViewMode, setFilesViewMode] = useState<"list" | "tree">("tree");
  const [parentIndex, setParentIndex] = useState(0);
  const parents = selectedCommitDetail?.parents ?? [];

  useEffect(() => {
    // Reset to first parent whenever a different commit is selected.
    setParentIndex(0);
  }, [selectedCommitSha]);

  useEffect(() => {
    if (!activeRepo || !selectedCommitSha || !selectedCommitDetail) {
      setCommitFileDiffs([]);
      setSelectedFile(null);
      return;
    }

    let cancelled = false;
    void gitCommitDiff(activeRepo.path, selectedCommitSha, parentIndex)
      .then((diffs) => {
        if (cancelled) return;
        setCommitFileDiffs(diffs);
        const firstDiff = diffs[0] ?? null;
        setSelectedFile(firstDiff?.file ?? null);
        if (firstDiff) {
          setActiveCommitDiff(activeRepo, selectedCommitDetail, firstDiff);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setCommitFileDiffs([]);
        setSelectedFile(null);
      });

    return () => {
      cancelled = true;
    };
  }, [activeRepo, parentIndex, selectedCommitDetail, selectedCommitSha, setActiveCommitDiff]);

  const commitFiles = useMemo(
    () => commitFileDiffs.map((diff) => toCommitFileStat(diff)),
    [commitFileDiffs]
  );

  useEffect(() => {
    if (activeScope === "graph" && activeFilePath) {
      setSelectedFile(activeFilePath);
    }
  }, [activeFilePath, activeScope]);

  if (!selectedCommitDetail) {
    return (
      <div className="commit-detail-empty">
        <Codicon name="git-commit" size={18} />
        <span>Select a commit to inspect</span>
      </div>
    );
  }

  return (
    <div className="commit-detail">
      <header className="commit-detail__header">
        <div className="commit-detail__subject">
          {selectedCommitDetail.message || `Commit ${selectedCommitDetail.shortSha}`}
        </div>
        {selectedCommitDetail.body ? (
          <pre className="commit-detail__body">{selectedCommitDetail.body}</pre>
        ) : null}
        {parents.length > 1 ? (
          <div className="commit-detail__parents">
            <span>Compare against parent:</span>
            {parents.map((parentSha, index) => (
              <button
                key={parentSha}
                className={`vscode-button${parentIndex === index ? " vscode-button--primary" : ""}`}
                onClick={() => setParentIndex(index)}
                type="button"
                title={parentSha}
              >
                {index === 0 ? "First" : `#${index + 1}`} · {parentSha.slice(0, 7)}
              </button>
            ))}
          </div>
        ) : null}
      </header>

      <div className="commit-detail__split">
        <aside className="commit-detail__files">
          <div className="commit-detail__files-title">
            <span>Changed Files ({commitFiles.length || selectedCommitDetail.files.length})</span>
            <button
              className="view-action"
              onClick={() => setFilesViewMode((mode) => (mode === "tree" ? "list" : "tree"))}
              title={filesViewMode === "tree" ? "View as List" : "View as Tree"}
              type="button"
            >
              <Codicon
                name={filesViewMode === "tree" ? "list-flat" : "list-tree"}
                size={14}
              />
            </button>
          </div>

          {filesViewMode === "tree" ? (
            <FileTree<CommitFileStat>
              entries={commitFiles.map((file) => ({
                path: file.file,
                data: file
              }))}
              storageKey="commit-files"
              isSelected={(entry) => selectedFile === entry.data.file}
              renderFile={(entry) => (
                <FileRow
                  file={entry.data}
                  isActive={selectedFile === entry.data.file}
                  onSelect={() =>
                    handleSelectFile(
                      entry.data.file,
                      commitFileDiffs,
                      activeRepo,
                      selectedCommitDetail,
                      setSelectedFile,
                      setActiveCommitDiff
                    )
                  }
                />
              )}
            />
          ) : (
            commitFiles.map((file) => (
              <FileRow
                key={`${selectedCommitDetail.sha}-${file.file}`}
                file={file}
                isActive={selectedFile === file.file}
                onSelect={() =>
                  handleSelectFile(
                    file.file,
                    commitFileDiffs,
                    activeRepo,
                    selectedCommitDetail,
                    setSelectedFile,
                    setActiveCommitDiff
                  )
                }
              />
            ))
          )}
        </aside>

        <section className="commit-detail__diff-pane">
          {commitFiles.length > 0 ? (
            <>
              <TabStrip scope="graph" repoPath={activeRepo?.path} />
              <DiffViewer activeView="graph" />
            </>
          ) : (
            <div className="commit-detail__diff-placeholder">
              Select a file on the left to view its diff.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function handleSelectFile(
  filePath: string,
  diffs: FileDiff[],
  activeRepo: Repository | null,
  commit: CommitDetail,
  setSelectedFile: (file: string) => void,
  setActiveCommitDiff: ReturnType<typeof useDiffStore.getState>["setActiveCommitDiff"]
) {
  setSelectedFile(filePath);
  const diff = diffs.find((entry) => entry.file === filePath);
  if (activeRepo && diff) {
    setActiveCommitDiff(activeRepo, commit, diff);
  }
}

function toCommitFileStat(diff: FileDiff): CommitFileStat {
  return {
    file: diff.file,
    additions: diff.hunks.reduce(
      (count, hunk) => count + hunk.lines.filter((line) => line.lineType === "add").length,
      0
    ),
    deletions: diff.hunks.reduce(
      (count, hunk) =>
        count + hunk.lines.filter((line) => line.lineType === "remove").length,
      0
    ),
    status: diff.status ?? inferCommitFileStatus(diff)
  };
}

function inferCommitFileStatus(diff: FileDiff) {
  if (diff.oldFile && diff.oldFile !== diff.file) {
    return "R";
  }
  return "M";
}

function FileRow({
  file,
  isActive,
  onSelect
}: {
  file: CommitFileStat;
  isActive: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      className={`scm-row${isActive ? " is-selected" : ""}`}
      onClick={onSelect}
      role="treeitem"
    >
      <FileIcon path={file.file} size={16} className="scm-row__icon" />
      <span className="scm-row__name" title={file.file}>
        {file.file.split("/").pop()}
      </span>
      <span className="scm-row__path">+{file.additions} -{file.deletions}</span>
      <span className="scm-row__status">{file.status}</span>
    </div>
  );
}
