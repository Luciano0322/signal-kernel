import type {
  StreamAsyncMeta,
  StreamAsyncStatus,
} from "@signal-kernel/async-runtime";
import { useCallback } from "react";
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

type StreamResourceSnapshot<T, M extends StreamAsyncMeta<unknown, T>> = {
  value: T | undefined;
  status: StreamAsyncStatus;
  error: StreamResourceError<M, T> | undefined;
  stableValue: T | undefined;
};

export function useStreamResource<
  T,
  M extends StreamAsyncMeta<unknown, T> = StreamAsyncMeta<unknown, T>,
>(
  resource: StreamResourceTuple<T, M>,
): [T | undefined, M] {
  const [value, meta] = resource;

  const read = useCallback(
    (): StreamResourceSnapshot<T, M> => ({
      value: value(),
      status: meta.status(),
      error: meta.error() as StreamResourceError<M, T> | undefined,
      stableValue: meta.stableValue(),
    }),
    [value, meta],
  );

  const snapshot = useReactive(read, {
    snapshot: read,
    track: read,
    equals: (prev, next) =>
      Object.is(prev.value, next.value) &&
      Object.is(prev.status, next.status) &&
      Object.is(prev.error, next.error) &&
      Object.is(prev.stableValue, next.stableValue),
  });

  return [snapshot.value, meta];
}
