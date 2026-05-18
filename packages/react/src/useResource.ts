import type { AsyncMeta } from "@signal-kernel/async-runtime";
import { useCallback } from "react";
import { useReactive } from "./useReactive.js";

export type ResourceTuple<T, E = unknown> = [
  value: () => T | undefined,
  meta: AsyncMeta<E>,
];

type ResourceSnapshot<T, E = unknown> = {
  value: T | undefined;
  status: ReturnType<AsyncMeta<E>["status"]>;
  error: ReturnType<AsyncMeta<E>["error"]>;
};

export function useResource<T, E = unknown>(
  resource: ResourceTuple<T, E>,
): [T | undefined, AsyncMeta<E>] {
  const [value, meta] = resource;

  const read = useCallback(
    (): ResourceSnapshot<T, E> => ({
      value: value(),
      status: meta.status(),
      error: meta.error(),
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
