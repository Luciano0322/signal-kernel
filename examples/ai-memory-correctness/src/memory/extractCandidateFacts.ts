import type { CandidateFact, ExtractInput } from "./types";

type ExtractionRule = {
  id: string;
  confidence: number;
  content: string;
  matches(text: string): boolean;
};

const rules: ExtractionRule[] = [
  {
    id: "devto",
    confidence: 0.9,
    content: "User is interested in publishing technical articles on DEV.to.",
    matches: (text) => text.includes("dev.to") || text.includes("article"),
  },
  {
    id: "memory-correctness",
    confidence: 0.94,
    content:
      "User wants to validate AI memory correctness before building a full AI runtime.",
    matches: (text) => text.includes("memory correctness"),
  },
  {
    id: "snapshot",
    confidence: 0.84,
    content:
      "User treats snapshots as lifecycle inspection artifacts before durable replay.",
    matches: (text) => text.includes("snapshot") || text.includes("replay"),
  },
  {
    id: "architecture-boundaries",
    confidence: 0.88,
    content: "User prefers concrete package boundaries and runtime ownership.",
    matches: (text) => text.includes("boundary") || text.includes("ownership"),
  },
];

function normalize(input: ExtractInput) {
  return `${input.userMessage} ${input.assistantMessage}`.toLowerCase();
}

export async function extractCandidateFacts(
  input: ExtractInput,
): Promise<CandidateFact[]> {
  const text = normalize(input);

  return rules
    .filter((rule) => rule.matches(text))
    .map((rule) => ({
      id: `${input.turnId}-${rule.id}`,
      content: rule.content,
      confidence: rule.confidence,
      sourceTurnId: input.turnId,
      status: "candidate",
    }));
}
