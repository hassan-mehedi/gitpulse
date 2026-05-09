import { Minus, Plus, RotateCcw } from "lucide-react";

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
        <button className="panel-button" onClick={onStageToggle} type="button">
          {staged ? <Minus size={14} /> : <Plus size={14} />}
          {staged ? "Unstage Hunk" : "Stage Hunk"}
        </button>
      ) : null}
      {canStageSelection ? (
        <button className="panel-button" onClick={onSelectionToggle} type="button">
          {staged ? <Minus size={14} /> : <Plus size={14} />}
          {staged ? "Unstage Selection" : "Stage Selection"}
        </button>
      ) : null}
      {canDiscard ? (
        <button className="panel-button" onClick={onDiscard} type="button">
          <RotateCcw size={14} />
          Discard Hunk
        </button>
      ) : null}
      {canStageSelection && !staged ? (
        <button className="panel-button" onClick={onSelectionDiscard} type="button">
          <RotateCcw size={14} />
          Discard Selection
        </button>
      ) : null}
    </div>
  );
}
