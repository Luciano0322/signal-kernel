import { batch, createEffect, signal } from "@signal-kernel/core";
import type {
  StreamAsyncMeta,
  StreamAsyncStatus,
  StreamContext,
  StreamInterruptionPolicy,
  StreamResourceOptions,
} from "./types";

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
  options: StreamResourceOptions<TChunk, TValue, E> = {},
): [() => TValue | undefined, StreamAsyncMeta<E, TValue>] {
  const {
    initialValue,
    reduce,
    onCancel = "rollback",
    onError = "rollback",
    onSuccess,
    onErrorEffect,
  } = options;

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

  function run(sourceValue: S) {
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
      .then(() => streamer(sourceValue, ctx))
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
    const nextSource = source();
    invalidateActiveRun();
    run(nextSource);
  });

  const meta: StreamAsyncMeta<E, TValue> = {
    status: statusSig.get,
    error: errorSig.get,
    reload: () => {
      invalidateActiveRun();
      run(source());
    },
    cancel: manualCancel,
    stableValue: stableValueSig.get,
  };

  return [valueSig.get, meta];
}