export type AsyncStatus = "idle" | "pending" | "success" | "error" | "cancelled";

export interface AsyncSignal<T, E = unknown> {
  value: () => T | undefined;
  status: () => AsyncStatus;
  error: () => E | undefined;
  reload: () => void;
  cancel:  (reason?: unknown) => void;
}

export type StreamAsyncStatus =
  | "idle"
  | "pending"
  | "streaming"
  | "success"
  | "error"
  | "cancelled";

export type StreamInterruptionPolicy =
  | "keep-partial"
  | "rollback"
  | "clear";

export interface StreamAsyncMeta<E, TValue> {
  status: () => StreamAsyncStatus;
  error: () => E | undefined;
  reload: () => void;
  cancel: (reason?: unknown) => void;
  stableValue: () => TValue | undefined;
}

export interface StreamContext<TChunk, TValue> {
  emit: (chunk: TChunk) => void;
  set: (value: TValue) => void;
  done: (finalValue?: TValue) => void;
  isCancelled: () => boolean;
}

export interface StreamResourceOptions<TChunk, TValue, E = unknown> {
  initialValue?: TValue;
  reduce?: (current: TValue | undefined, chunk: TChunk) => TValue;
  onCancel?: StreamInterruptionPolicy;
  onError?: StreamInterruptionPolicy;
  onSuccess?: (value: TValue) => void;
  onErrorEffect?: (error: E) => void;
}
