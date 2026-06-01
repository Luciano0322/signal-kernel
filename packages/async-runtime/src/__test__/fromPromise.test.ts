import { describe, expect, it, vi } from "vitest";
import { fromPromise } from "../fromPromise.js";

const tick = () => Promise.resolve();

describe("fromPromise", () => {
  it("runs with explicit input and returns the latest successful result", async () => {
    const makePromise = vi.fn(
      (input: string, _ctx: { signal: AbortSignal; token: number }) =>
        Promise.resolve(input.length),
    );

    const asyncSig = fromPromise<string, number>({ run: makePromise });

    expect(makePromise).not.toHaveBeenCalled();
    expect(asyncSig.status()).toBe("idle");

    const result = await asyncSig.run("alice");
    await tick();

    expect(result).toBe(5);
    expect(makePromise).toHaveBeenCalledWith(
      "alice",
      expect.objectContaining({ signal: expect.any(AbortSignal), token: 1 }),
    );
    expect(asyncSig.status()).toBe("success");
    expect(asyncSig.value()).toBe(5);
  });

  it("descriptor reload is a no-op before an input is established", async () => {
    const makePromise = vi.fn(
      (input: string, _ctx: { signal: AbortSignal; token: number }) =>
        Promise.resolve(input.length),
    );

    const asyncSig = fromPromise<string, number>({ run: makePromise });

    await expect(asyncSig.reload()).resolves.toBeUndefined();

    expect(makePromise).not.toHaveBeenCalled();
    expect(asyncSig.status()).toBe("idle");
  });

  it("descriptor eager execution requires and uses an initial input", async () => {
    const makePromise = vi.fn(
      (input: string, _ctx: { signal: AbortSignal; token: number }) =>
        Promise.resolve(input.length),
    );

    const asyncSig = fromPromise<string, number>({
      eager: true,
      initialInput: "alice",
      run: makePromise,
    });

    expect(asyncSig.status()).toBe("pending");
    expect(makePromise).toHaveBeenCalledWith(
      "alice",
      expect.objectContaining({ signal: expect.any(AbortSignal), token: 1 }),
    );

    await tick();

    expect(asyncSig.status()).toBe("success");
    expect(asyncSig.value()).toBe(5);
  });

  it("reload reruns the latest explicit input", async () => {
    const makePromise = vi.fn(
      (input: string, _ctx: { signal: AbortSignal; token: number }) =>
        Promise.resolve(`${input}:${Date.now()}`),
    );

    const asyncSig = fromPromise<string, string>({ run: makePromise });

    await asyncSig.run("user-1");
    await asyncSig.reload();

    expect(makePromise).toHaveBeenCalledTimes(2);
    expect(makePromise.mock.calls[1]![0]).toBe("user-1");
  });

  it("resolves run() with undefined when the producer fails", async () => {
    const error = new Error("boom");
    const onError = vi.fn();
    const makePromise = vi.fn(
      (_input: string, _ctx: { signal: AbortSignal; token: number }) =>
        Promise.reject(error),
    );

    const asyncSig = fromPromise<string, number, Error>({
      run: makePromise,
      onError,
    });

    const result = await asyncSig.run("bad-input");

    expect(result).toBeUndefined();
    expect(asyncSig.status()).toBe("error");
    expect(asyncSig.error()).toBe(error);
    expect(onError).toHaveBeenCalledWith(error);
  });

  it("starts in pending state by default and invokes the producer immediately", () => {
    const makePromise = vi.fn(
      (_ctx: { signal: AbortSignal; token: number }) =>
        new Promise<number>(() => {}),
    );

    const asyncSig = fromPromise(makePromise);

    expect(makePromise).toHaveBeenCalledTimes(1);

    const firstCallArg = makePromise.mock.calls[0]![0];
    expect(firstCallArg.signal).toBeInstanceOf(AbortSignal);

    expect(asyncSig.status()).toBe("pending");
    expect(asyncSig.value()).toBeUndefined();
    expect(asyncSig.error()).toBeUndefined();
  });

  it("starts idle and does not invoke the producer when eager is false", () => {
    const makePromise = vi.fn(
      (_ctx: { signal: AbortSignal; token: number }) => Promise.resolve(123),
    );

    const asyncSig = fromPromise(makePromise, { eager: false });

    expect(makePromise).not.toHaveBeenCalled();
    expect(asyncSig.status()).toBe("idle");
    expect(asyncSig.value()).toBeUndefined();
    expect(asyncSig.error()).toBeUndefined();
  });

  it("reload starts work and moves the status to pending", () => {
    const makePromise = vi.fn(
      (_ctx: { signal: AbortSignal; token: number }) =>
        new Promise<number>(() => {}),
    );

    const asyncSig = fromPromise(makePromise, { eager: false });

    expect(asyncSig.status()).toBe("idle");

    asyncSig.reload();

    expect(makePromise).toHaveBeenCalledTimes(1);
    expect(asyncSig.status()).toBe("pending");
  });

  it("commits the value and success status when the producer resolves", async () => {
    let resolveFn!: (v: number) => void;

    const makePromise = vi.fn(
      (_ctx: { signal: AbortSignal; token: number }) =>
        new Promise<number>((resolve) => {
          resolveFn = resolve;
        }),
    );

    const asyncSig = fromPromise(makePromise);

    expect(asyncSig.status()).toBe("pending");
    expect(asyncSig.value()).toBeUndefined();

    resolveFn(42);
    await tick();

    expect(asyncSig.status()).toBe("success");
    expect(asyncSig.value()).toBe(42);
    expect(asyncSig.error()).toBeUndefined();
  });

  it("commits the error and error status when the producer rejects", async () => {
    let rejectFn!: (err: unknown) => void;

    const makePromise = vi.fn(
      (_ctx: { signal: AbortSignal; token: number }) =>
        new Promise<never>((_, reject) => {
          rejectFn = reject;
        }),
    );

    const asyncSig = fromPromise<number, Error>(makePromise);

    expect(asyncSig.status()).toBe("pending");

    const err = new Error("boom");
    rejectFn(err);
    await tick();

    expect(asyncSig.status()).toBe("error");
    expect(asyncSig.value()).toBeUndefined();
    expect(asyncSig.error()).toBe(err);
  });

  it("cancel moves the status to cancelled and ignores a later resolution", async () => {
    let resolveFn!: (v: number) => void;

    const makePromise = vi.fn(
      (_ctx: { signal: AbortSignal; token: number }) =>
        new Promise<number>((resolve) => {
          resolveFn = resolve;
        }),
    );

    const asyncSig = fromPromise(makePromise);

    expect(asyncSig.status()).toBe("pending");

    asyncSig.cancel();
    expect(asyncSig.status()).toBe("cancelled");

    resolveFn(999);
    await tick();

    expect(asyncSig.status()).toBe("cancelled");
    expect(asyncSig.value()).toBeUndefined();
    expect(asyncSig.error()).toBeUndefined();
  });

  it("reload starts a newer run and prevents the older result from overwriting it", async () => {
    let resolveFirst!: (v: number) => void;
    let resolveSecond!: (v: number) => void;
    let callCount = 0;

    const makePromise = vi.fn((_ctx: { signal: AbortSignal; token: number }) => {
      callCount += 1;

      if (callCount === 1) {
        return new Promise<number>((resolve) => {
          resolveFirst = resolve;
        });
      }

      return new Promise<number>((resolve) => {
        resolveSecond = resolve;
      });
    });

    const asyncSig = fromPromise(makePromise);

    expect(asyncSig.status()).toBe("pending");

    asyncSig.reload();

    expect(makePromise).toHaveBeenCalledTimes(2);
    expect(asyncSig.status()).toBe("pending");

    resolveSecond(2);
    await tick();

    expect(asyncSig.status()).toBe("success");
    expect(asyncSig.value()).toBe(2);

    resolveFirst(1);
    await tick();

    expect(asyncSig.status()).toBe("success");
    expect(asyncSig.value()).toBe(2);
  });

  it("calls success and error callbacks for matching outcomes", async () => {
    let resolveFn!: (v: number) => void;
    let rejectFn!: (err: unknown) => void;

    const makePromiseSuccess = vi.fn(
      (_ctx: { signal: AbortSignal; token: number }) =>
        new Promise<number>((resolve) => {
          resolveFn = resolve;
        }),
    );

    const makePromiseError = vi.fn(
      (_ctx: { signal: AbortSignal; token: number }) =>
        new Promise<number>((_, reject) => {
          rejectFn = reject;
        }),
    );

    const onSuccess = vi.fn();
    const onError = vi.fn();

    const okSig = fromPromise(makePromiseSuccess, { onSuccess });
    resolveFn(7);
    await tick();
    expect(onSuccess).toHaveBeenCalledWith(7);

    const errSig = fromPromise(makePromiseError, { onError });
    const error = new Error("oops");
    rejectFn(error);
    await tick();
    expect(onError).toHaveBeenCalledWith(error);

    expect(okSig.status()).toBe("success");
    expect(errSig.status()).toBe("error");
  });

  it("keeps the previous successful value while pending by default", async () => {
    let resolveFirst!: (v: number) => void;
    let resolveSecond!: (v: number) => void;
    let callCount = 0;

    const makePromise = vi.fn((_ctx: { signal: AbortSignal; token: number }) => {
      callCount += 1;

      if (callCount === 1) {
        return new Promise<number>((resolve) => {
          resolveFirst = resolve;
        });
      }

      return new Promise<number>((resolve) => {
        resolveSecond = resolve;
      });
    });

    const asyncSig = fromPromise(makePromise);

    expect(asyncSig.status()).toBe("pending");
    resolveFirst(1);
    await tick();

    expect(asyncSig.status()).toBe("success");
    expect(asyncSig.value()).toBe(1);

    asyncSig.reload();

    expect(asyncSig.status()).toBe("pending");
    expect(asyncSig.value()).toBe(1);

    resolveSecond(2);
    await tick();

    expect(asyncSig.status()).toBe("success");
    expect(asyncSig.value()).toBe(2);
  });

  it("clears the previous value while pending when configured", async () => {
    let resolveFirst!: (v: number) => void;
    let resolveSecond!: (v: number) => void;
    let callCount = 0;

    const makePromise = vi.fn((_ctx: { signal: AbortSignal; token: number }) => {
      callCount += 1;

      if (callCount === 1) {
        return new Promise<number>((resolve) => {
          resolveFirst = resolve;
        });
      }

      return new Promise<number>((resolve) => {
        resolveSecond = resolve;
      });
    });

    const asyncSig = fromPromise(makePromise, {
      keepPreviousValueOnPending: false,
    });

    expect(asyncSig.status()).toBe("pending");
    resolveFirst(1);
    await tick();

    expect(asyncSig.status()).toBe("success");
    expect(asyncSig.value()).toBe(1);

    asyncSig.reload();

    expect(asyncSig.status()).toBe("pending");
    expect(asyncSig.value()).toBeUndefined();

    resolveSecond(2);
    await tick();

    expect(asyncSig.status()).toBe("success");
    expect(asyncSig.value()).toBe(2);
  });

  it("calls onCancel without treating cancellation as an error", async () => {
    let resolveFn!: (v: number) => void;

    const makePromise = vi.fn(
      (_ctx: { signal: AbortSignal; token: number }) =>
        new Promise<number>((resolve) => {
          resolveFn = resolve;
        }),
    );

    const onCancel = vi.fn();
    const onError = vi.fn();

    const asyncSig = fromPromise(makePromise, { onCancel, onError });

    expect(asyncSig.status()).toBe("pending");

    asyncSig.cancel("test-reason");

    expect(asyncSig.status()).toBe("cancelled");
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledWith("test-reason");

    resolveFn(123);
    await tick();

    expect(asyncSig.status()).toBe("cancelled");
    expect(asyncSig.value()).toBeUndefined();
    expect(asyncSig.error()).toBeUndefined();
    expect(onError).not.toHaveBeenCalled();
  });

  it("moves to error status when the producer throws synchronously", () => {
    const err = new Error("sync boom");

    const makePromise = vi.fn((_ctx: { signal: AbortSignal; token: number }) => {
      throw err;
    });

    const onError = vi.fn();

    const asyncSig = fromPromise<number, Error>(makePromise, { onError });

    expect(asyncSig.status()).toBe("error");
    expect(asyncSig.error()).toBe(err);
    expect(onError).toHaveBeenCalledWith(err);
  });

  it("keeps cancellation status when the producer rejects with AbortError", async () => {
    const makePromise = vi.fn(
      (ctx: { signal: AbortSignal; token: number }) =>
        new Promise<number>((_resolve, reject) => {
          ctx.signal.addEventListener("abort", () => {
            const abortErr =
              typeof DOMException !== "undefined"
                ? new DOMException("Aborted", "AbortError")
                : Object.assign(new Error("Aborted"), { name: "AbortError" });

            reject(abortErr);
          });
        }),
    );

    const onError = vi.fn();
    const asyncSig = fromPromise(makePromise, { onError });

    expect(asyncSig.status()).toBe("pending");

    asyncSig.cancel("user-cancel");

    expect(asyncSig.status()).toBe("cancelled");

    await tick();

    expect(asyncSig.status()).toBe("cancelled");
    expect(asyncSig.error()).toBeUndefined();
    expect(onError).not.toHaveBeenCalled();

    const ctx = makePromise.mock.calls[0]![0];
    expect(ctx.signal.aborted).toBe(true);
  });

  it("keeps the newer run pending when a superseded run rejects with AbortError", async () => {
    let resolveSecond!: (v: number) => void;
    let callCount = 0;

    const makePromise = vi.fn((ctx: { signal: AbortSignal; token: number }) => {
      callCount += 1;

      if (callCount === 1) {
        return new Promise<number>((_resolve, reject) => {
          ctx.signal.addEventListener("abort", () => {
            const abortErr =
              typeof DOMException !== "undefined"
                ? new DOMException("Superseded", "AbortError")
                : Object.assign(new Error("Superseded"), { name: "AbortError" });
            reject(abortErr);
          });
        });
      }

      return new Promise<number>((resolve) => {
        resolveSecond = resolve;
      });
    });

    const onError = vi.fn();
    const asyncSig = fromPromise(makePromise, { onError });

    expect(makePromise).toHaveBeenCalledTimes(1);
    expect(asyncSig.status()).toBe("pending");

    asyncSig.reload();
    expect(makePromise).toHaveBeenCalledTimes(2);
    expect(asyncSig.status()).toBe("pending");

    await tick();

    expect(asyncSig.status()).toBe("pending");
    expect(asyncSig.error()).toBeUndefined();
    expect(onError).not.toHaveBeenCalled();

    resolveSecond(2);
    await tick();

    expect(asyncSig.status()).toBe("success");
    expect(asyncSig.value()).toBe(2);
    expect(asyncSig.error()).toBeUndefined();
    expect(onError).not.toHaveBeenCalled();
  });
});
