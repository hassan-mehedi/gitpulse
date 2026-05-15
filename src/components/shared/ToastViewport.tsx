import { useEffect } from "react";
import { useNotificationStore } from "../../stores/notifications";
import { useProgressStore } from "../../stores/progress";
import { ProgressBar } from "./ProgressBar";

export function ToastViewport() {
  const items = useNotificationStore((state) => state.items);
  const removeNotification = useNotificationStore((state) => state.removeNotification);
  const progressItems = useProgressStore((state) => state.items);
  const activeProgressItems = progressItems.filter(
    (item) => item.status === "started" || item.status === "running"
  );

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
    <div className="toast-viewport">
      {activeProgressItems.map((item) => (
        <div key={item.id} className="toast toast--progress">
          <div className="toast__title">{item.operation}</div>
          <div className="toast__message">{item.message}</div>
          <ProgressBar value={item.percent ?? undefined} status={item.status} />
        </div>
      ))}
      {items.map((item) => (
        <div key={item.id} className={`toast toast--${item.tone}`}>
          <div className="toast__title">{item.title}</div>
          <div className="toast__message">{item.message}</div>
          {item.actionLabel && item.onAction ? (
            <button
              className="toast__action"
              onClick={() => {
                item.onAction?.();
                removeNotification(item.id);
              }}
              type="button"
            >
              {item.actionLabel}
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
