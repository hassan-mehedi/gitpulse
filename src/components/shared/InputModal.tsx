import { useEffect, useRef, useState } from "react";
import { Modal } from "./Modal";

interface InputModalProps {
  isOpen: boolean;
  title: string;
  label: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  /** Optional validator. Returns an error string to display, or null/undefined when valid. */
  validate?: (value: string) => string | null | undefined;
  onSubmit: (value: string) => void;
  onClose: () => void;
}

/**
 * VS Code-style text-input prompt. Replaces window.prompt() for branch / tag /
 * worktree create / rename flows so they share the workbench look.
 */
export function InputModal({
  isOpen,
  title,
  label,
  placeholder,
  initialValue = "",
  confirmLabel = "OK",
  validate,
  onSubmit,
  onClose
}: InputModalProps) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Reset state every time the modal reopens.
  useEffect(() => {
    if (isOpen) {
      setValue(initialValue);
      setError(null);
      // Defer focus until the modal is mounted.
      window.setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    }
  }, [isOpen, initialValue]);

  function handleSubmit(event?: React.FormEvent) {
    event?.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Value is required");
      return;
    }
    if (validate) {
      const message = validate(trimmed);
      if (message) {
        setError(message);
        return;
      }
    }
    onSubmit(trimmed);
    onClose();
  }

  return (
    <Modal isOpen={isOpen} title={title} onClose={onClose}>
      <form onSubmit={handleSubmit} className="input-modal">
        <label className="input-modal__label">
          <span>{label}</span>
          <input
            ref={inputRef}
            className="input-modal__input"
            onChange={(event) => {
              setValue(event.target.value);
              if (error) setError(null);
            }}
            placeholder={placeholder}
            type="text"
            value={value}
          />
        </label>
        {error ? <div className="input-modal__error">{error}</div> : null}
        <div className="input-modal__actions">
          <button
            className="vscode-button"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="vscode-button vscode-button--primary"
            type="submit"
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
