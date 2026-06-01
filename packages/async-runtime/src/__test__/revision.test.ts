import { createEffect } from "@signal-kernel/core";
import { describe, expect, it, vi } from "vitest";
import { createKeyedRevision, createRevision } from "../revision.js";

const tick = () => Promise.resolve();

describe("revision", () => {
  it("tracks get() as a reactive dependency and invalidates dependents", async () => {
    const revision = createRevision();
    const seen: number[] = [];

    createEffect(() => {
      seen.push(revision.get());
    });

    expect(seen).toEqual([0]);
    expect(revision.peek()).toBe(0);

    revision.invalidate("users-updated");
    await tick();

    expect(seen).toEqual([0, 1]);
    expect(revision.peek()).toBe(1);
  });

  it("tracks keyed revisions independently", async () => {
    const revision = createKeyedRevision<string>();
    const seenA: number[] = [];
    const seenB: number[] = [];

    createEffect(() => {
      seenA.push(revision.get("a"));
    });

    createEffect(() => {
      seenB.push(revision.get("b"));
    });

    revision.invalidate("a");
    await tick();

    expect(seenA).toEqual([0, 1]);
    expect(seenB).toEqual([0]);

    revision.target("b").invalidate("user-b-updated");
    await tick();

    expect(seenA).toEqual([0, 1]);
    expect(seenB).toEqual([0, 1]);
    expect(revision.peek("a")).toBe(1);
    expect(revision.peek("b")).toBe(1);
  });

  it("target() exposes only invalidation behavior", () => {
    const revision = createKeyedRevision<string>();
    const target = revision.target("user-1");

    expect(Object.keys(target)).toEqual(["invalidate"]);
    expect(vi.isMockFunction(target.invalidate)).toBe(false);

    target.invalidate();

    expect(revision.peek("user-1")).toBe(1);
  });
});
