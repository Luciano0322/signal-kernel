import { describe, it, expect, vi } from "vitest";
import { asyncSignal } from "../asyncSignal.js";

const tick = () => Promise.resolve();

describe("asyncSignal", () => {
  it("預設 eager=true，建立當下就進入 pending 狀態，data 為 undefined", () => {
    const makePromise = vi.fn(
      () => new Promise<number>(() => { /* 永遠 pending */ })
    );

    const [user, meta] = asyncSignal(makePromise);

    expect(makePromise).toHaveBeenCalledTimes(1);
    expect(meta.status()).toBe("pending");
    expect(user()).toBeUndefined();
    expect(meta.error()).toBeUndefined();
    expect(meta.keepPreviousValueOnPending).toBe(true);
  });

  it("成功 resolve 後，user() 會有值且狀態為 success", async () => {
    let resolveFn!: (v: number) => void;

    const makePromise = vi.fn(
      () =>
        new Promise<number>((resolve) => {
          resolveFn = resolve;
        })
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

  it("reject 後，狀態為 error 且 error() 有值，user() 維持 undefined", async () => {
    let rejectFn!: (err: unknown) => void;

    const makePromise = vi.fn(
      () =>
        new Promise<number>((_, reject) => {
          rejectFn = reject;
        })
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

  it("eager=false 時，初始為 idle，呼叫 reload 後才 pending", () => {
    const makePromise = vi.fn(
      () => new Promise<number>(() => { /* pending */ })
    );

    const [user, meta] = asyncSignal(makePromise, { eager: false });

    expect(makePromise).not.toHaveBeenCalled();
    expect(meta.status()).toBe("idle");
    expect(user()).toBeUndefined();

    meta.reload();

    expect(makePromise).toHaveBeenCalledTimes(1);
    expect(meta.status()).toBe("pending");
  });

  it("keepPreviousValueOnPending 可以透過 options 控制，meta 會反映設定", async () => {
    let resolveFirst!: (v: number) => void;
    let resolveSecond!: (v: number) => void;
    let callCount = 0;

    const makePromise = vi.fn(() => {
      if (callCount === 0) {
        callCount++;
        return new Promise<number>((resolve) => {
          resolveFirst = resolve;
        });
      }
      callCount++;
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
  });
});
