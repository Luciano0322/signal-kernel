import { fromPromise } from "./fromPromise.js";
import type { AsyncStatus } from "./types.js";
import type { FromPromiseOptions } from "./fromPromise.js";

export interface AsyncMeta<E = unknown> {
  status: () => AsyncStatus;
  error: () => E | undefined;
  reload: () => void;
  /** 可帶 reason，方便上層標記 cancel 來源（例如 source-changed） */
  cancel: (reason?: unknown) => void;
  keepPreviousValueOnPending: boolean;
}

export function asyncSignal<T, E = unknown>(
  makePromise: () => Promise<T>,
  options?: FromPromiseOptions
): [() => T | undefined, AsyncMeta<E>] {
  const sig = fromPromise<T, E>(makePromise, options);
  const keepPrev = options?.keepPreviousValueOnPending ?? true;

  return [
    sig.value,
    {
      status: sig.status,
      error: sig.error,
      reload: sig.reload,
      cancel: sig.cancel,
      keepPreviousValueOnPending: keepPrev,
    },
  ];
}
