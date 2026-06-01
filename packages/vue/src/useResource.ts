import type { AsyncMeta, AsyncStatus } from "@signal-kernel/async-runtime";
import type { Ref } from "vue";
import { useReactive } from "./useReactive.js";

export type ResourceTuple<
  T,
  M extends AsyncMeta<unknown> = AsyncMeta<unknown>,
> = [
  value: () => T | undefined,
  meta: M,
];

type ResourceError<M> = M extends AsyncMeta<infer E> ? E : unknown;

export interface VueResource<
  T,
  M extends AsyncMeta<unknown> = AsyncMeta<unknown>,
> {
  value: Readonly<Ref<T | undefined>>;
  status: Readonly<Ref<AsyncStatus>>;
  error: Readonly<Ref<ResourceError<M> | undefined>>;
  reload: M["reload"];
  cancel: M["cancel"];
  meta: M;
}

export function useResource<
  T,
  M extends AsyncMeta<unknown> = AsyncMeta<unknown>,
>(
  resource: ResourceTuple<T, M>,
): VueResource<T, M> {
  const [value, meta] = resource;

  return {
    value: useReactive(value),
    status: useReactive(meta.status),
    error: useReactive(() => meta.error() as ResourceError<M> | undefined),
    reload: meta.reload,
    cancel: meta.cancel,
    meta,
  };
}
