import { useEffect, useState } from "react";
import { Modal } from "../shared/Modal";
import { Codicon } from "../shared/Codicon";
import {
  gitListRebaseCandidates,
  gitRebaseInteractive,
  type RebaseCandidate
} from "../../lib/git";
import { useGit } from "../../hooks/useGit";

export type RebaseAction = "pick" | "reword" | "squash" | "fixup" | "edit" | "drop";

interface RebaseRow extends RebaseCandidate {
  action: RebaseAction;
  message: string;
}

interface InteractiveRebaseModalProps {
  isOpen: boolean;
  repoPath: string;
  baseSha: string;
  baseShortSha: string;
  onClose: () => void;
  onComplete: () => void;
}

export function InteractiveRebaseModal({
  isOpen,
  repoPath,
  baseSha,
  baseShortSha,
  onClose,
  onComplete
}: InteractiveRebaseModalProps) {
  const runGit = useGit();
  const [rows, setRows] = useState<RebaseRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    void runGit(async () => {
      const candidates = await gitListRebaseCandidates(repoPath, baseSha);
      if (cancelled) return;
      setRows(
        candidates.map((candidate) => ({
          ...candidate,
          action: "pick",
          message: candidate.subject
        }))
      );
      setIsLoading(false);
    }).catch((err) => {
      if (cancelled) return;
      setError(typeof err === "string" ? err : err?.message ?? "Failed to load commits");
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [baseSha, isOpen, repoPath, runGit]);

  function setAction(sha: string, action: RebaseAction) {
    setRows((current) =>
      current.map((row) => (row.sha === sha ? { ...row, action } : row))
    );
  }

  function setMessage(sha: string, message: string) {
    setRows((current) =>
      current.map((row) => (row.sha === sha ? { ...row, message } : row))
    );
  }

  function move(sha: string, direction: -1 | 1) {
    setRows((current) => {
      const idx = current.findIndex((row) => row.sha === sha);
      const target = idx + direction;
      if (idx < 0 || target < 0 || target >= current.length) return current;
      const next = current.slice();
      const [removed] = next.splice(idx, 1);
      next.splice(target, 0, removed);
      return next;
    });
  }

  async function handleApply() {
    if (rows.every((row) => row.action === "drop")) {
      setError("At least one commit must remain in the rebase todo.");
      return;
    }
    const firstNonDrop = rows.findIndex((row) => row.action !== "drop");
    if (firstNonDrop >= 0 && ["squash", "fixup"].includes(rows[firstNonDrop]!.action)) {
      setError("The first remaining commit cannot be squash or fixup.");
      return;
    }
    const missingMessage = rows.find(
      (row) =>
        (row.action === "reword" || row.action === "squash") &&
        row.message.trim().length === 0
    );
    if (missingMessage) {
      setError(`${missingMessage.action} ${missingMessage.shortSha} needs a commit message.`);
      return;
    }
    const todo = rows.map((row) => `${row.action} ${row.sha} ${row.subject}`);
    const messages = rows
      .filter((row) => row.action === "reword" || row.action === "squash")
      .map((row) => row.message.trim());
    setIsApplying(true);
    setError(null);
    try {
      await runGit(() => gitRebaseInteractive(repoPath, baseSha, todo, messages));
      setIsApplying(false);
      onComplete();
    } catch (err) {
      setIsApplying(false);
      const message = typeof err === "string" ? err : (err as { stderr?: string; message?: string })?.stderr ?? (err as { message?: string })?.message ?? "Rebase failed";
      setError(message);
    }
  }

  const keepCount = rows.filter((row) => row.action !== "drop").length;
  const dropCount = rows.filter((row) => row.action === "drop").length;

  return (
    <Modal
      isOpen={isOpen}
      title={`Interactive Rebase onto ${baseShortSha}`}
      onClose={isApplying ? () => {} : onClose}
      className="rebase-modal"
      bodyClassName="rebase-modal__body"
    >
      {isLoading ? (
        <div className="rebase-modal__loading">Loading commits…</div>
      ) : rows.length === 0 ? (
        <div className="rebase-modal__loading">
          No commits to rebase between {baseShortSha} and HEAD.
        </div>
      ) : (
        <>
          <div className="rebase-modal__hint">
            Reorder, pick, reword, squash, fixup, edit, or drop commits. Reword
            and squash use the message text shown under each selected commit.
          </div>
          <ul className="rebase-modal__list">
            {rows.map((row, index) => (
              <li
                key={row.sha}
                className={`rebase-row rebase-row--${row.action}`}
              >
                <div className="rebase-row__handle">
                  <button
                    className="icon-button"
                    onClick={() => move(row.sha, -1)}
                    disabled={index === 0}
                    title="Move up"
                    type="button"
                  >
                    <Codicon name="arrow-up" size={12} />
                  </button>
                  <button
                    className="icon-button"
                    onClick={() => move(row.sha, 1)}
                    disabled={index === rows.length - 1}
                    title="Move down"
                    type="button"
                  >
                    <Codicon name="arrow-down" size={12} />
                  </button>
                </div>
                <select
                  className="rebase-row__action"
                  value={row.action}
                  onChange={(event) =>
                    setAction(row.sha, event.target.value as RebaseAction)
                  }
                >
                  <option value="pick">pick</option>
                  <option value="reword">reword</option>
                  <option value="squash">squash</option>
                  <option value="fixup">fixup</option>
                  <option value="edit">edit</option>
                  <option value="drop">drop</option>
                </select>
                <span className="rebase-row__sha">{row.shortSha}</span>
                <span className="rebase-row__subject" title={row.subject}>
                  {row.subject}
                </span>
                <span className="rebase-row__author" title={row.author}>
                  {row.author}
                </span>
                {row.action === "reword" || row.action === "squash" ? (
                  <label className="rebase-row__message">
                    <span>
                      {row.action === "reword"
                        ? "New commit message"
                        : "Squashed commit message"}
                    </span>
                    <textarea
                      className="rebase-row__message"
                      value={row.message}
                      onChange={(event) => setMessage(row.sha, event.target.value)}
                      rows={3}
                    />
                  </label>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      )}

      {error ? <div className="rebase-modal__error">{error}</div> : null}

      <div className="rebase-modal__footer">
        <div className="rebase-modal__counts">
          {keepCount} kept · {dropCount} dropped
        </div>
        <button
          className="vscode-button"
          onClick={onClose}
          type="button"
          disabled={isApplying}
        >
          Cancel
        </button>
        <button
          className="vscode-button vscode-button--primary"
          onClick={() => void handleApply()}
          type="button"
          disabled={isApplying || keepCount === 0 || isLoading}
        >
          {isApplying ? "Rebasing…" : `Rebase ${keepCount} commit${keepCount === 1 ? "" : "s"}`}
        </button>
      </div>
    </Modal>
  );
}
