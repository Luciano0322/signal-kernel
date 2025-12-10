import { fromPromise } from "./fromPromise.js";
import type { AsyncStatus } from "./types.js";
import type { FromPromiseOptions } from "./fromPromise.js";

export interface AsyncMeta<E = unknown> {
  /** 狀態機：idle / pending / success / error */
  status: () => AsyncStatus;
  /** 當前錯誤（只有在 error 狀態有值） */
  error: () => E | undefined;
  /** 重新執行一次 Promise（會覆蓋掉舊的請求） */
  reload: () => void;
  /** 標記取消當前請求（只是忽略結果，不會 abort 真正的 fetch） */
  cancel: () => void;
  /** 診斷用：這個 asyncSignal 是否在 pending 期間保留上一筆成功資料 */
  keepPreviousValueOnPending: boolean;
}

/**
 * 白皮書語意層 API：
 *
 * const [user, meta] = asyncSignal(() => fetchUser(id), {
 *   keepPreviousValueOnPending: true,
 * });
 *
 * effect(() => {
 *   const data = user();          // 像 signal 一樣讀 data
 *   const status = meta.status(); // 狀態 & 錯誤另外拿
 * });
 */
export function asyncSignal<T, E = unknown>(
  makePromise: () => Promise<T>,
  options?: FromPromiseOptions
): [() => T | undefined, AsyncMeta<E>] {
  const sig = fromPromise<T, E>(makePromise, options);
  const keepPrev = options?.keepPreviousValueOnPending ?? true;

  return [
    sig.value,
    {
      status: sig.status,
      error: sig.error,
      reload: sig.reload,
      cancel: sig.cancel,
      keepPreviousValueOnPending: keepPrev,
    },
  ];
}
