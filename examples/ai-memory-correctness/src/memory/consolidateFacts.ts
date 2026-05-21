import type {
  CandidateFact,
  ConsolidateInput,
  ConsolidationAction,
  MemoryFact,
} from "./types";

const lowConfidenceThreshold = 0.7;
const stopwords = new Set([
  "after",
  "before",
  "building",
  "full",
  "interested",
  "user",
  "validate",
  "wants",
]);

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, " ")
    .split(" ")
    .map((token) => token.trim().replace(/^\.+|\.+$/g, ""))
    .filter((token) => token.length > 2 && !stopwords.has(token));
}

function tokenSet(text: string) {
  return new Set(normalize(text));
}

function overlapScore(candidate: CandidateFact, fact: MemoryFact) {
  const candidateTokens = tokenSet(candidate.content);
  const factTokens = tokenSet(fact.content);
  let overlap = 0;

  for (const token of candidateTokens) {
    if (factTokens.has(token)) {
      overlap += 1;
    }
  }

  return overlap / Math.max(candidateTokens.size, 1);
}

function isContradiction(candidate: CandidateFact) {
  return /\b(no longer|stop|stopped|instead of|not interested)\b/i.test(
    candidate.content,
  );
}

function findClosestFact(candidate: CandidateFact, facts: MemoryFact[]) {
  return facts
    .filter((fact) => fact.status === "active")
    .map((fact) => ({ fact, score: overlapScore(candidate, fact) }))
    .sort((a, b) => b.score - a.score)[0];
}

function actionForCandidate(
  candidate: CandidateFact,
  existingFacts: MemoryFact[],
): ConsolidationAction {
  if (candidate.confidence < lowConfidenceThreshold) {
    return {
      type: "skip",
      reason: "low confidence",
      fact: candidate,
    };
  }

  const closest = findClosestFact(candidate, existingFacts);

  if (!closest || closest.score < 0.28) {
    return {
      type: "insert",
      fact: candidate,
    };
  }

  if (isContradiction(candidate)) {
    return {
      type: "supersede",
      targetFactId: closest.fact.id,
      fact: candidate,
    };
  }

  return {
    type: "merge",
    targetFactId: closest.fact.id,
    fact: candidate,
  };
}

export async function consolidateFacts(input: ConsolidateInput) {
  return {
    actions: input.candidates.map((candidate) =>
      actionForCandidate(candidate, input.existingFacts),
    ),
  };
}
