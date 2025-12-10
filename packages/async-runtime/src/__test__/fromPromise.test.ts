import { describe, it, expect, vi } from "vitest";
import { fromPromise } from "../fromPromise.js";

// 小工具：讓 microtask queue 跑完
const tick = () => Promise.resolve();

describe("fromPromise", () => {
  it("預設 eager=true，建立當下就進入 pending 狀態", () => {
    const makePromise = vi.fn(
      () => new Promise<number>(() => { /* 永遠 pending */ })
    );

    const asyncSig = fromPromise(makePromise);

    expect(makePromise).toHaveBeenCalledTimes(1);
    expect(asyncSig.status()).toBe("pending");
    expect(asyncSig.value()).toBeUndefined();
    expect(asyncSig.error()).toBeUndefined();
  });

  it("eager=false 時初始為 idle，不會立刻執行 promise", () => {
    const makePromise = vi.fn(
      () => Promise.resolve(123)
    );

    const asyncSig = fromPromise(makePromise, { eager: false });

    expect(makePromise).not.toHaveBeenCalled();
    expect(asyncSig.status()).toBe("idle");
    expect(asyncSig.value()).toBeUndefined();
    expect(asyncSig.error()).toBeUndefined();
  });

  it("reload 會觸發 promise 執行並進入 pending", () => {
    const makePromise = vi.fn(
      () => new Promise<number>(() => { /* pending */ })
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
      () =>
        new Promise<number>((resolve) => {
          resolveFn = resolve;
        })
    );

    const asyncSig = fromPromise(makePromise);

    // 先確認進入 pending
    expect(asyncSig.status()).toBe("pending");
    expect(asyncSig.value()).toBeUndefined();

    // 讓 promise 成功
    resolveFn(42);
    await tick(); // 等待 .then() 跑完

    expect(asyncSig.status()).toBe("success");
    expect(asyncSig.value()).toBe(42);
    expect(asyncSig.error()).toBeUndefined();
  });

  it("reject 時會設定 error 並設為 error 狀態", async () => {
    let rejectFn!: (err: unknown) => void;

    const makePromise = vi.fn(
      () =>
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

  it("cancel() 會讓當前 promise 的結果被忽略", async () => {
    let resolveFn!: (v: number) => void;

    const makePromise = vi.fn(
      () =>
        new Promise<number>((resolve) => {
          resolveFn = resolve;
        })
    );

    const asyncSig = fromPromise(makePromise);

    expect(asyncSig.status()).toBe("pending");

    asyncSig.cancel();   // 標記為 aborted
    resolveFn(999);      // 這個結果應被忽略
    await tick();

    // 狀態保持在 pending（因為我們沒有定義 cancel 後的狀態轉移）
    expect(asyncSig.status()).toBe("pending");
    expect(asyncSig.value()).toBeUndefined();
    expect(asyncSig.error()).toBeUndefined();
  });

  it("reload 會啟動新的 promise，舊的結果不會覆蓋新的", async () => {
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

    const asyncSig = fromPromise(makePromise);

    // 第一個 promise 還在 pending
    expect(asyncSig.status()).toBe("pending");

    // 觸發第二個 promise
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

    const makePromiseSuccess = () =>
      new Promise<number>((resolve) => {
        resolveFn = resolve;
      });

    const makePromiseError = () =>
      new Promise<number>((_, reject) => {
        rejectFn = reject;
      });

    const onSuccess = vi.fn();
    const onError = vi.fn();

    // 成功情況
    const okSig = fromPromise(makePromiseSuccess, { onSuccess });
    resolveFn(7);
    await tick();
    expect(onSuccess).toHaveBeenCalledWith(7);

    // 失敗情況
    const errSig = fromPromise(makePromiseError, { onError });
    const error = new Error("oops");
    rejectFn(error);
    await tick();
    expect(onError).toHaveBeenCalledWith(error);

    // 順便確認狀態一致
    expect(okSig.status()).toBe("success");
    expect(errSig.status()).toBe("error");
  });
});
