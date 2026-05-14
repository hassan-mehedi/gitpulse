import { useEffect, useRef, useState } from "react";
import { Codicon } from "../shared/Codicon";
import { Modal } from "../shared/Modal";
import {
  gitCommit,
  gitCommitAll,
  gitCommitAmend,
  gitPush,
  gitStageFiles,
  gitSync,
  gitUndoLastCommit
} from "../../lib/git";
import { useGit } from "../../hooks/useGit";
import { useSettingsStore } from "../../stores/settings";
import { useWorkspaceStore } from "../../stores/workspace";
import { resolveCommitIdentity } from "../../lib/commitIdentity";
import type { Repository } from "../../types/git";

interface CommitInputProps {
  repo: Repository;
}

type CommitAction =
  | "commit"
  | "commit-staged"
  | "commit-all"
  | "commit-push"
  | "commit-sync"
  | "undo"
  | "amend";

interface MenuEntry {
  id: CommitAction;
  label: string;
  separatorBefore?: boolean;
  needsMessage?: boolean;
}

const MENU: MenuEntry[] = [
  { id: "commit", label: "Commit", needsMessage: true },
  { id: "amend", label: "Commit (Amend)" },
  { id: "commit-push", label: "Commit Staged & Push", needsMessage: true },
  { id: "commit-sync", label: "Commit Staged & Sync", needsMessage: true }
];

const HISTORY_LIMIT = 30;

export function CommitInput({ repo }: CommitInputProps) {
  const historyKey = `gitpulse:commitHistory:${repo.path}`;
  const [message, setMessage] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [history, setHistory] = useState<string[]>(() => readHistory(historyKey));
  const [historyCursor, setHistoryCursor] = useState<number | null>(null);
  const [lastGitOutput, setLastGitOutput] = useState<string | null>(null);
  const [stageAllPrompt, setStageAllPrompt] = useState<CommitAction | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const runGit = useGit();
  const smartCommit = useSettingsStore((state) => state.smartCommit);
  const signCommits = useSettingsStore((state) => state.signCommits);
  const commitIdentities = useSettingsStore((state) => state.commitIdentities);
  const repoIdentityAssignments = useSettingsStore((state) => state.repoIdentityAssignments);
  const refreshRepo = useWorkspaceStore((state) => state.refreshRepo);
  const setActiveRepo = useWorkspaceStore((state) => state.setActiveRepo);
  const assignedIdentity = resolveCommitIdentity(
    repo.path,
    commitIdentities,
    repoIdentityAssignments
  );
  const commitIdentity =
    assignedIdentity.source === "gitpulse" ? assignedIdentity.identity : undefined;
  const smartCommitChanges = repo.changes.filter(
    (change) => change.status !== "?" && change.status !== "U"
  );
  const stageableChanges = repo.changes.filter((change) => change.status !== "U");
  const hasStageableChanges = stageableChanges.length > 0;
  const hasCommitMessage = message.trim().length > 0;

  useEffect(() => {
    setHistory(readHistory(historyKey));
    setHistoryCursor(null);
    setLastGitOutput(null);
  }, [historyKey]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "0px";
    const nextHeight = textarea.scrollHeight;
    textarea.style.height = `${Math.max(nextHeight, 30)}px`;
    textarea.style.overflowY = "hidden";
  }, [message]);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickAway(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("mousedown", handleClickAway);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handleClickAway);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [menuOpen]);

  async function execute(action: CommitAction) {
    const trimmed = message.trim();
    const entry = MENU.find((item) => item.id === action);
    if (entry?.needsMessage && !trimmed) {
      return;
    }

    await executeCommitAction(action, trimmed);
  }

  async function executeCommitAction(
    action: CommitAction,
    trimmed: string,
    stageAllBeforeCommit = false
  ) {
    setLastGitOutput(null);
    try {
      await runGit(async () => {
        switch (action) {
          case "commit":
          case "commit-staged":
            await commitSmart(trimmed, stageAllBeforeCommit);
            rememberMessage(trimmed);
            break;
          case "commit-all":
            await gitCommitAll(repo.path, trimmed, signCommits, commitIdentity);
            rememberMessage(trimmed);
            break;
          case "commit-push":
            await commitSmart(trimmed, stageAllBeforeCommit);
            rememberMessage(trimmed);
            await gitPush(repo.path);
            break;
          case "commit-sync":
            await commitSmart(trimmed, stageAllBeforeCommit);
            rememberMessage(trimmed);
            await gitSync(repo.path);
            break;
          case "amend":
            await gitCommitAmend(repo.path, trimmed || undefined, signCommits, commitIdentity);
            if (trimmed) rememberMessage(trimmed);
            break;
          case "undo":
            await gitUndoLastCommit(repo.path);
            break;
        }

        if (action !== "undo") {
          setMessage("");
        }
        setHistoryCursor(null);
        await refreshRepo(repo.path);
      });
    } catch (error) {
      const detail =
        (error as { message?: string; stderr?: string })?.stderr ??
        (error as { message?: string })?.message ??
        String(error);
      setLastGitOutput(detail);
    }
  }

  async function commitSmart(trimmed: string, stageAllBeforeCommit = false) {
    if (repo.staged.length === 0) {
      if ((!smartCommit && !stageAllBeforeCommit) || stageableChanges.length === 0) {
        return;
      }
      const nextChanges = stageAllBeforeCommit ? stageableChanges : smartCommitChanges;
      if (nextChanges.length === 0) {
        return;
      }
      await gitStageFiles(repo.path, nextChanges.map((change) => change.path));
    }
    await gitCommit(repo.path, trimmed, signCommits, commitIdentity);
  }

  function rememberMessage(value: string) {
    if (!value) return;
    const next = [value, ...history.filter((item) => item !== value)].slice(0, HISTORY_LIMIT);
    setHistory(next);
    writeHistory(historyKey, next);
  }

  function runAction(action: CommitAction) {
    setMenuOpen(false);
    const entry = MENU.find((item) => item.id === action);
    if (entry?.needsMessage && !message.trim()) {
      return;
    }
    if (isCommitAction(action) && repo.staged.length === 0 && hasStageableChanges) {
      setStageAllPrompt(action);
      return;
    }
    void execute(action);
  }

  function confirmStageAndCommit() {
    const action = stageAllPrompt;
    setStageAllPrompt(null);
    if (!action) return;
    const trimmed = message.trim();
    void executeCommitAction(action, trimmed, true);
  }

  function navigateHistory(direction: -1 | 1) {
    if (history.length === 0) return;
    const current = historyCursor ?? (direction === -1 ? -1 : 0);
    const next = Math.max(0, Math.min(history.length - 1, current + (direction === -1 ? 1 : -1)));
    setHistoryCursor(next);
    setMessage(history[next] ?? "");
    window.setTimeout(() => textareaRef.current?.setSelectionRange(0, 0), 0);
  }

  const placeholder = `Message (Ctrl+Enter to commit on '${repo.branch}')`;
  const commitToneDimmed = !hasCommitMessage;

  return (
    <div className="commit-input">
      <textarea
        className="commit-input__textarea"
        ref={textareaRef}
        onChange={(event) => setMessage(event.target.value)}
        onFocus={() => setActiveRepo(repo.id)}
        onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
            event.preventDefault();
            runAction(event.shiftKey ? "commit-all" : "commit");
          } else if (!event.altKey && !event.ctrlKey && !event.metaKey && event.key === "ArrowUp") {
            const atStart = event.currentTarget.selectionStart === 0;
            if (atStart) {
              event.preventDefault();
              navigateHistory(-1);
            }
          } else if (!event.altKey && !event.ctrlKey && !event.metaKey && event.key === "ArrowDown") {
            const atEnd = event.currentTarget.selectionStart === event.currentTarget.value.length;
            if (atEnd && historyCursor !== null) {
              event.preventDefault();
              navigateHistory(1);
            }
          }
        }}
        placeholder={placeholder}
        rows={1}
        value={message}
      />
      <div className="commit-input__actions" ref={menuRef}>
        <button
          className={`vscode-button vscode-button--primary commit-input__primary${
            commitToneDimmed ? " is-dimmed" : ""
          }`}
          onClick={() => runAction("commit")}
          title={!message.trim() ? "Enter a commit message" : "Commit"}
          type="button"
        >
          <Codicon name="check" size={14} />
          <span>Commit</span>
        </button>
        <button
          className={`vscode-button vscode-button--primary commit-input__chevron${
            commitToneDimmed ? " is-dimmed" : ""
          }`}
          onClick={() => setMenuOpen((value) => !value)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label="More commit actions"
          type="button"
        >
          <Codicon name="chevron-down" size={14} />
        </button>
        {menuOpen ? (
          <div className="dropdown-menu commit-input__menu" role="menu">
            {MENU.map((entry, index) => (
              <DropdownItem
                key={entry.id}
                entry={entry}
                showSeparator={entry.separatorBefore && index > 0}
                onSelect={() => runAction(entry.id)}
              />
            ))}
          </div>
        ) : null}
      </div>
      {lastGitOutput ? (
        <details className="commit-input__output" open>
          <summary>Git hook / commit output</summary>
          <pre>{lastGitOutput}</pre>
        </details>
      ) : null}
      <StageAllCommitPrompt
        isOpen={stageAllPrompt !== null}
        onAlways={confirmStageAndCommit}
        onCancel={() => setStageAllPrompt(null)}
        onNever={() => setStageAllPrompt(null)}
        onYes={confirmStageAndCommit}
      />
    </div>
  );
}

function isCommitAction(action: CommitAction) {
  return (
    action === "commit" ||
    action === "commit-staged" ||
    action === "commit-push" ||
    action === "commit-sync"
  );
}

function StageAllCommitPrompt({
  isOpen,
  onAlways,
  onCancel,
  onNever,
  onYes
}: {
  isOpen: boolean;
  onAlways: () => void;
  onCancel: () => void;
  onNever: () => void;
  onYes: () => void;
}) {
  return (
    <Modal isOpen={isOpen} title="GitPulse" onClose={onCancel}>
      <div className="stage-all-prompt">
        <Codicon name="warning" size={44} />
        <div className="stage-all-prompt__body">
          <p>There are no staged changes to commit.</p>
          <p>Would you like to stage all your changes and commit them directly?</p>
        </div>
      </div>
      <div className="stage-all-prompt__actions">
        <button className="vscode-button" onClick={onNever} type="button">
          Never
        </button>
        <button className="vscode-button" onClick={onAlways} type="button">
          Always
        </button>
        <button className="vscode-button" onClick={onCancel} type="button">
          Cancel
        </button>
        <button className="vscode-button vscode-button--primary" onClick={onYes} type="button">
          Yes
        </button>
      </div>
    </Modal>
  );
}

function DropdownItem({
  entry,
  showSeparator,
  onSelect
}: {
  entry: MenuEntry;
  showSeparator: boolean | undefined;
  onSelect: () => void;
}) {
  return (
    <>
      {showSeparator ? <div className="dropdown-menu__separator" role="separator" /> : null}
      <button
        className="dropdown-menu__item"
        onClick={onSelect}
        role="menuitem"
        type="button"
      >
        {entry.label}
      </button>
    </>
  );
}

function readHistory(key: string) {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function writeHistory(key: string, value: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage failures; history is convenience state.
  }
}
