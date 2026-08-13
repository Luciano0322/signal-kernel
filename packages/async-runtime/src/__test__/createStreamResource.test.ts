import { batch, signal } from "@signal-kernel/core";
import { describe, expect, it, vi } from "vitest";
import { createStreamResource } from "../createStreamResource.js";
import { createRevision } from "../revision.js";
import type { StreamContext } from "../types";
import {
  createDeferred,
  flushMicrotasks,
  setupBasicStream,
  setupMultiSourceStream,
} from "./helper";

describe("createStreamResource", () => {
  it("starts in pending state with initial visible and stable values", () => {
    const { value, meta } = setupBasicStream({ initialValue: "" });

    expect(meta.status()).toBe("pending");
    expect(value()).toBe("");
    expect(meta.stableValue()).toBe("");
    expect(meta.error()).toBeUndefined();
  });

  it("switches to streaming after first emit and accumulates chunks", async () => {
    const { value, meta, getCtx } = setupBasicStream({ initialValue: "" });
    const ctx = await getCtx();

    ctx.emit("Hel");
    expect(meta.status()).toBe("streaming");
    expect(value()).toBe("Hel");
    expect(meta.stableValue()).toBe("");

    ctx.emit("lo");
    expect(value()).toBe("Hello");
    expect(meta.stableValue()).toBe("");
  });

  it("commits stable value on done", async () => {
    const { value, meta, getCtx } = setupBasicStream({ initialValue: "" });
    const ctx = await getCtx();

    ctx.emit("Hello");
    ctx.done();

    expect(meta.status()).toBe("success");
    expect(value()).toBe("Hello");
    expect(meta.stableValue()).toBe("Hello");
  });

  it("accepts finalValue in done()", async () => {
    const { value, meta, getCtx } = setupBasicStream({ initialValue: "" });
    const ctx = await getCtx();

    ctx.emit("draft");
    ctx.done("final");

    expect(meta.status()).toBe("success");
    expect(value()).toBe("final");
    expect(meta.stableValue()).toBe("final");
  });

  it("closes a completed run and ignores later context mutations", async () => {
    const cleanup = vi.fn();
    const onSuccess = vi.fn();
    let retainedCtx: StreamContext<string, string> | undefined;

    const [value, meta] = createStreamResource<string, string>({
      stream: (_input, ctx) => {
        retainedCtx = ctx;
        ctx.onCleanup(cleanup);
        ctx.onCleanup(cleanup);
      },
      initialValue: "",
      reduce: (current = "", chunk) => current + chunk,
      onSuccess,
    });

    await flushMicrotasks();
    if (!retainedCtx) throw new Error("stream context was not captured");

    retainedCtx.emit("draft");
    retainedCtx.done("final");

    expect(value()).toBe("final");
    expect(meta.stableValue()).toBe("final");
    expect(meta.status()).toBe("success");
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(onSuccess).toHaveBeenCalledWith("final");
    expect(cleanup).toHaveBeenCalledTimes(2);
    expect(retainedCtx.isCancelled()).toBe(false);

    retainedCtx.emit("late-emit");
    retainedCtx.set("late-set");
    retainedCtx.done("late-done");

    expect(value()).toBe("final");
    expect(meta.stableValue()).toBe("final");
    expect(meta.status()).toBe("success");
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(cleanup).toHaveBeenCalledTimes(2);
  });

  it("runs cleanup registered after completion immediately and once", async () => {
    const setup = createDeferred<void>();
    const cleanup = vi.fn();
    let retainedCtx: StreamContext<string, string> | undefined;
    let cleanupRanDuringRegistration = false;

    const [value, meta] = createStreamResource<string, string>({
      stream: async (_input, ctx) => {
        retainedCtx = ctx;
        await setup.promise;
        ctx.onCleanup(cleanup);
        cleanupRanDuringRegistration = cleanup.mock.calls.length === 1;
      },
      initialValue: "",
    });

    await flushMicrotasks();
    if (!retainedCtx) throw new Error("stream context was not captured");

    retainedCtx.done("final");

    expect(meta.status()).toBe("success");
    expect(value()).toBe("final");
    expect(cleanup).not.toHaveBeenCalled();

    setup.resolve();
    await setup.promise;
    await flushMicrotasks();

    expect(cleanup).toHaveBeenCalledOnce();
    expect(cleanupRanDuringRegistration).toBe(true);

    await flushMicrotasks();
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it("supports replacement-style updates via set()", async () => {
    const { value, meta, getCtx } = setupBasicStream({ initialValue: "" });
    const ctx = await getCtx();

    ctx.set("step-1");
    expect(meta.status()).toBe("streaming");
    expect(value()).toBe("step-1");

    ctx.set("step-2");
    expect(value()).toBe("step-2");

    ctx.done();
    expect(meta.stableValue()).toBe("step-2");
  });

  it("resets visible value on source change but keeps stable value", async () => {
    const { source, value, meta, getCtxA, getCtxB } = setupMultiSourceStream({
      initialValue: "",
    });

    const ctxA = await getCtxA();
    ctxA.emit("foo");
    ctxA.done();

    expect(meta.status()).toBe("success");
    expect(value()).toBe("foo");
    expect(meta.stableValue()).toBe("foo");

    source.set("b");
    await flushMicrotasks();

    expect(meta.status()).toBe("pending");
    expect(value()).toBe("");
    expect(meta.stableValue()).toBe("foo");

    const ctxB = await getCtxB();
    ctxB.emit("bar");

    expect(meta.status()).toBe("streaming");
    expect(value()).toBe("bar");
    expect(meta.stableValue()).toBe("foo");
  });

  it("ignores stale chunks from an invalidated previous run", async () => {
    const { source, value, meta, getCtxA, getCtxB } = setupMultiSourceStream({
      initialValue: "",
    });

    const ctxA = await getCtxA();
    ctxA.emit("old");
    expect(value()).toBe("old");

    source.set("b");
    await flushMicrotasks();

    expect(meta.status()).toBe("pending");
    expect(value()).toBe("");

    ctxA.emit("stale");
    expect(value()).toBe("");

    const ctxB = await getCtxB();
    ctxB.emit("new");
    expect(value()).toBe("new");
  });

  it("aborts and cleans up an input-superseded run before replacement", async () => {
    const source = signal("a");
    const lifecycle: string[] = [];
    let ctxA: StreamContext<string, string> | undefined;
    let ctxB: StreamContext<string, string> | undefined;

    const [value, meta] = createStreamResource({
      input: source.get,
      stream: (input, ctx) => {
        lifecycle.push(`start:${input}`);

        if (input === "a") {
          ctxA = ctx;
          ctx.onCleanup(() => {
            lifecycle.push("cleanup:a");
          });
        } else {
          ctxB = ctx;
        }
      },
      initialValue: "",
      reduce: (current = "", chunk: string) => current + chunk,
    });

    await flushMicrotasks();
    if (!ctxA) throw new Error("Context for input 'a' was not captured");
    const supersededCtx = ctxA;

    supersededCtx.emit("old");
    source.set("b");
    await flushMicrotasks();

    if (!ctxB) throw new Error("Context for input 'b' was not captured");
    const activeCtx = ctxB;

    expect(supersededCtx.signal.aborted).toBe(true);
    expect(lifecycle).toEqual(["start:a", "cleanup:a", "start:b"]);

    activeCtx.emit("new");
    supersededCtx.emit("stale-emit");
    supersededCtx.set("stale-set");
    supersededCtx.done("stale-done");

    expect(value()).toBe("new");
    expect(meta.status()).toBe("streaming");
    expect(meta.stableValue()).toBe("");
  });

  it("does not start a stale producer during rapid input supersession", async () => {
    const source = signal("a");
    const startedInputs: string[] = [];

    createStreamResource({
      input: source.get,
      stream: (input) => {
        startedInputs.push(input);
      },
    });

    source.set("b");
    await flushMicrotasks(4);

    expect(startedInputs).toEqual(["b"]);
  });

  it("reload starts a new stream session and resets visible value", async () => {
    const { value, meta, getCtx } = setupBasicStream({ initialValue: "" });

    const firstCtx = await getCtx();
    firstCtx.emit("foo");
    firstCtx.done();

    expect(meta.status()).toBe("success");
    expect(value()).toBe("foo");
    expect(meta.stableValue()).toBe("foo");

    meta.reload();

    expect(meta.status()).toBe("pending");
    expect(value()).toBe("");
    expect(meta.stableValue()).toBe("foo");
  });

  it("reload aborts and cleans up the active run before replacing it", async () => {
    const source = signal("room-a");
    const lifecycle: string[] = [];
    const contexts: StreamContext<string, string>[] = [];

    const [value, meta] = createStreamResource({
      input: source.get,
      stream: (input, ctx) => {
        const runNumber = contexts.length + 1;
        contexts.push(ctx);
        lifecycle.push(`start:${input}:${runNumber}`);
        ctx.onCleanup(() => {
          lifecycle.push(`cleanup:${input}:${runNumber}`);
        });
      },
      initialValue: "stable",
    });

    await flushMicrotasks();
    const firstCtx = contexts[0];
    if (!firstCtx) throw new Error("First reload context was not captured");

    firstCtx.set("draft");
    expect(meta.status()).toBe("streaming");

    meta.reload();

    expect(firstCtx.signal.aborted).toBe(true);
    expect(lifecycle).toEqual(["start:room-a:1", "cleanup:room-a:1"]);
    expect(meta.status()).toBe("pending");
    expect(value()).toBe("stable");
    expect(meta.stableValue()).toBe("stable");

    await flushMicrotasks();

    expect(contexts).toHaveLength(2);
    expect(lifecycle).toEqual([
      "start:room-a:1",
      "cleanup:room-a:1",
      "start:room-a:2",
    ]);
  });

  it("manual cancel applies keep-partial policy", async () => {
    const { value, meta, getCtx } = setupBasicStream({
      initialValue: "",
      onCancel: "keep-partial",
    });

    const ctx = await getCtx();
    ctx.emit("draft");

    meta.cancel("user-stop");

    expect(meta.status()).toBe("cancelled");
    expect(value()).toBe("draft");
    expect(meta.stableValue()).toBe("");
  });

  it("manual cancel aborts the active producer and runs cleanup exactly once", async () => {
    const cleanup = vi.fn();
    let producerSignal: AbortSignal | undefined;

    const [value, meta] = createStreamResource({
      stream: (_input, ctx) => {
        producerSignal = ctx.signal;
        ctx.onCleanup(cleanup);
        ctx.emit("draft");
      },
      initialValue: "",
      reduce: (current = "", chunk: string) => current + chunk,
      onCancel: "keep-partial",
    });

    await flushMicrotasks();

    expect(producerSignal?.aborted).toBe(false);

    meta.cancel("manual");

    expect(producerSignal?.aborted).toBe(true);
    expect(producerSignal?.reason).toBe("manual");
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(meta.status()).toBe("cancelled");
    expect(value()).toBe("draft");
    expect(meta.stableValue()).toBe("");

    meta.cancel("again");
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("does not start a deferred producer after synchronous cancellation", async () => {
    const stream = vi.fn(
      (_input: undefined, _ctx: StreamContext<string, string>) => undefined,
    );

    const [, meta] = createStreamResource({ stream });

    meta.cancel("manual");
    expect(meta.status()).toBe("cancelled");

    await flushMicrotasks();

    expect(stream).not.toHaveBeenCalled();
  });

  it("manual cancel applies rollback policy", async () => {
    const { value, meta, getCtx } = setupBasicStream({
      initialValue: "",
      onCancel: "rollback",
    });

    const ctx = await getCtx();
    ctx.emit("draft");

    meta.cancel("user-stop");

    expect(meta.status()).toBe("cancelled");
    expect(value()).toBe("");
    expect(meta.stableValue()).toBe("");
  });

  it("manual cancel applies clear policy", async () => {
    const { value, meta, getCtx } = setupBasicStream({
      initialValue: "seed",
      onCancel: "clear",
    });

    const ctx = await getCtx();
    ctx.emit("draft");

    meta.cancel("user-stop");

    expect(meta.status()).toBe("cancelled");
    expect(value()).toBe("seed");
    expect(meta.stableValue()).toBe("seed");
  });

  it("fails an active stream from a retained push callback", async () => {
    const failure = new Error("transport failed");
    const cleanup = vi.fn();
    const onErrorEffect = vi.fn();
    let failFromTransport: ((error: Error) => void) | undefined;

    const [value, meta] = createStreamResource<string, string, Error>({
      stream: (_input, ctx) => {
        ctx.emit("partial");
        ctx.onCleanup(cleanup);
        failFromTransport = (error) => ctx.fail(error);
      },
      initialValue: "stable",
      reduce: (current = "", chunk) => current + chunk,
      onError: "rollback",
      onErrorEffect,
    });

    await flushMicrotasks();

    expect(meta.status()).toBe("streaming");
    expect(value()).toBe("stablepartial");
    if (!failFromTransport) throw new Error("failure callback was not captured");

    failFromTransport(failure);

    expect(meta.error()).toBe(failure);
    expect(meta.status()).toBe("error");
    expect(value()).toBe("stable");
    expect(meta.stableValue()).toBe("stable");
    expect(cleanup).toHaveBeenCalledOnce();
    expect(onErrorEffect).toHaveBeenCalledOnce();
    expect(onErrorEffect).toHaveBeenCalledWith(failure);
  });

  it("ignores failure reported by a superseded stream context", async () => {
    const source = signal("a");
    const contexts = new Map<
      string,
      StreamContext<string, string, Error>
    >();
    const onErrorEffect = vi.fn();

    const [value, meta] = createStreamResource<
      string,
      string,
      string,
      Error
    >({
      input: source.get,
      stream: (input, ctx) => {
        contexts.set(input, ctx);
      },
      initialValue: "stable",
      reduce: (current = "", chunk) => current + chunk,
      onError: "rollback",
      onErrorEffect,
    });

    await flushMicrotasks();
    const staleCtx = contexts.get("a");
    if (!staleCtx) throw new Error("first stream context was not captured");

    source.set("b");
    await flushMicrotasks();

    const activeCtx = contexts.get("b");
    if (!activeCtx) throw new Error("replacement context was not captured");
    activeCtx.emit("active");

    staleCtx.fail(new Error("stale transport failure"));

    expect(value()).toBe("stableactive");
    expect(meta.stableValue()).toBe("stable");
    expect(meta.status()).toBe("streaming");
    expect(meta.error()).toBeUndefined();
    expect(onErrorEffect).not.toHaveBeenCalled();
  });

  it("commits only the first failure reported by a stream context", async () => {
    const firstFailure = new Error("first transport failure");
    const secondFailure = new Error("second transport failure");
    const cleanup = vi.fn();
    const onErrorEffect = vi.fn();
    let retainedCtx: StreamContext<string, string, Error> | undefined;

    const [value, meta] = createStreamResource<string, string, Error>({
      stream: (_input, ctx) => {
        retainedCtx = ctx;
        ctx.emit("partial");
        ctx.onCleanup(cleanup);
      },
      initialValue: "stable",
      reduce: (current = "", chunk) => current + chunk,
      onError: "rollback",
      onErrorEffect,
    });

    await flushMicrotasks();
    if (!retainedCtx) throw new Error("stream context was not captured");

    retainedCtx.fail(firstFailure);
    retainedCtx.fail(secondFailure);

    expect(meta.error()).toBe(firstFailure);
    expect(meta.status()).toBe("error");
    expect(value()).toBe("stable");
    expect(meta.stableValue()).toBe("stable");
    expect(cleanup).toHaveBeenCalledOnce();
    expect(onErrorEffect).toHaveBeenCalledOnce();
    expect(onErrorEffect).toHaveBeenCalledWith(firstFailure);
  });

  it("applies the same terminal error behavior to every producer failure", async () => {
    const modes = ["throw", "reject", "callback"] as const;

    for (const mode of modes) {
      const failure = new Error(`${mode} failure`);
      const cleanup = vi.fn();
      const onErrorEffect = vi.fn();
      let retainedCtx: StreamContext<string, string, Error> | undefined;
      let failFromCallback: (() => void) | undefined;

      const [value, meta] = createStreamResource<string, string, Error>({
        stream: (_input, ctx) => {
          retainedCtx = ctx;
          ctx.emit("partial");
          ctx.onCleanup(cleanup);

          if (mode === "throw") throw failure;
          if (mode === "reject") return Promise.reject(failure);

          failFromCallback = () => ctx.fail(failure);
        },
        initialValue: "stable",
        reduce: (current = "", chunk) => current + chunk,
        onError: "rollback",
        onErrorEffect,
      });

      await flushMicrotasks(4);
      if (mode === "callback") failFromCallback?.();
      await flushMicrotasks();

      expect(meta.error(), mode).toBe(failure);
      expect(meta.status(), mode).toBe("error");
      expect(value(), mode).toBe("stable");
      expect(meta.stableValue(), mode).toBe("stable");
      expect(cleanup, mode).toHaveBeenCalledOnce();
      expect(onErrorEffect, mode).toHaveBeenCalledOnce();
      expect(onErrorEffect, mode).toHaveBeenCalledWith(failure);

      if (!retainedCtx) throw new Error(`${mode} context was not captured`);
      retainedCtx.emit("late");
      expect(value(), mode).toBe("stable");
    }
  });

  it("does not treat producer Promise fulfillment as completion", async () => {
    const producer = createDeferred<void>();
    let retainedCtx: StreamContext<string, string> | undefined;

    const [value, meta] = createStreamResource<string, string>({
      stream: async (_input, ctx) => {
        retainedCtx = ctx;
        ctx.emit("partial");
        await producer.promise;
      },
      initialValue: "stable",
      reduce: (current = "", chunk) => current + chunk,
    });

    await flushMicrotasks();
    expect(meta.status()).toBe("streaming");

    producer.resolve();
    await producer.promise;
    await flushMicrotasks();

    expect(meta.status()).toBe("streaming");
    expect(value()).toBe("stablepartial");
    expect(meta.stableValue()).toBe("stable");

    if (!retainedCtx) throw new Error("stream context was not captured");
    retainedCtx.emit("more");

    expect(meta.status()).toBe("streaming");
    expect(value()).toBe("stablepartialmore");
    expect(meta.stableValue()).toBe("stable");
  });

  it("applies every error policy to callback failure", async () => {
    const cases = [
      { policy: "rollback" as const, expectedValue: "committed" },
      { policy: "keep-partial" as const, expectedValue: "initialpartial" },
      { policy: "clear" as const, expectedValue: "initial" },
    ];

    for (const { policy, expectedValue } of cases) {
      const contexts: StreamContext<string, string, Error>[] = [];
      const failure = new Error(`${policy} callback failure`);

      const [value, meta] = createStreamResource<string, string, Error>({
        stream: (_input, ctx) => {
          contexts.push(ctx);
        },
        initialValue: "initial",
        reduce: (current = "", chunk) => current + chunk,
        onError: policy,
      });

      await flushMicrotasks();
      const firstCtx = contexts[0];
      if (!firstCtx) throw new Error(`${policy} first context was not captured`);
      firstCtx.done("committed");

      meta.reload();
      await flushMicrotasks();

      const secondCtx = contexts[1];
      if (!secondCtx) {
        throw new Error(`${policy} replacement context was not captured`);
      }

      secondCtx.emit("partial");
      secondCtx.fail(failure);

      expect(meta.error(), policy).toBe(failure);
      expect(meta.status(), policy).toBe("error");
      expect(value(), policy).toBe(expectedValue);
      expect(meta.stableValue(), policy).toBe("committed");
    }
  });

  it("error applies rollback policy", async () => {
    const sourceValue = "a";
    const source = () => sourceValue;

    const deferred = createDeferred<void>();

    const [value, meta] = createStreamResource<string, string, string>(
      source,
      async (_source, ctx) => {
        ctx.emit("partial");
        await deferred.promise;
      },
      {
        initialValue: "",
        reduce: (current = "", chunk: string) => current + chunk,
        onError: "rollback",
      },
    );

    expect(meta.status()).toBe("pending");

    await flushMicrotasks();
    expect(meta.status()).toBe("streaming");
    expect(value()).toBe("partial");

    deferred.reject(new Error("boom"));
    await flushMicrotasks();

    expect(meta.status()).toBe("error");
    expect(value()).toBe("");
    expect(meta.stableValue()).toBe("");
    expect(meta.error()).toBeInstanceOf(Error);
  });

  it("error applies keep-partial policy", async () => {
    const sourceValue = "a";
    const source = () => sourceValue;

    const deferred = createDeferred<void>();

    const [value, meta] = createStreamResource<string, string, string>(
      source,
      async (_source, ctx) => {
        ctx.emit("partial");
        await deferred.promise;
      },
      {
        initialValue: "",
        reduce: (current = "", chunk: string) => current + chunk,
        onError: "keep-partial",
      },
    );

    await flushMicrotasks();
    expect(meta.status()).toBe("streaming");
    expect(value()).toBe("partial");

    deferred.reject(new Error("boom"));
    await flushMicrotasks();

    expect(meta.status()).toBe("error");
    expect(value()).toBe("partial");
    expect(meta.stableValue()).toBe("");
  });

  it("error applies clear policy", async () => {
    const sourceValue = "a";
    const source = () => sourceValue;

    const deferred = createDeferred<void>();

    const [value, meta] = createStreamResource<string, string, string>(
      source,
      async (_source, ctx) => {
        ctx.emit("partial");
        await deferred.promise;
      },
      {
        initialValue: "seed",
        reduce: (current = "", chunk: string) => current + chunk,
        onError: "clear",
      },
    );

    await flushMicrotasks();
    expect(meta.status()).toBe("streaming");

    deferred.reject(new Error("boom"));
    await flushMicrotasks();

    expect(meta.status()).toBe("error");
    expect(value()).toBe("seed");
    expect(meta.stableValue()).toBe("seed");
  });

  it("ignores async failure from an invalidated previous run", async () => {
    const { promise, reject } = createDeferred<void>();
    const sourceHolder = { current: "a" as "a" | "b" };

    const source = () => sourceHolder.current;

    let ctxA: StreamContext<string, string> | undefined;
    let ctxB: StreamContext<string, string> | undefined;

    const [value, meta] = createStreamResource<string, string, string>(
      source,
      async (current, ctx) => {
        if (current === "a") {
          ctxA = ctx;
          ctx.emit("old");
          await promise;
          return;
        }

        if (current === "b") {
          ctxB = ctx;
        }
      },
      {
        initialValue: "",
        reduce: (current = "", chunk: string) => current + chunk,
        onError: "rollback",
      },
    );

    await flushMicrotasks();
    expect(value()).toBe("old");
    expect(meta.status()).toBe("streaming");

    sourceHolder.current = "b";
    meta.reload();

    expect(meta.status()).toBe("pending");
    expect(value()).toBe("");

    reject(new Error("stale failure"));
    await flushMicrotasks();

    expect(meta.status()).toBe("pending");
    expect(meta.error()).toBeUndefined();

    ctxA?.emit("ignored");
    expect(value()).toBe("");

    ctxB?.emit("new");
    expect(meta.status()).toBe("streaming");
    expect(value()).toBe("new");
  });

  it("supports object-form stream resources with tracked input", async () => {
    const source = signal("a");
    const contexts = new Map<string, StreamContext<string, string>>();
    const stream = vi.fn((input: string, ctx: StreamContext<string, string>) => {
      contexts.set(input, ctx);
    });

    const [value, meta] = createStreamResource({
      input: source.get,
      stream,
      initialValue: "",
      reduce: (current = "", chunk: string) => current + chunk,
    });

    expect(meta.status()).toBe("pending");

    await flushMicrotasks();

    expect(stream).toHaveBeenCalledTimes(1);
    expect(stream).toHaveBeenLastCalledWith("a", expect.any(Object));

    contexts.get("a")?.emit("old");
    expect(value()).toBe("old");

    source.set("b");
    await flushMicrotasks();

    expect(stream).toHaveBeenCalledTimes(2);
    expect(stream).toHaveBeenLastCalledWith("b", expect.any(Object));
    expect(value()).toBe("");

    contexts.get("a")?.emit("stale");
    expect(value()).toBe("");

    contexts.get("b")?.emit("new");
    expect(value()).toBe("new");
  });

  it("tracks object-form observe dependencies without passing them to stream", async () => {
    const revision = createRevision();
    const lifecycle: string[] = [];
    const contexts: StreamContext<string, string>[] = [];
    const stream = vi.fn((input: string, ctx: StreamContext<string, string>) => {
      const runNumber = contexts.length + 1;
      contexts.push(ctx);
      lifecycle.push(`start:${input}:${runNumber}`);
      ctx.onCleanup(() => {
        lifecycle.push(`cleanup:${input}:${runNumber}`);
      });
    });

    const [value, meta] = createStreamResource({
      input: () => "room-a",
      observe: () => {
        revision.get();
      },
      stream,
      initialValue: "",
      reduce: (current = "", chunk: string) => current + chunk,
    });

    await flushMicrotasks();

    expect(stream).toHaveBeenCalledTimes(1);
    expect(stream).toHaveBeenLastCalledWith("room-a", expect.any(Object));
    const firstCtx = contexts[0];
    if (!firstCtx) throw new Error("First observed context was not captured");
    firstCtx.emit("old");

    revision.invalidate();
    await flushMicrotasks();

    expect(stream).toHaveBeenCalledTimes(2);
    expect(stream).toHaveBeenLastCalledWith("room-a", expect.any(Object));
    expect(firstCtx.signal.aborted).toBe(true);
    expect(lifecycle).toEqual([
      "start:room-a:1",
      "cleanup:room-a:1",
      "start:room-a:2",
    ]);

    const secondCtx = contexts[1];
    if (!secondCtx) throw new Error("Second observed context was not captured");
    secondCtx.emit("new");
    firstCtx.emit("stale-emit");
    firstCtx.set("stale-set");
    firstCtx.done("stale-done");

    expect(value()).toBe("new");
    expect(meta.status()).toBe("streaming");
    expect(meta.stableValue()).toBe("");
  });

  it("does not duplicate stream sessions when input and observe change in the same batch", async () => {
    const source = signal("a");
    const revision = createRevision();
    const stream = vi.fn(
      (_input: string, _ctx: StreamContext<string, string>) => undefined,
    );

    createStreamResource({
      input: source.get,
      observe: () => {
        revision.get();
      },
      stream,
      initialValue: "",
      reduce: (current = "", chunk: string) => current + chunk,
    });

    await flushMicrotasks();

    expect(stream).toHaveBeenCalledTimes(1);

    batch(() => {
      source.set("b");
      revision.invalidate();
    });

    await flushMicrotasks();

    expect(stream).toHaveBeenCalledTimes(2);
    expect(stream).toHaveBeenLastCalledWith("b", expect.any(Object));
  });

  it("supports parameterless object-form stream resources", async () => {
    const stream = vi.fn(
      (input: undefined, ctx: StreamContext<string, string>) => {
        expect(input).toBeUndefined();
        ctx.emit("chunk");
        ctx.done();
      },
    );

    const [value, meta] = createStreamResource({
      stream,
      initialValue: "",
      reduce: (current = "", chunk: string) => current + chunk,
    });

    await flushMicrotasks();

    expect(stream).toHaveBeenCalledTimes(1);
    expect(stream).toHaveBeenLastCalledWith(undefined, expect.any(Object));
    expect(meta.status()).toBe("success");
    expect(value()).toBe("chunk");
    expect(meta.stableValue()).toBe("chunk");
  });
});
