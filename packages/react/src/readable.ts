import { useCallback, useSyncExternalStore } from "react";
import { createEffect } from "@signal-kernel/core";
import type { Readable } from "./types.js";

export function useReadableValue<T>(src: Readable<T>): T {
  const subscribe = useCallback(
    (notify: () => void) => {
      let first = true;

      const stop = createEffect(() => {
        src.get();

        if (first) {
          first = false;
          return;
        }

        notify();
      });

      return () => {
        stop();
      };
    },
    [src]
  );

  const getSnapshot = useCallback(() => {
    return src.peek();
  }, [src]);

  return useSyncExternalStore(
    subscribe,
    getSnapshot,
    getSnapshot
  );
}