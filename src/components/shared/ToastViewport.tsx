import { useEffect } from "react";
import { useNotificationStore } from "../../stores/notifications";

export function ToastViewport() {
  const items = useNotificationStore((state) => state.items);
  const removeNotification = useNotificationStore((state) => state.removeNotification);

  useEffect(() => {
    if (items.length === 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      removeNotification(items[0].id);
    }, 3600);

    return () => {
      window.clearTimeout(timer);
    };
  }, [items, removeNotification]);

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
          style={{
            minWidth: 280,
            padding: "14px 16px",
            borderRadius: 16,
            border: "1px solid var(--border-subtle)",
            background: "rgba(10, 17, 24, 0.94)",
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
