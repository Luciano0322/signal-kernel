import { computed, signal } from "@signal-kernel/core";
import type {
  AsyncMeta,
  AsyncStatus,
  RunnableAsyncMeta,
  StreamAsyncMeta,
  StreamAsyncStatus,
} from "@signal-kernel/async-runtime";
import { describe, expect, it, vi } from "vitest";
import { effectScope, isReadonly } from "vue";
import {
  useComputedValue,
  useReactive,
  useResource,
  useSignalValue,
  useStreamResource,
} from "../index.js";

async function flushGraph() {
  await Promise.resolve();
  await Promise.resolve();
}

function runInScope<T>(read: () => T) {
  const scope = effectScope();
  const result = scope.run(read);
  if (result === undefined) {
    throw new Error("Expected scope to return a value");
  }
  return { result, stop: () => scope.stop() };
}

describe("@signal-kernel/vue", () => {
  it("reads an existing signal as a readonly Vue ref and updates with the graph", async () => {
    const count = signal(0);

    const { result: countRef, stop } = runInScope(() => useSignalValue(count));

    expect(countRef.value).toBe(0);
    expect(isReadonly(countRef)).toBe(true);

    count.set(1);
    await flushGraph();

    expect(countRef.value).toBe(1);

    stop();
    count.set(2);
    await flushGraph();

    expect(countRef.value).toBe(1);
    expect(count.get()).toBe(2);
  });

  it("uses peek for the initial readable snapshot", () => {
    const src = {
      get: vi.fn(() => "tracked"),
      peek: vi.fn(() => "snapshot"),
    };

    const { result } = runInScope(() => useSignalValue(src));

    expect(result.value).toBe("tracked");
    expect(src.peek).toHaveBeenCalledTimes(1);
    expect(src.get).toHaveBeenCalledTimes(1);
  });

  it("reads an existing computed value as a readonly Vue ref", async () => {
    const count = signal(1);
    const doubled = computed(() => count.get() * 2);

    const { result: doubledRef } = runInScope(() => useComputedValue(doubled));

    expect(doubledRef.value).toBe(2);

    count.set(2);
    await flushGraph();

    expect(doubledRef.value).toBe(4);
  });

  it("reads multiple existing graph values with useReactive", async () => {
    const count = signal(1);
    const status = signal("idle");

    const { result: state } = runInScope(() =>
      useReactive(() => ({
        count: count.get(),
        status: status.get(),
      })),
    );

    expect(state.value).toEqual({ count: 1, status: "idle" });

    count.set(2);
    await flushGraph();

    expect(state.value).toEqual({ count: 2, status: "idle" });

    status.set("ready");
    await flushGraph();

    expect(state.value).toEqual({ count: 2, status: "ready" });
  });

  it("exposes resource value and metadata as refs without cancelling on scope disposal", async () => {
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

    const { result: resource, stop } = runInScope(() =>
      useResource([value.get, meta]),
    );

    expect(resource.value.value).toBe("cached-user");
    expect(resource.status.value).toBe("success");
    expect(resource.error.value).toBeUndefined();
    expect(resource.meta).toBe(meta);

    status.set("pending");
    await flushGraph();

    expect(resource.value.value).toBe("cached-user");
    expect(resource.status.value).toBe("pending");

    value.set("fresh-user");
    await flushGraph();

    expect(resource.value.value).toBe("fresh-user");

    const err = new Error("failed");
    error.set(err);
    await flushGraph();

    expect(resource.error.value).toBe(err);

    stop();

    expect(cancel).not.toHaveBeenCalled();
  });

  it("preserves runnable resource metadata through useResource", async () => {
    const value = signal<string | undefined>(undefined);
    const status = signal<AsyncStatus>("idle");
    const error = signal<Error | undefined>(undefined);
    const run = vi.fn(async (input: number) => `user:${input}`);

    const meta: RunnableAsyncMeta<number, string, Error> = {
      status: status.get,
      error: error.get,
      reload: vi.fn(async () => undefined),
      cancel: vi.fn(),
      run,
      keepPreviousValueOnPending: true,
    };

    const { result: resource } = runInScope(() => useResource([value.get, meta]));

    await expect(resource.meta.run(1)).resolves.toBe("user:1");
    expect(run).toHaveBeenCalledWith(1);
  });

  it("exposes stream resource value and metadata refs without defining stream policy", async () => {
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

    const { result: resource, stop } = runInScope(() =>
      useStreamResource([value.get, meta]),
    );

    expect(resource.value.value).toBe("draft");
    expect(resource.status.value).toBe("streaming");
    expect(resource.error.value).toBeUndefined();
    expect(resource.stableValue.value).toBe("committed");
    expect(resource.meta).toBe(meta);

    status.set("success");
    value.set("final-draft");
    stableValue.set("draft");
    await flushGraph();

    expect(resource.value.value).toBe("final-draft");
    expect(resource.status.value).toBe("success");
    expect(resource.stableValue.value).toBe("draft");

    const err = new Error("stream failed");
    error.set(err);
    await flushGraph();

    expect(resource.error.value).toBe(err);

    stop();

    expect(cancel).not.toHaveBeenCalled();
  });
});
