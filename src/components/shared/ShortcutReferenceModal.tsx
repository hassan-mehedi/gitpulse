import { Modal } from "./Modal";

const shortcuts = [
  ["Ctrl+Shift+G", "Focus Source Control"],
  ["Ctrl+Enter", "Commit from message box"],
  ["Ctrl+Shift+Enter", "Commit all from message box"],
  ["Ctrl+Shift+.", "Stage selected file"],
  ["Ctrl+Shift+,", "Unstage selected file"],
  ["Ctrl+Shift+Z", "Undo last commit"],
  ["Ctrl+Shift+B", "Open branch picker"],
  ["Ctrl+Shift+N", "Open branch creation"],
  ["Ctrl+Shift+P", "Push"],
  ["Ctrl+Shift+L", "Pull"],
  ["Ctrl+Shift+F", "Fetch"],
  ["Alt+ArrowUp / Alt+ArrowDown", "Navigate hunks in diff"],
  ["Ctrl+K Ctrl+S", "Open shortcuts reference"]
] as const;

interface ShortcutReferenceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShortcutReferenceModal({ isOpen, onClose }: ShortcutReferenceModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Keyboard Shortcuts">
      <div className="shortcut-list">
        {shortcuts.map(([shortcut, description]) => (
          <div className="shortcut-list__row" key={shortcut}>
            <code>{shortcut}</code>
            <span>{description}</span>
          </div>
        ))}
      </div>
    </Modal>
  );
}
