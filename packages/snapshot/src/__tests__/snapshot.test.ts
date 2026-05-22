import { computed, signal } from "../../../core/src/index";
import { describe, expect, it } from "vitest";
import {
  captureSnapshot,
  createSnapshotScope,
  decodeJsonSnapshot,
  diffSnapshots,
  encodeJsonSnapshot,
  restoreSnapshot,
} from "../index";

function createProfileGraph() {
  const userId = signal("guest");
  const plan = signal<"free" | "pro">("free");
  const usage = signal(0);
  const entitlement = computed(() =>
    plan.get() === "pro" ? "priority" : "standard",
  );
  const overLimit = computed(() => usage.get() > 100);

  return {
    computed: {
      entitlement,
      overLimit,
    },
    signals: {
      plan,
      usage,
      userId,
    },
  };
}

function registerProfileGraph(graph: ReturnType<typeof createProfileGraph>) {
  const scope = createSnapshotScope({
    graphId: "profile-graph",
    graphVersion: "0.1.0",
    now: () => 123,
  });

  scope.signal("userId", graph.signals.userId);
  scope.signal("plan", graph.signals.plan);
  scope.signal("usage", graph.signals.usage);
  scope.computed("entitlement", graph.computed.entitlement);
  scope.computed("overLimit", graph.computed.overLimit);

  return scope;
}

describe("snapshot package", () => {
  it("captures writable signals as a JSON-safe snapshot document", () => {
    const graph = createProfileGraph();
    graph.signals.userId.set("luciano");
    graph.signals.plan.set("pro");
    graph.signals.usage.set(42);

    const snapshot = captureSnapshot(registerProfileGraph(graph));

    expect(snapshot).toEqual({
      createdAt: 123,
      graph: {
        id: "profile-graph",
        version: "0.1.0",
      },
      nodes: [
        {
          id: "userId",
          kind: "signal",
          value: "luciano",
        },
        {
          id: "plan",
          kind: "signal",
          value: "pro",
        },
        {
          id: "usage",
          kind: "signal",
          value: 42,
        },
        {
          id: "entitlement",
          kind: "computed",
          restore: "recompute",
          value: "priority",
        },
        {
          id: "overLimit",
          kind: "computed",
          restore: "recompute",
          value: false,
        },
      ],
      schema: "signal-kernel.snapshot.v1",
    });
  });

  it("restores writable signals into a compatible graph and recomputes computed values", () => {
    const source = createProfileGraph();
    const target = createProfileGraph();
    source.signals.userId.set("luciano");
    source.signals.plan.set("pro");
    source.signals.usage.set(42);

    const snapshot = captureSnapshot(registerProfileGraph(source));
    const report = restoreSnapshot(registerProfileGraph(target), snapshot);

    expect(report).toEqual({
      restored: ["userId", "plan", "usage"],
      skipped: ["entitlement", "overLimit"],
      warnings: [],
    });
    expect(target.signals.userId.get()).toBe("luciano");
    expect(target.signals.plan.get()).toBe("pro");
    expect(target.signals.usage.get()).toBe(42);
    expect(target.computed.entitlement.get()).toBe("priority");
    expect(target.computed.overLimit.get()).toBe(false);
  });

  it("rejects incompatible graph ids in strict restore mode", () => {
    const graph = createProfileGraph();
    const snapshot = captureSnapshot(registerProfileGraph(graph));
    const targetScope = createSnapshotScope({
      graphId: "other-graph",
      graphVersion: "0.1.0",
    });

    expect(() => restoreSnapshot(targetScope, snapshot)).toThrow(
      "Incompatible graph id",
    );
  });

  it("round-trips through the JSON codec", () => {
    const graph = createProfileGraph();
    graph.signals.userId.set("luciano");

    const snapshot = captureSnapshot(registerProfileGraph(graph));
    const decoded = decodeJsonSnapshot(encodeJsonSnapshot(snapshot));

    expect(decoded).toEqual(snapshot);
  });

  it("omits redacted nodes from captured documents", () => {
    const token = signal("secret");
    const scope = createSnapshotScope({
      graphId: "session-graph",
      graphVersion: "0.1.0",
      now: () => 123,
    });
    scope.signal("session.token", token, {
      redaction: "omit",
    });

    const snapshot = captureSnapshot(scope);

    expect(snapshot.nodes).toEqual([]);
  });

  it("diffs changed signal and computed values between snapshots", () => {
    const graph = createProfileGraph();
    const scope = registerProfileGraph(graph);
    const before = captureSnapshot(scope);

    graph.signals.plan.set("pro");
    graph.signals.usage.set(120);

    const after = captureSnapshot(scope);
    const diff = diffSnapshots(before, after);

    expect(diff.changed.map((entry) => entry.id)).toEqual([
      "plan",
      "usage",
      "entitlement",
      "overLimit",
    ]);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
  });

  it("captures resource and stream nodes for inspection without restoring them", () => {
    const scope = createSnapshotScope({
      graphId: "async-graph",
      graphVersion: "0.1.0",
      now: () => 123,
    });
    scope.resource(
      "profileResource",
      [
        () => ({ name: "Luciano" }),
        {
          error: () => undefined,
          status: () => "success",
        },
      ],
      {
        restore: "inspect-only",
        sourceKey: { userId: "luciano" },
      },
    );
    scope.stream(
      "assistantStream",
      [
        () => "partial text",
        {
          error: () => undefined,
          stableValue: () => "stable text",
          status: () => "streaming",
        },
      ],
      {
        restore: "inspect-only",
        sourceKey: { prompt: "snapshot" },
      },
    );

    const snapshot = captureSnapshot(scope);

    expect(snapshot.nodes).toEqual([
      {
        id: "profileResource",
        kind: "resource",
        restore: "inspect-only",
        sourceKey: { userId: "luciano" },
        status: "success",
        value: { name: "Luciano" },
      },
      {
        id: "assistantStream",
        kind: "stream",
        restore: "inspect-only",
        sourceKey: { prompt: "snapshot" },
        stableValue: "stable text",
        status: "streaming",
        value: "partial text",
      },
    ]);
  });

  it("rejects incompatible node kinds in strict restore mode", () => {
    const graph = createProfileGraph();
    const snapshot = captureSnapshot(registerProfileGraph(graph));
    const mutated = {
      ...snapshot,
      nodes: snapshot.nodes.map((node) =>
        node.id === "userId" ? { ...node, kind: "computed" as const } : node,
      ),
    };

    expect(() => restoreSnapshot(registerProfileGraph(graph), mutated)).toThrow(
      "Incompatible node kind for userId",
    );
  });
});
