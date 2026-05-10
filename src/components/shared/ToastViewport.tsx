import { useEffect } from "react";
import { useNotificationStore } from "../../stores/notifications";

export function ToastViewport() {
  const items = useNotificationStore((state) => state.items);
  const removeNotification = useNotificationStore((state) => state.removeNotification);

  useEffect(() => {
    if (items.length === 0) {
      return;
    }

    // Capture the ID of the oldest toast at effect time. Using items[0].id rather
    // than items avoids resetting the timer whenever later toasts are added/removed.
    const oldestId = items[0].id;
    const timer = window.setTimeout(() => {
      removeNotification(oldestId);
    }, 3600);

    return () => {
      window.clearTimeout(timer);
    };
  }, [items[0]?.id, removeNotification]);

  return (
    <div
      style={{
        position: "fixed",
        top: 20,
        right: 20,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        zIndex: 50
      }}
    >
      {items.map((item) => (
        <div
          key={item.id}
          className={`toast toast--${item.tone}`}
          style={{
            minWidth: 280,
            padding: "14px 16px",
            borderRadius: 16,
            border: "1px solid var(--border-subtle)",
            background: "var(--bg-panel)",
            boxShadow: "var(--shadow-lg)"
          }}
        >
          <div style={{ fontWeight: 600 }}>{item.title}</div>
          <div style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>{item.message}</div>
        </div>
      ))}
    </div>
  );
}
