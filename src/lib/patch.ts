import type { DiffHunk } from "../types/git";

export function buildPatch(file: string, hunks: DiffHunk[], oldFile = file) {
  const header = [`diff --git a/${oldFile} b/${file}`, `--- a/${oldFile}`, `+++ b/${file}`];
  const body = hunks.flatMap((hunk) => [
    hunk.header,
    ...hunk.lines.map((line) => line.content)
  ]);
  return [...header, ...body, ""].join("\n");
}

export function buildPatchFromSelectedLines(
  file: string,
  hunk: DiffHunk,
  selectedLineIndices: number[],
  oldFile = file
) {
  const selection = new Set(selectedLineIndices);
  const segments = buildSelectedSegments(hunk, selection);
  const derivedHunks = segments.map((indices) => {
    const startInfo = getLineCursor(hunk, indices[0]);
    const lines = indices.map((index) => hunk.lines[index]);
    const oldCount = lines.filter((line) => line.lineType !== "add").length;
    const newCount = lines.filter((line) => line.lineType !== "remove").length;

    return {
      oldStart: startInfo.oldCursor,
      oldCount,
      newStart: startInfo.newCursor,
      newCount,
      header: `@@ -${startInfo.oldCursor},${oldCount} +${startInfo.newCursor},${newCount} @@`,
      lines
    } satisfies DiffHunk;
  });

  return buildPatch(file, derivedHunks, oldFile);
}

function buildSelectedSegments(hunk: DiffHunk, selection: Set<number>) {
  const selectedChangedIndices = hunk.lines
    .map((line, index) => ({ line, index }))
    .filter(({ line, index }) => line.lineType !== "context" && selection.has(index))
    .map(({ index }) => index);

  const segments: number[][] = [];
  for (const index of selectedChangedIndices) {
    const current = segments[segments.length - 1];
    if (!current) {
      segments.push([index]);
      continue;
    }

    const previous = current[current.length - 1];
    const between = hunk.lines.slice(previous + 1, index);
    const hasUnselectedChange = between.some((line) => line.lineType !== "context");
    if (hasUnselectedChange) {
      segments.push([index]);
      continue;
    }

    for (let cursor = previous + 1; cursor <= index; cursor += 1) {
      current.push(cursor);
    }
  }

  return segments;
}

function getLineCursor(hunk: DiffHunk, targetIndex: number) {
  let oldCursor = hunk.oldStart;
  let newCursor = hunk.newStart;

  for (let index = 0; index < targetIndex; index += 1) {
    const line = hunk.lines[index];
    if (line.lineType !== "add") {
      oldCursor += 1;
    }
    if (line.lineType !== "remove") {
      newCursor += 1;
    }
  }

  return { oldCursor, newCursor };
}
