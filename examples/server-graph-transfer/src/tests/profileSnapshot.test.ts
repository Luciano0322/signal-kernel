import type { SnapshotDocument, SnapshotNode } from "@signal-kernel/snapshot";
import { describe, expect, it } from "vitest";
import { createProfileGraph } from "../shared/createProfileGraph";
import {
  captureProfileGraphSnapshot,
  decodeProfileGraphSnapshot,
  encodeProfileGraphSnapshot,
  restoreProfileGraphSnapshot,
} from "../shared/profileSnapshot";

describe("server graph transfer with @signal-kernel/snapshot", () => {
  it("captures a JSON-safe snapshot from writable graph signals", () => {
    const graph = createProfileGraph();
    graph.actions.setProfile({
      plan: "pro",
      usage: 42,
      userId: "luciano",
    });

    const snapshot = captureProfileGraphSnapshot(graph, () => 123);
    const encoded = JSON.stringify(snapshot);
    const parsed = JSON.parse(encoded);

    expect(parsed).toEqual(snapshot);
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
        {
          id: "summary",
          kind: "computed",
          restore: "recompute",
          value: "luciano is on pro with 42 / 1000 usage.",
        },
        {
          id: "usageLimit",
          kind: "computed",
          restore: "recompute",
        },
      ],
      schema: "signal-kernel.snapshot.v1",
    });
  });

  it("restores writable signals into a compatible graph", () => {
    const source = createProfileGraph();
    const target = createProfileGraph();
    source.actions.setProfile({
      plan: "pro",
      usage: 42,
      userId: "luciano",
    });

    const snapshot = captureProfileGraphSnapshot(source, () => 123);
    const report = restoreProfileGraphSnapshot(target, snapshot);

    expect(report).toEqual({
      restored: ["userId", "plan", "usage"],
      skipped: ["entitlement", "overLimit", "summary", "usageLimit"],
      warnings: [],
    });
    expect(target.signals.userId.get()).toBe("luciano");
    expect(target.signals.plan.get()).toBe("pro");
    expect(target.signals.usage.get()).toBe(42);
  });

  it("recomputes computed values after restore instead of using captured values as source state", () => {
    const source = createProfileGraph();
    const target = createProfileGraph();
    source.actions.setProfile({
      plan: "enterprise",
      usage: 12_000,
      userId: "luciano",
    });

    const snapshot = captureProfileGraphSnapshot(source, () => 123);

    restoreProfileGraphSnapshot(target, snapshot);

    expect(target.computed.entitlement.get()).toBe("dedicated");
    expect(target.computed.overLimit.get()).toBe(false);
    expect(target.computed.summary.get()).toContain("enterprise");
  });

  it("encodes and decodes through the published snapshot JSON codec", () => {
    const graph = createProfileGraph();
    graph.actions.setProfile({
      plan: "free",
      usage: 101,
      userId: "guest",
    });

    const snapshot = captureProfileGraphSnapshot(graph, () => 123);
    const decoded = decodeProfileGraphSnapshot(
      encodeProfileGraphSnapshot(snapshot),
    );

    expect(decoded).toEqual(snapshot);
  });

  it("rejects incompatible graph ids", () => {
    const graph = createProfileGraph();
    const snapshot: SnapshotDocument = captureProfileGraphSnapshot(
      graph,
      () => 123,
    );

    expect(() =>
      restoreProfileGraphSnapshot(graph, {
        ...snapshot,
        graph: {
          ...snapshot.graph,
          id: "other-graph",
        },
      }),
    ).toThrow("Incompatible graph id");
  });

  it("rejects incompatible graph versions", () => {
    const graph = createProfileGraph();
    const snapshot: SnapshotDocument = captureProfileGraphSnapshot(
      graph,
      () => 123,
    );

    expect(() =>
      restoreProfileGraphSnapshot(graph, {
        ...snapshot,
        graph: {
          ...snapshot.graph,
          version: "2.0.0",
        },
      }),
    ).toThrow("Incompatible graph version");
  });

  it("validates domain values through node serializers during restore", () => {
    const graph = createProfileGraph();
    const snapshot: SnapshotDocument = captureProfileGraphSnapshot(
      graph,
      () => 123,
    );
    const mutated: SnapshotDocument = {
      ...snapshot,
      nodes: snapshot.nodes.map((node): SnapshotNode =>
        node.id === "plan" && node.kind === "signal"
          ? {
              ...node,
              value: "team",
            }
          : node,
      ),
    };

    expect(() => restoreProfileGraphSnapshot(graph, mutated)).toThrow(
      "plan must be a supported profile plan",
    );
  });
});
