import { useEffect, useMemo, useState } from "react";
import { Codicon } from "../shared/Codicon";
import {
  gitBisect,
  gitHookRead,
  gitHooks,
  gitAddRemote,
  gitAddWorktree,
  gitCreateTag,
  gitDeleteTag,
  gitFetchPrune,
  gitListRemotes,
  gitListTags,
  gitListWorktrees,
  gitLfsLock,
  gitLfsLocks,
  gitLfsStatus,
  gitLfsUnlock,
  gitPatchApply,
  gitPatchCreate,
  gitPruneWorktrees,
  gitPushTag,
  gitRemoveRemote,
  gitRemoveWorktree,
  gitRenameRemote,
  gitRemoteSetUrl,
  gitSparseDisable,
  gitSparseList,
  gitSparseSet,
  gitSubmoduleInit,
  gitSubmoduleStatus,
  gitSubmoduleUpdate,
  gitLog
} from "../../lib/git";
import { useGit } from "../../hooks/useGit";
import { useWorkspaceStore } from "../../stores/workspace";
import type {
  GitHookInfo,
  LfsLockInfo,
  ProgressPayload,
  RemoteInfo,
  SubmoduleInfo,
  TagInfo,
  CommitInfo,
  WorktreeInfo
} from "../../types/git";
import { useOutputStore } from "../../stores/output";

type Section =
  | "output"
  | "bisect"
  | "submodules"
  | "sparse"
  | "lfs"
  | "remotes"
  | "tags"
  | "worktrees"
  | "hooks"
  | "patches"
  | "timeline";

const sections: Array<{ id: Section; label: string; description: string }> = [
  { id: "output", label: "Output", description: "Recent Git and AI operation output." },
  { id: "bisect", label: "Bisect", description: "Find the commit that introduced a regression." },
  { id: "submodules", label: "Submodules", description: "Initialize, update, and inspect nested repositories." },
  { id: "sparse", label: "Sparse Checkout", description: "Limit the working tree to selected paths." },
  { id: "lfs", label: "LFS", description: "Inspect Git LFS status and manage file locks." },
  { id: "remotes", label: "Remotes", description: "Edit fetch and push URLs for a remote." },
  { id: "tags", label: "Tags", description: "Create, inspect, push, and delete tags." },
  { id: "worktrees", label: "Worktrees", description: "Create and manage linked working trees." },
  { id: "hooks", label: "Hooks", description: "List installed Git hooks and view hook scripts." },
  { id: "patches", label: "Patches", description: "Create or apply patch text." },
  { id: "timeline", label: "Timeline", description: "Load commit history, optionally for one file." }
];

export function MiscPanel() {
  const runGit = useGit();
  const repositories = useWorkspaceStore((state) => state.repositories);
  const activeRepoId = useWorkspaceStore((state) => state.activeRepoId);
  const refreshRepo = useWorkspaceStore((state) => state.refreshRepo);
  const [section, setSection] = useState<Section>("output");
  const output = useOutputStore((state) => state.items);
  const [text, setText] = useState("");
  const [secondary, setSecondary] = useState("");
  const [result, setResult] = useState("");
  const [hooks, setHooks] = useState<GitHookInfo[]>([]);
  const [remotes, setRemotes] = useState<RemoteInfo[]>([]);
  const [tags, setTags] = useState<TagInfo[]>([]);
  const [worktrees, setWorktrees] = useState<WorktreeInfo[]>([]);
  const [submodules, setSubmodules] = useState<SubmoduleInfo[]>([]);
  const [sparsePaths, setSparsePaths] = useState<string[]>([]);
  const [lfsLocks, setLfsLocks] = useState<LfsLockInfo[]>([]);
  const [lfsStatusText, setLfsStatusText] = useState("");
  const [timelineCommits, setTimelineCommits] = useState<CommitInfo[]>([]);
  const repo = useMemo(
    () => repositories.find((item) => item.id === activeRepoId) ?? repositories[0] ?? null,
    [activeRepoId, repositories]
  );
  const activeSection = sections.find((item) => item.id === section) ?? sections[0];

  useEffect(() => {
    if (!repo) return;
    if (section === "remotes") {
      void reloadRemotes().catch(() => {});
    } else if (section === "tags") {
      void reloadTags().catch(() => {});
    } else if (section === "worktrees") {
      void reloadWorktrees().catch(() => {});
    } else if (section === "submodules") {
      void reloadSubmodules().catch(() => {});
    } else if (section === "sparse") {
      void reloadSparsePaths().catch(() => {});
    } else if (section === "lfs") {
      void reloadLfs().catch(() => {});
    }
  }, [repo?.path, section]);

  function run(operation: () => Promise<unknown>) {
    if (!repo) return;
    setResult("");
    void runGit(async () => {
      const value = await operation();
      if (typeof value === "string") setResult(value);
      else setResult(JSON.stringify(value, null, 2));
      await refreshRepo(repo.path);
    }).catch(() => {});
  }

  async function reloadRemotes() {
    if (!repo) return [];
    const next = await gitListRemotes(repo.path);
    setRemotes(next);
    return next;
  }

  async function reloadTags() {
    if (!repo) return [];
    const next = await gitListTags(repo.path);
    setTags(next);
    return next;
  }

  async function reloadWorktrees() {
    if (!repo) return [];
    const next = await gitListWorktrees(repo.path);
    setWorktrees(next);
    return next;
  }

  async function reloadSubmodules() {
    if (!repo) return [];
    const next = await gitSubmoduleStatus(repo.path);
    setSubmodules(next);
    return next;
  }

  async function reloadSparsePaths() {
    if (!repo) return [];
    const next = await gitSparseList(repo.path);
    setSparsePaths(next);
    return next;
  }

  async function reloadLfs() {
    if (!repo) return [];
    const [status, locks] = await Promise.all([
      gitLfsStatus(repo.path),
      gitLfsLocks(repo.path)
    ]);
    setLfsStatusText(status.output);
    setLfsLocks(locks);
    return locks;
  }

  async function reloadTimeline() {
    if (!repo) return [];
    const next = await gitLog(repo.path, 100, undefined, text || undefined);
    setTimelineCommits(next);
    return next;
  }

  return (
    <>
      <div className="view-title">
        <h2 className="view-title__label">Git Tools</h2>
      </div>
      <div className="misc-panel">
        <aside className="misc-panel__nav">
          {sections.map((item) => (
            <button
              key={item.id}
              className={`misc-panel__nav-item${section === item.id ? " is-active" : ""}`}
              onClick={() => setSection(item.id)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </aside>
        <main className="misc-panel__body">
          {!repo ? (
            <div className="scm-welcome">No repository loaded.</div>
          ) : section === "output" ? (
            <OutputPanel output={output} />
          ) : (
            <>
              <div className="misc-panel__repo">
                <Codicon name="repo" size={14} /> {repo.name}
              </div>
              <p className="misc-panel__hint">{activeSection.description}</p>
              {section === "bisect" ? (
                <ToolCard title="Bisect">
                  <div className="misc-panel__field-label">Revision for `start`, `good`, or `bad` (optional)</div>
                  <input className="settings-control" placeholder="HEAD, tag, or commit" value={text} onChange={(e) => setText(e.target.value)} />
                  <div className="misc-panel__actions">
                    <button className="vscode-button" onClick={() => run(() => gitBisect(repo.path, "start", text || undefined))} type="button">Start</button>
                    <button className="vscode-button" onClick={() => run(() => gitBisect(repo.path, "good", text || undefined))} type="button">Mark Good</button>
                    <button className="vscode-button" onClick={() => run(() => gitBisect(repo.path, "bad", text || undefined))} type="button">Mark Bad</button>
                    <button className="vscode-button" onClick={() => run(() => gitBisect(repo.path, "reset"))} type="button">Reset</button>
                  </div>
                </ToolCard>
              ) : section === "submodules" ? (
                <ToolCard title="Submodules">
                  <div className="misc-panel__actions">
                    <button className="vscode-button" onClick={() => run(reloadSubmodules)} type="button">Refresh</button>
                    <button className="vscode-button" onClick={() => run(async () => { await gitSubmoduleInit(repo.path); return reloadSubmodules(); })} type="button">Init</button>
                    <button className="vscode-button" onClick={() => run(async () => { await gitSubmoduleUpdate(repo.path); return reloadSubmodules(); })} type="button">Update</button>
                  </div>
                  <ToolRows>
                    {submodules.map((submodule) => (
                      <ToolRow
                        key={submodule.path}
                        title={submodule.path}
                        detail={`${submodule.status} ${submodule.sha.slice(0, 7)}${submodule.description ? ` | ${submodule.description}` : ""}`}
                        actions={null}
                      />
                    ))}
                  </ToolRows>
                </ToolCard>
              ) : section === "sparse" ? (
                <ToolCard title="Sparse Checkout">
                  <ToolRows>
                    {sparsePaths.map((path) => (
                      <ToolRow key={path} title={path} detail="included path" actions={null} />
                    ))}
                  </ToolRows>
                  <textarea className="misc-panel__textarea" placeholder="one path per line" value={text} onChange={(e) => setText(e.target.value)} />
                  <div className="misc-panel__actions">
                    <button className="vscode-button" onClick={() => run(reloadSparsePaths)} type="button">Refresh</button>
                    <button className="vscode-button" onClick={() => run(async () => { await gitSparseSet(repo.path, text.split(/\r?\n/).filter(Boolean)); return reloadSparsePaths(); })} type="button">Set</button>
                    <button className="vscode-button" onClick={() => run(async () => { await gitSparseDisable(repo.path); return reloadSparsePaths(); })} type="button">Disable</button>
                  </div>
                </ToolCard>
              ) : section === "lfs" ? (
                <ToolCard title="Git LFS">
                  {lfsStatusText ? <pre className="misc-panel__compact-result">{lfsStatusText}</pre> : null}
                  <ToolRows>
                    {lfsLocks.map((lock) => (
                      <ToolRow
                        key={lock.id || lock.path}
                        title={lock.path}
                        detail={`${lock.owner}${lock.id ? ` | ${lock.id}` : ""}`}
                        actions={
                          <button className="vscode-button" onClick={() => run(async () => { await gitLfsUnlock(repo.path, lock.path); return reloadLfs(); })} type="button">Unlock</button>
                        }
                      />
                    ))}
                  </ToolRows>
                  <input className="settings-control" placeholder="file path" value={text} onChange={(e) => setText(e.target.value)} />
                  <div className="misc-panel__actions">
                    <button className="vscode-button" onClick={() => run(reloadLfs)} type="button">Refresh</button>
                    <button className="vscode-button" onClick={() => run(async () => { await gitLfsLock(repo.path, text); return reloadLfs(); })} type="button">Lock</button>
                    <button className="vscode-button" onClick={() => run(async () => { await gitLfsUnlock(repo.path, text); return reloadLfs(); })} type="button">Unlock</button>
                  </div>
                </ToolCard>
              ) : section === "remotes" ? (
                <ToolCard title="Remotes">
                  <div className="misc-panel__actions">
                    <button className="vscode-button" onClick={() => run(reloadRemotes)} type="button">Refresh</button>
                    <button className="vscode-button" onClick={() => run(() => gitFetchPrune(repo.path))} type="button">Fetch Prune</button>
                  </div>
                  <ToolRows>
                    {remotes.map((remote) => (
                      <ToolRow
                        key={remote.name}
                        title={remote.name}
                        detail={`fetch: ${remote.fetchUrl || "-"} | push: ${remote.pushUrl || "-"}`}
                        actions={
                          <button className="vscode-button" onClick={() => run(async () => { await gitRemoveRemote(repo.path, remote.name); return reloadRemotes(); })} type="button">Remove</button>
                        }
                      />
                    ))}
                  </ToolRows>
                  <input className="settings-control" placeholder="remote name" value={text} onChange={(e) => setText(e.target.value)} />
                  <input className="settings-control" placeholder="url or new name" value={secondary} onChange={(e) => setSecondary(e.target.value)} />
                  <div className="misc-panel__actions">
                    <button className="vscode-button" onClick={() => run(async () => { await gitAddRemote(repo.path, text, secondary); return reloadRemotes(); })} type="button">Add Remote</button>
                    <button className="vscode-button" onClick={() => run(async () => { await gitRenameRemote(repo.path, text, secondary); return reloadRemotes(); })} type="button">Rename Remote</button>
                    <button className="vscode-button" onClick={() => run(async () => { await gitRemoteSetUrl(repo.path, text, secondary, false); return reloadRemotes(); })} type="button">Set Fetch URL</button>
                    <button className="vscode-button" onClick={() => run(async () => { await gitRemoteSetUrl(repo.path, text, secondary, true); return reloadRemotes(); })} type="button">Set Push URL</button>
                  </div>
                </ToolCard>
              ) : section === "tags" ? (
                <ToolCard title="Tags">
                  <div className="misc-panel__actions">
                    <button className="vscode-button" onClick={() => run(reloadTags)} type="button">Refresh</button>
                  </div>
                  <ToolRows>
                    {tags.map((tag) => (
                      <ToolRow
                        key={tag.name}
                        title={tag.name}
                        detail={`${tag.sha.slice(0, 7)}${tag.message ? ` | ${tag.message}` : ""}`}
                        actions={
                          <>
                            <button className="vscode-button" onClick={() => run(() => gitPushTag(repo.path, secondary || "origin", tag.name))} type="button">Push</button>
                            <button className="vscode-button" onClick={() => run(async () => { await gitDeleteTag(repo.path, tag.name); return reloadTags(); })} type="button">Delete</button>
                          </>
                        }
                      />
                    ))}
                  </ToolRows>
                  <input className="settings-control" placeholder="tag name" value={text} onChange={(e) => setText(e.target.value)} />
                  <input className="settings-control" placeholder="remote for push (default origin)" value={secondary} onChange={(e) => setSecondary(e.target.value)} />
                  <button className="vscode-button" onClick={() => run(async () => { await gitCreateTag(repo.path, text); return reloadTags(); })} type="button">Create Tag</button>
                </ToolCard>
              ) : section === "worktrees" ? (
                <ToolCard title="Worktrees">
                  <div className="misc-panel__actions">
                    <button className="vscode-button" onClick={() => run(reloadWorktrees)} type="button">Refresh</button>
                    <button className="vscode-button" onClick={() => run(async () => { await gitPruneWorktrees(repo.path); return reloadWorktrees(); })} type="button">Prune</button>
                  </div>
                  <ToolRows>
                    {worktrees.map((worktree) => (
                      <ToolRow
                        key={worktree.path}
                        title={worktree.path}
                        detail={`${worktree.branch || "(detached)"} | ${worktree.sha.slice(0, 7)}`}
                        actions={
                          worktree.isMain ? null : (
                            <button className="vscode-button" onClick={() => run(async () => { await gitRemoveWorktree(repo.path, worktree.path); return reloadWorktrees(); })} type="button">Remove</button>
                          )
                        }
                      />
                    ))}
                  </ToolRows>
                  <input className="settings-control" placeholder="new worktree path" value={text} onChange={(e) => setText(e.target.value)} />
                  <input className="settings-control" placeholder="branch (optional)" value={secondary} onChange={(e) => setSecondary(e.target.value)} />
                  <button className="vscode-button" onClick={() => run(async () => { await gitAddWorktree(repo.path, text, secondary || undefined); return reloadWorktrees(); })} type="button">Add Worktree</button>
                </ToolCard>
              ) : section === "hooks" ? (
                <ToolCard title="Git Hooks">
                  <div className="misc-panel__actions">
                    <button className="vscode-button" onClick={() => run(async () => { const list = await gitHooks(repo.path); setHooks(list); return list; })} type="button">Refresh Hooks</button>
                  </div>
                  <ToolRows>
                    {hooks.map((hook) => (
                      <ToolRow
                        key={hook.name}
                        title={hook.name}
                        detail={`${hook.executable ? "executable" : "not executable"} | ${hook.path}`}
                        actions={
                          <button className="vscode-button" onClick={() => run(() => gitHookRead(repo.path, hook.name))} type="button">View</button>
                        }
                      />
                    ))}
                  </ToolRows>
                </ToolCard>
              ) : section === "patches" ? (
                <ToolCard title="Patch Import / Export">
                  <div className="misc-panel__field-label">Export</div>
                  <div className="misc-panel__actions">
                    <button className="vscode-button" onClick={() => run(() => gitPatchCreate(repo.path, false))} type="button">Create Working Patch</button>
                    <button className="vscode-button" onClick={() => run(() => gitPatchCreate(repo.path, true))} type="button">Create Staged Patch</button>
                  </div>
                  <div className="misc-panel__field-label">Import</div>
                  <textarea className="misc-panel__textarea" placeholder="Paste patch text to apply" value={text} onChange={(e) => setText(e.target.value)} />
                  <button className="vscode-button" onClick={() => run(() => gitPatchApply(repo.path, text))} type="button">Apply Patch</button>
                </ToolCard>
              ) : (
                <ToolCard title="Timeline">
                  <input className="settings-control" placeholder="file path" value={text} onChange={(e) => setText(e.target.value)} />
                  <button className="vscode-button" onClick={() => run(reloadTimeline)} type="button">Load Timeline</button>
                  <ToolRows>
                    {timelineCommits.map((commit) => (
                      <ToolRow
                        key={commit.sha}
                        title={commit.message}
                        detail={`${commit.shortSha} | ${commit.author} | ${commit.date}`}
                        actions={null}
                      />
                    ))}
                  </ToolRows>
                </ToolCard>
              )}
              <pre className="misc-panel__result">{result || "No output yet."}</pre>
            </>
          )}
        </main>
      </div>
    </>
  );
}

function ToolCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="misc-card">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function ToolRows({ children }: { children: React.ReactNode }) {
  return <div className="misc-panel__rows">{children}</div>;
}

function ToolRow({
  title,
  detail,
  actions
}: {
  title: string;
  detail: string;
  actions: React.ReactNode;
}) {
  return (
    <div className="misc-panel__row">
      <div>
        <div className="misc-panel__row-title">{title}</div>
        <div className="misc-panel__row-detail">{detail}</div>
      </div>
      <div className="misc-panel__row-actions">{actions}</div>
    </div>
  );
}

function OutputPanel({ output }: { output: ProgressPayload[] }) {
  return (
    <div className="misc-card">
      <h3>Operation Output</h3>
      <pre className="misc-panel__result">
        {output.length === 0
          ? "No Git or AI operation output yet."
          : output
              .map((item) => {
                const command = item.command?.length ? `git ${item.command.join(" ")}` : item.operation;
                return `[${item.status}] ${command}\n${item.message}`;
              })
              .join("\n\n")}
      </pre>
    </div>
  );
}
