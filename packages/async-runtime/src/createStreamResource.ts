import { batch, createEffect, signal } from "@signal-kernel/core";
import type {
  StreamAsyncMeta,
  StreamAsyncStatus,
  StreamContext,
  StreamInterruptionPolicy,
  StreamResourceOptions,
} from "./types";

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
    ctx: StreamContext<TChunk, TValue>,
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
    ctx: StreamContext<TChunk, TValue>,
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
    ctx: StreamContext<TChunk, TValue>,
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

  let version = 0;
  let activeVersion = 0;
  let cancelled = false;

  function resetForNewRun() {
    batch(() => {
      valueSig.set(initialValue);
      errorSig.set(undefined);
      statusSig.set("pending");
    });
  }

  function invalidateActiveRun() {
    cancelled = true;
  }

  function manualCancel(reason?: unknown) {
    void reason;

    const status = statusSig.get();
    if (
      status === "idle" ||
      status === "success" ||
      status === "error" ||
      status === "cancelled"
    ) {
      return;
    }

    cancelled = true;

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
    version += 1;
    const runVersion = version;
    activeVersion = runVersion;
    cancelled = false;

    resetForNewRun();

    const ctx: StreamContext<TChunk, TValue> = {
      emit(chunk) {
        if (cancelled || runVersion !== activeVersion) return;

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
        if (cancelled || runVersion !== activeVersion) return;

        batch(() => {
          valueSig.set(nextValue);

          if (statusSig.get() === "pending") {
            statusSig.set("streaming");
          }
        });
      },

      done(finalValue) {
        if (cancelled || runVersion !== activeVersion) return;

        batch(() => {
          if (finalValue !== undefined) {
            valueSig.set(finalValue);
          }

          const committed = valueSig.get();
          stableValueSig.set(committed);
          statusSig.set("success");
        });

        const committed = valueSig.get();
        if (committed !== undefined) {
          onSuccess?.(committed);
        }
      },

      isCancelled() {
        return cancelled || runVersion !== activeVersion;
      },
    };

    Promise.resolve()
      .then(() => stream(sourceValue, ctx))
      .catch((err: E) => {
        if (cancelled || runVersion !== activeVersion) return;

        batch(() => {
          errorSig.set(err);

          applyInterruptionPolicy(
            onError,
            stableValueSig.get(),
            initialValue,
            (v) => valueSig.set(v),
          );

          statusSig.set("error");
        });

        onErrorEffect?.(err);
      });
  }

  createEffect(() => {
    const nextSource = readInput();
    observe?.();
    invalidateActiveRun();
    run(nextSource);
  });

  const meta: StreamAsyncMeta<E, TValue> = {
    status: statusSig.get,
    error: errorSig.get,
    reload: () => {
      invalidateActiveRun();
      run(readInput());
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
        ctx: StreamContext<TChunk, TValue>,
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
