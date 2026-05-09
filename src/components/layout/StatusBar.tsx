import { useRepo } from "../../hooks/useRepo";

export function StatusBar() {
  const { activeRepo } = useRepo();
  const changes = (activeRepo?.changes.length ?? 0) + (activeRepo?.staged.length ?? 0);

  return (
    <footer className="status-bar">
      <div className="status-bar__group">
        <span>{activeRepo?.branch ?? "No repo"}</span>
        <span>
          ↑{activeRepo?.ahead ?? 0} ↓{activeRepo?.behind ?? 0}
        </span>
        <span>{changes} changes</span>
      </div>
      <div className="status-bar__group">
        <span>{activeRepo?.upstream ?? "No upstream"}</span>
        <span>UTF-8</span>
      </div>
    </footer>
  );
}
