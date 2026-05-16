import { useEffect, useRef, useState } from "react";
import { Codicon } from "../shared/Codicon";
import { Modal } from "../shared/Modal";
import {
  gitCommit,
  gitCommitAll,
  gitCommitAmend,
  gitPatchCreate,
  gitPush,
  gitStageFiles,
  gitSync,
  gitUndoLastCommit
} from "../../lib/git";
import { useGit } from "../../hooks/useGit";
import { useSettingsStore } from "../../stores/settings";
import { useWorkspaceStore } from "../../stores/workspace";
import { resolveCommitIdentity } from "../../lib/commitIdentity";
import { generateCommitMessage, prepareAiDiffContext } from "../../lib/aiCommit";
import { createId } from "../../lib/ids";
import { useNotificationStore } from "../../stores/notifications";
import { progressId, useProgressStore } from "../../stores/progress";
import { useCommitDraftStore } from "../../stores/commitDrafts";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [history, setHistory] = useState<string[]>(() => readHistory(historyKey));
  const [historyCursor, setHistoryCursor] = useState<number | null>(null);
  const [stageAllPrompt, setStageAllPrompt] = useState<CommitAction | null>(null);
  const [isGeneratingMessage, setIsGeneratingMessage] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const runGit = useGit();
  const smartCommit = useSettingsStore((state) => state.smartCommit);
  const stageAllOnCommit = useSettingsStore((state) => state.stageAllOnCommit);
  const setStageAllOnCommit = useSettingsStore((state) => state.setStageAllOnCommit);
  const signCommits = useSettingsStore((state) => state.signCommits);
  const commitIdentities = useSettingsStore((state) => state.commitIdentities);
  const repoIdentityAssignments = useSettingsStore((state) => state.repoIdentityAssignments);
  const aiCommitEnabled = useSettingsStore((state) => state.aiCommitEnabled);
  const aiCommitProvider = useSettingsStore((state) => state.aiCommitProvider);
  const aiCommitApiKey = useSettingsStore((state) => state.aiCommitApiKey);
  const aiCommitBaseUrl = useSettingsStore((state) => state.aiCommitBaseUrl);
  const aiCommitModel = useSettingsStore((state) => state.aiCommitModel);
  const aiCommitStyle = useSettingsStore((state) => state.aiCommitStyle);
  const aiCommitIncludeBody = useSettingsStore((state) => state.aiCommitIncludeBody);
  const aiCommitMaxDiffChars = useSettingsStore((state) => state.aiCommitMaxDiffChars);
  const refreshRepo = useWorkspaceStore((state) => state.refreshRepo);
  const setActiveRepo = useWorkspaceStore((state) => state.setActiveRepo);
  const pushNotification = useNotificationStore((state) => state.pushNotification);
  const upsertProgress = useProgressStore((state) => state.upsertProgress);
  const removeProgress = useProgressStore((state) => state.removeProgress);
  const message = useCommitDraftStore((state) => state.drafts[repo.path] ?? "");
  const setDraft = useCommitDraftStore((state) => state.setDraft);
  const clearDraft = useCommitDraftStore((state) => state.clearDraft);
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
          clearDraft(repo.path);
        }
        setHistoryCursor(null);
        await refreshRepo(repo.path);
      });
    } catch {
      // useGit already surfaces commit failures through notifications.
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
      if (stageAllOnCommit === "always") {
        void executeCommitAction(action, message.trim(), true);
        return;
      }
      if (stageAllOnCommit === "ask") {
        setStageAllPrompt(action);
        return;
      }
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
    setDraft(repo.path, history[next] ?? "");
    window.setTimeout(() => textareaRef.current?.setSelectionRange(0, 0), 0);
  }

  async function generateMessage() {
    const startedAt = performance.now();
    const generationProgress = {
      repoPath: repo.path,
      operation: "generate commit message",
      command: [],
      message: "Preparing staged diff",
      status: "started" as const
    };
    setIsGeneratingMessage(true);
    upsertProgress(generationProgress);
    emitAiOutput(generationProgress);
    try {
      const patch = await gitPatchCreate(repo.path, true);
      if (!patch.patch.trim()) {
        throw new Error("Stage changes before generating a commit message.");
      }
      const preparedDiff = prepareAiDiffContext(patch.patch, aiCommitMaxDiffChars);
      emitAiOutput({
        ...generationProgress,
        message: `Prepared staged diff: ${patch.patch.length.toLocaleString()} chars across all files, sending ${preparedDiff.length.toLocaleString()} chars to ${formatAiProvider(aiCommitProvider)} model ${aiCommitModel || "(unset)"}`,
        status: "running"
      });
      upsertProgress({
        ...generationProgress,
        message: `Waiting for ${formatAiProvider(aiCommitProvider)}`,
        status: "running"
      });
      const generated = await generateCommitMessage(patch.patch, {
        provider: aiCommitProvider,
        apiKey: aiCommitApiKey,
        baseUrl: aiCommitBaseUrl,
        model: aiCommitModel,
        style: aiCommitStyle,
        includeBody: aiCommitIncludeBody,
        maxDiffChars: aiCommitMaxDiffChars
      });
      setDraft(
        repo.path,
        generated.body ? `${generated.subject}\n\n${generated.body}` : generated.subject
      );
      emitAiOutput({
        ...generationProgress,
        message: `Completed in ${formatElapsed(startedAt)}: ${generated.subject}`,
        percent: 100,
        status: "completed"
      });
      pushNotification({
        id: createId(),
        tone: "info",
        title: "Commit message generated",
        message: generated.subject
      });
    } catch (error) {
      const detail = (error as Error).message || String(error);
      emitAiOutput({
        ...generationProgress,
        message: `Failed after ${formatElapsed(startedAt)}: ${detail}`,
        status: "failed"
      });
      pushNotification({
        id: createId(),
        tone: "error",
        title: "Commit message generation failed",
        message: detail
      });
    } finally {
      setIsGeneratingMessage(false);
      removeProgress(progressId(generationProgress));
    }
  }

  const placeholder = `Message (Ctrl+Enter to commit on '${repo.branch}')`;
  const commitToneDimmed = !hasCommitMessage;

  return (
    <div className="commit-input">
      <div className="commit-input__editor">
        <textarea
          className="commit-input__textarea"
          ref={textareaRef}
          onChange={(event) => setDraft(repo.path, event.target.value)}
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
        {aiCommitEnabled ? (
          <button
            className="commit-input__generate"
            disabled={isGeneratingMessage}
            onClick={() => void generateMessage()}
            title="Generate commit message from staged changes"
            type="button"
          >
            <Codicon name={isGeneratingMessage ? "sync~spin" : "rocket"} size={14} />
          </button>
        ) : null}
      </div>
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
      <StageAllCommitPrompt
        isOpen={stageAllPrompt !== null}
        onAlways={() => {
          setStageAllOnCommit("always");
          confirmStageAndCommit();
        }}
        onCancel={() => setStageAllPrompt(null)}
        onNever={() => {
          setStageAllOnCommit("never");
          setStageAllPrompt(null);
        }}
        onYes={confirmStageAndCommit}
      />
    </div>
  );
}

function formatAiProvider(provider: string) {
  if (provider === "ollama") return "Ollama";
  if (provider === "openai") return "OpenAI";
  if (provider === "anthropic") return "Anthropic";
  if (provider === "deepseek") return "DeepSeek";
  return "AI provider";
}

function formatElapsed(startedAt: number) {
  return `${((performance.now() - startedAt) / 1000).toFixed(1)}s`;
}

function emitAiOutput(payload: {
  repoPath: string;
  operation: string;
  command: string[];
  message: string;
  percent?: number;
  status: "started" | "running" | "completed" | "failed";
}) {
  window.dispatchEvent(
    new CustomEvent("gitpulse:output", {
      detail: payload
    })
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
