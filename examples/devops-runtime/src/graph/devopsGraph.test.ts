import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDevopsGraph } from "./devopsGraph";

async function flushGraph() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("devops runtime graph", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the selected commit authoritative when older CI results resolve later", async () => {
    const graph = createDevopsGraph();
    const [ciStatus] = graph.resources.ciStatus;

    await flushGraph();
    await vi.advanceTimersByTimeAsync(100);

    graph.actions.selectCommit("commit-b");
    await flushGraph();

    await vi.advanceTimersByTimeAsync(900);
    await flushGraph();

    expect(ciStatus()?.commitId).toBe("commit-b");
    expect(ciStatus()?.state).toBe("success");

    await vi.advanceTimersByTimeAsync(2500);
    await flushGraph();

    expect(ciStatus()?.commitId).toBe("commit-b");
    expect(
      graph.signals.eventLog
        .get()
        .filter(
          (event) =>
            event.source === "ci" &&
            event.phase === "resolve-ignored" &&
            event.commitId === "commit-a",
        ),
    ).toHaveLength(1);
  });

  it("allows promotion only after CI, artifact, rollout, health, and approval pass", async () => {
    const graph = createDevopsGraph();

    await flushGraph();
    await vi.advanceTimersByTimeAsync(3200);
    await flushGraph();

    expect(graph.computed.decisions.get().canDeploy).toBe(true);
    expect(graph.computed.decisions.get().canPromote).toBe(false);

    graph.actions.startDeployment();
    await flushGraph();

    await vi.advanceTimersByTimeAsync(1500);
    await flushGraph();

    expect(graph.computed.decisions.get().phase).toBe("awaiting-approval");
    expect(graph.computed.decisions.get().blockedReason).toBe(
      "Manual approval is required",
    );

    graph.actions.approvePromotion();
    await flushGraph();

    expect(graph.computed.decisions.get().phase).toBe("ready-to-promote");
    expect(graph.computed.decisions.get().canPromote).toBe(true);
    expect(graph.computed.decisions.get().blockedReason).toBeNull();
  });

  it("blocks promotion when the health stream becomes degraded", async () => {
    const graph = createDevopsGraph();

    graph.actions.selectCommit("commit-b");
    await flushGraph();

    await vi.advanceTimersByTimeAsync(1300);
    await flushGraph();

    expect(graph.computed.decisions.get().canDeploy).toBe(true);
    expect(graph.computed.decisions.get().health.state).toBe("degraded");

    graph.actions.startDeployment();
    await flushGraph();

    await vi.advanceTimersByTimeAsync(1000);
    await flushGraph();

    graph.actions.approvePromotion();
    await flushGraph();

    expect(graph.computed.decisions.get().canPromote).toBe(false);
    expect(graph.computed.decisions.get().phase).toBe("blocked");
    expect(graph.computed.decisions.get().blockedReason).toBe(
      "Health stream is degraded",
    );
  });
});
