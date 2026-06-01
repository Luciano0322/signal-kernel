import { fromPromise } from "./fromPromise.js";
import type { AsyncStatus, RunnableAsyncSignal } from "./types.js";
import type {
  FromPromiseDescriptor,
  FromPromiseOptions,
  PromiseContext,
} from "./fromPromise.js";

export interface AsyncMeta<E = unknown, T = unknown> {
  status: () => AsyncStatus;
  error: () => E | undefined;
  reload: () => Promise<T | undefined>;
  cancel: (reason?: unknown) => void;
  keepPreviousValueOnPending: boolean;
}

export interface RunnableAsyncMeta<I, T, E = unknown> extends AsyncMeta<E, T> {
  run(input: I): Promise<T | undefined>;
}

export type AsyncSignalDescriptor<I, T> = FromPromiseDescriptor<I, T>;

export function asyncSignal<T, E = unknown>(
  makePromise: (ctx: PromiseContext) => Promise<T>,
  options?: FromPromiseOptions<T>
): [() => T | undefined, AsyncMeta<E, T>];
export function asyncSignal<I, T, E = unknown>(
  descriptor: AsyncSignalDescriptor<I, T>,
): [() => T | undefined, RunnableAsyncMeta<I, T, E>];
export function asyncSignal<I, T, E = unknown>(
  makePromiseOrDescriptor:
    | ((ctx: PromiseContext) => Promise<T>)
    | AsyncSignalDescriptor<I, T>,
  options?: FromPromiseOptions<T>
): [() => T | undefined, RunnableAsyncMeta<I, T, E>] {
  const isDescriptor = typeof makePromiseOrDescriptor !== "function";
  const sig = isDescriptor
    ? fromPromise<I, T, E>(makePromiseOrDescriptor)
    : (fromPromise<T, E>(
        makePromiseOrDescriptor,
        options,
      ) as RunnableAsyncSignal<I, T, E>);
  const keepPrev =
    (isDescriptor
      ? makePromiseOrDescriptor.keepPreviousValueOnPending
      : options?.keepPreviousValueOnPending) ?? true;

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
