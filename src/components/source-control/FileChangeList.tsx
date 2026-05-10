import { useState } from "react";
import { Codicon, type CodiconName } from "../shared/Codicon";
import type { FileChange, Repository } from "../../types/git";
import { FileChangeRow } from "./FileChangeRow";

export interface FileChangeListAction {
  icon: CodiconName;
  label: string;
  onClick: () => void;
}

interface FileChangeListProps {
  repo: Repository;
  changes: FileChange[];
  staged: boolean;
  title: string;
  count: number;
  viewMode: "tree" | "list";
  actions?: FileChangeListAction[];
}

export function FileChangeList({
  repo,
  changes,
  staged,
  title,
  count,
  viewMode,
  actions
}: FileChangeListProps) {
  const [collapsed, setCollapsed] = useState(false);
  const grouped = viewMode === "tree" ? groupByDirectory(changes) : null;

  return (
    <section className="scm-section">
      <header className="scm-section__header">
        <button
          className="scm-section__toggle"
          onClick={() => setCollapsed((value) => !value)}
          type="button"
        >
          <Codicon name={collapsed ? "chevron-right" : "chevron-down"} size={14} />
          <span className="scm-section__title">{title}</span>
        </button>
        <div className="scm-section__actions">
          {actions?.map((action) => (
            <button
              key={action.label}
              className="scm-section__action"
              onClick={action.onClick}
              title={action.label}
              aria-label={action.label}
              type="button"
            >
              <Codicon name={action.icon} size={16} />
            </button>
          ))}
        </div>
        <span className="scm-section__count">{count}</span>
      </header>

      {!collapsed ? (
        <div className="scm-section__body">
          {grouped
            ? Object.entries(grouped).map(([directory, directoryChanges]) => (
                <div key={`${staged}-${directory}`}>
                  <div className="scm-tree__directory">
                    <Codicon name="chevron-down" size={12} />
                    <Codicon name="folder" size={14} />
                    <span>{directory}</span>
                  </div>
                  {directoryChanges.map((change) => (
                    <FileChangeRow
                      key={`${staged}-${change.path}`}
                      change={change}
                      repo={repo}
                      staged={staged}
                      indent={1}
                    />
                  ))}
                </div>
              ))
            : changes.map((change) => (
                <FileChangeRow
                  key={`${staged}-${change.path}`}
                  change={change}
                  repo={repo}
                  staged={staged}
                />
              ))}
        </div>
      ) : null}
    </section>
  );
}

function groupByDirectory(changes: FileChange[]) {
  return changes.reduce<Record<string, FileChange[]>>((accumulator, change) => {
    const directory = change.path.includes("/")
      ? change.path.split("/").slice(0, -1).join("/")
      : ".";
    accumulator[directory] ??= [];
    accumulator[directory].push(change);
    return accumulator;
  }, {});
}
