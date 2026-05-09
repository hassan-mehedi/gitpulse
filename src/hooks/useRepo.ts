import { useWorkspaceStore } from "../stores/workspace";

export function useRepo() {
  return useWorkspaceStore((state) => {
    const activeRepo = state.repositories.find((repo) => repo.id === state.activeRepoId) ?? null;
    return {
      activeRepo,
      repositories: state.repositories,
      setActiveRepo: state.setActiveRepo
    };
  });
}
