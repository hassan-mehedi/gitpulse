import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AppErrorBoundary } from "./components/shared/AppErrorBoundary";
import { RuntimeErrorMonitor } from "./components/shared/RuntimeErrorMonitor";
import "@vscode/codicons/dist/codicon.css";
import "./styles/globals.css";
import "./styles/diff.css";
import "./styles/graph.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
      <RuntimeErrorMonitor />
    </AppErrorBoundary>
  </React.StrictMode>
);
