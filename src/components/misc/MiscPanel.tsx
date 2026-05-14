import { useEffect, useMemo, useState } from "react";
import { Codicon } from "../shared/Codicon";
import {
  gitBisect,
  gitHookRead,
  gitHooks,
  gitLfsLock,
  gitLfsLocks,
  gitLfsStatus,
  gitLfsUnlock,
  gitPatchApply,
  gitPatchCreate,
  gitRemoteSetUrl,
  gitSparseDisable,
  gitSparseList,
  gitSparseSet,
  gitSubmoduleInit,
  gitSubmoduleStatus,
  gitSubmoduleUpdate,
  gitLog,
  listenGitProgress
} from "../../lib/git";
import { useGit } from "../../hooks/useGit";
import { useWorkspaceStore } from "../../stores/workspace";
import type { GitHookInfo, ProgressPayload } from "../../types/git";

type Section =
  | "output"
  | "bisect"
  | "submodules"
  | "sparse"
  | "lfs"
  | "remotes"
  | "hooks"
  | "patches"
  | "timeline";

const sections: Array<{ id: Section; label: string; description: string }> = [
  { id: "output", label: "Git Output", description: "Recent command output and progress." },
  { id: "bisect", label: "Bisect", description: "Find the commit that introduced a regression." },
  { id: "submodules", label: "Submodules", description: "Initialize, update, and inspect nested repositories." },
  { id: "sparse", label: "Sparse Checkout", description: "Limit the working tree to selected paths." },
  { id: "lfs", label: "LFS", description: "Inspect Git LFS status and manage file locks." },
  { id: "remotes", label: "Remotes", description: "Edit fetch and push URLs for a remote." },
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
  const [output, setOutput] = useState<ProgressPayload[]>([]);
  const [text, setText] = useState("");
  const [secondary, setSecondary] = useState("");
  const [result, setResult] = useState("");
  const [hooks, setHooks] = useState<GitHookInfo[]>([]);
  const repo = useMemo(
    () => repositories.find((item) => item.id === activeRepoId) ?? repositories[0] ?? null,
    [activeRepoId, repositories]
  );
  const activeSection = sections.find((item) => item.id === section) ?? sections[0];

  useEffect(() => {
    let dispose: (() => void) | undefined;
    function onOutput(event: Event) {
      const payload = (event as CustomEvent<ProgressPayload>).detail;
      setOutput((items) => [payload, ...items].slice(0, 300));
    }
    window.addEventListener("gitpulse:output", onOutput);
    void listenGitProgress((payload) => {
      setOutput((items) => [payload, ...items].slice(0, 300));
    }).then((nextDispose) => {
      dispose = nextDispose;
    });
    return () => {
      window.removeEventListener("gitpulse:output", onOutput);
      dispose?.();
    };
  }, []);

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
                  <input className="settings-control" placeholder="revision (optional)" value={text} onChange={(e) => setText(e.target.value)} />
                  <div className="misc-panel__actions">
                    {(["start", "bad", "good", "reset"] as const).map((action) => (
                      <button className="vscode-button" key={action} onClick={() => run(() => gitBisect(repo.path, action, text || undefined))} type="button">{action}</button>
                    ))}
                  </div>
                </ToolCard>
              ) : section === "submodules" ? (
                <ToolCard title="Submodules">
                  <div className="misc-panel__actions">
                    <button className="vscode-button" onClick={() => run(() => gitSubmoduleStatus(repo.path))} type="button">Status</button>
                    <button className="vscode-button" onClick={() => run(() => gitSubmoduleInit(repo.path))} type="button">Init</button>
                    <button className="vscode-button" onClick={() => run(() => gitSubmoduleUpdate(repo.path))} type="button">Update</button>
                  </div>
                </ToolCard>
              ) : section === "sparse" ? (
                <ToolCard title="Sparse Checkout">
                  <textarea className="misc-panel__textarea" placeholder="one path per line" value={text} onChange={(e) => setText(e.target.value)} />
                  <div className="misc-panel__actions">
                    <button className="vscode-button" onClick={() => run(() => gitSparseList(repo.path))} type="button">List</button>
                    <button className="vscode-button" onClick={() => run(() => gitSparseSet(repo.path, text.split(/\r?\n/).filter(Boolean)))} type="button">Set</button>
                    <button className="vscode-button" onClick={() => run(() => gitSparseDisable(repo.path))} type="button">Disable</button>
                  </div>
                </ToolCard>
              ) : section === "lfs" ? (
                <ToolCard title="Git LFS">
                  <input className="settings-control" placeholder="file path" value={text} onChange={(e) => setText(e.target.value)} />
                  <div className="misc-panel__actions">
                    <button className="vscode-button" onClick={() => run(() => gitLfsStatus(repo.path))} type="button">Status</button>
                    <button className="vscode-button" onClick={() => run(() => gitLfsLocks(repo.path))} type="button">Locks</button>
                    <button className="vscode-button" onClick={() => run(() => gitLfsLock(repo.path, text))} type="button">Lock</button>
                    <button className="vscode-button" onClick={() => run(() => gitLfsUnlock(repo.path, text))} type="button">Unlock</button>
                  </div>
                </ToolCard>
              ) : section === "remotes" ? (
                <ToolCard title="Remote URL">
                  <input className="settings-control" placeholder="remote name" value={text} onChange={(e) => setText(e.target.value)} />
                  <input className="settings-control" placeholder="url" value={secondary} onChange={(e) => setSecondary(e.target.value)} />
                  <div className="misc-panel__actions">
                    <button className="vscode-button" onClick={() => run(() => gitRemoteSetUrl(repo.path, text, secondary, false))} type="button">Set Fetch URL</button>
                    <button className="vscode-button" onClick={() => run(() => gitRemoteSetUrl(repo.path, text, secondary, true))} type="button">Set Push URL</button>
                  </div>
                </ToolCard>
              ) : section === "hooks" ? (
                <ToolCard title="Git Hooks">
                  <div className="misc-panel__actions">
                    <button className="vscode-button" onClick={() => run(async () => { const list = await gitHooks(repo.path); setHooks(list); return list; })} type="button">Refresh Hooks</button>
                  </div>
                  <div className="misc-panel__list">
                    {hooks.map((hook) => (
                      <button className="misc-panel__list-item" key={hook.name} onClick={() => run(() => gitHookRead(repo.path, hook.name))} type="button">{hook.name}</button>
                    ))}
                  </div>
                </ToolCard>
              ) : section === "patches" ? (
                <ToolCard title="Patch Import / Export">
                  <textarea className="misc-panel__textarea" placeholder="paste patch to apply" value={text} onChange={(e) => setText(e.target.value)} />
                  <div className="misc-panel__actions">
                    <button className="vscode-button" onClick={() => run(() => gitPatchCreate(repo.path, false))} type="button">Create Working Patch</button>
                    <button className="vscode-button" onClick={() => run(() => gitPatchCreate(repo.path, true))} type="button">Create Staged Patch</button>
                    <button className="vscode-button" onClick={() => run(() => gitPatchApply(repo.path, text))} type="button">Apply Patch</button>
                  </div>
                </ToolCard>
              ) : (
                <ToolCard title="Timeline">
                  <input className="settings-control" placeholder="file path" value={text} onChange={(e) => setText(e.target.value)} />
                  <button className="vscode-button" onClick={() => run(() => gitLog(repo.path, 100, undefined, text || undefined))} type="button">Load Timeline</button>
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

function OutputPanel({ output }: { output: ProgressPayload[] }) {
  return (
    <div className="misc-card">
      <h3>Git Output</h3>
      <pre className="misc-panel__result">
        {output.length === 0
          ? "No Git progress output yet."
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
