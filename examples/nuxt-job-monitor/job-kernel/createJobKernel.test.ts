import { describe, expect, it, vi } from "vitest";
import {
  captureSnapshot,
  decodeJsonSnapshot,
  encodeJsonSnapshot,
  restoreSnapshot,
} from "@signal-kernel/snapshot";
import { createJobKernel } from "./createJobKernel";
import { createJobKernelSnapshotScope } from "./snapshot";
import type {
  Job,
  JobEvent,
  JobEventStreamStatus,
  JobTransport,
} from "./index";

function flush() {
  return Promise.resolve().then(() => Promise.resolve());
}

function createTestTransport(initialJobs: Job[]): JobTransport {
  let jobs = initialJobs.map((job) => ({ ...job }));

  return {
    fetchJobs: vi.fn(async () => jobs.map((job) => ({ ...job }))),
    retryJob: vi.fn(async (jobId: string) => {
      jobs = jobs.map((job) =>
        job.id === jobId
          ? { ...job, status: "retrying", progress: 0, error: undefined }
          : job,
      );
    }),
    cancelJob: vi.fn(async (jobId: string) => {
      jobs = jobs.map((job) =>
        job.id === jobId ? { ...job, status: "cancelled" } : job,
      );
    }),
    subscribeJobEvents: vi.fn(() => vi.fn()),
  };
}

describe("createJobKernel", () => {
  it("loads jobs into an external signal-kernel graph", async () => {
    const jobs: Job[] = [
      {
        id: "job-1",
        name: "Import",
        status: "running",
        progress: 30,
        createdAt: 1,
      },
      {
        id: "job-2",
        name: "Report",
        status: "failed",
        progress: 60,
        createdAt: 1,
      },
    ];
    const transport = createTestTransport(jobs);
    const kernel = createJobKernel({ transport });

    await flush();

    expect(kernel.state.jobs.get()).toEqual(jobs);
    expect(kernel.computed.jobSummary.get()).toMatchObject({
      total: 2,
      running: 1,
      failed: 1,
    });
  });

  it("filters jobs and updates selected job through graph actions", async () => {
    const jobs: Job[] = [
      {
        id: "job-1",
        name: "Import",
        status: "running",
        progress: 30,
        createdAt: 1,
      },
      {
        id: "job-2",
        name: "Report",
        status: "failed",
        progress: 60,
        createdAt: 1,
      },
    ];
    const kernel = createJobKernel({ transport: createTestTransport(jobs) });

    await flush();

    kernel.actions.setStatusFilter("failed");
    kernel.actions.selectJob("job-2");

    expect(kernel.computed.filteredJobs.get()).toEqual([jobs[1]]);
    expect(kernel.computed.selectedJob.get()).toEqual(jobs[1]);
  });

  it("derives job list action flags and runtime health in the graph", async () => {
    const jobs: Job[] = [
      {
        id: "job-1",
        name: "Import",
        status: "running",
        progress: 30,
        createdAt: Date.now() - 1000 * 60 * 12,
        startedAt: Date.now() - 1000 * 60 * 3,
      },
      {
        id: "job-2",
        name: "Report",
        status: "failed",
        progress: 60,
        createdAt: 1,
      },
    ];
    const kernel = createJobKernel({ transport: createTestTransport(jobs) });

    await flush();

    const items = kernel.computed.filteredJobListItems.get();

    expect(items).toEqual([
      expect.objectContaining({
        id: "job-1",
        canCancel: true,
        canRetry: false,
        isSlaBreached: true,
      }),
      expect.objectContaining({
        id: "job-2",
        canCancel: false,
        canRetry: true,
        isSlaBreached: false,
      }),
    ]);
    expect(kernel.computed.runtimeHealth.get()).toMatchObject({
      queueHealth: "blocked",
      slaBreachedJobs: 1,
    });
  });

  it("tracks event stream status and last event timestamp", async () => {
    const jobs: Job[] = [
      {
        id: "job-1",
        name: "Import",
        status: "running",
        progress: 30,
        createdAt: 1,
      },
    ];
    const eventTimestamp = 123;
    const transport = createTestTransport(jobs);
    transport.subscribeJobEvents = vi.fn((onEvent, options) => {
      options?.onStatusChange?.("open");
      onEvent({
        type: "job_progressed",
        jobId: "job-1",
        progress: 50,
        timestamp: eventTimestamp,
      });

      return () => {
        options?.onStatusChange?.("closed");
      };
    });
    const kernel = createJobKernel({ transport });

    await flush();
    kernel.actions.start();
    await flush();

    expect(kernel.state.eventStreamStatus.get()).toBe("open");
    expect(kernel.computed.runtimeHealth.get()).toMatchObject({
      connectionStatus: "open",
      lastEventAt: eventTimestamp,
    });
    expect(kernel.state.jobs.get()[0]?.progress).toBe(50);

    kernel.actions.stop();

    expect(kernel.state.eventStreamStatus.get()).toBe("closed");
  });

  it("owns pushed job events through a stream resource lifecycle", async () => {
    const jobs: Job[] = [
      {
        id: "job-1",
        name: "Import",
        status: "running",
        progress: 30,
        createdAt: 1,
      },
    ];
    const event = {
      type: "job_progressed" as const,
      jobId: "job-1",
      progress: 75,
      timestamp: 456,
    };
    const transport = createTestTransport(jobs);
    const unsubscribe = vi.fn();
    let pushEvent: ((nextEvent: typeof event) => void) | undefined;

    transport.subscribeJobEvents = vi.fn((onEvent, options) => {
      pushEvent = onEvent;
      options?.onStatusChange?.("open");
      return unsubscribe;
    });

    const kernel = createJobKernel({ transport });

    await flush();
    kernel.actions.start();
    await flush();

    if (!pushEvent) throw new Error("job event subscription did not start");
    pushEvent(event);

    expect(kernel.resources.jobEventsResource[0]()).toEqual(event);
    expect(kernel.resources.jobEventsResource[1].status()).toBe("streaming");
    expect(kernel.state.jobs.get()[0]?.progress).toBe(75);

    kernel.actions.stop();
    await flush();

    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(kernel.state.eventStreamStatus.get()).toBe("closed");
  });

  it("stops the active event subscription before stale callbacks can update the graph", async () => {
    const jobs: Job[] = [
      {
        id: "job-1",
        name: "Import",
        status: "running",
        progress: 30,
        createdAt: 1,
      },
    ];
    const transport = createTestTransport(jobs);
    const unsubscribe = vi.fn();
    let retainedEventCallback: ((event: JobEvent) => void) | undefined;

    transport.subscribeJobEvents = vi.fn((onEvent) => {
      retainedEventCallback = onEvent;
      return unsubscribe;
    });

    const kernel = createJobKernel({ transport });

    await flush();
    kernel.actions.start();
    await flush();

    if (!retainedEventCallback) {
      throw new Error("job event subscription did not start");
    }

    kernel.actions.stop();

    expect(unsubscribe).toHaveBeenCalledOnce();

    retainedEventCallback({
      type: "job_progressed",
      jobId: "job-1",
      progress: 90,
      timestamp: 999,
    });

    expect(kernel.state.jobs.get()[0]?.progress).toBe(30);
    expect(kernel.resources.jobEventsResource[1].status()).toBe("cancelled");
  });

  it("keeps the stream active while the SSE transport is reconnecting", async () => {
    const failure = new Error("temporary SSE interruption");
    const transport = createTestTransport([]);
    const unsubscribe = vi.fn();
    let pushEvent: ((event: JobEvent) => void) | undefined;
    let reportError: ((error: unknown) => void) | undefined;
    let reportStatus: ((status: JobEventStreamStatus) => void) | undefined;

    transport.subscribeJobEvents = vi.fn((onEvent, options) => {
      pushEvent = onEvent;
      reportError = options?.onError;
      reportStatus = options?.onStatusChange;
      return unsubscribe;
    });

    const kernel = createJobKernel({ transport });

    await flush();
    kernel.actions.start();
    await flush();

    if (!pushEvent || !reportError || !reportStatus) {
      throw new Error("job event subscription callbacks were not captured");
    }

    pushEvent({
      type: "log_appended",
      log: {
        id: "log-1",
        jobId: "job-1",
        level: "info",
        message: "Started",
        timestamp: 123,
      },
    });
    reportStatus("reconnecting");
    reportError(failure);

    expect(kernel.state.eventStreamStatus.get()).toBe("reconnecting");
    expect(kernel.state.streamError.get()).toBe(failure);
    expect(kernel.resources.jobEventsResource[1].status()).toBe("streaming");
    expect(unsubscribe).not.toHaveBeenCalled();

    kernel.actions.stop();
  });

  it("captures and restores explicit job graph state through snapshot handoff", async () => {
    const jobs: Job[] = [
      {
        id: "job-1",
        name: "Import",
        status: "running",
        progress: 30,
        createdAt: 1,
      },
      {
        id: "job-2",
        name: "Report",
        status: "failed",
        progress: 60,
        createdAt: 1,
      },
    ];
    const source = createJobKernel({ transport: createTestTransport(jobs) });
    const target = createJobKernel({ transport: createTestTransport([]) });

    await flush();

    source.actions.setStatusFilter("failed");
    source.actions.selectJob("job-2");
    source.actions.dispatch({
      type: "log_appended",
      log: {
        id: "log-1",
        jobId: "job-2",
        level: "error",
        message: "Retry needed",
        timestamp: 123,
      },
    });

    const snapshot = captureSnapshot(createJobKernelSnapshotScope(source));
    const decoded = decodeJsonSnapshot(encodeJsonSnapshot(snapshot));
    const report = restoreSnapshot(
      createJobKernelSnapshotScope(target),
      decoded,
    );

    expect(report).toEqual({
      restored: ["jobs", "logs", "selectedJobId", "statusFilter", "lastEventAt"],
      skipped: [
        "jobSummary",
        "filteredJobListItems",
        "runtimeHealth",
        "jobsResource",
        "jobEvents",
      ],
      warnings: [],
    });
    expect(target.state.jobs.get()).toEqual(source.state.jobs.get());
    expect(target.state.logs.get()).toEqual(source.state.logs.get());
    expect(target.state.selectedJobId.get()).toBe("job-2");
    expect(target.state.statusFilter.get()).toBe("failed");
    expect(target.state.lastEventAt.get()).toBe(123);
    expect(target.computed.jobSummary.get()).toMatchObject({
      total: 2,
      failed: 1,
    });
    expect(target.computed.filteredJobListItems.get()).toEqual([
      expect.objectContaining({
        id: "job-2",
        canRetry: true,
      }),
    ]);

    const nodeKinds = snapshot.nodes.map((node) => [node.id, node.kind]);

    expect(nodeKinds).toEqual(
      expect.arrayContaining([
        ["jobsResource", "resource"],
        ["jobEvents", "stream"],
      ]),
    );
  });

  it("captures the job event stream resource as inspect-only metadata", async () => {
    const jobs: Job[] = [
      {
        id: "job-1",
        name: "Import",
        status: "running",
        progress: 30,
        createdAt: 1,
      },
    ];
    const event: JobEvent = {
      type: "job_progressed",
      jobId: "job-1",
      progress: 80,
      timestamp: 789,
    };
    const transport = createTestTransport(jobs);
    let pushEvent: ((event: JobEvent) => void) | undefined;

    transport.subscribeJobEvents = vi.fn((onEvent) => {
      pushEvent = onEvent;
      return vi.fn();
    });

    const kernel = createJobKernel({ transport });

    await flush();
    kernel.actions.start();
    await flush();

    if (!pushEvent) throw new Error("job event subscription did not start");
    pushEvent(event);

    const snapshot = captureSnapshot(createJobKernelSnapshotScope(kernel));
    const streamNode = snapshot.nodes.find((node) => node.id === "jobEvents");

    expect(streamNode).toMatchObject({
      kind: "stream",
      restore: "inspect-only",
      status: "streaming",
      value: event,
    });

    kernel.actions.stop();
  });

  it("recomputes runtime health from restored writable graph state", async () => {
    const jobs: Job[] = [
      {
        id: "job-1",
        name: "Import",
        status: "failed",
        progress: 60,
        createdAt: 1,
      },
    ];
    const source = createJobKernel({ transport: createTestTransport(jobs) });
    const target = createJobKernel({ transport: createTestTransport([]) });

    await flush();

    source.actions.dispatch({
      type: "log_appended",
      log: {
        id: "log-1",
        jobId: "job-1",
        level: "error",
        message: "Import failed",
        timestamp: 456,
      },
    });

    const snapshot = captureSnapshot(createJobKernelSnapshotScope(source));
    restoreSnapshot(createJobKernelSnapshotScope(target), snapshot);

    expect(target.computed.runtimeHealth.get()).toMatchObject({
      connectionStatus: "idle",
      lastEventAt: 456,
      queueHealth: "blocked",
    });
  });

  it("restores graph state before explicitly reconnecting the event stream", async () => {
    const jobs: Job[] = [
      {
        id: "job-1",
        name: "Import",
        status: "running",
        progress: 30,
        createdAt: 1,
      },
    ];
    const source = createJobKernel({ transport: createTestTransport(jobs) });
    const targetTransport = createTestTransport([]);
    const target = createJobKernel({ transport: targetTransport });

    await flush();

    const snapshot = captureSnapshot(createJobKernelSnapshotScope(source));

    target.actions.start();
    await flush();
    target.actions.stop();
    await flush();
    restoreSnapshot(createJobKernelSnapshotScope(target), snapshot);

    expect(target.state.jobs.get()).toEqual(jobs);
    expect(targetTransport.subscribeJobEvents).toHaveBeenCalledTimes(1);

    target.actions.start();
    await flush();

    expect(targetTransport.subscribeJobEvents).toHaveBeenCalledTimes(2);

    target.actions.stop();
  });

  it("uses manual resources for mutation-like actions", async () => {
    const jobs: Job[] = [
      {
        id: "job-1",
        name: "Import",
        status: "failed",
        progress: 40,
        createdAt: 1,
      },
    ];
    const transport = createTestTransport(jobs);
    const kernel = createJobKernel({ transport });

    await flush();
    await kernel.actions.retryJob("job-1");
    await flush();

    expect(transport.retryJob).toHaveBeenCalledWith("job-1", {
      signal: expect.any(AbortSignal),
    });
    expect(kernel.state.jobs.get()[0]?.status).toBe("retrying");
  });
});
