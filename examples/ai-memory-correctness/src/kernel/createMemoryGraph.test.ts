import { describe, expect, it } from "vitest";
import { createMemoryGraph } from "./createMemoryGraph";
import { createLocalMemoryDriver } from "../memory/localMemoryDriver";
import type {
  ConsolidationPlan,
  MemoryDriver,
  MemoryFact,
  MemoryScope,
  MemorySnapshot,
  RecallInput,
  RecallResult,
} from "../memory/types";

const scope: MemoryScope = {
  userId: "luciano",
  threadId: "memory-poc",
};

const devtoFact: MemoryFact = {
  id: "fact-devto",
  content: "User publishes technical articles on DEV.to.",
  status: "active",
  confidence: 0.92,
  createdAt: 1,
  updatedAt: 1,
  sourceTurnIds: ["turn-1"],
};

const updatedDevtoFact: MemoryFact = {
  ...devtoFact,
  content: "User prepares scoped signal-kernel launch essays on DEV.to.",
  updatedAt: 2,
};

const styleFact: MemoryFact = {
  id: "fact-style",
  content: "User prefers precise architecture explanations.",
  status: "active",
  confidence: 0.88,
  createdAt: 1,
  updatedAt: 1,
  sourceTurnIds: ["turn-1"],
};

type Deferred<T> = {
  promise: Promise<T>;
  reject(error: unknown): void;
  resolve(value: T): void;
};

type RecallCall = {
  deferred: Deferred<RecallResult>;
  input: RecallInput;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, reject, resolve };
}

async function flushAsync() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

async function flushTimers(ms = 0) {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
  await flushAsync();
}

async function waitFor(assertion: () => void, attempts = 20) {
  let lastError: unknown;

  for (let i = 0; i < attempts; i++) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await flushTimers(0);
    }
  }

  throw lastError;
}

function createControllableDriver() {
  const calls: RecallCall[] = [];
  const driver: MemoryDriver = {
    applyPlan(_scope: MemoryScope, _plan: ConsolidationPlan) {
      throw new Error("applyPlan is not needed in this test");
    },
    inspect(_scope: MemoryScope): Promise<MemorySnapshot> {
      return Promise.resolve({
        scope,
        facts: [],
        version: 0,
        createdAt: 1,
      });
    },
    recall(input: RecallInput) {
      const deferred = createDeferred<RecallResult>();
      calls.push({ deferred, input });
      return deferred.promise;
    },
  };

  return { calls, driver };
}

describe("createMemoryGraph", () => {
  it("drives recall from the current user message", async () => {
    const { calls, driver } = createControllableDriver();
    const graph = createMemoryGraph({
      driver,
      initialMessage: "DEV.to",
      scope: () => scope,
    });

    expect(graph.computed.recallQuery.get()).toBe("DEV.to");
    expect(calls).toHaveLength(1);
    expect(calls[0].input.query).toBe("DEV.to");
  });

  it("keeps the latest recall when an older recall resolves later", async () => {
    const { calls, driver } = createControllableDriver();
    const graph = createMemoryGraph({
      driver,
      initialMessage: "alpha",
      scope: () => scope,
    });

    graph.actions.setCurrentUserMessage("beta");
    await flushAsync();

    expect(calls.map((call) => call.input.query)).toEqual(["alpha", "beta"]);
    expect(calls[0].input.signal?.aborted).toBe(true);

    calls[1].deferred.resolve({
      facts: [
        {
          ...devtoFact,
          id: "fact-beta",
          content: "beta memory",
        },
      ],
    });
    await flushAsync();

    expect(graph.resources.recalledFacts[0]()?.map((fact) => fact.id)).toEqual([
      "fact-beta",
    ]);

    calls[0].deferred.resolve({
      facts: [
        {
          ...devtoFact,
          id: "fact-alpha",
          content: "alpha memory",
        },
      ],
    });
    await flushAsync();

    expect(graph.resources.recalledFacts[0]()?.map((fact) => fact.id)).toEqual([
      "fact-beta",
    ]);
    expect(graph.computed.renderedPrompt.get()).toContain("beta memory");
  });

  it("keeps empty input from recalling every committed memory fact", async () => {
    const driver = createLocalMemoryDriver({
      initialFacts: [{ scope, facts: [devtoFact, styleFact] }],
      now: () => 1,
    });
    const graph = createMemoryGraph({
      driver,
      initialMessage: "",
      scope: () => scope,
    });

    await flushAsync();

    expect(graph.resources.recalledFacts[0]()).toEqual([]);
    expect(graph.computed.renderedPrompt.get()).toBe(
      "No committed memory is available for this turn.",
    );
  });

  it("recomputes the rendered prompt when memory is refreshed", async () => {
    const driver = createLocalMemoryDriver({
      initialFacts: [{ scope, facts: [devtoFact] }],
      now: () => 1,
    });
    const graph = createMemoryGraph({
      driver,
      initialMessage: "DEV.to",
      scope: () => scope,
    });

    await flushAsync();

    expect(graph.computed.renderedPrompt.get()).toContain(
      "publishes technical articles",
    );

    driver.seed(scope, [updatedDevtoFact]);
    graph.actions.refreshMemory();
    await flushAsync();

    expect(graph.computed.renderedPrompt.get()).toContain(
      "scoped signal-kernel launch essays",
    );
    expect(graph.computed.renderedPrompt.get()).not.toContain(
      "publishes technical articles",
    );
  });

  it("streams a mock model response from the rendered memory prompt", async () => {
    const driver = createLocalMemoryDriver({
      initialFacts: [{ scope, facts: [devtoFact] }],
      now: () => 1,
    });
    const graph = createMemoryGraph({
      driver,
      initialMessage: "DEV.to launch",
      scope: () => scope,
      streamDelayMs: 0,
    });

    await flushAsync();
    await flushAsync();

    const [text, meta] = graph.resources.modelStream;

    await waitFor(() => {
      expect(meta.status()).toBe("success");
      expect(text()).toContain("DEV.to launch");
      expect(text()).toContain("User publishes technical articles on DEV.to.");
    });
  });

  it("keeps partial streamed text when the model stream is cancelled", async () => {
    const driver = createLocalMemoryDriver({
      initialFacts: [{ scope, facts: [devtoFact] }],
      now: () => 1,
    });
    const graph = createMemoryGraph({
      driver,
      initialMessage: "DEV.to launch",
      scope: () => scope,
      streamDelayMs: 5,
    });
    const [text, meta] = graph.resources.modelStream;

    await waitFor(() => {
      expect(text()?.length ?? 0).toBeGreaterThan(0);
      expect(meta.status()).toBe("streaming");
    });

    const partial = text() ?? "";

    graph.actions.cancelModelStream("test-cancel");
    await flushAsync();

    expect(meta.status()).toBe("cancelled");
    expect(text()).toBe(partial);
  });

  it("starts a new stream when the user message changes", async () => {
    const driver = createLocalMemoryDriver({
      initialFacts: [{ scope, facts: [devtoFact, styleFact] }],
      now: () => 1,
    });
    const graph = createMemoryGraph({
      driver,
      initialMessage: "DEV.to",
      scope: () => scope,
      streamDelayMs: 0,
    });
    const [text] = graph.resources.modelStream;

    await waitFor(() => {
      expect(text()).toContain("DEV.to");
    });

    graph.actions.setCurrentUserMessage("architecture");

    await waitFor(() => {
      expect(text()).toContain("architecture");
      expect(text()).toContain("precise architecture explanations");
    });
  });
});
