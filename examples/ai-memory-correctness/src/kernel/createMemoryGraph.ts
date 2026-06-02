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
import type {
  MemoryRuntimeEvent,
  RetainTurnInput,
  RetainTurnResult,
  RuntimeSnapshot,
} from "../memory/types";

export type CreateMemoryGraphOptions = CreateMemoryRuntimeOptions & {
  initialMessage?: string;
  now?: () => number;
  streamDelayMs?: number;
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
  const events = signal<MemoryRuntimeEvent[]>([]);
  const snapshots = signal<RuntimeSnapshot[]>([]);
  const now = options.now ?? (() => Date.now());
  let snapshotIndex = 0;
  let turnIndex = 0;
  const activeTurnId = signal("turn-0");

  function timestamp() {
    return now();
  }

  function appendEvent(event: MemoryRuntimeEvent) {
    events.set((current) => [...current, event]);
  }

  function createTurn(message: string) {
    turnIndex += 1;
    const turnId = `turn-${turnIndex}`;
    activeTurnId.set(turnId);

    appendEvent({
      type: "turn.created",
      turnId,
      message,
      timestamp: timestamp(),
    });

    if (message.trim()) {
      appendEvent({
        type: "recall.started",
        turnId,
        query: message.trim(),
        timestamp: timestamp(),
      });
    }

    return turnId;
  }

  if (currentUserMessage.peek().trim()) {
    createTurn(currentUserMessage.peek().trim());
  }

  const runtime = createMemoryRuntime(options);
  const context = runtime.createContext({
    input: currentUserMessage.get,
  });
  const modelStream = createStreamResource<
    ModelStreamSource,
    string,
    string,
    Error
  >({
    input: () => ({
      memoryPrompt: context.renderedPrompt.get(),
      recallStatus: context.status.get(),
      userMessage: currentUserMessage.get().trim(),
    }),
    stream: async ({ memoryPrompt, recallStatus, userMessage }, ctx) => {
      if (!userMessage || recallStatus !== "success") {
        ctx.done("");
        return;
      }

      let content = "";
      const turnId = activeTurnId.peek();
      const recalledFacts = context.recalledFacts[0]() ?? [];

      appendEvent({
        type: "recall.resolved",
        turnId,
        factIds: recalledFacts.map((fact) => fact.id),
        timestamp: timestamp(),
      });
      void recordSnapshot("after-recall", turnId);
      appendEvent({
        type: "prompt.rendered",
        turnId,
        prompt: memoryPrompt,
        timestamp: timestamp(),
      });
      appendEvent({
        type: "stream.started",
        turnId,
        timestamp: timestamp(),
      });
      void recordSnapshot("before-stream", turnId);

      for await (const chunk of mockModelStream({
        delayMs: options.streamDelayMs,
        memoryPrompt,
        userMessage,
      })) {
        if (ctx.isCancelled()) return;

        content += chunk;
        ctx.emit(chunk);
        appendEvent({
          type: "stream.chunk",
          turnId,
          chunk,
          value: content,
          timestamp: timestamp(),
        });
      }

      if (ctx.isCancelled()) return;

      ctx.done(content);
      appendEvent({
        type: "stream.completed",
        turnId,
        value: content,
        timestamp: timestamp(),
      });
      void recordSnapshot("after-stream", turnId);
    },
    initialValue: "",
    onCancel: "keep-partial",
    onError: "keep-partial",
    reduce: (current, chunk) => `${current ?? ""}${chunk}`,
  });

  function setCurrentUserMessage(message: string) {
    const turnId = createTurn(message.trim());
    currentUserMessage.set(message);
    void recordSnapshot("before-recall", turnId);
  }

  async function recordSnapshot(label: string, turnId = activeTurnId.peek()) {
    const id = `snapshot-${++snapshotIndex}`;
    const memory = await options.driver.inspect(options.scope());
    const createdAt = timestamp();
    const snapshot: RuntimeSnapshot = {
      id,
      label,
      turnId,
      memory,
      renderedPrompt: context.renderedPrompt.get(),
      streamStatus: modelStream[1].status(),
      retainStatus: runtime.signals.retainState.peek().status,
      events: events.peek(),
      createdAt,
    };

    snapshots.set((current) => [...current, snapshot]);
    appendEvent({
      type: "snapshot.created",
      label,
      snapshot: memory,
      timestamp: createdAt,
    });

    return snapshot;
  }

  async function retainTurn(input: RetainTurnInput): Promise<RetainTurnResult> {
    appendEvent({
      type: "extract.started",
      turnId: input.turnId,
      timestamp: timestamp(),
    });

    const result = await runtime.actions.retainTurn(input);

    appendEvent({
      type: "extract.resolved",
      turnId: input.turnId,
      candidates: result.candidates,
      timestamp: timestamp(),
    });
    appendEvent({
      type: "consolidation.planned",
      turnId: input.turnId,
      plan: result.plan,
      timestamp: timestamp(),
    });
    appendEvent({
      type: "retain.started",
      turnId: input.turnId,
      plan: result.plan,
      timestamp: timestamp(),
    });

    if (result.status === "committed") {
      appendEvent({
        type: "retain.committed",
        turnId: input.turnId,
        snapshot: result.after,
        timestamp: timestamp(),
      });
      await recordSnapshot("after-retain-commit", input.turnId);
    } else {
      appendEvent({
        type: "retain.rolled_back",
        turnId: input.turnId,
        error:
          result.error instanceof Error ? result.error.message : String(result.error),
        timestamp: timestamp(),
      });
      await recordSnapshot("after-retain-rollback", input.turnId);
    }

    return result;
  }

  return {
    actions: {
      cancelModelStream: modelStream[1].cancel,
      recordSnapshot,
      refreshMemory: runtime.actions.notifyMemoryChanged,
      reloadModelStream: modelStream[1].reload,
      retainTurn,
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
      activeTurnId,
      currentUserMessage,
      events,
      memoryRevision: runtime.signals.memoryRevision,
      retainState: runtime.signals.retainState,
      snapshots,
    },
  };
}

export type MemoryGraph = ReturnType<typeof createMemoryGraph>;
