import { describe, expect, it } from "vitest";
import { consolidateFacts } from "./consolidateFacts";
import { extractCandidateFacts } from "./extractCandidateFacts";
import { createLocalMemoryDriver } from "./localMemoryDriver";
import { retainTransaction } from "./retainTransaction";
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

const existingDevtoFact: MemoryFact = {
  id: "fact-devto",
  content: "User publishes technical articles on DEV.to.",
  status: "active",
  confidence: 0.9,
  createdAt: 1,
  updatedAt: 1,
  sourceTurnIds: ["turn-1"],
};

const existingSnapshotFact: MemoryFact = {
  id: "fact-snapshot",
  content: "User wants snapshot inspection before durable replay.",
  status: "active",
  confidence: 0.82,
  createdAt: 1,
  updatedAt: 1,
  sourceTurnIds: ["turn-1"],
};

function candidate(
  id: string,
  content: string,
  confidence = 0.9,
): CandidateFact {
  return {
    id,
    content,
    confidence,
    sourceTurnId: "turn-2",
    status: "candidate",
  };
}

describe("retention pipeline", () => {
  it("extracts deterministic candidate facts from a completed turn", async () => {
    const candidates = await extractCandidateFacts({
      turnId: "turn-2",
      userMessage: "Let's prove AI memory correctness before a full AI runtime.",
      assistantMessage:
        "We can use snapshot inspection and a DEV.to article as the demo path.",
    });

    expect(candidates.map((fact) => fact.id)).toEqual([
      "turn-2-devto",
      "turn-2-memory-correctness",
      "turn-2-snapshot",
    ]);
    expect(candidates.every((fact) => fact.status === "candidate")).toBe(true);
  });

  it("plans insert, merge, supersede, and skip actions", async () => {
    const plan = await consolidateFacts({
      candidates: [
        candidate(
          "candidate-new",
          "User wants to validate AI memory correctness before building a full AI runtime.",
        ),
        candidate(
          "candidate-devto",
          "User is interested in publishing technical articles on DEV.to.",
        ),
        candidate(
          "candidate-stop-snapshot",
          "User is no longer interested in snapshot inspection before replay.",
        ),
        candidate("candidate-low", "Low confidence note.", 0.4),
      ],
      existingFacts: [existingDevtoFact, existingSnapshotFact],
    });

    expect(plan.actions.map((action) => action.type)).toEqual([
      "insert",
      "merge",
      "supersede",
      "skip",
    ]);
  });

  it("commits a consolidation plan through retainTransaction", async () => {
    const driver = createLocalMemoryDriver({
      initialFacts: [{ scope, facts: [existingDevtoFact] }],
      now: () => 10,
    });
    const plan: ConsolidationPlan = {
      actions: [
        {
          type: "insert",
          fact: candidate(
            "candidate-memory-correctness",
            "User wants to validate AI memory correctness before building a full AI runtime.",
          ),
        },
      ],
    };

    const result = await retainTransaction({
      driver,
      plan,
      scope,
    });

    expect(result.status).toBe("committed");
    expect(result.after.facts.map((fact) => fact.id)).toContain(
      "memory-candidate-memory-correctness",
    );
    expect(result.after.version).toBe(result.before.version + 1);
  });

  it("rolls back partial writes when retainTransaction fails", async () => {
    const driver = createLocalMemoryDriver({
      failOnActionIndex: 1,
      initialFacts: [{ scope, facts: [existingDevtoFact] }],
      now: () => 10,
    });
    const plan: ConsolidationPlan = {
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
    };

    const result = await retainTransaction({
      driver,
      plan,
      scope,
    });
    const finalSnapshot = await driver.inspect(scope);

    expect(result.status).toBe("rolled_back");
    expect(result.after.facts).toEqual(result.before.facts);
    expect(finalSnapshot.facts).toEqual(result.before.facts);
  });
});
