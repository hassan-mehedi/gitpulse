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
  PatchCreateResult,
  ProgressPayload,
  RemoteInfo,
  SparseCheckoutStatus,
  SubmoduleInfo,
  TagInfo,
  CommitInfo,
  WorktreeInfo
} from "../../types/git";
import { useOutputStore } from "../../stores/output";
import { ignoreReportedError, reportBackgroundError } from "../../lib/errors";
import {
  submoduleStatusMeta,
  summarizeLfsStatus,
  summarizeSparseCheckout
} from "../../lib/miscViews";

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
  const [remoteName, setRemoteName] = useState("");
  const [remoteValue, setRemoteValue] = useState("");
  const [tagName, setTagName] = useState("");
  const [tagRemote, setTagRemote] = useState("origin");
  const [worktreePath, setWorktreePath] = useState("");
  const [worktreeBranch, setWorktreeBranch] = useState("");
  const [selectedHook, setSelectedHook] = useState<GitHookInfo | null>(null);
  const [hookContent, setHookContent] = useState("");
  const [patchInput, setPatchInput] = useState("");
  const [patchOutput, setPatchOutput] = useState<PatchCreateResult | null>(null);
  const [timelinePath, setTimelinePath] = useState("");
  const [selectedTimelineCommit, setSelectedTimelineCommit] = useState<CommitInfo | null>(null);
  const [hooks, setHooks] = useState<GitHookInfo[]>([]);
  const [remotes, setRemotes] = useState<RemoteInfo[]>([]);
  const [tags, setTags] = useState<TagInfo[]>([]);
  const [worktrees, setWorktrees] = useState<WorktreeInfo[]>([]);
  const [submodules, setSubmodules] = useState<SubmoduleInfo[]>([]);
  const [sparseStatus, setSparseStatus] = useState<SparseCheckoutStatus>({
    enabled: false,
    patterns: []
  });
  const [lfsLocks, setLfsLocks] = useState<LfsLockInfo[]>([]);
  const [lfsStatus, setLfsStatus] = useState({
    available: false,
    output: ""
  });
  const [timelineCommits, setTimelineCommits] = useState<CommitInfo[]>([]);
  const repo = useMemo(
    () => repositories.find((item) => item.id === activeRepoId) ?? repositories[0] ?? null,
    [activeRepoId, repositories]
  );
  const activeSection = sections.find((item) => item.id === section) ?? sections[0];
  const lfsSummary = summarizeLfsStatus(lfsStatus, lfsLocks);

  useEffect(() => {
    if (!repo) return;
    if (section === "remotes") {
      void reloadRemotes().catch((error) => reportSectionLoadError(error, "Load remotes", repo.path));
    } else if (section === "tags") {
      void reloadTags().catch((error) => reportSectionLoadError(error, "Load tags", repo.path));
    } else if (section === "worktrees") {
      void reloadWorktrees().catch((error) =>
        reportSectionLoadError(error, "Load worktrees", repo.path)
      );
    } else if (section === "submodules") {
      void reloadSubmodules().catch((error) =>
        reportSectionLoadError(error, "Load submodules", repo.path)
      );
    } else if (section === "sparse") {
      void reloadSparsePaths().catch((error) =>
        reportSectionLoadError(error, "Load sparse checkout", repo.path)
      );
    } else if (section === "lfs") {
      void reloadLfs().catch((error) => reportSectionLoadError(error, "Load LFS", repo.path));
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
    }).catch(ignoreReportedError);
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
    setSparseStatus(next);
    return next;
  }

  async function reloadLfs() {
    if (!repo) return [];
    const [status, locks] = await Promise.all([
      gitLfsStatus(repo.path),
      gitLfsLocks(repo.path)
    ]);
    setLfsStatus(status);
    setLfsLocks(locks);
    return locks;
  }

  async function reloadTimeline() {
    if (!repo) return [];
    const next = await gitLog(repo.path, 100, undefined, timelinePath || undefined);
    setTimelineCommits(next);
    setSelectedTimelineCommit(next[0] ?? null);
    return next;
  }

  async function loadHookContent(hook: GitHookInfo) {
    if (!repo) return "";
    const content = await gitHookRead(repo.path, hook.name);
    setSelectedHook(hook);
    setHookContent(content);
    return content;
  }

  async function createPatch(staged: boolean) {
    if (!repo) return "";
    const patch = await gitPatchCreate(repo.path, staged);
    setPatchOutput(patch);
    return patch;
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
                  <SummaryStrip
                    items={[
                      {
                        label: "Total",
                        value: String(submodules.length)
                      },
                      {
                        label: "Needs attention",
                        value: String(
                          submodules.filter(
                            (submodule) => submoduleStatusMeta(submodule).tone !== "success"
                          ).length
                        )
                      }
                    ]}
                  />
                  <div className="misc-panel__actions">
                    <button className="vscode-button" onClick={() => run(reloadSubmodules)} type="button">Refresh</button>
                    <button className="vscode-button" onClick={() => run(async () => { await gitSubmoduleInit(repo.path); return reloadSubmodules(); })} type="button">Init</button>
                    <button className="vscode-button" onClick={() => run(async () => { await gitSubmoduleUpdate(repo.path); return reloadSubmodules(); })} type="button">Update</button>
                  </div>
                  {submodules.length === 0 ? (
                    <EmptyToolState>No submodules detected in this repository.</EmptyToolState>
                  ) : (
                    <ToolRows>
                      {submodules.map((submodule) => {
                        const meta = submoduleStatusMeta(submodule);
                        return (
                          <ToolRow
                            key={submodule.path}
                            title={submodule.path}
                            detail={`${meta.label} | ${submodule.sha.slice(0, 7)}${submodule.description ? ` | ${submodule.description}` : ""}`}
                            actions={<StatusPill tone={meta.tone}>{meta.label}</StatusPill>}
                          />
                        );
                      })}
                    </ToolRows>
                  )}
                </ToolCard>
              ) : section === "sparse" ? (
                <ToolCard title="Sparse Checkout">
                  <SummaryStrip items={[{ label: "State", value: summarizeSparseCheckout(sparseStatus) }]} />
                  {sparseStatus.patterns.length === 0 ? (
                    <EmptyToolState>
                      No sparse paths configured. Add one path per line to limit the working tree.
                    </EmptyToolState>
                  ) : (
                    <ToolRows>
                      {sparseStatus.patterns.map((path) => (
                        <ToolRow key={path} title={path} detail="Included path" actions={null} />
                      ))}
                    </ToolRows>
                  )}
                  <textarea className="misc-panel__textarea" placeholder="one path per line" value={text} onChange={(e) => setText(e.target.value)} />
                  <div className="misc-panel__actions">
                    <button className="vscode-button" onClick={() => run(reloadSparsePaths)} type="button">Refresh</button>
                    <button className="vscode-button" onClick={() => run(async () => { await gitSparseSet(repo.path, text.split(/\r?\n/).filter(Boolean)); return reloadSparsePaths(); })} type="button">Set</button>
                    <button className="vscode-button" onClick={() => run(async () => { await gitSparseDisable(repo.path); return reloadSparsePaths(); })} type="button">Disable</button>
                  </div>
                </ToolCard>
              ) : section === "lfs" ? (
                <ToolCard title="Git LFS">
                  <SummaryStrip
                    items={[
                      { label: "Availability", value: lfsSummary.available ? "Available" : "Unavailable" },
                      { label: "Locks", value: String(lfsSummary.lockCount) },
                      {
                        label: "Pending push",
                        value: lfsSummary.pendingPushCount === null ? "-" : String(lfsSummary.pendingPushCount)
                      },
                      {
                        label: "Pending pull",
                        value: lfsSummary.pendingPullCount === null ? "-" : String(lfsSummary.pendingPullCount)
                      }
                    ]}
                  />
                  {lfsLocks.length === 0 ? (
                    <EmptyToolState>No LFS locks reported.</EmptyToolState>
                  ) : (
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
                  )}
                  {lfsSummary.hasRawOutput ? (
                    <details className="misc-panel__details">
                      <summary>Show raw LFS status</summary>
                      <pre className="misc-panel__compact-result">{lfsStatus.output}</pre>
                    </details>
                  ) : null}
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
                  <ToolForm
                    title="Manage Remote"
                    fields={
                      <>
                        <LabeledField label="Remote name">
                          <input className="settings-control" placeholder="origin" value={remoteName} onChange={(e) => setRemoteName(e.target.value)} />
                        </LabeledField>
                        <LabeledField label="URL or new name">
                          <input className="settings-control" placeholder="git@github.com:org/repo.git" value={remoteValue} onChange={(e) => setRemoteValue(e.target.value)} />
                        </LabeledField>
                      </>
                    }
                    actions={
                      <>
                        <button className="vscode-button" onClick={() => run(async () => { await gitAddRemote(repo.path, remoteName, remoteValue); return reloadRemotes(); })} type="button">Add</button>
                        <button className="vscode-button" onClick={() => run(async () => { await gitRenameRemote(repo.path, remoteName, remoteValue); return reloadRemotes(); })} type="button">Rename</button>
                        <button className="vscode-button" onClick={() => run(async () => { await gitRemoteSetUrl(repo.path, remoteName, remoteValue, false); return reloadRemotes(); })} type="button">Set Fetch URL</button>
                        <button className="vscode-button" onClick={() => run(async () => { await gitRemoteSetUrl(repo.path, remoteName, remoteValue, true); return reloadRemotes(); })} type="button">Set Push URL</button>
                      </>
                    }
                  />
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
                            <button className="vscode-button" onClick={() => run(() => gitPushTag(repo.path, tagRemote || "origin", tag.name))} type="button">Push</button>
                            <button className="vscode-button" onClick={() => run(async () => { await gitDeleteTag(repo.path, tag.name); return reloadTags(); })} type="button">Delete</button>
                          </>
                        }
                      />
                    ))}
                  </ToolRows>
                  <ToolForm
                    title="Create / Push"
                    fields={
                      <>
                        <LabeledField label="Tag name">
                          <input className="settings-control" placeholder="v1.0.0" value={tagName} onChange={(e) => setTagName(e.target.value)} />
                        </LabeledField>
                        <LabeledField label="Push remote">
                          <input className="settings-control" placeholder="origin" value={tagRemote} onChange={(e) => setTagRemote(e.target.value)} />
                        </LabeledField>
                      </>
                    }
                    actions={
                      <button className="vscode-button" onClick={() => run(async () => { await gitCreateTag(repo.path, tagName); return reloadTags(); })} type="button">Create Tag</button>
                    }
                  />
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
                  <ToolForm
                    title="Add Worktree"
                    fields={
                      <>
                        <LabeledField label="Path">
                          <input className="settings-control" placeholder="../repo-feature" value={worktreePath} onChange={(e) => setWorktreePath(e.target.value)} />
                        </LabeledField>
                        <LabeledField label="Branch (optional)">
                          <input className="settings-control" placeholder="feature/name" value={worktreeBranch} onChange={(e) => setWorktreeBranch(e.target.value)} />
                        </LabeledField>
                      </>
                    }
                    actions={
                      <button className="vscode-button" onClick={() => run(async () => { await gitAddWorktree(repo.path, worktreePath, worktreeBranch || undefined); return reloadWorktrees(); })} type="button">Add Worktree</button>
                    }
                  />
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
                          <button className="vscode-button" onClick={() => run(() => loadHookContent(hook))} type="button">View</button>
                        }
                      />
                    ))}
                  </ToolRows>
                  <DetailPane
                    title={selectedHook ? selectedHook.name : "Hook details"}
                    empty="Select a hook to inspect its contents."
                    content={selectedHook ? hookContent : ""}
                  />
                </ToolCard>
              ) : section === "patches" ? (
                <ToolCard title="Patch Import / Export">
                  <div className="misc-panel__field-label">Export</div>
                  <div className="misc-panel__actions">
                    <button className="vscode-button" onClick={() => run(() => createPatch(false))} type="button">Create Working Patch</button>
                    <button className="vscode-button" onClick={() => run(() => createPatch(true))} type="button">Create Staged Patch</button>
                  </div>
                  <DetailPane
                    title="Generated patch"
                    empty="Create a patch to preview it here."
                    content={patchOutput?.patch ?? ""}
                  />
                  {patchOutput ? (
                    <SummaryStrip
                      items={[
                        { label: "Files", value: String(patchOutput.fileCount) },
                        { label: "Hunks", value: String(patchOutput.hunkCount) },
                        { label: "Source", value: patchOutput.staged ? "Staged" : "Working tree" }
                      ]}
                    />
                  ) : null}
                  <div className="misc-panel__field-label">Import</div>
                  <textarea className="misc-panel__textarea" placeholder="Paste patch text to apply" value={patchInput} onChange={(e) => setPatchInput(e.target.value)} />
                  <button className="vscode-button" onClick={() => run(() => gitPatchApply(repo.path, patchInput))} type="button">Apply Patch</button>
                </ToolCard>
              ) : (
                <ToolCard title="Timeline">
                  <ToolForm
                    title="Filter Timeline"
                    fields={
                      <LabeledField label="File path (optional)">
                        <input className="settings-control" placeholder="src/components/App.tsx" value={timelinePath} onChange={(e) => setTimelinePath(e.target.value)} />
                      </LabeledField>
                    }
                    actions={<button className="vscode-button" onClick={() => run(reloadTimeline)} type="button">Load Timeline</button>}
                  />
                  <ToolRows>
                    {timelineCommits.map((commit) => (
                      <button
                        className={`misc-panel__timeline-row${selectedTimelineCommit?.sha === commit.sha ? " is-selected" : ""}`}
                        key={commit.sha}
                        onClick={() => setSelectedTimelineCommit(commit)}
                        type="button"
                      >
                        <span>{commit.message}</span>
                        <small>{`${commit.shortSha} | ${commit.author} | ${commit.date}`}</small>
                      </button>
                    ))}
                  </ToolRows>
                  <TimelineDetail commit={selectedTimelineCommit} />
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

function SummaryStrip({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <div className="misc-panel__summary">
      {items.map((item) => (
        <div key={item.label} className="misc-panel__summary-item">
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

function EmptyToolState({ children }: { children: React.ReactNode }) {
  return <div className="misc-panel__empty">{children}</div>;
}

function ToolForm({
  title,
  fields,
  actions
}: {
  title: string;
  fields: React.ReactNode;
  actions: React.ReactNode;
}) {
  return (
    <section className="misc-panel__form">
      <div className="misc-panel__form-title">{title}</div>
      <div className="misc-panel__form-grid">{fields}</div>
      <div className="misc-panel__actions">{actions}</div>
    </section>
  );
}

function LabeledField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="misc-panel__field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function DetailPane({
  title,
  empty,
  content
}: {
  title: string;
  empty: string;
  content: string;
}) {
  return (
    <section className="misc-panel__detail">
      <h4>{title}</h4>
      {content ? <pre>{content}</pre> : <div>{empty}</div>}
    </section>
  );
}

function TimelineDetail({ commit }: { commit: CommitInfo | null }) {
  if (!commit) {
    return <EmptyToolState>Load the timeline and select a commit to inspect it.</EmptyToolState>;
  }

  return (
    <section className="misc-panel__timeline-detail">
      <h4>{commit.message}</h4>
      <dl>
        <div>
          <dt>Commit</dt>
          <dd>{commit.sha}</dd>
        </div>
        <div>
          <dt>Author</dt>
          <dd>{commit.author}</dd>
        </div>
        <div>
          <dt>Date</dt>
          <dd>{commit.date}</dd>
        </div>
        <div>
          <dt>Refs</dt>
          <dd>{commit.refs.join(", ") || "-"}</dd>
        </div>
      </dl>
    </section>
  );
}

function StatusPill({
  children,
  tone
}: {
  children: React.ReactNode;
  tone: "success" | "warning" | "danger";
}) {
  return <span className={`misc-panel__pill misc-panel__pill--${tone}`}>{children}</span>;
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

function reportSectionLoadError(error: unknown, operation: string, repoPath: string) {
  reportBackgroundError(error, {
    operation,
    repoPath,
    notify: false
  });
}
