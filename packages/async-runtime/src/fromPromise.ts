import { signal, batch } from "@signal-kernel/core";
import type { AsyncSignal, AsyncStatus } from "./types";

export interface FromPromiseOptions {
  eager?: boolean;
  onSuccess?: <T>(value: T) => void;
  onError?: (error: unknown) => void;
}

export function fromPromise<T, E = unknown>(
  makePromise: () => Promise<T>,
  options: FromPromiseOptions = {}
): AsyncSignal<T, E> {
  const { get: value, set: setValue } = signal<T | undefined>(undefined);
  const { get: status, set: setStatus } = signal<AsyncStatus>("idle");
  const { get: error, set: setError } = signal<E | undefined>(undefined);

  let currentToken = 0;
  let aborted = false;

  function run() {
    const myToken = ++currentToken;
    aborted = false;

    batch(() => {
      setStatus("pending");
      setError(undefined as E | undefined);
    });

    const p = makePromise();

    p.then(
      (result) => {
        if (aborted || myToken !== currentToken) return;

        batch(() => {
          setValue(result);
          setStatus("success");
        });

        options.onSuccess?.(result);
      },
      (err) => {
        if (aborted || myToken !== currentToken) return;

        batch(() => {
          setError(err as E);
          setStatus("error");
        });

        options.onError?.(err);
      }
    );
  }

  function cancel() {
    aborted = true;
  }

  const eager = options.eager ?? true;
  if (eager) {
    run();
  }

  return {
    value,
    status,
    error,
    reload: run,
    cancel,
  };
}
