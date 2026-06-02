import { batch, signal } from "@signal-kernel/core";
import { describe, expect, it, vi } from "vitest";
import { createResource } from "../createResource.js";
import { createKeyedRevision, createRevision } from "../revision.js";
import type { ResourceContext } from "../createResource.js";

const tick = () => Promise.resolve();
const flush = async () => {
  await tick();
  await tick();
};

describe("createResource", () => {
  it("loads from the source on creation and moves through pending to success", async () => {
    const { get, set } = signal(1);

    const fetcher = vi.fn(async (s: number, _ctx: ResourceContext) => s * 10);

    const [val, meta] = createResource(get, fetcher);

    expect(meta.status()).toBe("pending");
    expect(fetcher).toHaveBeenCalledTimes(1);

    await tick();

    expect(meta.status()).toBe("success");
    expect(val()).toBe(10);

    set(2);
    await tick();

    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("cancels the previous in-flight request on source change and commits the latest result", async () => {
    const { get, set } = signal(1);

    let resolve1!: (v: number) => void;
    let resolve2!: (v: number) => void;

    const fetcher = vi.fn((s: number, ctx: ResourceContext) => {
      if (s === 1) {
        return new Promise<number>((resolve, reject) => {
          resolve1 = resolve;
          ctx.signal.addEventListener("abort", () => {
            const abortErr =
              typeof DOMException !== "undefined"
                ? new DOMException("Aborted", "AbortError")
                : Object.assign(new Error("Aborted"), { name: "AbortError" });
            reject(abortErr);
          });
        });
      }

      return new Promise<number>((resolve) => {
        resolve2 = resolve;
      });
    });

    const onError = vi.fn();
    const [val, meta] = createResource(get, fetcher, { onError });

    expect(meta.status()).toBe("pending");

    set(2);
    await tick();

    expect(meta.status()).toBe("pending");
    expect(fetcher).toHaveBeenCalledTimes(2);

    resolve2(200);
    await tick();

    expect(meta.status()).toBe("success");
    expect(val()).toBe(200);
    expect(onError).not.toHaveBeenCalled();

    resolve1(100);
    await tick();

    expect(meta.status()).toBe("success");
    expect(val()).toBe(200);
    expect(onError).not.toHaveBeenCalled();
  });

  it("starts a resource load on creation even though the internal async signal is lazy", () => {
    const { get } = signal(1);
    const fetcher = vi.fn(async (s: number, _ctx: ResourceContext) => s);

    createResource(get, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("supports object-form auto resources with tracked input", async () => {
    const { get, set } = signal(1);
    const fetcher = vi.fn(async (id: number, _ctx: ResourceContext) => id * 10);

    const [value, meta] = createResource({
      input: get,
      run: fetcher,
    });

    expect(meta.status()).toBe("pending");
    expect(fetcher).toHaveBeenCalledWith(1, expect.any(Object));

    await tick();

    expect(value()).toBe(10);

    set(2);
    await tick();

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenLastCalledWith(2, expect.any(Object));
  });

  it("tracks observe dependencies without passing them to run", async () => {
    const usersRevision = createRevision();
    const fetcher = vi.fn(async (input: string, _ctx: ResourceContext) => input);

    createResource({
      input: () => "users",
      observe: () => {
        usersRevision.get();
      },
      run: fetcher,
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenLastCalledWith("users", expect.any(Object));

    await tick();

    usersRevision.invalidate();
    await tick();

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenLastCalledWith("users", expect.any(Object));
  });

  it("does not duplicate reloads when input and observe change in the same batch", async () => {
    const { get, set } = signal(1);
    const revision = createRevision();
    const fetcher = vi.fn(async (id: number, _ctx: ResourceContext) => id);

    createResource({
      input: get,
      observe: () => {
        revision.get();
      },
      run: fetcher,
    });

    await tick();
    expect(fetcher).toHaveBeenCalledTimes(1);

    batch(() => {
      set(2);
      revision.invalidate();
    });

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenLastCalledWith(2, expect.any(Object));
  });

  it("supports parameterless object-form auto resources", async () => {
    const fetcher = vi.fn(async (input: undefined, _ctx: ResourceContext) => {
      expect(input).toBeUndefined();
      return "loaded";
    });

    const [value] = createResource({
      run: fetcher,
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenLastCalledWith(undefined, expect.any(Object));

    await tick();

    expect(value()).toBe("loaded");
  });

  it("supports manual resources through meta.run(input)", async () => {
    const fetcher = vi.fn(async (input: number, _ctx: ResourceContext) => {
      await tick();
      return input * 10;
    });

    const [value, meta] = createResource({
      trigger: "manual",
      run: fetcher,
    });

    expect(meta.status()).toBe("idle");
    expect(fetcher).not.toHaveBeenCalled();

    const result = meta.run(3);

    expect(meta.status()).toBe("pending");
    expect(fetcher).toHaveBeenCalledWith(3, expect.any(Object));

    await expect(result).resolves.toBe(30);
    expect(meta.status()).toBe("success");
    expect(value()).toBe(30);
  });

  it("manual reload reruns the latest established input", async () => {
    const fetcher = vi.fn(async (input: string, _ctx: ResourceContext) => {
      await tick();
      return `${input}:${fetcher.mock.calls.length}`;
    });

    const [value, meta] = createResource({
      trigger: "manual",
      run: fetcher,
    });

    await expect(meta.run("user-1")).resolves.toBe("user-1:1");
    await expect(meta.reload()).resolves.toBe("user-1:2");

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1]![0]).toBe("user-1");
    expect(value()).toBe("user-1:2");
  });

  it("manual reload is a no-op before any input is established", async () => {
    const fetcher = vi.fn(async (input: string, _ctx: ResourceContext) => input);

    const [, meta] = createResource({
      trigger: "manual",
      run: fetcher,
    });

    await expect(meta.reload()).resolves.toBeUndefined();

    expect(fetcher).not.toHaveBeenCalled();
    expect(meta.status()).toBe("idle");
  });

  it("updates manual resource errors without invalidating targets", async () => {
    const target = { invalidate: vi.fn() };
    const error = new Error("boom");

    const [, meta] = createResource<number, number, Error>({
      trigger: "manual",
      run: async () => {
        throw error;
      },
      invalidates: () => [target],
    });

    await expect(meta.run(1)).resolves.toBeUndefined();

    expect(meta.status()).toBe("error");
    expect(meta.error()).toBe(error);
    expect(target.invalidate).not.toHaveBeenCalled();
  });

  it("does not invalidate targets after manual cancellation", async () => {
    const target = { invalidate: vi.fn() };
    let rejectRun!: (error: unknown) => void;

    const [, meta] = createResource<number, number>({
      trigger: "manual",
      run: (_input, ctx) =>
        new Promise<number>((_resolve, reject) => {
          rejectRun = reject;
          ctx.signal.addEventListener("abort", () => {
            reject(
              typeof DOMException !== "undefined"
                ? new DOMException("Aborted", "AbortError")
                : Object.assign(new Error("Aborted"), { name: "AbortError" })
            );
          });
        }),
      invalidates: () => [target],
    });

    const pending = meta.run(1);
    meta.cancel("user-cancelled");
    rejectRun(new Error("should be ignored"));

    await expect(pending).resolves.toBeUndefined();

    expect(meta.status()).toBe("cancelled");
    expect(target.invalidate).not.toHaveBeenCalled();
  });

  it("invalidates observed resources after a manual resource succeeds", async () => {
    const usersRevision = createRevision();
    const page = signal(1);

    const fetchUsers = vi.fn(async (query: { page: number }) => [
      `page:${query.page}`,
    ]);

    const [users] = createResource({
      input: () => ({ page: page.get() }),
      observe: () => {
        usersRevision.get();
      },
      run: fetchUsers,
    });

    const updateUser = vi.fn(async (payload: { id: string }) => ({
      id: payload.id,
    }));

    const [, updateUserMeta] = createResource({
      trigger: "manual",
      run: updateUser,
      invalidates: () => [usersRevision],
    });

    await flush();
    expect(users()).toEqual(["page:1"]);
    expect(fetchUsers).toHaveBeenCalledTimes(1);

    await updateUserMeta.run({ id: "u1" });
    await flush();

    expect(fetchUsers).toHaveBeenCalledTimes(2);
    expect(users()).toEqual(["page:1"]);
  });

  it("invalidates only matching keyed revision observers", async () => {
    const userRevision = createKeyedRevision<string>();
    const userAId = signal("a");
    const userBId = signal("b");

    const fetchUserA = vi.fn(async (id: string) => `user:${id}`);
    const fetchUserB = vi.fn(async (id: string) => `user:${id}`);

    createResource({
      input: userAId.get,
      observe: () => {
        userRevision.get(userAId.get());
      },
      run: fetchUserA,
    });

    createResource({
      input: userBId.get,
      observe: () => {
        userRevision.get(userBId.get());
      },
      run: fetchUserB,
    });

    const [, updateUserMeta] = createResource({
      trigger: "manual",
      run: async (payload: { id: string }) => payload,
      invalidates: (_result, payload) => [userRevision.target(payload.id)],
    });

    await flush();
    expect(fetchUserA).toHaveBeenCalledTimes(1);
    expect(fetchUserB).toHaveBeenCalledTimes(1);

    await updateUserMeta.run({ id: "a" });
    await flush();

    expect(fetchUserA).toHaveBeenCalledTimes(2);
    expect(fetchUserB).toHaveBeenCalledTimes(1);
  });
});
