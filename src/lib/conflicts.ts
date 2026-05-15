export type ConflictChoice =
  | "ours"
  | "theirs"
  | "both-ours-first"
  | "both-theirs-first";

export interface ConflictRegion {
  id: number;
  ours: string;
  theirs: string;
}

export type ConflictSegment =
  | { type: "context"; content: string }
  | { type: "conflict"; region: ConflictRegion };

export function parseConflictSegments(raw: string): ConflictSegment[] {
  const lines = raw.split("\n");
  const segments: ConflictSegment[] = [];
  let contextBuffer: string[] = [];
  let activeRegion: { ours: string[]; theirs: string[] } | null = null;
  let mode: "context" | "ours" | "base" | "theirs" = "context";

  function flushContext() {
    if (contextBuffer.length === 0) {
      return;
    }
    segments.push({
      type: "context",
      content: contextBuffer.join("\n")
    });
    contextBuffer = [];
  }

  for (const line of lines) {
    if (line.startsWith("<<<<<<<")) {
      flushContext();
      activeRegion = { ours: [], theirs: [] };
      mode = "ours";
      continue;
    }
    if (line.startsWith("|||||||")) {
      mode = "base";
      continue;
    }
    if (line === "=======") {
      mode = "theirs";
      continue;
    }
    if (line.startsWith(">>>>>>>")) {
      if (activeRegion) {
        segments.push({
          type: "conflict",
          region: {
            id: segments.filter((segment) => segment.type === "conflict").length,
            ours: activeRegion.ours.join("\n"),
            theirs: activeRegion.theirs.join("\n")
          }
        });
      }
      activeRegion = null;
      mode = "context";
      continue;
    }

    if (mode === "context") {
      contextBuffer.push(line);
    } else if (mode === "ours" && activeRegion) {
      activeRegion.ours.push(line);
    } else if (mode === "theirs" && activeRegion) {
      activeRegion.theirs.push(line);
    }
  }

  flushContext();
  return segments;
}

export function buildResolvedConflictContent(
  segments: ConflictSegment[],
  choices: Record<number, ConflictChoice | undefined>
) {
  const resolvedParts: string[] = [];

  for (const segment of segments) {
    if (segment.type === "context") {
      resolvedParts.push(segment.content);
      continue;
    }

    const choice = choices[segment.region.id];
    if (!choice) {
      return null;
    }

    if (choice === "ours") {
      resolvedParts.push(segment.region.ours);
    } else if (choice === "theirs") {
      resolvedParts.push(segment.region.theirs);
    } else if (choice === "both-ours-first") {
      resolvedParts.push(segment.region.ours);
      resolvedParts.push(segment.region.theirs);
    } else {
      resolvedParts.push(segment.region.theirs);
      resolvedParts.push(segment.region.ours);
    }
  }

  return resolvedParts.join("\n");
}
