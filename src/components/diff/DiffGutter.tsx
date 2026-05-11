import { Codicon } from "../shared/Codicon";

interface DiffGutterProps {
  staged: boolean;
  canStage: boolean;
  canDiscard: boolean;
  canStageSelection: boolean;
  onStageToggle: () => void;
  onDiscard: () => void;
  onSelectionToggle: () => void;
  onSelectionDiscard: () => void;
}

export function DiffGutter({
  staged,
  canStage,
  canDiscard,
  canStageSelection,
  onStageToggle,
  onDiscard,
  onSelectionToggle,
  onSelectionDiscard
}: DiffGutterProps) {
  return (
    <div className="diff-gutter">
      {canStage ? (
        <button className="vscode-button" onClick={onStageToggle} type="button">
          <Codicon name={staged ? "remove" : "add"} size={14} />
          {staged ? "Unstage Hunk" : "Stage Hunk"}
        </button>
      ) : null}
      {canStageSelection ? (
        <button className="vscode-button" onClick={onSelectionToggle} type="button">
          <Codicon name={staged ? "remove" : "add"} size={14} />
          {staged ? "Unstage Selection" : "Stage Selection"}
        </button>
      ) : null}
      {canDiscard ? (
        <button className="vscode-button" onClick={onDiscard} type="button">
          <Codicon name="discard" size={14} />
          Discard Hunk
        </button>
      ) : null}
      {canStageSelection && !staged ? (
        <button className="vscode-button" onClick={onSelectionDiscard} type="button">
          <Codicon name="discard" size={14} />
          Discard Selection
        </button>
      ) : null}
    </div>
  );
}
