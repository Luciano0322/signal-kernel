import { describe, expect, it, vi } from "vitest";
import { createJobKernel } from "./createJobKernel";
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
