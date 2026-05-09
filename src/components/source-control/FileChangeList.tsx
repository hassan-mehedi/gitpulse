import type { ReactNode } from "react";
import type { FileChange, Repository } from "../../types/git";
import { FileChangeRow } from "./FileChangeRow";

interface FileChangeListProps {
  repo: Repository;
  changes: FileChange[];
  staged: boolean;
  title: string;
  viewMode: "tree" | "list";
  action?: ReactNode;
}

export function FileChangeList({
  repo,
  changes,
  staged,
  title,
  viewMode,
  action
}: FileChangeListProps) {
  const grouped = groupByDirectory(changes);

  return (
    <section className="repo-card__section">
      <div className="repo-card__section-header">
        <span>{title}</span>
        {action}
      </div>
      <div className="file-list">
        {changes.length === 0 ? (
          <div className="file-row">
            <div className="file-row__left">
              <span className="file-row__path">No files</span>
            </div>
          </div>
        ) : null}
        {viewMode === "list"
          ? changes.map((change) => (
              <FileChangeRow
                key={`${staged}-${change.path}`}
                change={change}
                repo={repo}
                staged={staged}
              />
            ))
          : Object.entries(grouped).map(([directory, directoryChanges]) => (
              <div key={`${staged}-${directory}`}>
                <div className="file-row">
                  <div className="file-row__left">
                    <span className="file-row__path">{directory}</span>
                  </div>
                </div>
                {directoryChanges.map((change) => (
                  <FileChangeRow
                    key={`${staged}-${change.path}`}
                    change={change}
                    repo={repo}
                    staged={staged}
                  />
                ))}
              </div>
            ))}
      </div>
    </section>
  );
}

function groupByDirectory(changes: FileChange[]) {
  return changes.reduce<Record<string, FileChange[]>>((accumulator, change) => {
    const directory = change.path.includes("/") ? change.path.split("/").slice(0, -1).join("/") : ".";
    accumulator[directory] ??= [];
    accumulator[directory].push(change);
    return accumulator;
  }, {});
}
