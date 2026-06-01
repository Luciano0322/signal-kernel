import type { AsyncMeta, AsyncStatus } from "@signal-kernel/async-runtime";
import { useCallback } from "react";
import { useReactive } from "./useReactive.js";

export type ResourceTuple<
  T,
  M extends AsyncMeta<unknown, T> = AsyncMeta<unknown, T>,
> = [
  value: () => T | undefined,
  meta: M,
];

type ResourceError<M, T> = M extends AsyncMeta<infer E, T> ? E : unknown;

type ResourceSnapshot<T, M extends AsyncMeta<unknown, T>> = {
  value: T | undefined;
  status: AsyncStatus;
  error: ResourceError<M, T> | undefined;
};

export function useResource<
  T,
  M extends AsyncMeta<unknown, T> = AsyncMeta<unknown, T>,
>(
  resource: ResourceTuple<T, M>,
): [T | undefined, M] {
  const [value, meta] = resource;

  const read = useCallback(
    (): ResourceSnapshot<T, M> => ({
      value: value(),
      status: meta.status(),
      error: meta.error() as ResourceError<M, T> | undefined,
    }),
    [value, meta],
  );

  const snapshot = useReactive(read, {
    snapshot: read,
    track: read,
    equals: (prev, next) =>
      Object.is(prev.value, next.value) &&
      Object.is(prev.status, next.status) &&
      Object.is(prev.error, next.error)
  });

  return [snapshot.value, meta];
}
