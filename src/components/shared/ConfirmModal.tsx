import { Modal } from "./Modal";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  body: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * VS Code-styled confirmation modal. Replaces window.confirm() for branch /
 * tag / worktree destructive operations.
 */
export function ConfirmModal({
  isOpen,
  title,
  body,
  confirmLabel = "OK",
  cancelLabel = "Cancel",
  danger = false,
  onConfirm,
  onClose
}: ConfirmModalProps) {
  return (
    <Modal isOpen={isOpen} title={title} onClose={onClose}>
      <div className="confirm-modal">
        <div className="confirm-modal__body">{body}</div>
        <div className="confirm-modal__actions">
          <button className="vscode-button" onClick={onClose} type="button">
            {cancelLabel}
          </button>
          <button
            className={`vscode-button vscode-button--primary${danger ? " vscode-button--danger" : ""}`}
            onClick={() => {
              onConfirm();
              onClose();
            }}
            type="button"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
