import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSearchRaceGraph } from "./searchGraph";

async function flushGraph() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("search race graph", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the latest query result when older requests resolve later", async () => {
    const graph = createSearchRaceGraph();
    const [result, meta] = graph.searchResource;

    graph.query.set("a");
    await flushGraph();

    graph.query.set("ab");
    await flushGraph();

    graph.query.set("abc");
    await flushGraph();

    await vi.advanceTimersByTimeAsync(1100);
    await flushGraph();

    expect(meta.status()).toBe("success");
    expect(result()?.query).toBe("abc");

    await vi.advanceTimersByTimeAsync(2100);
    await flushGraph();

    expect(result()?.query).toBe("abc");
    expect(
      graph.eventLog
        .get()
        .filter((event) => event.phase === "resolve-ignored")
        .map((event) => event.query),
    ).toEqual(["ab", "a"]);
  });
});
