import { fromPromise } from "./fromPromise.js";
import type { AsyncStatus } from "./types.js";
import type { FromPromiseOptions } from "./fromPromise.js";

export interface AsyncMeta<E = unknown> {
  status: () => AsyncStatus;
  error: () => E | undefined;
  reload: () => void;
  cancel: (reason?: unknown) => void;
  keepPreviousValueOnPending: boolean;
}

export interface RunnableAsyncMeta<I, T, E = unknown> extends AsyncMeta<E> {
  run(input: I): Promise<T | undefined>;
  reload(): Promise<T | undefined>;
}

export function asyncSignal<T, E = unknown>(
  makePromise: (ctx: { signal: AbortSignal; token: number }) => Promise<T>,
  options?: FromPromiseOptions
): [() => T | undefined, AsyncMeta<E>];
export function asyncSignal<I, T, E = unknown>(
  makePromise: (
    input: I,
    ctx: { signal: AbortSignal; token: number },
  ) => Promise<T>,
  options?: FromPromiseOptions,
): [() => T | undefined, RunnableAsyncMeta<I, T, E>];
export function asyncSignal<I, T, E = unknown>(
  makePromise:
    | ((ctx: { signal: AbortSignal; token: number }) => Promise<T>)
    | ((
        input: I,
        ctx: { signal: AbortSignal; token: number },
      ) => Promise<T>),
  options?: FromPromiseOptions
): [() => T | undefined, RunnableAsyncMeta<I, T, E>] {
  const sig = fromPromise<I, T, E>(
    makePromise as (
      input: I,
      ctx: { signal: AbortSignal; token: number },
    ) => Promise<T>,
    options,
  );
  const keepPrev = options?.keepPreviousValueOnPending ?? true;

  return [
    sig.value,
    {
      status: sig.status,
      error: sig.error,
      reload: sig.reload,
      run: sig.run,
      cancel: sig.cancel,
      keepPreviousValueOnPending: keepPrev,
    },
  ];
}
