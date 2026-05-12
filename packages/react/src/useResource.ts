import type { AsyncMeta } from "@signal-kernel/async-runtime";
import { useCallback } from "react";
import { useReactive } from "./useReactive.js";

export type ResourceTuple<T, E = unknown> = [
  value: () => T | undefined,
  meta: AsyncMeta<E>,
];

export function useResource<T, E = unknown>(
  resource: ResourceTuple<T, E>,
): [T | undefined, AsyncMeta<E>] {
  const [value, meta] = resource;

  const read = useCallback(
    () => ({
      value: value(),
      status: meta.status(),
      error: meta.error(),
    }),
    [value, meta],
  );

  const snapshot = useReactive(read);

  return [snapshot.value, meta];
}
