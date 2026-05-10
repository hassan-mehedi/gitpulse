import { useEffect, useState } from "react";

interface RuntimeFailure {
  title: string;
  message: string;
}

export function RuntimeErrorMonitor() {
  const [failure, setFailure] = useState<RuntimeFailure | null>(null);

  useEffect(() => {
    function handleError(event: ErrorEvent) {
      const detail =
        event.error instanceof Error
          ? event.error.stack ?? event.error.message
          : event.message || "Unknown runtime error";

      console.error("GitPulse window error", event.error ?? event.message);
      setFailure({
        title: "Runtime Error",
        message: detail
      });
    }

    function handleRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      let serializedReason = "Unknown rejection";
      if (typeof reason === "string") {
        serializedReason = reason;
      } else {
        try {
          serializedReason = JSON.stringify(reason, null, 2);
        } catch {
          serializedReason = String(reason);
        }
      }

      const detail =
        reason instanceof Error
          ? reason.stack ?? reason.message
          : serializedReason;

      console.error("GitPulse unhandled rejection", reason);
      setFailure({
        title: "Unhandled Promise Rejection",
        message: detail
      });
    }

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  if (!failure) {
    return null;
  }

  return (
    <div
      className="fatal-screen fatal-screen--overlay"
      onClick={() => setFailure(null)}
    >
      <div
        className="fatal-screen__card"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
      >
        <div className="fatal-screen__eyebrow">{failure.title}</div>
        <div className="fatal-screen__title">GitPulse hit a runtime failure.</div>
        <pre className="fatal-screen__body">{failure.message}</pre>
        <div style={{ marginTop: 16, textAlign: "right" }}>
          <button
            className="panel-button"
            onClick={() => setFailure(null)}
            type="button"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
