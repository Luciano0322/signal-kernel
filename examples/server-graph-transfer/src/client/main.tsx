import { createRoot } from "react-dom/client";
import { App } from "./App";
import { createProfileGraph } from "../shared/createProfileGraph";
import {
  decodeProfileGraphSnapshot,
  restoreProfileGraphSnapshot,
} from "../shared/profileSnapshot";
import type { SnapshotDocument } from "@signal-kernel/snapshot";

function readSnapshotDocument(): SnapshotDocument | undefined {
  const element = document.getElementById("__SIGNAL_KERNEL_SNAPSHOT__");
  const text = element?.textContent?.trim();

  if (!text) return undefined;

  return decodeProfileGraphSnapshot(text);
}

const root = document.getElementById("root");

if (!root) {
  throw new Error("Example root is missing from HTML");
}

const graph = createProfileGraph();
const snapshot = readSnapshotDocument();

if (snapshot) {
  restoreProfileGraphSnapshot(graph, snapshot);
}

createRoot(root).render(<App graph={graph} snapshot={snapshot} />);
