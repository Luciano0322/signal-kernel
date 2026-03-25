import { signal } from "@signal-kernel/core";
import { createStreamResource } from "../createStreamResource.js";
import type {
  StreamContext,
  StreamInterruptionPolicy,
} from "../types";

export function createDeferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

export async function flushMicrotasks(times = 2) {
  for (let i = 0; i < times; i += 1) {
    await Promise.resolve();
  }
}

type BasicStreamOptions = {
  initialValue?: string;
  onCancel?: StreamInterruptionPolicy;
  onError?: StreamInterruptionPolicy;
};

export function setupBasicStream(options: BasicStreamOptions = {}) {
  const source = signal("a");
  let ctx: StreamContext<string, string> | undefined;

  const [value, meta] = createStreamResource(
    source.get,
    (_source, streamCtx) => {
      ctx = streamCtx;
    },
    {
      initialValue: options.initialValue ?? "",
      reduce: (current = "", chunk) => current + chunk,
      onCancel: options.onCancel,
      onError: options.onError,
    }
  );

  return {
    source,
    value,
    meta,
    async getCtx() {
      await flushMicrotasks();
      if (!ctx) {
        throw new Error("Stream context not captured yet");
      }
      return ctx;
    },
  };
}

export function setupMultiSourceStream(options: BasicStreamOptions = {}) {
  const source = signal("a");

  let ctxA: StreamContext<string, string> | undefined;
  let ctxB: StreamContext<string, string> | undefined;
  let ctxC: StreamContext<string, string> | undefined;

  const [value, meta] = createStreamResource(
    source.get,
    (currentSource, streamCtx) => {
      if (currentSource === "a") ctxA = streamCtx;
      if (currentSource === "b") ctxB = streamCtx;
      if (currentSource === "c") ctxC = streamCtx;
    },
    {
      initialValue: options.initialValue ?? "",
      reduce: (current = "", chunk) => current + chunk,
      onCancel: options.onCancel,
      onError: options.onError,
    }
  );

  return {
    source,
    value,
    meta,
    async getCtxA() {
      await flushMicrotasks();
      if (!ctxA) throw new Error("Context for source 'a' not captured yet");
      return ctxA;
    },
    async getCtxB() {
      await flushMicrotasks();
      if (!ctxB) throw new Error("Context for source 'b' not captured yet");
      return ctxB;
    },
    async getCtxC() {
      await flushMicrotasks();
      if (!ctxC) throw new Error("Context for source 'c' not captured yet");
      return ctxC;
    },
  };
}