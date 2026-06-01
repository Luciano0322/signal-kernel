import { describe, expect, it, vi } from "vitest";
import { asyncSignal } from "../asyncSignal.js";

const tick = () => Promise.resolve();

describe("asyncSignal", () => {
  it("exposes run(input) for input-based async work", async () => {
    const makePromise = vi.fn(
      (input: string, _ctx: { signal: AbortSignal; token: number }) =>
        Promise.resolve(input.toUpperCase()),
    );

    const [value, meta] = asyncSignal<string, string>(makePromise, {
      eager: false,
    });

    const result = await meta.run("alice");

    expect(result).toBe("ALICE");
    expect(value()).toBe("ALICE");
    expect(meta.status()).toBe("success");
    expect(makePromise).toHaveBeenCalledWith(
      "alice",
      expect.objectContaining({ signal: expect.any(AbortSignal), token: 1 }),
    );
  });

  it("starts in pending state by default and exposes metadata", () => {
    const makePromise = vi.fn(
      (_ctx: { signal: AbortSignal; token: number }) =>
        new Promise<number>(() => {}),
    );

    const [user, meta] = asyncSignal(makePromise);

    expect(makePromise).toHaveBeenCalledTimes(1);
    expect(meta.status()).toBe("pending");
    expect(user()).toBeUndefined();
    expect(meta.error()).toBeUndefined();
    expect(meta.keepPreviousValueOnPending).toBe(true);

    const ctx = makePromise.mock.calls[0]![0];
    expect(ctx.signal).toBeInstanceOf(AbortSignal);
  });

  it("commits the value and success status when the producer resolves", async () => {
    let resolveFn!: (v: number) => void;

    const makePromise = vi.fn(
      (_ctx: { signal: AbortSignal; token: number }) =>
        new Promise<number>((resolve) => {
          resolveFn = resolve;
        }),
    );

    const [user, meta] = asyncSignal(makePromise);

    expect(meta.status()).toBe("pending");
    expect(user()).toBeUndefined();

    resolveFn(42);
    await tick();

    expect(meta.status()).toBe("success");
    expect(user()).toBe(42);
    expect(meta.error()).toBeUndefined();
  });

  it("commits the error and error status when the producer rejects", async () => {
    let rejectFn!: (err: unknown) => void;

    const makePromise = vi.fn(
      (_ctx: { signal: AbortSignal; token: number }) =>
        new Promise<number>((_, reject) => {
          rejectFn = reject;
        }),
    );

    const [user, meta] = asyncSignal<number, Error>(makePromise);

    expect(meta.status()).toBe("pending");

    const err = new Error("boom");
    rejectFn(err);
    await tick();

    expect(meta.status()).toBe("error");
    expect(user()).toBeUndefined();
    expect(meta.error()).toBe(err);
  });

  it("starts idle and waits for reload when eager is false", () => {
    const makePromise = vi.fn(
      (_ctx: { signal: AbortSignal; token: number }) =>
        new Promise<number>(() => {}),
    );

    const [user, meta] = asyncSignal(makePromise, { eager: false });

    expect(makePromise).not.toHaveBeenCalled();
    expect(meta.status()).toBe("idle");
    expect(user()).toBeUndefined();

    meta.reload();

    expect(makePromise).toHaveBeenCalledTimes(1);
    expect(meta.status()).toBe("pending");
  });

  it("reflects keepPreviousValueOnPending and clears the value when configured", async () => {
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

    const [user, meta] = asyncSignal(makePromise, {
      keepPreviousValueOnPending: false,
    });

    expect(meta.keepPreviousValueOnPending).toBe(false);

    resolveFirst(1);
    await tick();

    expect(meta.status()).toBe("success");
    expect(user()).toBe(1);

    meta.reload();

    expect(meta.status()).toBe("pending");
    expect(user()).toBeUndefined();

    resolveSecond(2);
    await tick();
    expect(meta.status()).toBe("success");
    expect(user()).toBe(2);
  });

  it("cancel moves the status to cancelled and ignores a later resolution", async () => {
    let resolveFn!: (v: number) => void;

    const makePromise = vi.fn(
      (_ctx: { signal: AbortSignal; token: number }) =>
        new Promise<number>((resolve) => {
          resolveFn = resolve;
        }),
    );

    const [user, meta] = asyncSignal(makePromise);

    expect(meta.status()).toBe("pending");

    meta.cancel("bye");
    expect(meta.status()).toBe("cancelled");
    expect(meta.error()).toBeUndefined();
    expect(user()).toBeUndefined();

    resolveFn(123);
    await tick();

    expect(meta.status()).toBe("cancelled");
    expect(user()).toBeUndefined();
    expect(meta.error()).toBeUndefined();
  });

  it("preserves fromPromise cancellation semantics for AbortError rejection", async () => {
    const onError = vi.fn();

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

    const [, meta] = asyncSignal(makePromise, { onError });

    meta.cancel("cancel");
    await tick();

    expect(meta.status()).toBe("cancelled");
    expect(meta.error()).toBeUndefined();
    expect(onError).not.toHaveBeenCalled();
  });
});
