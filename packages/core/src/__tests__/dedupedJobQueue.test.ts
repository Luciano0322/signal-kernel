import { describe, expect, it } from "vitest";
import { createDedupedJobQueue } from "../dedupedJobQueue.js";

describe("deduped job queue", () => {
  it("shifts queued jobs in insertion order", () => {
    const queue = createDedupedJobQueue<object>();
    const first = {};
    const second = {};

    expect(queue.size).toBe(0);

    queue.enqueue(first);
    queue.enqueue(second);

    expect(queue.size).toBe(2);
    expect(queue.shift()).toBe(first);
    expect(queue.shift()).toBe(second);
    expect(queue.shift()).toBeUndefined();
    expect(queue.size).toBe(0);
  });

  it("dedupes the same queued job until it is shifted", () => {
    const queue = createDedupedJobQueue<object>();
    const job = {};

    queue.enqueue(job);
    queue.enqueue(job);
    queue.enqueue(job);

    expect(queue.size).toBe(1);
    expect(queue.shift()).toBe(job);
    expect(queue.shift()).toBeUndefined();
    expect(queue.size).toBe(0);
  });

  it("allows a shifted job to be queued again", () => {
    const queue = createDedupedJobQueue<object>();
    const job = {};

    queue.enqueue(job);
    expect(queue.shift()).toBe(job);

    queue.enqueue(job);

    expect(queue.size).toBe(1);
    expect(queue.shift()).toBe(job);
    expect(queue.size).toBe(0);
  });

  it("clears queued jobs and allows them to be queued again", () => {
    const queue = createDedupedJobQueue<object>();
    const first = {};
    const second = {};

    queue.enqueue(first);
    queue.enqueue(second);
    queue.clear();

    expect(queue.size).toBe(0);
    expect(queue.shift()).toBeUndefined();

    queue.enqueue(first);

    expect(queue.size).toBe(1);
    expect(queue.shift()).toBe(first);
  });
});
