import { afterEach, describe, expect, it, vi } from "vitest";
import { computed, signal } from "@signal-kernel/core";
import type {
  AsyncMeta,
  AsyncStatus,
  StreamAsyncMeta,
  StreamAsyncStatus,
} from "@signal-kernel/async-runtime";
import {
  useComputedValue,
  useReactive,
  useResource,
  useSignalValue,
  useStreamResource,
} from "../index.js";

type ExternalStoreState = {
  lastSnapshot: unknown;
  notifyCount: number;
  renderCount: number;
  unsubscribe: () => void;
};

const reactHarness = vi.hoisted(() => {
  const stores: ExternalStoreState[] = [];

  function cleanup() {
    for (const store of stores.splice(0)) {
      store.unsubscribe();
    }
  }

  function useCallback<T extends (...args: never[]) => unknown>(fn: T): T {
    return fn;
  }

  function useMemo<T>(factory: () => T): T {
    return factory();
  }

  function useRef<T>(initialValue: T): { current: T } {
    return { current: initialValue };
  }

  function useSyncExternalStore<T>(
    subscribe: (notify: () => void) => () => void,
    getSnapshot: () => T,
  ): T {
    const state: ExternalStoreState = {
      lastSnapshot: getSnapshot(),
      notifyCount: 0,
      renderCount: 1,
      unsubscribe: () => {},
    };

    state.unsubscribe = subscribe(() => {
      state.notifyCount += 1;

      const nextSnapshot = getSnapshot();
      if (!Object.is(state.lastSnapshot, nextSnapshot)) {
        state.lastSnapshot = nextSnapshot;
        state.renderCount += 1;
      }
    });

    state.lastSnapshot = getSnapshot();
    stores.push(state);

    return state.lastSnapshot as T;
  }

  return {
    cleanup,
    stores,
    useCallback,
    useMemo,
    useRef,
    useSyncExternalStore,
  };
});

vi.mock("react", () => ({
  useCallback: reactHarness.useCallback,
  useMemo: reactHarness.useMemo,
  useRef: reactHarness.useRef,
  useSyncExternalStore: reactHarness.useSyncExternalStore,
}));

async function flushGraph() {
  await Promise.resolve();
  await Promise.resolve();
}

function latestStore(): ExternalStoreState {
  const store = reactHarness.stores[reactHarness.stores.length - 1];
  if (!store) throw new Error("Expected a subscribed external store");
  return store;
}

afterEach(() => {
  reactHarness.cleanup();
});

describe("@signal-kernel/react", () => {
  it("reads an existing signal and updates through the external store bridge", async () => {
    const count = signal(0);

    expect(useSignalValue(count)).toBe(0);

    const store = latestStore();
    count.set(1);
    await flushGraph();

    expect(store.notifyCount).toBe(1);
    expect(store.renderCount).toBe(2);
    expect(store.lastSnapshot).toBe(1);
  });

  it("reads an existing computed value and observes invalidation", async () => {
    const count = signal(1);
    const doubled = computed(() => count.get() * 2);

    expect(useComputedValue(doubled)).toBe(2);

    const store = latestStore();
    count.set(2);
    await flushGraph();

    expect(store.renderCount).toBe(2);
    expect(store.lastSnapshot).toBe(4);
  });

  it("initializes a lazy computed value when React first observes it", () => {
    const count = signal(1);
    const doubled = computed(() => count.get() * 2);

    expect(doubled.peek()).toBeUndefined();
    expect(useComputedValue(doubled)).toBe(2);
    expect(doubled.peek()).toBe(2);
  });

  it("reads multiple graph values with useReactive", async () => {
    const count = signal(1);
    const status = signal("idle");

    expect(
      useReactive(() => ({
        count: count.get(),
        status: status.get(),
      })),
    ).toEqual({ count: 1, status: "idle" });

    const store = latestStore();
    count.set(2);
    await flushGraph();

    expect(store.lastSnapshot).toEqual({ count: 2, status: "idle" });

    status.set("ready");
    await flushGraph();

    expect(store.renderCount).toBe(3);
    expect(store.lastSnapshot).toEqual({ count: 2, status: "ready" });
  });

  it("does not re-render when useReactive snapshot is equal by custom equality", async () => {
    const count = signal(1);
    const status = signal("idle");

    useReactive(
      () => ({
        count: count.get(),
        status: status.get(),
      }),
      {
        equals: (prev, next) =>
          Object.is(prev.count, next.count) &&
          Object.is(prev.status, next.status),
      },
    );

    const store = latestStore();

    count.set(1);
    await flushGraph();

    expect(store.renderCount).toBe(1);
    expect(store.notifyCount).toBe(0);
  });

  it("does not notify React for equivalent object snapshots after invalidation", async () => {
    const count = signal(1, () => false);
    let readCount = 0;

    useReactive(
      () => {
        readCount += 1;

        return {
          count: count.get(),
        };
      },
      {
        equals: (prev, next) => Object.is(prev.count, next.count),
      },
    );

    const store = latestStore();
    const readsBeforeInvalidation = readCount;

    count.set(1);
    await flushGraph();

    expect(readCount).toBeGreaterThan(readsBeforeInvalidation);
    expect(store.renderCount).toBe(1);
    expect(store.notifyCount).toBe(0);
  });

  it("re-renders resource consumers for metadata-only transitions", async () => {
    const value = signal<string | undefined>("cached-user");
    const status = signal<AsyncStatus>("success");
    const error = signal<Error | undefined>(undefined);
    const cancel = vi.fn();

    const meta: AsyncMeta<Error> = {
      status: status.get,
      error: error.get,
      reload: vi.fn(),
      cancel,
      keepPreviousValueOnPending: true,
    };

    const [current, returnedMeta] = useResource([value.get, meta]);

    expect(current).toBe("cached-user");
    expect(returnedMeta).toBe(meta);

    const store = latestStore();
    status.set("pending");
    await flushGraph();

    expect(store.renderCount).toBe(2);
    expect(store.lastSnapshot).toEqual({
      value: "cached-user",
      status: "pending",
      error: undefined,
    });

    reactHarness.cleanup();

    expect(cancel).not.toHaveBeenCalled();
  });

  it("re-renders stream resource consumers for stream metadata changes", async () => {
    const value = signal<string | undefined>("draft");
    const status = signal<StreamAsyncStatus>("streaming");
    const error = signal<Error | undefined>(undefined);
    const stableValue = signal<string | undefined>("committed");
    const cancel = vi.fn();

    const meta: StreamAsyncMeta<Error, string> = {
      status: status.get,
      error: error.get,
      reload: vi.fn(),
      cancel,
      stableValue: stableValue.get,
    };

    const [current, returnedMeta] = useStreamResource([value.get, meta]);

    expect(current).toBe("draft");
    expect(returnedMeta).toBe(meta);

    const store = latestStore();
    status.set("success");
    await flushGraph();

    expect(store.renderCount).toBe(2);
    expect(store.lastSnapshot).toEqual({
      value: "draft",
      status: "success",
      error: undefined,
      stableValue: "committed",
    });

    stableValue.set("draft");
    await flushGraph();

    expect(store.renderCount).toBe(3);
    expect(store.lastSnapshot).toEqual({
      value: "draft",
      status: "success",
      error: undefined,
      stableValue: "draft",
    });

    reactHarness.cleanup();

    expect(cancel).not.toHaveBeenCalled();
  });
});
