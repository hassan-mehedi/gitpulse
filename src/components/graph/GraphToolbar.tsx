import { Codicon } from "../shared/Codicon";

interface GraphToolbarProps {
  query: string;
  onQueryChange: (value: string) => void;
  onReload: () => void;
}

export function GraphToolbar({ query, onQueryChange, onReload }: GraphToolbarProps) {
  return (
    <div className="graph-toolbar">
      <div className="graph-toolbar__filter">
        <Codicon name="search" size={14} />
        <input
          className="graph-toolbar__input"
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search commits, authors, refs"
          value={query}
        />
      </div>
      <button
        className="view-action"
        onClick={onReload}
        title="Reload"
        type="button"
      >
        <Codicon name="refresh" size={16} />
      </button>
    </div>
  );
}
