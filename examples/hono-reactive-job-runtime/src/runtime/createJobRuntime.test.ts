import { describe, expect, it } from "vitest";
import { analyzeDocument, analysisSteps } from "../mock/analyzeDocument";
import { createJobRuntime } from "./createJobRuntime";
import type {
  JobAnalyzeStream,
  JobExecutionChunk,
  JobExecutionState,
} from "./jobTypes";

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
  for (let i = 0; i < 12; i += 1) {
    await Promise.resolve();
  }
}

describe("createJobRuntime", () => {
  it("models document analysis as four progressive stream chunks", async () => {
    const chunks: JobExecutionChunk[] = [];
    let finalValue: JobExecutionState | undefined;

    await analyzeDocument(
      {
        attempt: 1,
        content: "Runtime notes",
      },
      {
        emit: (chunk) => chunks.push(chunk),
        set: (value) => {
          finalValue = value;
        },
        done: (value) => {
          finalValue = value;
        },
        isCancelled: () => false,
      },
      {
        wait: async () => undefined,
      },
    );

    expect(chunks).toHaveLength(analysisSteps.length);
    expect(chunks.map((chunk) => chunk.currentStep)).toEqual([
      "parse_document",
      "extract_keywords",
      "summarize_sections",
      "generate_report",
    ]);
    expect(chunks.map((chunk) => chunk.progress)).toEqual([20, 45, 70, 90]);
    expect(finalValue).toMatchObject({
      progress: 100,
      currentStep: "generate_report",
      stableResult: expect.stringContaining("Runtime notes"),
    });
  });

  it("stops the mock analysis stream when the context is cancelled", async () => {
    const chunks: JobExecutionChunk[] = [];
    let finalValue: JobExecutionState | undefined;

    await analyzeDocument(
      {
        attempt: 0,
        content: "Cancelled notes",
      },
      {
        emit: (chunk) => chunks.push(chunk),
        set: (value) => {
          finalValue = value;
        },
        done: (value) => {
          finalValue = value;
        },
        isCancelled: () => chunks.length > 0,
      },
      {
        wait: async () => undefined,
      },
    );

    expect(chunks).toHaveLength(1);
    expect(finalValue).toBeUndefined();
  });

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
    const analyze: JobAnalyzeStream = (source, ctx) =>
      analyzeDocument(source, ctx, {
        wait: async () => undefined,
      });

    const runtime = createJobRuntime({
      id: "job_success",
      content: "A short document",
      analyze,
    });

    runtime.start();
    await flushMicrotasks();

    expect(runtime.getState()).toMatchObject({
      id: "job_success",
      status: "success",
      progress: 100,
      currentStep: "generate_report",
      stableResult: expect.stringContaining("A short document"),
      visibleResult: expect.stringContaining("A short document"),
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
