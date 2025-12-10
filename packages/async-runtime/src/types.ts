export type AsyncStatus = "idle" | "pending" | "success" | "error";

export interface AsyncSignal<T, E = unknown> {
  value: () => T | undefined;
  status: () => AsyncStatus;
  error: () => E | undefined;
  reload: () => void;
  cancel: () => void;
}
