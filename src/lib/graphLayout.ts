import type { CommitInfo, GraphEdge, GraphNode } from "../types/git";

export function buildGraphNodes(commits: CommitInfo[]): GraphNode[] {
  const laneBySha = new Map<string, number>();
  const activeLanes: Array<string | null> = [];

  return commits.map((commit) => {
    const lane = ensureLane(commit.sha, laneBySha, activeLanes);
    const connections: GraphEdge[] = [];

    if (commit.parents.length === 0) {
      activeLanes[lane] = null;
    } else {
      commit.parents.forEach((parent, index) => {
        const parentLane =
          index === 0 ? lane : ensureLane(parent, laneBySha, activeLanes);

        laneBySha.set(parent, parentLane);
        activeLanes[parentLane] = parent;
        connections.push({
          fromLane: lane,
          toLane: parentLane,
          type:
            index === 0
              ? lane === parentLane
                ? "straight"
                : "fork"
              : "merge"
        });
      });
    }

    laneBySha.delete(commit.sha);
    trimTrailingEmptyLanes(activeLanes);

    return {
      sha: commit.sha,
      shortSha: commit.shortSha,
      parents: commit.parents,
      refs: commit.refs,
      message: commit.message,
      author: commit.author,
      date: commit.date,
      lane,
      connections
    };
  });
}

function ensureLane(
  sha: string,
  laneBySha: Map<string, number>,
  activeLanes: Array<string | null>
) {
  const existing = laneBySha.get(sha);
  if (existing !== undefined) {
    return existing;
  }

  const emptyLane = activeLanes.findIndex((value) => value === null || value === undefined);
  const lane = emptyLane === -1 ? activeLanes.length : emptyLane;
  activeLanes[lane] = sha;
  laneBySha.set(sha, lane);
  return lane;
}

function trimTrailingEmptyLanes(activeLanes: Array<string | null>) {
  while (activeLanes.length > 0 && activeLanes[activeLanes.length - 1] === null) {
    activeLanes.pop();
  }
}
