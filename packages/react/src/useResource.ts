import type { AsyncMeta, AsyncStatus } from "@signal-kernel/async-runtime";
import { useCallback } from "react";
import { useReactive } from "./useReactive.js";

export type ResourceTuple<
  T,
  M extends AsyncMeta<unknown> = AsyncMeta<unknown>,
> = [
  value: () => T | undefined,
  meta: M,
];

type ResourceError<M> = M extends AsyncMeta<infer E> ? E : unknown;

type ResourceSnapshot<T, M extends AsyncMeta<unknown>> = {
  value: T | undefined;
  status: AsyncStatus;
  error: ResourceError<M> | undefined;
};

export function useResource<
  T,
  M extends AsyncMeta<unknown> = AsyncMeta<unknown>,
>(
  resource: ResourceTuple<T, M>,
): [T | undefined, M] {
  const [value, meta] = resource;

  const read = useCallback(
    (): ResourceSnapshot<T, M> => ({
      value: value(),
      status: meta.status(),
      error: meta.error() as ResourceError<M> | undefined,
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
