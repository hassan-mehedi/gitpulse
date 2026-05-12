import { useEffect, useRef, useState } from "react";
import { Codicon } from "../shared/Codicon";
import {
  gitCommit,
  gitCommitAll,
  gitCommitAmend,
  gitPush,
  gitStashPush,
  gitSync,
  gitUndoLastCommit
} from "../../lib/git";
import { useGit } from "../../hooks/useGit";
import { useWorkspaceStore } from "../../stores/workspace";
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
  | "amend"
  | "stash"
  | "stash-untracked"
  | "stash-all";

interface MenuEntry {
  id: CommitAction;
  label: string;
  separatorBefore?: boolean;
  needsMessage?: boolean;
}

const MENU: MenuEntry[] = [
  { id: "commit", label: "Commit", needsMessage: true },
  { id: "commit-staged", label: "Commit Staged", needsMessage: true },
  { id: "commit-all", label: "Commit All", needsMessage: true },
  { id: "commit-push", label: "Commit Staged & Push", needsMessage: true },
  { id: "commit-sync", label: "Commit Staged & Sync", needsMessage: true },
  { id: "undo", label: "Undo Last Commit", separatorBefore: true },
  { id: "amend", label: "Amend Last Commit" },
  { id: "stash", label: "Stash", separatorBefore: true },
  { id: "stash-untracked", label: "Stash (Include Untracked)" },
  { id: "stash-all", label: "Stash All" }
];

export function CommitInput({ repo }: CommitInputProps) {
  const [message, setMessage] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const runGit = useGit();
  const refreshRepo = useWorkspaceStore((state) => state.refreshRepo);
  const setActiveRepo = useWorkspaceStore((state) => state.setActiveRepo);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const maxHeight = 120;
    textarea.style.height = "0px";
    const nextHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${Math.max(nextHeight, 30)}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
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

    await runGit(async () => {
      switch (action) {
        case "commit":
        case "commit-staged":
          await gitCommit(repo.path, trimmed);
          break;
        case "commit-all":
          await gitCommitAll(repo.path, trimmed);
          break;
        case "commit-push":
          await gitCommit(repo.path, trimmed);
          await gitPush(repo.path);
          break;
        case "commit-sync":
          await gitCommit(repo.path, trimmed);
          await gitSync(repo.path);
          break;
        case "amend":
          await gitCommitAmend(repo.path, trimmed || undefined);
          break;
        case "undo":
          await gitUndoLastCommit(repo.path);
          break;
        case "stash":
          await gitStashPush(repo.path, trimmed || undefined, false);
          break;
        case "stash-untracked":
          await gitStashPush(repo.path, trimmed || undefined, true);
          break;
        case "stash-all":
          await gitStashPush(repo.path, trimmed || undefined, true);
          break;
      }

      if (action !== "undo") {
        setMessage("");
      }
      await refreshRepo(repo.path);
    });
  }

  function runAction(action: CommitAction) {
    setMenuOpen(false);
    void execute(action);
  }

  const placeholder = `Message (Ctrl+Enter to commit on '${repo.branch}')`;

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
          }
        }}
        placeholder={placeholder}
        rows={1}
        value={message}
      />
      <div className="commit-input__actions" ref={menuRef}>
        <button
          className="vscode-button vscode-button--primary commit-input__primary"
          onClick={() => runAction("commit")}
          type="button"
        >
          <Codicon name="check" size={14} />
          <span>Commit</span>
        </button>
        <button
          className="vscode-button vscode-button--primary commit-input__chevron"
          onClick={() => setMenuOpen((value) => !value)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label="More commit actions"
          type="button"
        >
          <Codicon name="chevron-down" size={14} />
        </button>
        {menuOpen ? (
          <div className="dropdown-menu" role="menu">
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
    </div>
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
