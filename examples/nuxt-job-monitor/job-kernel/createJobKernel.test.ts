import { describe, expect, it, vi } from "vitest";
import {
  captureSnapshot,
  decodeJsonSnapshot,
  encodeJsonSnapshot,
  restoreSnapshot,
} from "@signal-kernel/snapshot";
import { createJobKernel } from "./createJobKernel";
import { createJobKernelSnapshotScope } from "./snapshot";
import type { Job, JobTransport } from "./index";

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

    expect(kernel.state.eventStreamStatus.get()).toBe("open");
    expect(kernel.computed.runtimeHealth.get()).toMatchObject({
      connectionStatus: "open",
      lastEventAt: eventTimestamp,
    });
    expect(kernel.state.jobs.get()[0]?.progress).toBe(50);

    kernel.actions.stop();

    expect(kernel.state.eventStreamStatus.get()).toBe("closed");
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
    target.actions.stop();
    restoreSnapshot(createJobKernelSnapshotScope(target), snapshot);

    expect(target.state.jobs.get()).toEqual(jobs);
    expect(targetTransport.subscribeJobEvents).toHaveBeenCalledTimes(1);

    target.actions.start();

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
