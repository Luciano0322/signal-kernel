import { computed, signal } from "@signal-kernel/core";
import { createResource, type AsyncMeta } from "@signal-kernel/async-runtime";
import { consolidateFacts } from "./consolidateFacts";
import { extractCandidateFacts } from "./extractCandidateFacts";
import { renderMemoryPrompt } from "./renderMemoryPrompt";
import {
  retainTransaction,
  type RestorableMemoryDriver,
} from "./retainTransaction";
import type {
  CandidateFact,
  ConsolidateInput,
  ConsolidationPlan,
  ExtractInput,
  MemoryDriver,
  MemoryFact,
  MemoryScope,
  RecallResult,
  RetainState,
  RetainTurnInput,
  RetainTurnResult,
} from "./types";

export type CreateMemoryRuntimeOptions = {
  consolidate?: (input: ConsolidateInput) => Promise<ConsolidationPlan>;
  driver: MemoryDriver;
  extract?: (input: ExtractInput) => Promise<CandidateFact[]>;
  render?: (facts: MemoryFact[]) => string;
  scope: () => MemoryScope;
};

export type CreateMemoryContextOptions = {
  input: () => string;
};

export type RecallSource = {
  query: string;
  revision: number;
  scope: MemoryScope;
};

export type MemoryContextSnapshot = {
  error: unknown;
  facts: MemoryFact[];
  query: string;
  renderedPrompt: string;
  revision: number;
  scope: MemoryScope;
  status: ReturnType<AsyncMeta<Error>["status"]>;
};

export type RecalledFactsResource = [
  value: () => MemoryFact[] | undefined,
  meta: AsyncMeta<Error>,
];

export function createMemoryRuntime(options: CreateMemoryRuntimeOptions) {
  const consolidate = options.consolidate ?? consolidateFacts;
  const extract = options.extract ?? extractCandidateFacts;
  const render = options.render ?? renderMemoryPrompt;
  const memoryRevision = signal(0);
  const retainState = signal<RetainState>({
    status: "idle",
    candidates: [],
  });

  function notifyMemoryChanged() {
    memoryRevision.set((current) => current + 1);
  }

  function getRestorableDriver(): RestorableMemoryDriver {
    if (!("restore" in options.driver)) {
      throw new Error("retainTurn requires a memory driver with restore()");
    }

    return options.driver as RestorableMemoryDriver;
  }

  async function retainTurn(input: RetainTurnInput): Promise<RetainTurnResult> {
    const scope = options.scope();
    const driver = getRestorableDriver();

    retainState.set({
      status: "extracting",
      candidates: [],
    });

    const candidates = await extract(input);

    retainState.set({
      status: "consolidating",
      candidates,
    });

    const before = await driver.inspect(scope);
    const plan = await consolidate({
      candidates,
      existingFacts: before.facts,
    });

    retainState.set({
      status: "retaining",
      before,
      candidates,
      plan,
    });

    const transaction = await retainTransaction({
      before,
      driver,
      plan,
      scope,
    });
    const result: RetainTurnResult = {
      ...transaction,
      candidates,
      plan,
    };

    retainState.set({
      status: result.status,
      after: result.after,
      before: result.before,
      candidates,
      error: result.status === "rolled_back" ? result.error : undefined,
      plan,
    });

    notifyMemoryChanged();

    return result;
  }

  function createContext(contextOptions: CreateMemoryContextOptions) {
    const recallQuery = computed(() => contextOptions.input().trim());
    const recalledFacts = createResource<RecallSource, MemoryFact[], Error>(
      () => ({
        query: recallQuery.get(),
        revision: memoryRevision.get(),
        scope: options.scope(),
      }),
      async ({ query, scope }, ctx): Promise<MemoryFact[]> => {
        if (!query) return [];

        const result: RecallResult = await options.driver.recall({
          query,
          scope,
          signal: ctx.signal,
        });

        return result.facts;
      },
      {
        keepPreviousValueOnPending: false,
      },
    );
    const [recalledFactValue, recallMeta] = recalledFacts;
    const renderedPrompt = computed(() => render(recalledFactValue() ?? []));
    const status = computed(() => recallMeta.status());
    const error = computed(() => recallMeta.error());
    const snapshot = computed<MemoryContextSnapshot>(() => ({
      error: recallMeta.error(),
      facts: recalledFactValue() ?? [],
      query: recallQuery.get(),
      renderedPrompt: renderedPrompt.get(),
      revision: memoryRevision.get(),
      scope: options.scope(),
      status: recallMeta.status(),
    }));

    return {
      actions: {
        cancelRecall: recallMeta.cancel,
        reloadRecall: recallMeta.reload,
      },
      error,
      recallQuery,
      recalledFacts: recalledFacts as RecalledFactsResource,
      renderedPrompt,
      snapshot,
      status,
    };
  }

  return {
    actions: {
      notifyMemoryChanged,
      retainTurn,
    },
    createContext,
    signals: {
      memoryRevision,
      retainState,
    },
  };
}
