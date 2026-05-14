import type {
  StreamAsyncMeta,
  StreamAsyncStatus,
} from "@signal-kernel/async-runtime";
import type { Ref } from "vue";
import { useReactive } from "./useReactive.js";

export type StreamResourceTuple<T, E = unknown> = [
  value: () => T | undefined,
  meta: StreamAsyncMeta<E, T>,
];

export interface VueStreamResource<T, E = unknown> {
  value: Readonly<Ref<T | undefined>>;
  stableValue: Readonly<Ref<T | undefined>>;
  status: Readonly<Ref<StreamAsyncStatus>>;
  error: Readonly<Ref<E | undefined>>;
  reload: () => void;
  cancel: (reason?: unknown) => void;
  meta: StreamAsyncMeta<E, T>;
}

export function useStreamResource<T, E = unknown>(
  resource: StreamResourceTuple<T, E>,
): VueStreamResource<T, E> {
  const [value, meta] = resource;

  return {
    value: useReactive(value),
    stableValue: useReactive(meta.stableValue),
    status: useReactive(meta.status),
    error: useReactive(meta.error),
    reload: meta.reload,
    cancel: meta.cancel,
    meta,
  };
}
