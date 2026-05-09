interface GraphToolbarProps {
  query: string;
  onQueryChange: (value: string) => void;
  onReload: () => void;
}

export function GraphToolbar({ query, onQueryChange, onReload }: GraphToolbarProps) {
  return (
    <div className="diff-viewer__header">
      <div>
        <div>Commit Graph</div>
        <div className="diff-viewer__meta">Topo-ordered history across all refs</div>
      </div>
      <div className="toolbar__actions">
        <input
          className="text-input"
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search commits"
          value={query}
        />
        <button className="panel-button" onClick={onReload} type="button">
          Reload
        </button>
      </div>
    </div>
  );
}
