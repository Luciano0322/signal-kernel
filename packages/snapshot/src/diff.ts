import type { SnapshotDiff, SnapshotDiffEntry, SnapshotDocument, SnapshotNode } from "./types";

function nodeKey(node: SnapshotNode) {
  return `${node.kind}:${node.id}`;
}

function equalJson(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function toEntry(node: SnapshotNode): SnapshotDiffEntry {
  return {
    id: node.id,
    kind: node.kind,
  };
}

export function diffSnapshots(
  before: SnapshotDocument,
  after: SnapshotDocument,
): SnapshotDiff {
  const beforeNodes = new Map(before.nodes.map((node) => [nodeKey(node), node]));
  const afterNodes = new Map(after.nodes.map((node) => [nodeKey(node), node]));
  const added: SnapshotDiffEntry[] = [];
  const removed: SnapshotDiffEntry[] = [];
  const changed: SnapshotDiffEntry[] = [];

  for (const [key, node] of afterNodes) {
    const previous = beforeNodes.get(key);

    if (!previous) {
      added.push({
        ...toEntry(node),
        after: node,
      });
      continue;
    }

    if (!equalJson(previous, node)) {
      changed.push({
        ...toEntry(node),
        after: node,
        before: previous,
      });
    }
  }

  for (const [key, node] of beforeNodes) {
    if (afterNodes.has(key)) continue;

    removed.push({
      ...toEntry(node),
      before: node,
    });
  }

  return {
    added,
    changed,
    removed,
  };
}
