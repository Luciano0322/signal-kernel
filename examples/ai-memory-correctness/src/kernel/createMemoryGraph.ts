import { signal } from "@signal-kernel/core";
import {
  createStreamResource,
  type StreamAsyncMeta,
} from "@signal-kernel/async-runtime";
import {
  createMemoryRuntime,
  type CreateMemoryRuntimeOptions,
} from "../memory/createMemoryRuntime";
import { mockModelStream } from "../model/mockModelStream";

export type CreateMemoryGraphOptions = CreateMemoryRuntimeOptions & {
  streamDelayMs?: number;
  initialMessage?: string;
};

export type ModelStreamSource = {
  memoryPrompt: string;
  recallStatus: string;
  userMessage: string;
};

export type ModelStreamResource = [
  value: () => string | undefined,
  meta: StreamAsyncMeta<Error, string>,
];

export function createMemoryGraph(options: CreateMemoryGraphOptions) {
  const currentUserMessage = signal(options.initialMessage ?? "");
  const runtime = createMemoryRuntime(options);
  const context = runtime.createContext({
    input: currentUserMessage.get,
  });
  const modelStream = createStreamResource<
    ModelStreamSource,
    string,
    string,
    Error
  >(
    () => ({
      memoryPrompt: context.renderedPrompt.get(),
      recallStatus: context.status.get(),
      userMessage: currentUserMessage.get().trim(),
    }),
    async ({ memoryPrompt, recallStatus, userMessage }, ctx) => {
      if (!userMessage || recallStatus !== "success") {
        ctx.done("");
        return;
      }

      let content = "";

      for await (const chunk of mockModelStream({
        delayMs: options.streamDelayMs,
        memoryPrompt,
        userMessage,
      })) {
        if (ctx.isCancelled()) return;

        content += chunk;
        ctx.emit(chunk);
      }

      if (ctx.isCancelled()) return;

      ctx.done(content);
    },
    {
      initialValue: "",
      onCancel: "keep-partial",
      onError: "keep-partial",
      reduce: (current, chunk) => `${current ?? ""}${chunk}`,
    },
  );

  function setCurrentUserMessage(message: string) {
    currentUserMessage.set(message);
  }

  return {
    actions: {
      cancelModelStream: modelStream[1].cancel,
      refreshMemory: runtime.actions.notifyMemoryChanged,
      reloadModelStream: modelStream[1].reload,
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
      modelStream: modelStream as ModelStreamResource,
      recalledFacts: context.recalledFacts,
    },
    signals: {
      currentUserMessage,
      memoryRevision: runtime.signals.memoryRevision,
    },
  };
}

export type MemoryGraph = ReturnType<typeof createMemoryGraph>;
