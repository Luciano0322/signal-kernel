import { computed, signal } from "@signal-kernel/core";
import { createResource, type AsyncMeta } from "@signal-kernel/async-runtime";
import { renderMemoryPrompt } from "./renderMemoryPrompt";
import type {
  MemoryDriver,
  MemoryFact,
  MemoryScope,
  RecallResult,
} from "./types";

export type CreateMemoryRuntimeOptions = {
  driver: MemoryDriver;
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
  const render = options.render ?? renderMemoryPrompt;
  const memoryRevision = signal(0);

  function notifyMemoryChanged() {
    memoryRevision.set((current) => current + 1);
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
    },
    createContext,
    signals: {
      memoryRevision,
    },
  };
}
