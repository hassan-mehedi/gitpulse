import { useEffect } from "react";
import type { ReactNode } from "react";
import { Codicon } from "./Codicon";

interface ModalProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function Modal({ isOpen, title, onClose, children }: ModalProps) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <section
        aria-modal="true"
        className="modal-card"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="modal-card__header">
          <div className="modal-card__title">{title}</div>
          <button
            className="icon-button"
            onClick={onClose}
            title="Close"
            aria-label="Close"
            type="button"
          >
            <Codicon name="close" size={14} />
          </button>
        </div>
        <div className="modal-card__body">{children}</div>
      </section>
    </div>
  );
}
