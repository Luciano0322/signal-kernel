import { describe, expect, it } from "vitest";
import { createJobRuntime } from "./createJobRuntime";
import type { JobAnalyzeStream } from "./jobTypes";

function createDeferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return {
    promise,
    resolve,
    reject,
  };
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("createJobRuntime", () => {
  it("starts with an idle public state before start is called", async () => {
    const runtime = createJobRuntime({
      id: "job_test",
      content: "Document content",
    });

    await flushMicrotasks();

    expect(runtime.getState()).toEqual({
      id: "job_test",
      status: "idle",
      progress: 0,
      currentStep: null,
      partialResult: "",
      stableResult: null,
      visibleResult: null,
      error: null,
      canCancel: false,
      canRetry: false,
      isTerminal: false,
    });

    runtime.dispose();
  });

  it("derives success state from the stream value and metadata", async () => {
    const runtime = createJobRuntime({
      id: "job_success",
      content: "A short document",
    });

    runtime.start();
    await flushMicrotasks();

    expect(runtime.getState()).toMatchObject({
      id: "job_success",
      status: "success",
      progress: 100,
      currentStep: "generate_report",
      stableResult: "Report ready for: A short document",
      visibleResult: "Report ready for: A short document",
      error: null,
      canCancel: false,
      canRetry: false,
      isTerminal: true,
    });

    runtime.dispose();
  });

  it("cancels the active stream and preserves the latest partial result", async () => {
    const release = createDeferred();
    const analyze: JobAnalyzeStream = async (_source, ctx) => {
      ctx.emit({
        progress: 45,
        currentStep: "extract_keywords",
        partialResult: "Parsed content and extracted early keywords.",
      });

      await release.promise;

      if (ctx.isCancelled()) return;

      ctx.done({
        progress: 100,
        currentStep: "generate_report",
        partialResult: "Final report ready.",
        stableResult: "Final report ready.",
      });
    };

    const runtime = createJobRuntime({
      id: "job_cancel",
      content: "Long content",
      analyze,
    });

    runtime.start();
    await flushMicrotasks();
    runtime.cancel();

    expect(runtime.getState()).toMatchObject({
      status: "cancelled",
      progress: 45,
      currentStep: "extract_keywords",
      partialResult: "Parsed content and extracted early keywords.",
      stableResult: null,
      visibleResult: "Parsed content and extracted early keywords.",
      canCancel: false,
      canRetry: true,
      isTerminal: true,
    });

    release.resolve();
    runtime.dispose();
  });

  it("retries cancelled jobs by updating the attempt source", async () => {
    const runs: number[] = [];
    const analyze: JobAnalyzeStream = (source, ctx) => {
      runs.push(source.attempt);
      ctx.emit({
        progress: 30,
        currentStep: "parse_document",
        partialResult: `Attempt ${source.attempt}`,
      });
    };

    const runtime = createJobRuntime({
      id: "job_retry",
      content: "Retryable content",
      analyze,
    });

    runtime.start();
    await flushMicrotasks();
    runtime.cancel();
    runtime.retry();
    await flushMicrotasks();

    expect(runs).toEqual([0, 1]);
    expect(runtime.getState()).toMatchObject({
      status: "running",
      progress: 30,
      partialResult: "Attempt 1",
      canCancel: true,
      canRetry: false,
      isTerminal: false,
    });

    runtime.dispose();
  });

  it("surfaces stream errors without manually mutating derived flags", async () => {
    const analyze: JobAnalyzeStream = (_source, ctx) => {
      ctx.emit({
        progress: 70,
        currentStep: "summarize_sections",
        partialResult: "Partial summary before failure.",
      });

      throw new Error("analysis failed");
    };

    const runtime = createJobRuntime({
      id: "job_error",
      content: "Broken content",
      analyze,
    });

    runtime.start();
    await flushMicrotasks();

    expect(runtime.getState()).toMatchObject({
      status: "error",
      progress: 70,
      currentStep: "summarize_sections",
      partialResult: "Partial summary before failure.",
      error: "analysis failed",
      canCancel: false,
      canRetry: true,
      isTerminal: true,
    });

    runtime.dispose();
  });
});
