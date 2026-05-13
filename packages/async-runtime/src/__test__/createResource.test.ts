import { signal } from "@signal-kernel/core";
import { describe, expect, it, vi } from "vitest";
import { createResource } from "../createResource.js";
import type { ResourceContext } from "../createResource.js";

const tick = () => Promise.resolve();

describe("createResource", () => {
  it("loads from the source on creation and moves through pending to success", async () => {
    const { get, set } = signal(1);

    const fetcher = vi.fn(async (s: number, _ctx: ResourceContext) => s * 10);

    const [val, meta] = createResource(get, fetcher);

    expect(meta.status()).toBe("pending");
    expect(fetcher).toHaveBeenCalledTimes(1);

    await tick();

    expect(meta.status()).toBe("success");
    expect(val()).toBe(10);

    set(2);
    await tick();

    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("cancels the previous in-flight request on source change and commits the latest result", async () => {
    const { get, set } = signal(1);

    let resolve1!: (v: number) => void;
    let resolve2!: (v: number) => void;

    const fetcher = vi.fn((s: number, ctx: ResourceContext) => {
      if (s === 1) {
        return new Promise<number>((resolve, reject) => {
          resolve1 = resolve;
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

    set(2);
    await tick();

    expect(meta.status()).toBe("pending");
    expect(fetcher).toHaveBeenCalledTimes(2);

    resolve2(200);
    await tick();

    expect(meta.status()).toBe("success");
    expect(val()).toBe(200);
    expect(onError).not.toHaveBeenCalled();

    resolve1(100);
    await tick();

    expect(meta.status()).toBe("success");
    expect(val()).toBe(200);
    expect(onError).not.toHaveBeenCalled();
  });

  it("starts a resource load on creation even though the internal async signal is lazy", () => {
    const { get } = signal(1);
    const fetcher = vi.fn(async (s: number, _ctx: ResourceContext) => s);

    createResource(get, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
