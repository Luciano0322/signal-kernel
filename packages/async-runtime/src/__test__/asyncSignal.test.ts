import { describe, it, expect, vi } from "vitest";
import { asyncSignal } from "../asyncSignal.js";

const tick = () => Promise.resolve();

describe("asyncSignal", () => {
  it("預設 eager=true，建立當下就進入 pending 狀態，data 為 undefined", () => {
    const makePromise = vi.fn(
      (_ctx: { signal: AbortSignal; token: number }) =>
        new Promise<number>(() => {
          /* 永遠 pending */
        })
    );

    const [user, meta] = asyncSignal(makePromise);

    expect(makePromise).toHaveBeenCalledTimes(1);
    expect(meta.status()).toBe("pending");
    expect(user()).toBeUndefined();
    expect(meta.error()).toBeUndefined();
    expect(meta.keepPreviousValueOnPending).toBe(true);

    // optional sanity: token starts at 1
    const ctx = makePromise.mock.calls[0]![0];
    expect(ctx.token).toBe(1);
    expect(ctx.signal).toBeInstanceOf(AbortSignal);
  });

  it("成功 resolve 後，user() 會有值且狀態為 success", async () => {
    let resolveFn!: (v: number) => void;

    const makePromise = vi.fn(
      (_ctx: { signal: AbortSignal; token: number }) =>
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
      (_ctx: { signal: AbortSignal; token: number }) =>
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
      (_ctx: { signal: AbortSignal; token: number }) =>
        new Promise<number>(() => {
          /* pending */
        })
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

    const makePromise = vi.fn((ctx: { signal: AbortSignal; token: number }) => {
      if (ctx.token === 1) {
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

    // 收尾（避免未使用變數）
    resolveSecond(2);
    await tick();
    expect(meta.status()).toBe("success");
    expect(user()).toBe(2);
  });

  it("cancel() 會把狀態轉為 cancelled，且後續 resolve 不應覆蓋", async () => {
    let resolveFn!: (v: number) => void;

    const makePromise = vi.fn(
      (_ctx: { signal: AbortSignal; token: number }) =>
        new Promise<number>((resolve) => {
          resolveFn = resolve;
        })
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

  it("AbortError reject 不應被視為 error（wrapper 不應改變 fromPromise 的語意）", async () => {
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
        })
    );

    const [_user, meta] = asyncSignal(makePromise, { onError });

    meta.cancel("cancel");
    await tick();

    expect(meta.status()).toBe("cancelled");
    expect(meta.error()).toBeUndefined();
    expect(onError).not.toHaveBeenCalled();
  });
});