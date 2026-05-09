import { useRepo } from "../../hooks/useRepo";

export function RepoSelector() {
  const { activeRepo, repositories, setActiveRepo } = useRepo();

  return (
    <select
      className="select-input"
      value={activeRepo?.id ?? ""}
      onChange={(event) => setActiveRepo(event.target.value)}
    >
      {repositories.length === 0 ? (
        <option value="">No repository loaded</option>
      ) : null}
      {repositories.map((repo) => (
        <option key={repo.id} value={repo.id}>
          {repo.name} ({repo.branch})
        </option>
      ))}
    </select>
  );
}
