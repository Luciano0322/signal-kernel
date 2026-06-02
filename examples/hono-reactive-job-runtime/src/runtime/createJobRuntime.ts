import { createStreamResource } from "@signal-kernel/async-runtime";
import { batch, computed, createEffect, signal } from "@signal-kernel/core";
import { captureSnapshot, createSnapshotScope } from "@signal-kernel/snapshot";
import { defaultAnalyzeDocument } from "../mock/analyzeDocument";
import type {
  JobAnalyzeStream,
  JobExecutionChunk,
  JobExecutionState,
  JobRuntime,
  JobRuntimeOptions,
  JobRunSource,
  JobStateView,
  JobStatus,
} from "./jobTypes";

type InternalRunSource = JobRunSource & {
  enabled: boolean;
};

let nextRuntimeId = 0;

export const initialExecutionState: JobExecutionState = {
  progress: 0,
  currentStep: null,
  partialResult: "",
  stableResult: null,
};

export function reduceExecutionState(
  current: JobExecutionState | undefined,
  chunk: JobExecutionChunk,
): JobExecutionState {
  return {
    ...(current ?? initialExecutionState),
    ...chunk,
  };
}

function createJobId() {
  nextRuntimeId += 1;
  return `job_${nextRuntimeId.toString(36)}`;
}

function formatError(error: unknown) {
  if (error instanceof Error) return error.message;
  return error ? String(error) : null;
}

function toJobStatus(enabled: boolean, streamStatus: string): JobStatus {
  if (!enabled) return "idle";
  if (streamStatus === "streaming") return "running";
  if (streamStatus === "cancelled") return "cancelled";
  if (streamStatus === "error") return "error";
  if (streamStatus === "success") return "success";
  if (streamStatus === "pending") return "pending";
  return "idle";
}

export function createJobRuntime(options: JobRuntimeOptions): JobRuntime {
  const id = options.id ?? createJobId();
  const analyze = options.analyze ?? defaultAnalyzeDocument;
  const content = signal(options.content);
  const attempt = signal(0);
  const enabled = signal(false);
  const listeners = new Set<(state: JobStateView) => void>();

  let disposed = false;

  const runSource = computed<InternalRunSource>(() => ({
    attempt: attempt.get(),
    content: content.get(),
    enabled: enabled.get(),
  }));

  const analysis = createStreamResource<
    InternalRunSource,
    JobExecutionChunk,
    JobExecutionState,
    Error
  >({
    input: runSource.get,
    stream: async (source, ctx) => {
      if (!source.enabled) {
        ctx.done(initialExecutionState);
        return;
      }

      await analyze(
        {
          attempt: source.attempt,
          content: source.content,
        },
        ctx,
      );
    },
    initialValue: initialExecutionState,
    reduce: reduceExecutionState,
    onCancel: "keep-partial",
    onError: "keep-partial",
  });
  const [execution, executionMeta] = analysis;

  const status = computed<JobStatus>(() =>
    toJobStatus(enabled.get(), executionMeta.status()),
  );

  const progress = computed(() => execution()?.progress ?? 0);
  const currentStep = computed(() => execution()?.currentStep ?? null);
  const partialResult = computed(() => execution()?.partialResult ?? "");
  const stableResult = computed(
    () => executionMeta.stableValue()?.stableResult ?? null,
  );
  const error = computed(() => formatError(executionMeta.error()));
  const canCancel = computed(
    () => status.get() === "pending" || status.get() === "running",
  );
  const canRetry = computed(
    () => status.get() === "error" || status.get() === "cancelled",
  );
  const isTerminal = computed(
    () =>
      status.get() === "success" ||
      status.get() === "error" ||
      status.get() === "cancelled",
  );
  const visibleResult = computed(() => {
    if (status.get() === "running" || status.get() === "cancelled") {
      return partialResult.get();
    }

    return stableResult.get();
  });

  function getState(): JobStateView {
    return {
      id,
      status: status.get(),
      progress: progress.get(),
      currentStep: currentStep.get(),
      partialResult: partialResult.get(),
      stableResult: stableResult.get(),
      visibleResult: visibleResult.get(),
      error: error.get(),
      canCancel: canCancel.get(),
      canRetry: canRetry.get(),
      isTerminal: isTerminal.get(),
    };
  }

  const stopNotify = createEffect(() => {
    const state = getState();

    for (const listener of listeners) {
      listener(state);
    }
  });

  function start() {
    if (disposed || enabled.peek()) return;
    enabled.set(true);
  }

  function cancel() {
    if (disposed || !canCancel.get()) return;
    executionMeta.cancel("job-cancelled");
  }

  function retry() {
    if (disposed || !canRetry.get()) return;

    batch(() => {
      enabled.set(true);
      attempt.set((current) => current + 1);
    });
  }

  function subscribe(listener: (state: JobStateView) => void) {
    if (disposed) {
      listener(getState());
      return () => undefined;
    }

    listener(getState());
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  }

  function snapshot() {
    const scope = createSnapshotScope({
      graphId: "hono-reactive-job",
      graphVersion: "0.1.0",
      instanceId: id,
    });

    scope.signal("attempt", attempt);
    scope.signal("content", content, {
      redaction: {
        redact: (value) => ({
          length: value.length,
        }),
      },
    });

    scope.computed("status", status);
    scope.computed("progress", progress);
    scope.computed("currentStep", currentStep);
    scope.computed("visibleResult", visibleResult);
    scope.computed("canCancel", canCancel);
    scope.computed("canRetry", canRetry);
    scope.computed("isTerminal", isTerminal);

    scope.stream("analysis", analysis, {
      restore: "inspect-only",
      sourceKey: {
        attempt: attempt.peek(),
        jobId: id,
      },
    });

    return captureSnapshot(scope);
  }

  function dispose() {
    if (disposed) return;

    disposed = true;
    executionMeta.cancel("job-disposed");
    stopNotify();
    listeners.clear();
  }

  return {
    id,
    start,
    cancel,
    retry,
    getState,
    subscribe,
    snapshot,
    dispose,
  };
}
