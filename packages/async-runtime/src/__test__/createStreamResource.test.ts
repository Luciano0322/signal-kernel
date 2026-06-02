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
    const stream = vi.fn(
      (_input: string, _ctx: StreamContext<string, string>) => undefined,
    );

    createStreamResource({
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

    revision.invalidate();
    await flushMicrotasks();

    expect(stream).toHaveBeenCalledTimes(2);
    expect(stream).toHaveBeenLastCalledWith("room-a", expect.any(Object));
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
