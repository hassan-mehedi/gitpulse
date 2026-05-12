import { Codicon } from "../shared/Codicon";
import { useRepo } from "../../hooks/useRepo";
import { pickRepositoryDirectory } from "../../lib/openTarget";
import { useWorkspaceStore } from "../../stores/workspace";

export function RepoSelector() {
  const { activeRepo, repositories, setActiveRepo } = useRepo();
  const loadTarget = useWorkspaceStore((state) => state.loadTarget);
  const addTarget = useWorkspaceStore((state) => state.addTarget);
  const isLoading = useWorkspaceStore((state) => state.isLoading);

  async function handleOpenRepository() {
    const selection = await pickRepositoryDirectory();
    if (!selection) {
      return;
    }

    await loadTarget(selection).catch(() => {});
  }

  async function handleAddRepository() {
    const selection = await pickRepositoryDirectory();
    if (!selection) {
      return;
    }

    await addTarget(selection).catch(() => {});
  }

  return (
    <div className="repo-selector">
      <select
        className="select-input repo-selector__select"
        value={activeRepo?.id ?? ""}
        onChange={(event) => setActiveRepo(event.target.value)}
        disabled={repositories.length === 0}
        aria-label="Active repository"
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
      <button
        className="title-bar__action"
        onClick={() => void handleOpenRepository()}
        title="Open repository"
        aria-label="Open repository"
        type="button"
        disabled={isLoading}
      >
        <Codicon name="folder-opened" size={14} />
      </button>
      <button
        className="title-bar__action"
        onClick={() => void handleAddRepository()}
        title="Add repository"
        aria-label="Add repository"
        type="button"
        disabled={isLoading}
      >
        <Codicon name="add" size={14} />
      </button>
    </div>
  );
}
