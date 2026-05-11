import { useEffect, useMemo, useState } from "react";
import { Codicon } from "../shared/Codicon";
import { FileIcon } from "../shared/FileIcon";
import { FileTree } from "../shared/FileTree";
import { DiffHunk } from "../diff/DiffHunk";
import { useRepo } from "../../hooks/useRepo";
import { useGraphStore } from "../../stores/graph";
import { useSettingsStore } from "../../stores/settings";
import { gitCommitDiff } from "../../lib/git";
import type { CommitFileStat, FileDiff } from "../../types/git";

export function CommitGraphDetail() {
  const { activeRepo } = useRepo();
  const theme = useSettingsStore((state) => state.theme);
  const selectedCommitDetail = useGraphStore((state) => state.selectedCommitDetail);
  const selectedCommitSha = useGraphStore((state) => state.selectedCommitSha);
  const [commitFileDiffs, setCommitFileDiffs] = useState<FileDiff[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [filesViewMode, setFilesViewMode] = useState<"list" | "tree">("tree");

  useEffect(() => {
    if (!activeRepo || !selectedCommitSha) {
      setCommitFileDiffs([]);
      setSelectedFile(null);
      return;
    }
    let cancelled = false;
    void gitCommitDiff(activeRepo.path, selectedCommitSha)
      .then((diffs) => {
        if (cancelled) return;
        setCommitFileDiffs(diffs);
        setSelectedFile(diffs[0]?.file ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setCommitFileDiffs([]);
        setSelectedFile(null);
      });
    return () => {
      cancelled = true;
    };
  }, [activeRepo?.path, selectedCommitSha]);

  const activeFileDiff = useMemo(
    () => commitFileDiffs.find((diff) => diff.file === selectedFile) ?? null,
    [commitFileDiffs, selectedFile]
  );

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
        <div className="commit-detail__subject">{selectedCommitDetail.message}</div>
        <div className="commit-detail__meta-row">
          <span className="commit-detail__sha">{selectedCommitDetail.sha}</span>
          <span>•</span>
          <span>{selectedCommitDetail.author}</span>
          <span className="commit-detail__email">
            &lt;{selectedCommitDetail.authorEmail}&gt;
          </span>
          <span>•</span>
          <span>{selectedCommitDetail.date}</span>
        </div>
        {selectedCommitDetail.body ? (
          <pre className="commit-detail__body">{selectedCommitDetail.body}</pre>
        ) : null}
      </header>

      <div className="commit-detail__split">
        <aside className="commit-detail__files">
          <div className="commit-detail__files-title">
            <span>Changed Files ({selectedCommitDetail.files.length})</span>
            <button
              className="view-action"
              onClick={() =>
                setFilesViewMode((m) => (m === "tree" ? "list" : "tree"))
              }
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
              entries={selectedCommitDetail.files.map((file) => ({
                path: file.file,
                data: file
              }))}
              storageKey="commit-files"
              isSelected={(entry) => selectedFile === entry.data.file}
              renderFile={(entry) => (
                <FileRow
                  file={entry.data}
                  isActive={selectedFile === entry.data.file}
                  onSelect={() => setSelectedFile(entry.data.file)}
                />
              )}
            />
          ) : (
            selectedCommitDetail.files.map((file) => (
              <FileRow
                key={`${selectedCommitDetail.sha}-${file.file}`}
                file={file}
                isActive={selectedFile === file.file}
                onSelect={() => setSelectedFile(file.file)}
              />
            ))
          )}
        </aside>

        <section className="commit-detail__diff">
          {activeFileDiff ? (
            <>
              <div className="commit-detail__diff-title" title={activeFileDiff.file}>
                <FileIcon path={activeFileDiff.file} size={14} />
                <span>{activeFileDiff.file}</span>
              </div>
              {activeFileDiff.isBinary ? (
                <div className="diff-viewer__placeholder">
                  Binary file — no textual diff.
                </div>
              ) : activeFileDiff.hunks.length === 0 ? (
                <div className="diff-viewer__placeholder">
                  No textual changes to display.
                </div>
              ) : (
                activeFileDiff.hunks.map((hunk, index) => (
                  <DiffHunk
                    filePath={activeFileDiff.file}
                    hunk={hunk}
                    hunkIndex={index}
                    isActive={false}
                    key={`${activeFileDiff.file}-${hunk.header}-${index}`}
                    mode="inline"
                    onFocus={() => {}}
                    onToggleLine={() => {}}
                    selectedLineIndices={[]}
                    theme={theme}
                  />
                ))
              )}
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
