import { useState } from "react";
import { Check, PenSquare, Undo2 } from "lucide-react";
import { gitCommit, gitCommitAll, gitCommitAmend, gitUndoLastCommit } from "../../lib/git";
import { useGit } from "../../hooks/useGit";
import { useWorkspaceStore } from "../../stores/workspace";
import type { Repository } from "../../types/git";

interface CommitInputProps {
  repo: Repository;
}

export function CommitInput({ repo }: CommitInputProps) {
  const [message, setMessage] = useState("");
  const runGit = useGit();
  const refreshRepo = useWorkspaceStore((state) => state.refreshRepo);

  async function handleCommit(action: "commit" | "commit-all" | "amend") {
    if (!message.trim() && action !== "amend") {
      return;
    }

    await runGit(async () => {
      if (action === "commit") {
        await gitCommit(repo.path, message.trim());
      } else if (action === "commit-all") {
        await gitCommitAll(repo.path, message.trim());
      } else {
        await gitCommitAmend(repo.path, message.trim() || undefined);
      }
      setMessage("");
      await refreshRepo(repo.path);
    });
  }

  async function handleUndo() {
    await runGit(async () => {
      await gitUndoLastCommit(repo.path);
      await refreshRepo(repo.path);
    });
  }

  return (
    <section className="repo-card__section">
      <div className="repo-card__section-header">
        <span>Commit</span>
      </div>
      <textarea
        className="commit-textarea"
        placeholder="Write a commit message"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
      />
      <div className="toolbar__actions">
        <button className="panel-button" onClick={() => void handleCommit("commit")} type="button">
          <Check size={15} /> Commit
        </button>
        <button className="panel-button" onClick={() => void handleCommit("commit-all")} type="button">
          <Check size={15} /> Commit All
        </button>
        <button className="panel-button" onClick={() => void handleCommit("amend")} type="button">
          <PenSquare size={15} /> Amend
        </button>
        <button className="panel-button" onClick={() => void handleUndo()} type="button">
          <Undo2 size={15} /> Undo
        </button>
      </div>
    </section>
  );
}
