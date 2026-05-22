import type {
  ComputedSnapshotOptions,
  Readable,
  ResourceSnapshotOptions,
  ResourceTuple,
  SnapshotNodeOptions,
  SnapshotScopeOptions,
  StreamResourceTuple,
  StreamSnapshotOptions,
  WritableSignal,
} from "./types";

export type SignalRegistration<T = unknown> = {
  id: string;
  kind: "signal";
  options: SnapshotNodeOptions<T>;
  source: WritableSignal<T>;
};

export type ComputedRegistration<T = unknown> = {
  id: string;
  kind: "computed";
  options: ComputedSnapshotOptions<T>;
  source: Readable<T>;
};

export type ResourceRegistration<T = unknown, E = unknown> = {
  id: string;
  kind: "resource";
  options: ResourceSnapshotOptions<T>;
  source: ResourceTuple<T, E>;
};

export type StreamRegistration<T = unknown, E = unknown> = {
  id: string;
  kind: "stream";
  options: StreamSnapshotOptions<T>;
  source: StreamResourceTuple<T, E>;
};

export type SnapshotRegistration =
  | SignalRegistration
  | ComputedRegistration
  | ResourceRegistration
  | StreamRegistration;

export class SnapshotScope {
  readonly graphId: string;
  readonly graphVersion: string;
  readonly instanceId: string | undefined;
  readonly now: () => number;
  private readonly registrations = new Map<string, SnapshotRegistration>();

  constructor(options: SnapshotScopeOptions) {
    this.graphId = options.graphId;
    this.graphVersion = options.graphVersion;
    this.instanceId = options.instanceId;
    this.now = options.now ?? (() => Date.now());
  }

  signal<T>(
    id: string,
    source: WritableSignal<T>,
    options: SnapshotNodeOptions<T> = {},
  ) {
    this.add({
      id,
      kind: "signal",
      options,
      source,
    });
    return this;
  }

  computed<T>(
    id: string,
    source: Readable<T>,
    options: ComputedSnapshotOptions<T> = {},
  ) {
    this.add({
      id,
      kind: "computed",
      options,
      source,
    });
    return this;
  }

  resource<T, E = unknown>(
    id: string,
    source: ResourceTuple<T, E>,
    options: ResourceSnapshotOptions<T> = {},
  ) {
    this.add({
      id,
      kind: "resource",
      options,
      source,
    });
    return this;
  }

  stream<T, E = unknown>(
    id: string,
    source: StreamResourceTuple<T, E>,
    options: StreamSnapshotOptions<T> = {},
  ) {
    this.add({
      id,
      kind: "stream",
      options,
      source,
    });
    return this;
  }

  getRegistration(id: string) {
    return this.registrations.get(id);
  }

  listRegistrations() {
    return Array.from(this.registrations.values());
  }

  private add(registration: SnapshotRegistration) {
    if (this.registrations.has(registration.id)) {
      throw new Error(`Duplicate snapshot node id: ${registration.id}`);
    }

    this.registrations.set(registration.id, registration);
  }
}

export function createSnapshotScope(options: SnapshotScopeOptions) {
  return new SnapshotScope(options);
}
