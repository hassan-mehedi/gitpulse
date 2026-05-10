import { Codicon } from "../shared/Codicon";
import { useRepo } from "../../hooks/useRepo";

interface ToolbarProps {
  /** Reserved for future quickpick integration. Title bar no longer triggers view nav. */
}

export function Toolbar(_props: ToolbarProps) {
  const { activeRepo } = useRepo();
  const title = activeRepo ? `${activeRepo.name} — GitPulse` : "GitPulse";

  return (
    <header className="title-bar">
      <div className="title-bar__brand">
        <Codicon name="source-control" size={14} />
        <span className="title-bar__title">{title}</span>
      </div>

      <div className="title-bar__center" aria-hidden />

      <div className="title-bar__window-controls">
        {/* Tauri's window decoration is OS-native by default;
            these slots stay empty unless we move to client-side decorations. */}
      </div>
    </header>
  );
}
