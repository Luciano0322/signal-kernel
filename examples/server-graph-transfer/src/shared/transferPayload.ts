import {
  PROFILE_GRAPH_ID,
  PROFILE_GRAPH_VERSION,
  isPlan,
  type Plan,
  type ProfileGraph,
} from "./createProfileGraph";

export const TRANSFER_PAYLOAD_SCHEMA =
  "signal-kernel.example.server-graph-transfer.v0";

export type ServerGraphTransferPayload = {
  createdAt: number;
  graph: {
    id: typeof PROFILE_GRAPH_ID;
    version: typeof PROFILE_GRAPH_VERSION;
  };
  schema: typeof TRANSFER_PAYLOAD_SCHEMA;
  signals: {
    plan: Plan;
    usage: number;
    userId: string;
  };
};

function assertObject(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Transfer payload must be an object");
  }
}

export function assertCompatiblePayload(
  payload: unknown,
): asserts payload is ServerGraphTransferPayload {
  assertObject(payload);

  if (payload.schema !== TRANSFER_PAYLOAD_SCHEMA) {
    throw new Error("Unsupported transfer payload schema");
  }

  assertObject(payload.graph);

  if (payload.graph.id !== PROFILE_GRAPH_ID) {
    throw new Error("Incompatible graph id");
  }

  if (payload.graph.version !== PROFILE_GRAPH_VERSION) {
    throw new Error("Incompatible graph version");
  }

  assertObject(payload.signals);

  if (typeof payload.signals.userId !== "string") {
    throw new Error("Invalid userId signal value");
  }

  if (!isPlan(String(payload.signals.plan))) {
    throw new Error("Invalid plan signal value");
  }

  if (
    typeof payload.signals.usage !== "number" ||
    !Number.isFinite(payload.signals.usage)
  ) {
    throw new Error("Invalid usage signal value");
  }
}

export function captureProfileGraphPayload(
  graph: ProfileGraph,
  now: () => number = () => Date.now(),
): ServerGraphTransferPayload {
  return {
    createdAt: now(),
    graph: {
      id: PROFILE_GRAPH_ID,
      version: PROFILE_GRAPH_VERSION,
    },
    schema: TRANSFER_PAYLOAD_SCHEMA,
    signals: {
      plan: graph.signals.plan.peek(),
      usage: graph.signals.usage.peek(),
      userId: graph.signals.userId.peek(),
    },
  };
}

export function restoreProfileGraphPayload(
  graph: ProfileGraph,
  payload: unknown,
) {
  assertCompatiblePayload(payload);
  graph.actions.setProfile(payload.signals);
}

export function encodeTransferPayload(payload: ServerGraphTransferPayload) {
  return JSON.stringify(payload);
}

export function decodeTransferPayload(text: string) {
  const payload: unknown = JSON.parse(text);
  assertCompatiblePayload(payload);
  return payload;
}
