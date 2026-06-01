import { createEffect } from "@signal-kernel/core";
import { asyncSignal } from "./asyncSignal.js";
import type { FromPromiseOptions } from "./fromPromise.js";
import type { AsyncMeta, RunnableAsyncMeta } from "./asyncSignal.js";
import type { InvalidationTarget } from "./revision.js";

export interface ResourceContext {
  signal: AbortSignal;
  token: number;
}

export interface ResourceOptions extends FromPromiseOptions {
  // extends
}

export interface AutoResourceDescriptor<I, T> extends ResourceOptions {
  trigger?: "auto";
  input?: () => I;
  observe?: () => void;
  run: (input: I, ctx: ResourceContext) => Promise<T>;
}

export interface ManualResourceDescriptor<I, T> extends ResourceOptions {
  trigger: "manual";
  run: (input: I, ctx: ResourceContext) => Promise<T>;
  invalidates?: (result: T, input: I) => InvalidationTarget[];
}

export function createResource<S, T, E = unknown>(
  source: () => S,
  fetcher: (s: S, ctx: ResourceContext) => Promise<T>,
  options?: ResourceOptions
): [() => T | undefined, AsyncMeta<E>];
export function createResource<T, E = unknown>(
  descriptor: AutoResourceDescriptor<undefined, T>
): [() => T | undefined, AsyncMeta<E>];
export function createResource<I, T, E = unknown>(
  descriptor: AutoResourceDescriptor<I, T>
): [() => T | undefined, AsyncMeta<E>];
export function createResource<I, T, E = unknown>(
  descriptor: ManualResourceDescriptor<I, T>
): [() => T | undefined, RunnableAsyncMeta<I, T, E>];
export function createResource<I, T, E = unknown>(
  sourceOrDescriptor:
    | (() => I)
    | AutoResourceDescriptor<I, T>
    | ManualResourceDescriptor<I, T>,
  fetcher?: (sourceValue: I, ctx: ResourceContext) => Promise<T>,
  options?: ResourceOptions
): [() => T | undefined, AsyncMeta<E> | RunnableAsyncMeta<I, T, E>] {
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
): [() => T | undefined, AsyncMeta<E>] {
  const { input, observe, run } = descriptor;
  const resourceOptions = toPromiseOptions(descriptor);

  const [value, meta] = asyncSignal<I, T, E>(
    (sourceValue, ctx) => run(sourceValue, ctx),
    { ...resourceOptions, eager: false }
  );

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

  const [value, meta] = asyncSignal<I, T, E>(
    (input, ctx) => run(input, ctx),
    {
      ...resourceOptions,
      eager: false,
      onSuccess(result) {
        const successResult = result as unknown as T;

        resourceOptions.onSuccess?.(successResult);
        if (!hasLatestInput) return;

        const targets = invalidates?.(successResult, latestInput) ?? [];
        for (const target of targets) {
          target.invalidate();
        }
      },
    }
  );

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

function toPromiseOptions(options: ResourceOptions): FromPromiseOptions {
  const {
    eager,
    onSuccess,
    onError,
    onCancel,
    onEvent,
    keepPreviousValueOnPending,
  } = options;

  return {
    eager,
    onSuccess,
    onError,
    onCancel,
    onEvent,
    keepPreviousValueOnPending,
  };
}
