import { createProfileGraph, isPlan, type Plan } from "../shared/createProfileGraph";
import {
  captureProfileGraphSnapshot,
  encodeProfileGraphSnapshot,
} from "../shared/profileSnapshot";

type RenderHtmlOptions = {
  requestUrl: URL;
};

function parsePlan(value: string | null): Plan {
  if (value && isPlan(value)) return value;
  return "pro";
}

function parseUsage(value: string | null) {
  const parsed = value ? Number(value) : 42;

  if (!Number.isFinite(parsed)) return 42;

  return Math.max(0, Math.floor(parsed));
}

function escapeScriptJson(json: string) {
  return json.replace(/</g, "\\u003c");
}

function createServerProfile(requestUrl: URL) {
  return {
    plan: parsePlan(requestUrl.searchParams.get("plan")),
    usage: parseUsage(requestUrl.searchParams.get("usage")),
    userId: requestUrl.searchParams.get("userId") || "luciano",
  };
}

export function renderHtml({ requestUrl }: RenderHtmlOptions) {
  const graph = createProfileGraph();
  graph.actions.setProfile(createServerProfile(requestUrl));

  const snapshot = captureProfileGraphSnapshot(graph);
  const snapshotJson = escapeScriptJson(encodeProfileGraphSnapshot(snapshot));

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>signal-kernel server graph transfer</title>
  </head>
  <body>
    <div id="root">
      <main class="server-preview">
        <p>Server graph preview</p>
        <h1>${graph.computed.entitlement.get()} entitlement</h1>
        <p>${graph.computed.summary.get()}</p>
      </main>
    </div>
    <script id="__SIGNAL_KERNEL_SNAPSHOT__" type="application/json">${snapshotJson}</script>
    <script type="module" src="/src/client/main.tsx"></script>
  </body>
</html>`;
}
