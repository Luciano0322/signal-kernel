import { describe, it, expect, vi } from "vitest";
import { signal } from "@signal-kernel/core";
import { createResource } from "../createResource.js";

const tick = () => Promise.resolve();

describe("createResource", () => {
  it("會根據 source() 變化重新 fetch，並在切換時 cancel 舊請求", async () => {
    const id = signal(1);

    let resolve1!: (v: string) => void;
    let resolve2!: (v: string) => void;
    let callCount = 0;

    const fetchUser = vi.fn((userId: number) => {
      if (callCount === 0) {
        callCount++;
        return new Promise<string>((resolve) => {
          resolve1 = resolve;
        });
      }
      callCount++;
      return new Promise<string>((resolve) => {
        resolve2 = resolve;
      });
    });

    const onCancel = vi.fn();

    const [user, meta] = createResource(
      () => id.get(),
      (userId) => fetchUser(userId),
      { keepPreviousValueOnPending: true, onCancel }
    );

    // 初次會根據 id=1 發送一次
    expect(fetchUser).toHaveBeenCalledTimes(1);
    expect(fetchUser).toHaveBeenCalledWith(1);
    expect(meta.status()).toBe("pending");
    expect(user()).toBeUndefined();

    // 第一次完成
    resolve1("User#1");
    await tick();

    expect(meta.status()).toBe("success");
    expect(user()).toBe("User#1");

    // 改變 source → 應 cancel 舊請求並重新 fetch
    id.set(2);
    await tick(); // 讓 createEffect rerun、meta.reload() 被呼叫

    expect(fetchUser).toHaveBeenCalledTimes(2);
    expect(fetchUser).toHaveBeenLastCalledWith(2);

    // keepPreviousValueOnPending = true → pending 期間保留舊資料
    expect(meta.status()).toBe("pending");
    expect(user()).toBe("User#1");

    // onCancel 應該被呼叫一次，reason 是 "source-changed"
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledWith("source-changed");

    resolve2("User#2");
    await tick();

    expect(meta.status()).toBe("success");
    expect(user()).toBe("User#2");
  });
});
