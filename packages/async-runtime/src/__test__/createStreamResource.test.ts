import { describe, expect, it } from "vitest";
import { createStreamResource } from "../createStreamResource.js";
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

    // stale emission from old run should be ignored
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
    // re-enter through reload since source is not a signal in this test
    meta.reload();

    expect(meta.status()).toBe("pending");
    expect(value()).toBe("");

    reject(new Error("stale failure"));
    await flushMicrotasks();

    // stale failure from old run should not overwrite current run
    expect(meta.status()).toBe("pending");
    expect(meta.error()).toBeUndefined();

    ctxA?.emit("ignored");
    expect(value()).toBe("");

    ctxB?.emit("new");
    expect(meta.status()).toBe("streaming");
    expect(value()).toBe("new");
  });
});
