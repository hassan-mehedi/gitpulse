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
    <div className="toast-viewport">
      {items.map((item) => (
        <div key={item.id} className={`toast toast--${item.tone}`}>
          <div className="toast__title">{item.title}</div>
          <div className="toast__message">{item.message}</div>
        </div>
      ))}
    </div>
  );
}
