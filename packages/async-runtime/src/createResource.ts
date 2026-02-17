import { createEffect } from "@signal-kernel/core";
import { asyncSignal } from "./asyncSignal.js";
import type { FromPromiseOptions } from "./fromPromise.js";
import type { AsyncMeta } from "./asyncSignal.js";

export interface ResourceContext {
  signal: AbortSignal;
  token: number;
}

export interface ResourceOptions extends FromPromiseOptions {
  // extends
}

export function createResource<S, T, E = unknown>(
  source: () => S,
  fetcher: (s: S, ctx: ResourceContext) => Promise<T>,
  options?: ResourceOptions
): [() => T | undefined, AsyncMeta<E>] {
  let currentSource!: S;

  const [value, meta] = asyncSignal<T, E>(
    (ctx) => fetcher(currentSource, ctx),
    { ...(options ?? {}), eager: false }
  );

  let initialized = false;

  createEffect(() => {
    currentSource = source();

    if (initialized) {
      // cancel previous in-flight
      meta.cancel("source-changed");
    }

    meta.reload();
    initialized = true;
  });

  return [value, meta];
}
