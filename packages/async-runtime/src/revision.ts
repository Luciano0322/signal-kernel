import { signal } from "@signal-kernel/core";

export interface InvalidationTarget {
  invalidate(reason?: string): void;
}

export interface Revision extends InvalidationTarget {
  get(): number;
  peek(): number;
}

export interface KeyedRevision<K> {
  get(key: K): number;
  peek(key: K): number;
  invalidate(key: K, reason?: string): void;
  target(key: K): InvalidationTarget;
}

export function createRevision(initial = 0): Revision {
  const version = signal(initial);

  return {
    get: version.get,
    peek: version.peek,
    invalidate(_reason?: string) {
      version.set((current) => current + 1);
    },
  };
}

export function createKeyedRevision<K>(): KeyedRevision<K> {
  const versions = new Map<K, ReturnType<typeof signal<number>>>();

  function getVersion(key: K) {
    let version = versions.get(key);

    if (!version) {
      version = signal(0);
      versions.set(key, version);
    }

    return version;
  }

  return {
    get(key) {
      return getVersion(key).get();
    },
    peek(key) {
      return getVersion(key).peek();
    },
    invalidate(key, _reason?: string) {
      getVersion(key).set((current) => current + 1);
    },
    target(key) {
      return {
        invalidate: (reason?: string) => {
          getVersion(key).set((current) => current + 1);
          void reason;
        },
      };
    },
  };
}
