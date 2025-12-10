import { createEffect } from "@signal-kernel/core";
import { asyncSignal } from "./asyncSignal.js";
import type { FromPromiseOptions } from "./fromPromise.js";
import type { AsyncMeta } from "./asyncSignal.js";

export interface ResourceOptions extends FromPromiseOptions {
  // 之後如果要加 resource 專屬選項，可以往這裡擴充
}

export function createResource<S, T, E = unknown>(
  source: () => S,
  fetcher: (s: S) => Promise<T>,
  options?: ResourceOptions
): [() => T | undefined, AsyncMeta<E>] {
  let currentSource: S;

  // Resource 一定由 source 驅動，所以這裡強制 eager=false，
  // 初始化與後續變化全部交給下面的 effect 控制。
  const [value, meta] = asyncSignal<T, E>(
    () => fetcher(currentSource),
    { ...(options ?? {}), eager: false }
  );

  let initialized = false;

  createEffect(() => {
    // 這裡建立 source → resource 的依賴關係
    currentSource = source();
    // 第一次只是初始載入；之後每次 source 改變，先 cancel 舊的再 reload
    if (initialized) {
      meta.cancel("source-changed");
    }
    meta.reload();
    initialized = true;
  });

  return [value, meta];
}
