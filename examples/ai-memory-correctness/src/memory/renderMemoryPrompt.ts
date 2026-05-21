import type { MemoryFact } from "./types";

export type MemoryPromptRenderPolicy = {
  emptyText?: string;
  header?: string;
  includeConfidence?: boolean;
  maxFacts?: number;
};

export function renderMemoryPrompt(
  facts: MemoryFact[],
  policy: MemoryPromptRenderPolicy = {},
) {
  const {
    emptyText = "No committed memory is available for this turn.",
    header = "Relevant memory:",
    includeConfidence = false,
    maxFacts = 5,
  } = policy;
  const activeFacts = facts
    .filter((fact) => fact.status === "active")
    .slice(0, maxFacts);

  if (activeFacts.length === 0) {
    return emptyText;
  }

  const rows = activeFacts.map((fact) => {
    const confidence = includeConfidence
      ? ` (${Math.round(fact.confidence * 100)}% confidence)`
      : "";

    return `- ${fact.content}${confidence}`;
  });

  return [header, ...rows].join("\n");
}
