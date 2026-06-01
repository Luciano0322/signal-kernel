import { signal, batch } from "@signal-kernel/core";
import type { AsyncSignal, AsyncStatus, RunnableAsyncSignal } from "./types";

export type FromPromiseEvent =
  | { type: "start"; token: number; ts: number }
  | { type: "success"; token: number; ts: number }
  | { type: "error"; token: number; ts: number; error: unknown }
  | { type: "cancel"; token: number; ts: number; reason?: unknown };

export interface FromPromiseOptions {
  eager?: boolean;
  onSuccess?: <T>(value: T) => void;
  onError?: (error: unknown) => void;
  onCancel?: (reason?: unknown) => void;
  onEvent?: (e: FromPromiseEvent) => void;
  keepPreviousValueOnPending?: boolean;
}

type PromiseContext = { signal: AbortSignal; token: number };

export function fromPromise<T, E = unknown>(
  makePromise: (ctx: { signal: AbortSignal; token: number }) => Promise<T>,
  options?: FromPromiseOptions
): AsyncSignal<T, E>;
export function fromPromise<I, T, E = unknown>(
  makePromise: (input: I, ctx: { signal: AbortSignal; token: number }) => Promise<T>,
  options?: FromPromiseOptions
): RunnableAsyncSignal<I, T, E>;
export function fromPromise<I, T, E = unknown>(
  makePromise:
    | ((ctx: PromiseContext) => Promise<T>)
    | ((input: I, ctx: PromiseContext) => Promise<T>),
  options: FromPromiseOptions = {}
): RunnableAsyncSignal<I, T, E> {
  const { get: value, set: setValue } = signal<T | undefined>(undefined);
  const { get: status, set: setStatus } = signal<AsyncStatus>("idle");
  const { get: error, set: setError } = signal<E | undefined>(undefined);
  function isAbortError(err: unknown) {
    return (
      (err instanceof DOMException && err.name === "AbortError") ||
      (typeof err === "object" &&
        err !== null &&
        "name" in err &&
        (err as any).name === "AbortError")
    );
  }

  let currentToken = 0;
  let currentRunToken = 0;
  let latestInput: I | undefined;

  let currentController: AbortController | null = null;

  function emit(e: FromPromiseEvent) {
    options.onEvent?.(e);
  }

  function callProducer(input: I, ctx: PromiseContext) {
    if (makePromise.length >= 2) {
      return (makePromise as (input: I, ctx: PromiseContext) => Promise<T>)(
        input,
        ctx,
      );
    }

    return (makePromise as (ctx: PromiseContext) => Promise<T>)(ctx);
  }

  function run(input: I): Promise<T | undefined> {
    latestInput = input;
    const myToken = ++currentToken;
    currentRunToken = myToken;

    currentController?.abort("superseded");

    const controller = new AbortController();
    currentController = controller;

    const keepPrev = options.keepPreviousValueOnPending ?? true;

    batch(() => {
      setStatus("pending");
      setError(undefined as E | undefined);
      if (!keepPrev) setValue(undefined as T | undefined);
    });

    emit({ type: "start", token: myToken, ts: Date.now() });

    let p: Promise<T>;
    try {
      p = callProducer(input, { signal: controller.signal, token: myToken });
    } catch (err) {
      if (myToken !== currentToken) return Promise.resolve(undefined);
      batch(() => {
        setError(err as E);
        setStatus("error");
      });
      emit({ type: "error", token: myToken, ts: Date.now(), error: err });
      options.onError?.(err);
      if (currentController === controller) currentController = null;
      return Promise.resolve(undefined);
    }

    return p.then(
      (result) => {
        if (myToken !== currentToken) return undefined;
        if (controller.signal.aborted) return undefined;

        batch(() => {
          setValue(result);
          setStatus("success");
        });

        emit({ type: "success", token: myToken, ts: Date.now() });
        options.onSuccess?.(result);
        if (currentController === controller) currentController = null;
        return result;
      },
      (err) => {
        if (myToken !== currentToken) return undefined;
        if (controller.signal.aborted || isAbortError(err)) {
          if (currentController === controller) currentController = null;
          return undefined;
        }
        batch(() => {
          setError(err as E);
          setStatus("error");
        });

        emit({ type: "error", token: myToken, ts: Date.now(), error: err });
        options.onError?.(err);
        if (currentController === controller) currentController = null;
        return undefined;
      }
    );
  }

  function reload() {
    return run(latestInput as I);
  }

  function cancel(reason?: unknown) {
    const controller = currentController;
    if (!controller) return;
    if (controller.signal.aborted) return;

    controller.abort(reason);
    
    batch(() => {
      setStatus("cancelled" as AsyncStatus);
    });

    emit({ type: "cancel", token: currentRunToken, ts: Date.now(), reason });
    options.onCancel?.(reason);
    if (currentController === controller) currentController = null;
  }

  const eager = options.eager ?? true;
  if (eager) void reload();

  return {
    value,
    status,
    error,
    run,
    reload,
    cancel,
  };
}
