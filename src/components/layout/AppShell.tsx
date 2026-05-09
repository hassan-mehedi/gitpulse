import { useState } from "react";
import { ActivityBar } from "./ActivityBar";
import { Toolbar } from "./Toolbar";
import { StatusBar } from "./StatusBar";
import { SourceControlPanel } from "../source-control/SourceControlPanel";
import { DiffViewer } from "../diff/DiffViewer";
import { ToastViewport } from "../shared/ToastViewport";
import type { ActivityView } from "../../types/git";
import { BranchManager } from "../branches/BranchManager";
import { SettingsPanel } from "../settings/SettingsPanel";
import { CommitGraph } from "../graph/CommitGraph";

export function AppShell() {
  const [activeView, setActiveView] = useState<ActivityView>("source-control");

  return (
    <div className="app-shell">
      <Toolbar activeView={activeView} onNavigate={setActiveView} />
      <div className="main-layout">
        <ActivityBar activeView={activeView} onNavigate={setActiveView} />
        <section className="left-panel">
          {activeView === "branches" ? (
            <BranchManager />
          ) : activeView === "settings" ? (
            <SettingsPanel />
          ) : (
            <SourceControlPanel activeView={activeView} />
          )}
        </section>
        <section className="content-panel">
          {activeView === "graph" ? <CommitGraph /> : <DiffViewer activeView={activeView} />}
        </section>
      </div>
      <StatusBar />
      <ToastViewport />
    </div>
  );
}
