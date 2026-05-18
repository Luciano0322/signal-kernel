import type { StreamAsyncMeta } from "@signal-kernel/async-runtime";
import { useCallback } from "react";
import { useReactive } from "./useReactive.js";

export type StreamResourceTuple<T, E = unknown> = [
  value: () => T | undefined,
  meta: StreamAsyncMeta<E, T>,
];

type StreamResourceSnapshot<T, E = unknown> = {
  value: T | undefined;
  status: ReturnType<StreamAsyncMeta<E, T>["status"]>;
  error: ReturnType<StreamAsyncMeta<E, T>["error"]>;
  stableValue: ReturnType<StreamAsyncMeta<E, T>["stableValue"]>;
};

export function useStreamResource<T, E = unknown>(
  resource: StreamResourceTuple<T, E>,
): [T | undefined, StreamAsyncMeta<E, T>] {
  const [value, meta] = resource;

  const read = useCallback(
    (): StreamResourceSnapshot<T, E> => ({
      value: value(),
      status: meta.status(),
      error: meta.error(),
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