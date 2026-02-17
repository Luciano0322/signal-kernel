import { describe, it, expect, vi } from "vitest";
import { signal } from "@signal-kernel/core";
import { createResource } from "../createResource.js";

const tick = () => Promise.resolve();

describe("createResource", () => {
  it("初次建立會依 source 執行 fetch，進入 pending", async () => {
    const { get, set } = signal(1);

    const fetcher = vi.fn(async (s: number, _ctx: { signal: AbortSignal; token: number }) => {
      return s * 10;
    });

    const [val, meta] = createResource(get, fetcher);

    // createEffect 通常會立刻跑一次
    expect(meta.status()).toBe("pending");
    expect(fetcher).toHaveBeenCalledTimes(1);

    await tick();

    expect(meta.status()).toBe("success");
    expect(val()).toBe(10);

    // 改 source → 觸發下一輪
    set(2);
    await tick();

    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("source change 會 cancel 前一次 in-flight，且舊結果不覆蓋新結果（switch-latest）", async () => {
    const { get, set } = signal(1);

    let resolve1!: (v: number) => void;
    let resolve2!: (v: number) => void;

    const fetcher = vi.fn((s: number, ctx: { signal: AbortSignal; token: number }) => {
      if (s === 1) {
        return new Promise<number>((resolve, reject) => {
          resolve1 = resolve;
          // 若你在 fromPromise 加了 AbortError 分流，可模擬 abort -> reject AbortError
          ctx.signal.addEventListener("abort", () => {
            const abortErr =
              typeof DOMException !== "undefined"
                ? new DOMException("Aborted", "AbortError")
                : Object.assign(new Error("Aborted"), { name: "AbortError" });
            reject(abortErr);
          });
        });
      }
      return new Promise<number>((resolve) => {
        resolve2 = resolve;
      });
    });

    const onError = vi.fn();
    const [val, meta] = createResource(get, fetcher, { onError });

    expect(meta.status()).toBe("pending");

    // source change -> cancel old + reload new
    set(2);
    await tick();

    expect(meta.status()).toBe("pending");
    expect(fetcher).toHaveBeenCalledTimes(2);

    // 先讓第二個完成
    resolve2(200);
    await tick();

    expect(meta.status()).toBe("success");
    expect(val()).toBe(200);
    expect(onError).not.toHaveBeenCalled();

    // 第一個最後才完成（或 resolve 或 reject），都不得覆蓋
    resolve1(100);
    await tick();

    expect(meta.status()).toBe("success");
    expect(val()).toBe(200);
    expect(onError).not.toHaveBeenCalled();
  });

  it("eager:false 的行為由 createResource 控制：建立後仍會因 effect 觸發而執行一次", () => {
    const { get } = signal(1);
    const fetcher = vi.fn(async (s: number) => s);

    createResource(get, fetcher as any);

    // 雖然 asyncSignal eager:false，但 createEffect 會立刻呼叫 meta.reload()
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});