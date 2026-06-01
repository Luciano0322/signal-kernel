import { signal, batch } from "@signal-kernel/core";
import type { AsyncSignal, AsyncStatus, RunnableAsyncSignal } from "./types";

export type FromPromiseEvent =
  | { type: "start"; token: number; ts: number }
  | { type: "success"; token: number; ts: number }
  | { type: "error"; token: number; ts: number; error: unknown }
  | { type: "cancel"; token: number; ts: number; reason?: unknown };

export interface FromPromiseOptions<T = unknown> {
  eager?: boolean;
  onSuccess?: (value: T) => void;
  onError?: (error: unknown) => void;
  onCancel?: (reason?: unknown) => void;
  onEvent?: (e: FromPromiseEvent) => void;
  keepPreviousValueOnPending?: boolean;
}

export type PromiseContext = { signal: AbortSignal; token: number };

interface FromPromiseDescriptorBase<I, T>
  extends Omit<FromPromiseOptions<T>, "eager"> {
  run: (input: I, ctx: PromiseContext) => Promise<T>;
}

export interface LazyFromPromiseDescriptor<I, T>
  extends FromPromiseDescriptorBase<I, T> {
  eager?: false;
}

export interface EagerFromPromiseDescriptor<I, T>
  extends FromPromiseDescriptorBase<I, T> {
  eager: true;
  initialInput: I;
}

export type FromPromiseDescriptor<I, T> =
  | LazyFromPromiseDescriptor<I, T>
  | EagerFromPromiseDescriptor<I, T>;

export function fromPromise<T, E = unknown>(
  makePromise: (ctx: PromiseContext) => Promise<T>,
  options?: FromPromiseOptions<T>
): AsyncSignal<T, E>;
export function fromPromise<I, T, E = unknown>(
  descriptor: FromPromiseDescriptor<I, T>
): RunnableAsyncSignal<I, T, E>;
export function fromPromise<I, T, E = unknown>(
  makePromiseOrDescriptor:
    | ((ctx: PromiseContext) => Promise<T>)
    | FromPromiseDescriptor<I, T>,
  optionsArg: FromPromiseOptions<T> = {}
): RunnableAsyncSignal<I, T, E> {
  const isDescriptor = typeof makePromiseOrDescriptor !== "function";
  const options = isDescriptor
    ? toPromiseOptions(makePromiseOrDescriptor)
    : optionsArg;
  const runProducer = isDescriptor
    ? makePromiseOrDescriptor.run
    : (_input: I, ctx: PromiseContext) => makePromiseOrDescriptor(ctx);
  const initialInput =
    isDescriptor && "initialInput" in makePromiseOrDescriptor
      ? makePromiseOrDescriptor.initialInput
      : undefined;

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
  let hasLatestInput = false;

  let currentController: AbortController | null = null;

  function emit(e: FromPromiseEvent) {
    options.onEvent?.(e);
  }

  function run(input: I): Promise<T | undefined> {
    latestInput = input;
    hasLatestInput = true;
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
      p = runProducer(input, { signal: controller.signal, token: myToken });
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
    if (isDescriptor && !hasLatestInput) return Promise.resolve(undefined);
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

  const eager = options.eager ?? !isDescriptor;
  if (eager) void run(initialInput as I);

  return {
    value,
    status,
    error,
    run,
    reload,
    cancel,
  };
}

function toPromiseOptions<I, T>(
  descriptor: FromPromiseDescriptor<I, T>,
): FromPromiseOptions<T> {
  const {
    eager,
    onSuccess,
    onError,
    onCancel,
    onEvent,
    keepPreviousValueOnPending,
  } = descriptor;

  return {
    eager,
    onSuccess,
    onError,
    onCancel,
    onEvent,
    keepPreviousValueOnPending,
  };
}
