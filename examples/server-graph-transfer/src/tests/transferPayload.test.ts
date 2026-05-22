import { describe, expect, it } from "vitest";
import { createProfileGraph } from "../shared/createProfileGraph";
import {
  captureProfileGraphPayload,
  decodeTransferPayload,
  encodeTransferPayload,
  restoreProfileGraphPayload,
  type ServerGraphTransferPayload,
} from "../shared/transferPayload";

describe("server graph transfer payload", () => {
  it("captures a JSON-safe payload from writable graph signals", () => {
    const graph = createProfileGraph();
    graph.actions.setProfile({
      plan: "pro",
      usage: 42,
      userId: "luciano",
    });

    const payload = captureProfileGraphPayload(graph, () => 123);
    const encoded = JSON.stringify(payload);
    const parsed = JSON.parse(encoded);

    expect(parsed).toEqual(payload);
    expect(payload).toEqual({
      createdAt: 123,
      graph: {
        id: "profile-graph",
        version: "0.1.0",
      },
      schema: "signal-kernel.example.server-graph-transfer.v0",
      signals: {
        plan: "pro",
        usage: 42,
        userId: "luciano",
      },
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

    const payload = captureProfileGraphPayload(source, () => 123);

    restoreProfileGraphPayload(target, payload);

    expect(target.signals.userId.get()).toBe("luciano");
    expect(target.signals.plan.get()).toBe("pro");
    expect(target.signals.usage.get()).toBe(42);
  });

  it("recomputes computed values after restore instead of storing them", () => {
    const source = createProfileGraph();
    const target = createProfileGraph();
    source.actions.setProfile({
      plan: "enterprise",
      usage: 12_000,
      userId: "luciano",
    });

    const payload = captureProfileGraphPayload(source, () => 123);

    expect("entitlement" in payload).toBe(false);

    restoreProfileGraphPayload(target, payload);

    expect(target.computed.entitlement.get()).toBe("dedicated");
    expect(target.computed.overLimit.get()).toBe(false);
    expect(target.computed.summary.get()).toContain("enterprise");
  });

  it("encodes and decodes through the local transfer codec", () => {
    const graph = createProfileGraph();
    graph.actions.setProfile({
      plan: "free",
      usage: 101,
      userId: "guest",
    });

    const payload = captureProfileGraphPayload(graph, () => 123);
    const decoded = decodeTransferPayload(encodeTransferPayload(payload));

    expect(decoded).toEqual(payload);
  });

  it("rejects incompatible graph ids", () => {
    const graph = createProfileGraph();
    const payload: ServerGraphTransferPayload = captureProfileGraphPayload(
      graph,
      () => 123,
    );

    expect(() =>
      restoreProfileGraphPayload(graph, {
        ...payload,
        graph: {
          ...payload.graph,
          id: "other-graph",
        },
      }),
    ).toThrow("Incompatible graph id");
  });

  it("rejects incompatible graph versions", () => {
    const graph = createProfileGraph();
    const payload: ServerGraphTransferPayload = captureProfileGraphPayload(
      graph,
      () => 123,
    );

    expect(() =>
      restoreProfileGraphPayload(graph, {
        ...payload,
        graph: {
          ...payload.graph,
          version: "2.0.0",
        },
      }),
    ).toThrow("Incompatible graph version");
  });
});
