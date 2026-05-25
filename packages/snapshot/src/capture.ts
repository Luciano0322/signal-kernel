import type {
  ComputedSnapshotNode,
  ResourceSnapshotNode,
  SignalSnapshotNode,
  SnapshotDocument,
  SnapshotNode,
  StreamSnapshotNode,
} from "./types";
import { SNAPSHOT_SCHEMA } from "./types";
import type {
  ComputedRegistration,
  ResourceRegistration,
  SignalRegistration,
  SnapshotRegistration,
  SnapshotScope,
  StreamRegistration,
} from "./scope";
import { normalizeError, serializeValue } from "./serialize";

export type CaptureSnapshotOptions = {
  metadata?: Record<string, import("./types").JsonValue>;
};

function captureSignal(registration: SignalRegistration): SignalSnapshotNode | undefined {
  const serialized = serializeValue(
    registration.source.peek(),
    registration.options,
    `Snapshot node ${registration.id}`,
  );

  if (serialized.omitted) return undefined;

  return {
    id: registration.id,
    kind: "signal",
    value: serialized.value,
  };
}

function captureComputed(
  registration: ComputedRegistration,
): ComputedSnapshotNode | undefined {
  const captureValue = registration.options.captureValue ?? true;
  const node: ComputedSnapshotNode = {
    id: registration.id,
    kind: "computed",
    restore: "recompute",
  };

  if (!captureValue) return node;

  const serialized = serializeValue(
    registration.source.get(),
    registration.options,
    `Snapshot node ${registration.id}`,
  );

  if (serialized.omitted) return undefined;

  return {
    ...node,
    value: serialized.value,
  };
}

function captureResource(
  registration: ResourceRegistration,
): ResourceSnapshotNode | undefined {
  const [value, meta] = registration.source;
  const currentValue = value();
  const restore = registration.options.restore ?? "inspect-only";
  const node: ResourceSnapshotNode = {
    id: registration.id,
    kind: "resource",
    restore,
    status: meta.status(),
  };
  const error = normalizeError(meta.error());

  if (registration.options.sourceKey !== undefined) {
    node.sourceKey = registration.options.sourceKey;
  }

  if (error !== undefined) {
    node.error = error;
  }

  if (currentValue === undefined) return node;

  const serialized = serializeValue(
    currentValue,
    registration.options,
    `Snapshot node ${registration.id}`,
  );

  if (serialized.omitted) return undefined;

  return {
    ...node,
    value: serialized.value,
  };
}

function captureStream(
  registration: StreamRegistration,
): StreamSnapshotNode | undefined {
  const [value, meta] = registration.source;
  const currentValue = value();
  const stableValue = meta.stableValue();
  const restore = registration.options.restore ?? "inspect-only";
  const node: StreamSnapshotNode = {
    id: registration.id,
    kind: "stream",
    restore,
    status: meta.status(),
  };
  const error = normalizeError(meta.error());

  if (registration.options.sourceKey !== undefined) {
    node.sourceKey = registration.options.sourceKey;
  }

  if (error !== undefined) {
    node.error = error;
  }

  if (currentValue !== undefined) {
    const serialized = serializeValue(
      currentValue,
      registration.options,
      `Snapshot node ${registration.id}`,
    );

    if (serialized.omitted) return undefined;
    node.value = serialized.value;
  }

  if (stableValue !== undefined) {
    const serializedStable = serializeValue(
      stableValue,
      {
        ...registration.options,
        serializer:
          registration.options.stableValueSerializer ??
          registration.options.serializer,
      },
      `Snapshot node ${registration.id} stableValue`,
    );

    if (!serializedStable.omitted) {
      node.stableValue = serializedStable.value;
    }
  }

  return node;
}

function captureNode(registration: SnapshotRegistration): SnapshotNode | undefined {
  switch (registration.kind) {
    case "signal":
      return captureSignal(registration);
    case "computed":
      return captureComputed(registration);
    case "resource":
      return captureResource(registration);
    case "stream":
      return captureStream(registration);
  }
}

export function captureSnapshot(
  scope: SnapshotScope,
  options: CaptureSnapshotOptions = {},
): SnapshotDocument {
  const graph: SnapshotDocument["graph"] = {
    id: scope.graphId,
    version: scope.graphVersion,
  };

  if (scope.instanceId) {
    graph.instanceId = scope.instanceId;
  }

  const document: SnapshotDocument = {
    createdAt: scope.now(),
    graph,
    nodes: scope
      .listRegistrations()
      .map(captureNode)
      .filter((node): node is SnapshotNode => Boolean(node)),
    schema: SNAPSHOT_SCHEMA,
  };

  if (options.metadata) {
    document.metadata = options.metadata;
  }

  return document;
}
