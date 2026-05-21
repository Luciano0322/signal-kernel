import { signal } from "@signal-kernel/core";
import {
  createMemoryRuntime,
  type CreateMemoryRuntimeOptions,
} from "../memory/createMemoryRuntime";

export type CreateMemoryGraphOptions = CreateMemoryRuntimeOptions & {
  initialMessage?: string;
};

export function createMemoryGraph(options: CreateMemoryGraphOptions) {
  const currentUserMessage = signal(options.initialMessage ?? "");
  const runtime = createMemoryRuntime(options);
  const context = runtime.createContext({
    input: currentUserMessage.get,
  });

  function setCurrentUserMessage(message: string) {
    currentUserMessage.set(message);
  }

  return {
    actions: {
      refreshMemory: runtime.actions.notifyMemoryChanged,
      setCurrentUserMessage,
    },
    context,
    computed: {
      error: context.error,
      recallQuery: context.recallQuery,
      renderedPrompt: context.renderedPrompt,
      snapshot: context.snapshot,
      status: context.status,
    },
    resources: {
      recalledFacts: context.recalledFacts,
    },
    signals: {
      currentUserMessage,
      memoryRevision: runtime.signals.memoryRevision,
    },
  };
}

export type MemoryGraph = ReturnType<typeof createMemoryGraph>;
