import { signal, batch } from "@signal-kernel/core";
import type { AsyncSignal, AsyncStatus } from "./types";

export interface FromPromiseOptions {
  eager?: boolean;
  onSuccess?: <T>(value: T) => void;
  onError?: (error: unknown) => void;
  keepPreviousValueOnPending?: boolean;
}

/**
 * 將一個 () => Promise<T> 轉成 AsyncSignal<T>。
 *
 * - 使用三顆 signal：value / status / error
 * - 用 token 確保只接受最新一次請求的結果
 */
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
    const keepPrev = options.keepPreviousValueOnPending ?? true;

    batch(() => {
      setStatus("pending");
      setError(undefined as E | undefined);

      if (!keepPrev) {
        setValue(undefined as T | undefined);
      }
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
