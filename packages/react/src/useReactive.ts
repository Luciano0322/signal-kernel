import { useCallback, useRef, useSyncExternalStore } from "react";
import { createEffect } from "@signal-kernel/core";
import type { UseReactiveOptions } from "./types.js";


export function useReactive<T>(
  read: () => T,
  options: UseReactiveOptions<T> = {},
): T {
  const snapshotRef = useRef<T | undefined>(undefined);
  const hasSnapshotRef = useRef(false);

  const snapshotRead = options.snapshot ?? read;
  const trackRead = options.track ?? read;
  const equals = options.equals ?? Object.is;

  const getSnapshot = useCallback(() => {
    if (!hasSnapshotRef.current) {
      const next = snapshotRead();

      snapshotRef.current = next;
      hasSnapshotRef.current = true;
    }

    return snapshotRef.current as T;
  }, [snapshotRead]);

  const subscribe = useCallback(
    (notify: () => void) => {
      let first = true;

      const stop = createEffect(() => {
        trackRead();

        if (first) {
          if (!hasSnapshotRef.current) {
            snapshotRef.current = snapshotRead();
            hasSnapshotRef.current = true;
          }
          first = false;
          return;
        }

        const next = snapshotRead();

        if (
          hasSnapshotRef.current &&
          equals(snapshotRef.current as T, next)
        ) {
          return;
        }

        snapshotRef.current = next;
        hasSnapshotRef.current = true;
        notify();
      });

      return stop;
    },
    [trackRead, snapshotRead, equals],
  );

  return useSyncExternalStore(
    subscribe,
    getSnapshot,
    options.getServerSnapshot ?? getSnapshot,
  );
}
