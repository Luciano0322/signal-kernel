import type { AsyncMeta, AsyncStatus } from "@signal-kernel/async-runtime";
import type { Ref } from "vue";
import { useReactive } from "./useReactive.js";

export type ResourceTuple<T, E = unknown> = [
  value: () => T | undefined,
  meta: AsyncMeta<E>,
];

export interface VueResource<T, E = unknown> {
  value: Readonly<Ref<T | undefined>>;
  status: Readonly<Ref<AsyncStatus>>;
  error: Readonly<Ref<E | undefined>>;
  reload: () => void;
  cancel: (reason?: unknown) => void;
  meta: AsyncMeta<E>;
}

export function useResource<T, E = unknown>(
  resource: ResourceTuple<T, E>,
): VueResource<T, E> {
  const [value, meta] = resource;

  return {
    value: useReactive(value),
    status: useReactive(meta.status),
    error: useReactive(meta.error),
    reload: meta.reload,
    cancel: meta.cancel,
    meta,
  };
}
