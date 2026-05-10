import { useEffect, useRef } from "react";

export interface ContextMenuItem {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  danger?: boolean;
}

interface ContextMenuProps {
  items: ContextMenuItem[];
  position: { x: number; y: number } | null;
  onClose: () => void;
}

export function ContextMenu({ items, position, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!position) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (ref.current?.contains(event.target as Node)) {
        return;
      }
      onClose();
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", onClose);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose, position]);

  if (!position) {
    return null;
  }

  return (
    <div
      className="context-menu"
      onContextMenu={(event) => event.preventDefault()}
      ref={ref}
      style={{ left: position.x, top: position.y }}
    >
      {items.map((item) => (
        <button
          className={`context-menu__item ${item.danger ? "is-danger" : ""}`}
          disabled={item.disabled}
          key={item.label}
          onClick={() => {
            if (item.disabled) {
              return;
            }
            item.onSelect();
            onClose();
          }}
          type="button"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
