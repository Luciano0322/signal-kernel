import type {
  CandidateFact,
  ConsolidationAction,
  ConsolidationPlan,
  MemoryDriver,
  MemoryFact,
  MemoryScope,
  MemorySnapshot,
  RecallInput,
  RecallResult,
} from "./types";

export type LocalMemoryDriverOptions = {
  failOnActionIndex?: number;
  initialFacts?: Array<{
    scope: MemoryScope;
    facts: MemoryFact[];
  }>;
  now?: () => number;
};

export interface LocalMemoryDriver extends MemoryDriver {
  restore(scope: MemoryScope, snapshot: MemorySnapshot): Promise<MemorySnapshot>;
  seed(scope: MemoryScope, facts: MemoryFact[]): void;
}

function scopeKey(scope: MemoryScope) {
  return `${scope.userId}:${scope.threadId}`;
}

function cloneFact(fact: MemoryFact): MemoryFact {
  return {
    ...fact,
    supersedes: fact.supersedes ? [...fact.supersedes] : undefined,
    sourceTurnIds: fact.sourceTurnIds ? [...fact.sourceTurnIds] : undefined,
  };
}

function cloneFacts(facts: MemoryFact[]) {
  return facts.map(cloneFact);
}

function cloneSnapshot(snapshot: MemorySnapshot): MemorySnapshot {
  return {
    ...snapshot,
    scope: { ...snapshot.scope },
    facts: cloneFacts(snapshot.facts),
  };
}

function abortError() {
  const error = new Error("Memory recall was aborted");
  error.name = "AbortError";
  return error;
}

function assertNotAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw abortError();
  }
}

function tokenize(query: string) {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, " ")
    .split(" ")
    .map((token) => token.trim().replace(/^\.+|\.+$/g, ""))
    .filter((token) => token.length > 2);
}

function factMatchesQuery(fact: MemoryFact, tokens: string[]) {
  if (fact.status !== "active") return false;
  if (tokens.length === 0) return true;

  const contentTokens = new Set(tokenize(fact.content));

  return tokens.some((token) => contentTokens.has(token));
}

function memoryFactFromCandidate(
  candidate: CandidateFact,
  now: number,
  supersedes: string[] = [],
): MemoryFact {
  return {
    id: `memory-${candidate.id}`,
    content: candidate.content,
    status: "active",
    confidence: candidate.confidence,
    createdAt: now,
    updatedAt: now,
    supersedes,
    sourceTurnIds: [candidate.sourceTurnId],
  };
}

function mergeSourceTurnIds(
  current: string[] | undefined,
  candidate: CandidateFact,
) {
  return Array.from(new Set([...(current ?? []), candidate.sourceTurnId]));
}

function findFact(facts: MemoryFact[], factId: string) {
  const fact = facts.find((item) => item.id === factId);

  if (!fact) {
    throw new Error(`Memory fact not found: ${factId}`);
  }

  return fact;
}

function applyAction(
  facts: MemoryFact[],
  action: ConsolidationAction,
  now: number,
) {
  switch (action.type) {
    case "insert": {
      facts.push(memoryFactFromCandidate(action.fact, now));
      return true;
    }
    case "merge": {
      const target = findFact(facts, action.targetFactId);
      target.content = `${target.content} ${action.fact.content}`;
      target.confidence = Math.max(target.confidence, action.fact.confidence);
      target.sourceTurnIds = mergeSourceTurnIds(target.sourceTurnIds, action.fact);
      target.updatedAt = now;
      return true;
    }
    case "supersede": {
      const target = findFact(facts, action.targetFactId);
      target.status = "superseded";
      target.updatedAt = now;
      facts.push(memoryFactFromCandidate(action.fact, now, [target.id]));
      return true;
    }
    case "skip":
      return false;
  }
}

export function createLocalMemoryDriver(
  options: LocalMemoryDriverOptions = {},
): LocalMemoryDriver {
  const now = options.now ?? (() => Date.now());
  const factsByScope = new Map<string, MemoryFact[]>();
  const versionByScope = new Map<string, number>();

  function seed(scope: MemoryScope, facts: MemoryFact[]) {
    const key = scopeKey(scope);
    factsByScope.set(key, cloneFacts(facts));
    versionByScope.set(key, 1);
  }

  function getFacts(scope: MemoryScope) {
    const key = scopeKey(scope);
    const facts = factsByScope.get(key);

    if (facts) return facts;

    const next: MemoryFact[] = [];
    factsByScope.set(key, next);
    versionByScope.set(key, 0);
    return next;
  }

  function bumpVersion(scope: MemoryScope) {
    const key = scopeKey(scope);
    const nextVersion = (versionByScope.get(key) ?? 0) + 1;
    versionByScope.set(key, nextVersion);
    return nextVersion;
  }

  async function inspect(scope: MemoryScope): Promise<MemorySnapshot> {
    const key = scopeKey(scope);

    return {
      scope: { ...scope },
      facts: cloneFacts(getFacts(scope)),
      version: versionByScope.get(key) ?? 0,
      createdAt: now(),
    };
  }

  async function recall(input: RecallInput): Promise<RecallResult> {
    assertNotAborted(input.signal);

    const tokens = tokenize(input.query);
    const facts = getFacts(input.scope)
      .filter((fact) => factMatchesQuery(fact, tokens))
      .sort((a, b) => b.confidence - a.confidence);

    assertNotAborted(input.signal);

    return { facts: cloneFacts(facts) };
  }

  async function applyPlan(
    scope: MemoryScope,
    plan: ConsolidationPlan,
  ): Promise<MemorySnapshot> {
    const facts = getFacts(scope);

    for (const [index, action] of plan.actions.entries()) {
      if (options.failOnActionIndex === index) {
        throw new Error(`Injected applyPlan failure at action ${index}`);
      }

      const changed = applyAction(facts, action, now());

      if (changed) {
        bumpVersion(scope);
      }
    }

    return inspect(scope);
  }

  async function restore(
    scope: MemoryScope,
    snapshot: MemorySnapshot,
  ): Promise<MemorySnapshot> {
    const key = scopeKey(scope);
    factsByScope.set(key, cloneFacts(snapshot.facts));
    versionByScope.set(key, snapshot.version);
    return inspect(scope);
  }

  for (const entry of options.initialFacts ?? []) {
    seed(entry.scope, entry.facts);
  }

  return {
    applyPlan,
    inspect,
    recall,
    restore,
    seed,
  };
}
