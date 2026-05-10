interface ProgressBarProps {
  value?: number;
  status: "started" | "running" | "completed" | "failed";
}

export function ProgressBar({ value, status }: ProgressBarProps) {
  return (
    <div className={`progress-bar ${status === "failed" ? "is-failed" : ""}`}>
      <div
        className={`progress-bar__fill ${value == null ? "is-indeterminate" : ""}`}
        style={value == null ? undefined : { width: `${Math.max(4, Math.min(value, 100))}%` }}
      />
    </div>
  );
}
