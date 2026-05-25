export const SNAPSHOT_SCHEMA = "signal-kernel.snapshot.v1";
export const DEFAULT_SNAPSHOT_GRAPH_ID = "default";
export const DEFAULT_SNAPSHOT_GRAPH_VERSION = "0.0.0";

export type JsonPrimitive = string | number | boolean | null;

export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

export type Readable<T> = {
  get(): T;
  peek(): T;
};

export type WritableSignal<T> = Readable<T> & {
  set(next: T | ((prev: T) => T)): void;
};

export type SnapshotSerializer<T> = {
  decode(value: JsonValue): T;
  encode(value: T): JsonValue;
};

export type RedactionPolicy<T> =
  | "include"
  | "omit"
  | {
      redact(value: T): JsonValue;
    };

export type SnapshotNodeOptions<T> = {
  redaction?: RedactionPolicy<T>;
  serializer?: SnapshotSerializer<T>;
};

export type ComputedSnapshotOptions<T> = SnapshotNodeOptions<T> & {
  captureValue?: boolean;
};

export type ResourceTuple<T, E = unknown> = [
  value: () => T | undefined,
  meta: {
    error(): E | undefined;
    status(): string;
  },
];

export type StreamResourceTuple<T, E = unknown> = [
  value: () => T | undefined,
  meta: {
    error(): E | undefined;
    stableValue(): T | undefined;
    status(): string;
  },
];

export type ResourceSnapshotOptions<T> = SnapshotNodeOptions<T> & {
  restore?: "inspect-only" | "reload" | "seed";
  sourceKey?: JsonValue;
};

export type StreamSnapshotOptions<T> = SnapshotNodeOptions<T> & {
  restore?: "inspect-only" | "reload" | "stable-value";
  sourceKey?: JsonValue;
  stableValueSerializer?: SnapshotSerializer<T>;
};

export type SnapshotScopeOptions = {
  graphId?: string;
  graphVersion?: string;
  instanceId?: string;
  now?: () => number;
};

export type SnapshotDocument = {
  createdAt: number;
  graph: {
    id: string;
    instanceId?: string;
    version: string;
  };
  metadata?: Record<string, JsonValue>;
  nodes: SnapshotNode[];
  schema: typeof SNAPSHOT_SCHEMA;
};

export type SignalSnapshotNode = {
  id: string;
  kind: "signal";
  value: JsonValue;
};

export type ComputedSnapshotNode = {
  id: string;
  kind: "computed";
  restore: "recompute";
  value?: JsonValue;
};

export type ResourceSnapshotNode = {
  error?: JsonValue;
  id: string;
  kind: "resource";
  restore: "inspect-only" | "reload" | "seed";
  sourceKey?: JsonValue;
  status: string;
  value?: JsonValue;
};

export type StreamSnapshotNode = {
  error?: JsonValue;
  id: string;
  kind: "stream";
  restore: "inspect-only" | "reload" | "stable-value";
  sourceKey?: JsonValue;
  stableValue?: JsonValue;
  status: string;
  value?: JsonValue;
};

export type SnapshotNode =
  | SignalSnapshotNode
  | ComputedSnapshotNode
  | ResourceSnapshotNode
  | StreamSnapshotNode;

export type RestoreMode = "strict" | "best-effort";

export type RestoreOptions = {
  mode?: RestoreMode;
};

export type RestoreReport = {
  restored: string[];
  skipped: string[];
  warnings: string[];
};

export type SnapshotDiffEntry = {
  after?: SnapshotNode;
  before?: SnapshotNode;
  id: string;
  kind: SnapshotNode["kind"] | "metadata";
};

export type SnapshotDiff = {
  added: SnapshotDiffEntry[];
  changed: SnapshotDiffEntry[];
  removed: SnapshotDiffEntry[];
};
