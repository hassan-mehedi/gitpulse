import type {
  CommitInfo,
  GraphEdge,
  GraphNode,
  LanePass
} from "../types/git";

interface LaneState {
  sha: string;
  colorId: number;
}

/**
 * Lay out commits into lanes for a VS Code–style commit graph.
 *
 * - Each commit reuses its first-parent's lane (the "trunk" of a branch).
 * - Secondary parents (merges) allocate a new lane or reuse the parent's
 *   pre-existing lane if one was already pending.
 * - Color ids are stable per branch chain: a child inherits its first-parent
 *   color, secondary parents get a fresh color. Recycled lane slots get a
 *   new color so a branch's color doesn't flicker when a slot is reused.
 */
export function buildGraphNodes(commits: CommitInfo[]): GraphNode[] {
  const laneBySha = new Map<string, number>();
  const colorBySha = new Map<string, number>();
  const activeLanes: Array<LaneState | null> = [];
  let nextColorId = 0;

  return commits.map((commit) => {
    const ownColorId =
      colorBySha.get(commit.sha) ??
      (() => {
        const id = nextColorId++;
        colorBySha.set(commit.sha, id);
        return id;
      })();

    const lane = ensureLane(commit.sha, ownColorId, laneBySha, activeLanes);

    const lanesIn: LanePass[] = activeLanes
      .map((state, index) =>
        state ? { lane: index, colorId: state.colorId } : null
      )
      .filter((value): value is LanePass => value !== null);

    const connections: GraphEdge[] = [];

    if (commit.parents.length === 0) {
      activeLanes[lane] = null;
    } else {
      commit.parents.forEach((parent, index) => {
        const isFirstParent = index === 0;
        // First parent inherits this commit's color (branch trunk continues).
        // Secondary parents get a fresh color id so the merged-in branch is
        // visually distinct.
        const parentColor = isFirstParent
          ? ownColorId
          : colorBySha.get(parent) ?? nextColorId++;
        colorBySha.set(parent, parentColor);

        const parentLane = isFirstParent
          ? lane
          : ensureLane(parent, parentColor, laneBySha, activeLanes);

        laneBySha.set(parent, parentLane);
        activeLanes[parentLane] = { sha: parent, colorId: parentColor };
        connections.push({
          fromLane: lane,
          toLane: parentLane,
          type: isFirstParent
            ? lane === parentLane
              ? "straight"
              : "fork"
            : "merge",
          colorId: parentColor,
          isFirstParent
        });
      });
    }

    laneBySha.delete(commit.sha);
    trimTrailingEmptyLanes(activeLanes);

    const lanesOut: LanePass[] = activeLanes
      .map((state, index) =>
        state ? { lane: index, colorId: state.colorId } : null
      )
      .filter((value): value is LanePass => value !== null);

    return {
      sha: commit.sha,
      shortSha: commit.shortSha,
      parents: commit.parents,
      refs: commit.refs,
      message: commit.message,
      author: commit.author,
      authorEmail: commit.authorEmail,
      date: commit.date,
      signature: commit.signature,
      lane,
      colorId: ownColorId,
      connections,
      lanesIn,
      lanesOut,
      isMerge: commit.parents.length > 1
    };
  });
}

function ensureLane(
  sha: string,
  colorId: number,
  laneBySha: Map<string, number>,
  activeLanes: Array<LaneState | null>
) {
  const existing = laneBySha.get(sha);
  if (existing !== undefined) {
    return existing;
  }

  const emptyLane = activeLanes.findIndex(
    (value) => value === null || value === undefined
  );
  const lane = emptyLane === -1 ? activeLanes.length : emptyLane;
  activeLanes[lane] = { sha, colorId };
  laneBySha.set(sha, lane);
  return lane;
}

function trimTrailingEmptyLanes(activeLanes: Array<LaneState | null>) {
  while (
    activeLanes.length > 0 &&
    activeLanes[activeLanes.length - 1] === null
  ) {
    activeLanes.pop();
  }
}
