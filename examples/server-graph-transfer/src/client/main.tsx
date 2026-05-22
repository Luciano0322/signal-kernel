import { createRoot } from "react-dom/client";
import { App } from "./App";
import { createProfileGraph } from "../shared/createProfileGraph";
import {
  decodeTransferPayload,
  restoreProfileGraphPayload,
  type ServerGraphTransferPayload,
} from "../shared/transferPayload";

function readTransferPayload(): ServerGraphTransferPayload | undefined {
  const element = document.getElementById("__SIGNAL_KERNEL_GRAPH__");
  const text = element?.textContent?.trim();

  if (!text) return undefined;

  return decodeTransferPayload(text);
}

const root = document.getElementById("root");

if (!root) {
  throw new Error("Example root is missing from HTML");
}

const graph = createProfileGraph();
const payload = readTransferPayload();

if (payload) {
  restoreProfileGraphPayload(graph, payload);
}

createRoot(root).render(<App graph={graph} payload={payload} />);
