import { useCallback } from "react";
import type { Readable, ReadStrategy } from "./types.js";
import { useReactive } from "./useReactive.js";

type UseReadableValueOptions<T> = {
  snapshot?: ReadStrategy;
  track?: ReadStrategy;
  getServerSnapshot?: () => T;
  equals?: (prev: T, next: T) => boolean;
};

function readByStrategy<T>(src: Readable<T>, strategy: ReadStrategy): T {
  return strategy === "get" ? src.get() : src.peek();
}

export function useReadableValue<T>(
  src: Readable<T>,
  options: UseReadableValueOptions<T> = {},
): T {
  const snapshot = useCallback(
    () => readByStrategy(src, options.snapshot ?? "peek"),
    [src, options.snapshot],
  );

  const track = useCallback(
    () => readByStrategy(src, options.track ?? "get"),
    [src, options.track],
  );

  return useReactive(track, {
    snapshot,
    track,
    getServerSnapshot: options.getServerSnapshot,
    equals: options.equals,
  });
}