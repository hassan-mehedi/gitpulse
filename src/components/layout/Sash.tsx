import { useCallback, useEffect, useRef } from "react";

interface SashProps {
  /** Current width in pixels. */
  value: number;
  /** Called with the new width (already clamped to [min, max]). */
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  /** Optional class for styling overrides. */
  className?: string;
}

/**
 * A 4 px vertical drag handle that resizes whatever's to its LEFT. Mirrors
 * VS Code's sash visuals: invisible at rest, a 1 px accent line on hover and
 * during drag.
 */
export function Sash({ value, onChange, min = 170, max = 720, className }: SashProps) {
  const startXRef = useRef(0);
  const startValueRef = useRef(value);
  const draggingRef = useRef(false);

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (!draggingRef.current) return;
      const delta = event.clientX - startXRef.current;
      const next = Math.max(min, Math.min(max, startValueRef.current + delta));
      onChange(next);
    },
    [min, max, onChange]
  );

  const handlePointerUp = useCallback(() => {
    draggingRef.current = false;
    document.body.classList.remove("is-resizing-sidebar");
  }, []);

  useEffect(() => {
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    draggingRef.current = true;
    startXRef.current = event.clientX;
    startValueRef.current = value;
    document.body.classList.add("is-resizing-sidebar");
    event.preventDefault();
  }

  return (
    <div
      className={`sash sash--vertical${className ? ` ${className}` : ""}`}
      onPointerDown={handlePointerDown}
      role="separator"
      aria-orientation="vertical"
    />
  );
}
