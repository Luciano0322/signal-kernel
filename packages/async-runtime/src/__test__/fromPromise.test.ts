import { describe, it, expect, vi } from "vitest";
import { fromPromise } from "../fromPromise.js";

// 讓 microtask queue 跑完
const tick = () => Promise.resolve();

describe("fromPromise", () => {
  it("default eager=true，建立當下就進入 pending 狀態", () => {
    const makePromise = vi.fn(
      (_ctx: { signal: AbortSignal; token: number }) =>
        new Promise<number>(() => {
          /* 永遠 pending */
        })
    );

    const asyncSig = fromPromise(makePromise);

    expect(makePromise).toHaveBeenCalledTimes(1);

    // 確認 ctx 有傳入（token 起手為 1）
    const firstCallArg = makePromise.mock.calls[0]![0];
    expect(firstCallArg.token).toBe(1);
    expect(firstCallArg.signal).toBeInstanceOf(AbortSignal);

    expect(asyncSig.status()).toBe("pending");
    expect(asyncSig.value()).toBeUndefined();
    expect(asyncSig.error()).toBeUndefined();
  });

  it("eager=false 時初始為 idle，不會立刻執行 promise", () => {
    const makePromise = vi.fn(
      (_ctx: { signal: AbortSignal; token: number }) => Promise.resolve(123)
    );

    const asyncSig = fromPromise(makePromise, { eager: false });

    expect(makePromise).not.toHaveBeenCalled();
    expect(asyncSig.status()).toBe("idle");
    expect(asyncSig.value()).toBeUndefined();
    expect(asyncSig.error()).toBeUndefined();
  });

  it("reload 會觸發 promise 執行並進入 pending", () => {
    const makePromise = vi.fn(
      (_ctx: { signal: AbortSignal; token: number }) =>
        new Promise<number>(() => {
          /* pending */
        })
    );

    const asyncSig = fromPromise(makePromise, { eager: false });

    expect(asyncSig.status()).toBe("idle");

    asyncSig.reload();

    expect(makePromise).toHaveBeenCalledTimes(1);
    expect(asyncSig.status()).toBe("pending");
  });

  it("成功 resolve 時會更新 value 並設為 success", async () => {
    let resolveFn!: (v: number) => void;

    const makePromise = vi.fn(
      (_ctx: { signal: AbortSignal; token: number }) =>
        new Promise<number>((resolve) => {
          resolveFn = resolve;
        })
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

  it("reject 時會設定 error 並設為 error 狀態", async () => {
    let rejectFn!: (err: unknown) => void;

    const makePromise = vi.fn(
      (_ctx: { signal: AbortSignal; token: number }) =>
        new Promise<never>((_, reject) => {
          rejectFn = reject;
        })
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

  it("cancel() 會取消當前 run，狀態轉為 cancelled，且後續結果被忽略", async () => {
    let resolveFn!: (v: number) => void;

    const makePromise = vi.fn(
      (_ctx: { signal: AbortSignal; token: number }) =>
        new Promise<number>((resolve) => {
          resolveFn = resolve;
        })
    );

    const asyncSig = fromPromise(makePromise);

    expect(asyncSig.status()).toBe("pending");

    asyncSig.cancel();
    expect(asyncSig.status()).toBe("cancelled");

    // 就算 promise resolve，也不應該覆蓋（token 相同但已 abort）
    resolveFn(999);
    await tick();

    expect(asyncSig.status()).toBe("cancelled");
    expect(asyncSig.value()).toBeUndefined();
    expect(asyncSig.error()).toBeUndefined();
  });

  it("reload 會啟動新的 promise，舊的結果不會覆蓋新的", async () => {
    let resolveFirst!: (v: number) => void;
    let resolveSecond!: (v: number) => void;
    let callCount = 0;

    const makePromise = vi.fn((_ctx: { signal: AbortSignal; token: number }) => {
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

    const asyncSig = fromPromise(makePromise);

    expect(asyncSig.status()).toBe("pending");

    asyncSig.reload();

    expect(makePromise).toHaveBeenCalledTimes(2);
    expect(asyncSig.status()).toBe("pending");

    // 第二個先完成
    resolveSecond(2);
    await tick();

    expect(asyncSig.status()).toBe("success");
    expect(asyncSig.value()).toBe(2);

    // 第一個之後才完成，但結果應該被忽略
    resolveFirst(1);
    await tick();

    expect(asyncSig.status()).toBe("success");
    expect(asyncSig.value()).toBe(2);
  });

  it("onSuccess / onError callback 會在對應情況被呼叫", async () => {
    let resolveFn!: (v: number) => void;
    let rejectFn!: (err: unknown) => void;

    const makePromiseSuccess = vi.fn(
      (_ctx: { signal: AbortSignal; token: number }) =>
        new Promise<number>((resolve) => {
          resolveFn = resolve;
        })
    );

    const makePromiseError = vi.fn(
      (_ctx: { signal: AbortSignal; token: number }) =>
        new Promise<number>((_, reject) => {
          rejectFn = reject;
        })
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

  it("預設會在 pending 期間保留上一筆成功資料（keepPreviousValueOnPending 預設為 true）", async () => {
    let resolveFirst!: (v: number) => void;
    let resolveSecond!: (v: number) => void;
    let callCount = 0;

    const makePromise = vi.fn((_ctx: { signal: AbortSignal; token: number }) => {
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

    const asyncSig = fromPromise(makePromise);

    expect(asyncSig.status()).toBe("pending");
    resolveFirst(1);
    await tick();

    expect(asyncSig.status()).toBe("success");
    expect(asyncSig.value()).toBe(1);

    asyncSig.reload();

    expect(asyncSig.status()).toBe("pending");
    expect(asyncSig.value()).toBe(1); // 保留舊值

    resolveSecond(2);
    await tick();

    expect(asyncSig.status()).toBe("success");
    expect(asyncSig.value()).toBe(2);
  });

  it("keepPreviousValueOnPending = false 時，pending 會清空 value", async () => {
    let resolveFirst!: (v: number) => void;
    let resolveSecond!: (v: number) => void;
    let callCount = 0;

    const makePromise = vi.fn((_ctx: { signal: AbortSignal; token: number }) => {
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
    expect(asyncSig.value()).toBeUndefined(); // 會清空

    resolveSecond(2);
    await tick();

    expect(asyncSig.status()).toBe("success");
    expect(asyncSig.value()).toBe(2);
  });

  it("cancel() 會呼叫 onCancel，狀態轉為 cancelled，且不會觸發 onError", async () => {
    let resolveFn!: (v: number) => void;

    const makePromise = vi.fn(
      (_ctx: { signal: AbortSignal; token: number }) =>
        new Promise<number>((resolve) => {
          resolveFn = resolve;
        })
    );

    const onCancel = vi.fn();
    const onError = vi.fn();

    const asyncSig = fromPromise(makePromise, { onCancel, onError });

    expect(asyncSig.status()).toBe("pending");

    asyncSig.cancel("test-reason");

    expect(asyncSig.status()).toBe("cancelled");
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledWith("test-reason");

    // 之後就算 promise resolve，也不應該更新狀態或值
    resolveFn(123);
    await tick();

    expect(asyncSig.status()).toBe("cancelled");
    expect(asyncSig.value()).toBeUndefined();
    expect(asyncSig.error()).toBeUndefined();

    // 取消不是 error
    expect(onError).not.toHaveBeenCalled();
  });

  it("makePromise 同步 throw 時：狀態進 error、onError 被呼叫", () => {
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

  it("cancel() 導致 promise 以 AbortError reject：不應設為 error，也不應呼叫 onError", async () => {
    let rejectFn!: (err: unknown) => void;

    const makePromise = vi.fn(
      (ctx: { signal: AbortSignal; token: number }) =>
        new Promise<number>((_resolve, reject) => {
          rejectFn = reject;

          // 模擬 fetch 在 abort 時 reject AbortError
          ctx.signal.addEventListener("abort", () => {
            const abortErr =
              // Node/DOM 環境下多半有 DOMException，沒有也沒關係
              typeof DOMException !== "undefined"
                ? new DOMException("Aborted", "AbortError")
                : Object.assign(new Error("Aborted"), { name: "AbortError" });

            reject(abortErr);
          });
        })
    );

    const onError = vi.fn();
    const asyncSig = fromPromise(makePromise, { onError });

    expect(asyncSig.status()).toBe("pending");

    asyncSig.cancel("user-cancel");

    // cancel 本身會設 cancelled
    expect(asyncSig.status()).toBe("cancelled");

    // 讓 abort event 觸發的 reject 進入 microtask
    await tick();

    // 仍應維持 cancelled，不應被當成 error
    expect(asyncSig.status()).toBe("cancelled");
    expect(asyncSig.error()).toBeUndefined();
    expect(onError).not.toHaveBeenCalled();

    // 保守確認：makePromise 的 ctx.signal 應該已被 abort
    const ctx = makePromise.mock.calls[0]![0];
    expect(ctx.signal.aborted).toBe(true);
  });
  it("reload() 造成舊 run superseded：舊 run AbortError reject 不應污染新 run", async () => {
    let resolveSecond!: (v: number) => void;

    const makePromise = vi.fn((ctx: { signal: AbortSignal; token: number }) => {
      // 第一個 run：永遠不 resolve，只在 abort 時 reject AbortError
      if (ctx.token === 1) {
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

      // 第二個 run：可控制 resolve
      return new Promise<number>((resolve) => {
        resolveSecond = resolve;
      });
    });

    const onError = vi.fn();
    const asyncSig = fromPromise(makePromise, { onError });

    expect(makePromise).toHaveBeenCalledTimes(1);
    expect(asyncSig.status()).toBe("pending");

    // 啟動第二個 run（會 abort 第一個 run）
    asyncSig.reload();
    expect(makePromise).toHaveBeenCalledTimes(2);
    expect(asyncSig.status()).toBe("pending");

    // 第一個 run 因 abort 而 reject AbortError（microtask 會進來）
    await tick();

    // 不應因此變成 error
    expect(asyncSig.status()).toBe("pending");
    expect(asyncSig.error()).toBeUndefined();
    expect(onError).not.toHaveBeenCalled();

    // 第二個 run 成功
    resolveSecond(2);
    await tick();

    expect(asyncSig.status()).toBe("success");
    expect(asyncSig.value()).toBe(2);
    expect(asyncSig.error()).toBeUndefined();
    expect(onError).not.toHaveBeenCalled();
  });
});