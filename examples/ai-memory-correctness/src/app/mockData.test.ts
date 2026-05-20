import { describe, expect, it } from "vitest";
import {
  candidateFacts,
  memoryFacts,
  renderedMemoryPrompt,
  runtimeEvents,
  scenarios,
  snapshots,
} from "./mockData";

describe("ai memory correctness static shell", () => {
  it("defines unique demo scenarios", () => {
    const ids = scenarios.map((scenario) => scenario.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([
      "stale-recall-race",
      "derived-prompt-drift",
      "partial-retain-failure",
      "snapshot-timeline",
    ]);
  });

  it("keeps candidate facts separate from committed memory facts", () => {
    const committedIds = new Set(memoryFacts.map((fact) => fact.id));

    expect(candidateFacts.length).toBeGreaterThan(0);
    expect(candidateFacts.every((fact) => !committedIds.has(fact.id))).toBe(true);
    expect(candidateFacts.every((fact) => fact.status === "candidate")).toBe(true);
  });

  it("renders the prompt from committed memory only", () => {
    expect(renderedMemoryPrompt).toContain("DEV.to");
    expect(renderedMemoryPrompt).toContain("precise architecture explanations");

    for (const candidate of candidateFacts) {
      expect(renderedMemoryPrompt).not.toContain(candidate.content);
    }
  });

  it("exposes timeline snapshots as inspection artifacts", () => {
    const snapshotEvents = runtimeEvents.filter(
      (event) => event.type === "snapshot.created",
    );

    expect(snapshotEvents.length).toBeGreaterThan(0);
    expect(snapshots.length).toBeGreaterThan(0);
    expect(snapshots[snapshots.length - 1].events.length).toBe(runtimeEvents.length);
  });
});
