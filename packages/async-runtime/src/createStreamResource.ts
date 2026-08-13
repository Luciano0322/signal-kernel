import { batch, createEffect, signal } from "@signal-kernel/core";
import type {
  StreamAsyncMeta,
  StreamAsyncStatus,
  StreamCleanup,
  StreamContext,
  StreamInterruptionPolicy,
  StreamResourceOptions,
} from "./types";

interface ActiveStreamRun {
  controller: AbortController;
  cleanups: StreamCleanup[];
  closed: boolean;
  cancelled: boolean;
}

export interface StreamResourceDescriptor<
  I,
  TChunk,
  TValue,
  E = unknown,
> extends StreamResourceOptions<TChunk, TValue, E> {
  input?: () => I;
  observe?: () => void;
  stream: (
    input: I,
    ctx: StreamContext<TChunk, TValue, E>,
  ) => Promise<void> | void;
}

function applyInterruptionPolicy<T>(
  policy: StreamInterruptionPolicy | undefined,
  stableValue: T | undefined,
  initialValue: T | undefined,
  setValue: (value: T | undefined) => void,
) {
  switch (policy) {
    case "keep-partial":
      return;
    case "rollback":
      setValue(stableValue);
      return;
    case "clear":
      setValue(initialValue);
      return;
    default:
      // conservative default
      setValue(stableValue);
  }
}

export function createStreamResource<S, TChunk, TValue, E = unknown>(
  source: () => S,
  streamer: (
    sourceValue: S,
    ctx: StreamContext<TChunk, TValue, E>,
  ) => Promise<void> | void,
  options?: StreamResourceOptions<TChunk, TValue, E>,
): [() => TValue | undefined, StreamAsyncMeta<E, TValue>];
export function createStreamResource<TChunk, TValue, E = unknown>(
  descriptor: StreamResourceDescriptor<undefined, TChunk, TValue, E>,
): [() => TValue | undefined, StreamAsyncMeta<E, TValue>];
export function createStreamResource<I, TChunk, TValue, E = unknown>(
  descriptor: StreamResourceDescriptor<I, TChunk, TValue, E>,
): [() => TValue | undefined, StreamAsyncMeta<E, TValue>];
export function createStreamResource<I, TChunk, TValue, E = unknown>(
  sourceOrDescriptor:
    | (() => I)
    | StreamResourceDescriptor<I, TChunk, TValue, E>,
  streamer?: (
    sourceValue: I,
    ctx: StreamContext<TChunk, TValue, E>,
  ) => Promise<void> | void,
  options: StreamResourceOptions<TChunk, TValue, E> = {},
): [() => TValue | undefined, StreamAsyncMeta<E, TValue>] {
  const descriptor =
    typeof sourceOrDescriptor === "function"
      ? createDescriptorFromPositional(sourceOrDescriptor, streamer, options)
      : sourceOrDescriptor;

  const { input, observe, stream } = descriptor;
  const streamOptions = toStreamOptions(descriptor);
  const {
    initialValue,
    reduce,
    onCancel = "rollback",
    onError = "rollback",
    onSuccess,
    onErrorEffect,
  } = streamOptions;

  const valueSig = signal<TValue | undefined>(initialValue);
  const stableValueSig = signal<TValue | undefined>(initialValue);
  const statusSig = signal<StreamAsyncStatus>("idle");
  const errorSig = signal<E | undefined>(undefined);

  let activeRun: ActiveStreamRun | null = null;

  function resetForNewRun() {
    batch(() => {
      valueSig.set(initialValue);
      errorSig.set(undefined);
      statusSig.set("pending");
    });
  }

  function isActiveRun(run: ActiveStreamRun) {
    return activeRun === run && !run.closed;
  }

  function closeRun(run: ActiveStreamRun, cancelled: boolean) {
    if (!isActiveRun(run)) return false;

    run.closed = true;
    run.cancelled = cancelled;
    activeRun = null;
    return true;
  }

  function runCleanup(cleanup: StreamCleanup) {
    try {
      cleanup();
    } catch {
      // Cleanup failures must not interrupt the remaining lifecycle work.
    }
  }

  function drainCleanups(run: ActiveStreamRun) {
    const cleanups = run.cleanups.splice(0);

    for (let index = cleanups.length - 1; index >= 0; index -= 1) {
      const cleanup = cleanups[index];
      if (cleanup) runCleanup(cleanup);
    }
  }

  function cancelRun(run: ActiveStreamRun, reason?: unknown) {
    if (!closeRun(run, true)) return false;

    run.controller.abort(reason);
    drainCleanups(run);
    return true;
  }

  function failRun(run: ActiveStreamRun, error: E) {
    if (!closeRun(run, false)) return false;

    batch(() => {
      errorSig.set(error);

      applyInterruptionPolicy(
        onError,
        stableValueSig.get(),
        initialValue,
        (value) => valueSig.set(value),
      );

      statusSig.set("error");
    });

    drainCleanups(run);
    onErrorEffect?.(error);
    return true;
  }

  function supersedeActiveRun(reason?: unknown) {
    const run = activeRun;
    if (run) cancelRun(run, reason);
  }

  function manualCancel(reason?: unknown) {
    const status = statusSig.get();
    if (
      status === "idle" ||
      status === "success" ||
      status === "error" ||
      status === "cancelled"
    ) {
      return;
    }

    const run = activeRun;
    if (!run || !cancelRun(run, reason)) return;

    batch(() => {
      applyInterruptionPolicy(
        onCancel,
        stableValueSig.get(),
        initialValue,
        (v) => valueSig.set(v),
      );
      statusSig.set("cancelled");
    });
  }

  function readInput() {
    return input ? input() : (undefined as I);
  }

  function run(sourceValue: I) {
    const currentRun: ActiveStreamRun = {
      controller: new AbortController(),
      cleanups: [],
      closed: false,
      cancelled: false,
    };
    activeRun = currentRun;

    resetForNewRun();

    const ctx: StreamContext<TChunk, TValue, E> = {
      emit(chunk) {
        if (!isActiveRun(currentRun)) return;

        batch(() => {
          const nextValue = reduce
            ? reduce(valueSig.get(), chunk)
            : ((chunk as unknown) as TValue);

          valueSig.set(nextValue);

          if (statusSig.get() === "pending") {
            statusSig.set("streaming");
          }
        });
      },

      set(nextValue) {
        if (!isActiveRun(currentRun)) return;

        batch(() => {
          valueSig.set(nextValue);

          if (statusSig.get() === "pending") {
            statusSig.set("streaming");
          }
        });
      },

      done(finalValue) {
        if (!closeRun(currentRun, false)) return;

        batch(() => {
          if (finalValue !== undefined) {
            valueSig.set(finalValue);
          }

          const committed = valueSig.get();
          stableValueSig.set(committed);
          statusSig.set("success");
        });

        drainCleanups(currentRun);

        const committed = valueSig.get();
        if (committed !== undefined) {
          onSuccess?.(committed);
        }
      },

      fail(error) {
        failRun(currentRun, error);
      },

      signal: currentRun.controller.signal,

      onCleanup(cleanup) {
        if (currentRun.closed) {
          runCleanup(cleanup);
          return;
        }

        currentRun.cleanups.push(cleanup);
      },

      isCancelled() {
        return currentRun.cancelled;
      },
    };

    // Let queued graph invalidations close superseded runs before producers start.
    Promise.resolve()
      .then(() => undefined)
      .then(() => {
        if (!isActiveRun(currentRun)) return;
        return stream(sourceValue, ctx);
      })
      .catch((err: E) => {
        failRun(currentRun, err);
      });
  }

  function replaceRun(sourceValue: I, reason: unknown) {
    supersedeActiveRun(reason);
    run(sourceValue);
  }

  createEffect(() => {
    const nextSource = readInput();
    observe?.();
    replaceRun(nextSource, "source-changed");
  });

  const meta: StreamAsyncMeta<E, TValue> = {
    status: statusSig.get,
    error: errorSig.get,
    reload: () => {
      replaceRun(readInput(), "reload");
    },
    cancel: manualCancel,
    stableValue: stableValueSig.get,
  };

  return [valueSig.get, meta];
}

function createDescriptorFromPositional<I, TChunk, TValue, E>(
  source: () => I,
  streamer:
    | ((
        sourceValue: I,
        ctx: StreamContext<TChunk, TValue, E>,
      ) => Promise<void> | void)
    | undefined,
  options: StreamResourceOptions<TChunk, TValue, E>,
): StreamResourceDescriptor<I, TChunk, TValue, E> {
  if (!streamer) {
    throw new TypeError("createStreamResource requires a streamer function");
  }

  return {
    ...options,
    input: source,
    stream: streamer,
  };
}

function toStreamOptions<TChunk, TValue, E>(
  options: StreamResourceOptions<TChunk, TValue, E>,
): StreamResourceOptions<TChunk, TValue, E> {
  const {
    initialValue,
    reduce,
    onCancel,
    onError,
    onSuccess,
    onErrorEffect,
  } = options;

  return {
    initialValue,
    reduce,
    onCancel,
    onError,
    onSuccess,
    onErrorEffect,
  };
}
