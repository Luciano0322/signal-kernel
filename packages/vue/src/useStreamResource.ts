import type {
  StreamAsyncMeta,
  StreamAsyncStatus,
} from "@signal-kernel/async-runtime";
import type { Ref } from "vue";
import { useReactive } from "./useReactive.js";

export type StreamResourceTuple<
  T,
  M extends StreamAsyncMeta<unknown, T> = StreamAsyncMeta<unknown, T>,
> = [
  value: () => T | undefined,
  meta: M,
];

type StreamResourceError<M, T> =
  M extends StreamAsyncMeta<infer E, T> ? E : unknown;

export interface VueStreamResource<
  T,
  M extends StreamAsyncMeta<unknown, T> = StreamAsyncMeta<unknown, T>,
> {
  value: Readonly<Ref<T | undefined>>;
  stableValue: Readonly<Ref<T | undefined>>;
  status: Readonly<Ref<StreamAsyncStatus>>;
  error: Readonly<Ref<StreamResourceError<M, T> | undefined>>;
  reload: M["reload"];
  cancel: M["cancel"];
  meta: M;
}

export function useStreamResource<
  T,
  M extends StreamAsyncMeta<unknown, T> = StreamAsyncMeta<unknown, T>,
>(
  resource: StreamResourceTuple<T, M>,
): VueStreamResource<T, M> {
  const [value, meta] = resource;

  return {
    value: useReactive(value),
    stableValue: useReactive(meta.stableValue),
    status: useReactive(meta.status),
    error: useReactive(() => meta.error() as StreamResourceError<M, T> | undefined),
    reload: meta.reload,
    cancel: meta.cancel,
    meta,
  };
}
