import { describe, expect, it } from "vitest";
import { createLocalMemoryDriver } from "./localMemoryDriver";
import type {
  CandidateFact,
  ConsolidationPlan,
  MemoryFact,
  MemoryScope,
} from "./types";

const scope: MemoryScope = {
  userId: "luciano",
  threadId: "memory-poc",
};

const baseFacts: MemoryFact[] = [
  {
    id: "fact-devto",
    content: "User publishes technical articles on DEV.to.",
    status: "active",
    confidence: 0.92,
    createdAt: 1,
    updatedAt: 1,
    sourceTurnIds: ["turn-1"],
  },
  {
    id: "fact-style",
    content: "User prefers precise architecture explanations.",
    status: "active",
    confidence: 0.88,
    createdAt: 1,
    updatedAt: 1,
    sourceTurnIds: ["turn-1"],
  },
  {
    id: "fact-old",
    content: "User used to explore broad AI runtime scope.",
    status: "superseded",
    confidence: 0.6,
    createdAt: 1,
    updatedAt: 2,
    sourceTurnIds: ["turn-0"],
  },
];

function candidate(id: string, content: string): CandidateFact {
  return {
    id,
    content,
    confidence: 0.91,
    sourceTurnId: "turn-2",
    status: "candidate",
  };
}

function createDriver(options: { failOnActionIndex?: number } = {}) {
  let clock = 10;

  return createLocalMemoryDriver({
    ...options,
    initialFacts: [{ scope, facts: baseFacts }],
    now: () => clock++,
  });
}

describe("createLocalMemoryDriver", () => {
  it("recalls active facts with keyword matching", async () => {
    const driver = createDriver();

    const result = await driver.recall({
      scope,
      query: "DEV.to article plan",
    });

    expect(result.facts.map((fact) => fact.id)).toEqual(["fact-devto"]);
  });

  it("does not return superseded facts from recall", async () => {
    const driver = createDriver();

    const result = await driver.recall({
      scope,
      query: "broad AI runtime",
    });

    expect(result.facts).toEqual([]);
  });

  it("returns defensive copies from inspect and recall", async () => {
    const driver = createDriver();
    const snapshot = await driver.inspect(scope);
    const recall = await driver.recall({ scope, query: "DEV.to" });

    snapshot.facts[0].content = "mutated snapshot";
    recall.facts[0].content = "mutated recall";

    const next = await driver.inspect(scope);

    expect(next.facts[0].content).toBe(baseFacts[0].content);
  });

  it("applies insert, merge, supersede, and skip actions", async () => {
    const driver = createDriver();
    const plan: ConsolidationPlan = {
      actions: [
        {
          type: "insert",
          fact: candidate(
            "candidate-memory-runtime",
            "User wants a memory correctness PoC before a full AI runtime.",
          ),
        },
        {
          type: "merge",
          targetFactId: "fact-style",
          fact: candidate(
            "candidate-style",
            "User values concrete package boundaries.",
          ),
        },
        {
          type: "supersede",
          targetFactId: "fact-devto",
          fact: candidate(
            "candidate-devto",
            "User wants to publish a scoped signal-kernel memory demo.",
          ),
        },
        {
          type: "skip",
          reason: "low confidence",
          fact: candidate("candidate-skip", "Low confidence note."),
        },
      ],
    };

    const snapshot = await driver.applyPlan(scope, plan);
    const ids = snapshot.facts.map((fact) => fact.id);
    const merged = snapshot.facts.find((fact) => fact.id === "fact-style");
    const superseded = snapshot.facts.find((fact) => fact.id === "fact-devto");
    const replacement = snapshot.facts.find(
      (fact) => fact.id === "memory-candidate-devto",
    );

    expect(ids).toContain("memory-candidate-memory-runtime");
    expect(ids).not.toContain("memory-candidate-skip");
    expect(merged?.content).toContain("concrete package boundaries");
    expect(superseded?.status).toBe("superseded");
    expect(replacement?.supersedes).toEqual(["fact-devto"]);
    expect(snapshot.version).toBe(4);
  });

  it("can restore a previous snapshot", async () => {
    const driver = createDriver();
    const before = await driver.inspect(scope);

    await driver.applyPlan(scope, {
      actions: [
        {
          type: "insert",
          fact: candidate("candidate-restore", "Temporary fact."),
        },
      ],
    });

    await driver.restore(scope, before);

    const restored = await driver.inspect(scope);

    expect(restored.version).toBe(before.version);
    expect(restored.facts).toEqual(before.facts);
  });

  it("can expose partial writes when failure injection is used directly", async () => {
    const driver = createDriver({ failOnActionIndex: 1 });

    await expect(
      driver.applyPlan(scope, {
        actions: [
          {
            type: "insert",
            fact: candidate("candidate-first", "First staged fact."),
          },
          {
            type: "insert",
            fact: candidate("candidate-second", "Second staged fact."),
          },
        ],
      }),
    ).rejects.toThrow("Injected applyPlan failure at action 1");

    const snapshot = await driver.inspect(scope);
    const ids = snapshot.facts.map((fact) => fact.id);

    expect(ids).toContain("memory-candidate-first");
    expect(ids).not.toContain("memory-candidate-second");
  });

  it("throws AbortError when recall starts with an aborted signal", async () => {
    const driver = createDriver();
    const controller = new AbortController();
    controller.abort();

    await expect(
      driver.recall({
        scope,
        query: "DEV.to",
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
