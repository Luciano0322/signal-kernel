export type AsyncStatus = 'idle' | 'pending' | 'success' | 'error';

export interface AsyncSignal<T, E = unknown> {
  /** 最新成功結果（或 undefined） */
  value: () => T | undefined;
  /** 狀態機：idle / pending / success / error */
  status: () => AsyncStatus;
  /** 錯誤資訊（只在 error 狀態有值） */
  error: () => E | undefined;
  /** 重新執行一次 async 任務（會自動 cancel 舊的） */
  reload: () => void;
  /** 標記取消當前任務（如果還在 pending） */
  cancel: () => void;
}
