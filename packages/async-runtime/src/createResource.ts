import { createEffect } from "@signal-kernel/core";
import { asyncSignal } from "./asyncSignal.js";
import type { FromPromiseOptions } from "./fromPromise.js";
import type { AsyncMeta, RunnableAsyncMeta } from "./asyncSignal.js";
import type { InvalidationTarget } from "./revision.js";

export interface ResourceContext {
  signal: AbortSignal;
  token: number;
}

export type ResourceOptions<T = unknown> = Omit<FromPromiseOptions<T>, "eager">;

export interface AutoResourceDescriptor<I, T> extends ResourceOptions<T> {
  trigger?: "auto";
  input?: () => I;
  observe?: () => void;
  run: (input: I, ctx: ResourceContext) => Promise<T>;
}

export interface ManualResourceDescriptor<I, T> extends ResourceOptions<T> {
  trigger: "manual";
  run: (input: I, ctx: ResourceContext) => Promise<T>;
  invalidates?: (result: T, input: I) => InvalidationTarget[];
}

export function createResource<S, T, E = unknown>(
  source: () => S,
  fetcher: (s: S, ctx: ResourceContext) => Promise<T>,
  options?: ResourceOptions<T>
): [() => T | undefined, AsyncMeta<E, T>];
export function createResource<T, E = unknown>(
  descriptor: AutoResourceDescriptor<undefined, T>
): [() => T | undefined, AsyncMeta<E, T>];
export function createResource<I, T, E = unknown>(
  descriptor: AutoResourceDescriptor<I, T>
): [() => T | undefined, AsyncMeta<E, T>];
export function createResource<I, T, E = unknown>(
  descriptor: ManualResourceDescriptor<I, T>
): [() => T | undefined, RunnableAsyncMeta<I, T, E>];
export function createResource<I, T, E = unknown>(
  sourceOrDescriptor:
    | (() => I)
    | AutoResourceDescriptor<I, T>
    | ManualResourceDescriptor<I, T>,
  fetcher?: (sourceValue: I, ctx: ResourceContext) => Promise<T>,
  options?: ResourceOptions<T>
): [() => T | undefined, AsyncMeta<E, T> | RunnableAsyncMeta<I, T, E>] {
  if (typeof sourceOrDescriptor === "function") {
    if (!fetcher) {
      throw new TypeError("createResource requires a fetcher function");
    }

    return createAutoResource<I, T, E>({
      ...(options ?? {}),
      input: sourceOrDescriptor,
      run: fetcher,
    });
  }

  if (sourceOrDescriptor.trigger === "manual") {
    return createManualResource(sourceOrDescriptor);
  }

  return createAutoResource(sourceOrDescriptor);
}

function createAutoResource<I, T, E = unknown>(
  descriptor: AutoResourceDescriptor<I, T>
): [() => T | undefined, AsyncMeta<E, T>] {
  const { input, observe, run } = descriptor;
  const resourceOptions = toPromiseOptions(descriptor);

  const [value, meta] = asyncSignal<I, T, E>({
    ...resourceOptions,
    eager: false,
    run: (sourceValue, ctx) => run(sourceValue, ctx),
  });

  let initialized = false;

  createEffect(() => {
    const currentInput = input ? input() : (undefined as I);
    observe?.();

    if (initialized) {
      // cancel previous in-flight
      meta.cancel("source-changed");
    }

    void meta.run(currentInput);
    initialized = true;
  });

  return [value, meta];
}

function createManualResource<I, T, E = unknown>(
  descriptor: ManualResourceDescriptor<I, T>
): [() => T | undefined, RunnableAsyncMeta<I, T, E>] {
  const { invalidates, run } = descriptor;
  const resourceOptions = toPromiseOptions(descriptor);

  let latestInput!: I;
  let hasLatestInput = false;

  const [value, meta] = asyncSignal<I, T, E>({
    ...resourceOptions,
    eager: false,
    run: (input, ctx) => run(input, ctx),
    onSuccess(result) {
      const successResult = result as unknown as T;

      resourceOptions.onSuccess?.(successResult);
      if (!hasLatestInput) return;

      const targets = invalidates?.(successResult, latestInput) ?? [];
      for (const target of targets) {
        target.invalidate();
      }
    },
  });

  return [
    value,
    {
      ...meta,
      run(input) {
        latestInput = input;
        hasLatestInput = true;
        return meta.run(input);
      },
      reload() {
        if (!hasLatestInput) return Promise.resolve(undefined);
        return meta.run(latestInput);
      },
    },
  ];
}

function toPromiseOptions<T>(options: ResourceOptions<T>): ResourceOptions<T> {
  const {
    onSuccess,
    onError,
    onCancel,
    onEvent,
    keepPreviousValueOnPending,
  } = options;

  return {
    onSuccess,
    onError,
    onCancel,
    onEvent,
    keepPreviousValueOnPending,
  };
}
