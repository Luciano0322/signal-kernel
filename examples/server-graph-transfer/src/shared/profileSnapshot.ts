import {
  captureSnapshot,
  createSnapshotScope,
  decodeJsonSnapshot,
  encodeJsonSnapshot,
  restoreSnapshot,
  type JsonValue,
  type SnapshotDocument,
  type SnapshotSerializer,
} from "@signal-kernel/snapshot";
import {
  PROFILE_GRAPH_ID,
  PROFILE_GRAPH_VERSION,
  isPlan,
  type Plan,
  type ProfileGraph,
} from "./createProfileGraph";

function assertString(value: JsonValue, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string`);
  }

  return value;
}

const userIdSerializer: SnapshotSerializer<string> = {
  decode: (value) => assertString(value, "userId"),
  encode: (value) => value,
};

const planSerializer: SnapshotSerializer<Plan> = {
  decode: (value) => {
    const plan = assertString(value, "plan");

    if (!isPlan(plan)) {
      throw new Error("plan must be a supported profile plan");
    }

    return plan;
  },
  encode: (value) => value,
};

const usageSerializer: SnapshotSerializer<number> = {
  decode: (value) => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error("usage must be a finite number");
    }

    return value;
  },
  encode: (value) => value,
};

export function createProfileSnapshotScope(
  graph: ProfileGraph,
  now: () => number = () => Date.now(),
) {
  const scope = createSnapshotScope({
    graphId: PROFILE_GRAPH_ID,
    graphVersion: PROFILE_GRAPH_VERSION,
    now,
  });

  scope.signal("userId", graph.signals.userId, {
    serializer: userIdSerializer,
  });
  scope.signal("plan", graph.signals.plan, {
    serializer: planSerializer,
  });
  scope.signal("usage", graph.signals.usage, {
    serializer: usageSerializer,
  });
  scope.computed("entitlement", graph.computed.entitlement);
  scope.computed("overLimit", graph.computed.overLimit);
  scope.computed("summary", graph.computed.summary);
  scope.computed("usageLimit", graph.computed.usageLimit, {
    captureValue: false,
  });

  return scope;
}

export function captureProfileGraphSnapshot(
  graph: ProfileGraph,
  now?: () => number,
) {
  return captureSnapshot(createProfileSnapshotScope(graph, now));
}

export function restoreProfileGraphSnapshot(
  graph: ProfileGraph,
  snapshot: SnapshotDocument,
) {
  return restoreSnapshot(createProfileSnapshotScope(graph), snapshot);
}

export function encodeProfileGraphSnapshot(snapshot: SnapshotDocument) {
  return encodeJsonSnapshot(snapshot);
}

export function decodeProfileGraphSnapshot(text: string) {
  return decodeJsonSnapshot(text);
}
