import { useMemo, useSyncExternalStore } from "react";
import { createEffect } from "@signal-kernel/core";

type ReactiveStore<T> = {
  getSnapshot(): T;
  subscribe(notify: () => void): () => void;
};

function createReactiveStore<T>(read: () => T): ReactiveStore<T> {
  let snapshot = read();

  return {
    getSnapshot() {
      return snapshot;
    },

    subscribe(notify) {
      let first = true;

      const stop = createEffect(() => {
        const next = read();

        if (first) {
          snapshot = next;
          first = false;
          return;
        }

        snapshot = next;
        notify();
      });

      return () => {
        stop();
      };
    },
  };
}

export function useReactive<T>(read: () => T): T {
  const store = useMemo(() => {
    return createReactiveStore(read);
  }, [read]);

  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot
  );
}