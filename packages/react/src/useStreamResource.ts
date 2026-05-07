import type { StreamAsyncMeta } from "@signal-kernel/async-runtime";
import { useCallback } from "react";
import { useReactive } from "./useReactive.js";

export type StreamResourceTuple<T, E = unknown> = [
  value: () => T | undefined,
  meta: StreamAsyncMeta<E, T>,
];

export function useStreamResource<T, E = unknown>(
  resource: StreamResourceTuple<T, E>,
): [T | undefined, StreamAsyncMeta<E, T>] {
  const [value, meta] = resource;

  const read = useCallback(
    () => ({
      value: value(),
      status: meta.status(),
      error: meta.error(),
      stableValue: meta.stableValue(),
    }),
    [value, meta],
  );

  const snapshot = useReactive(read);

  return [snapshot.value, meta];
}
