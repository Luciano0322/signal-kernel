import { computed, signal } from "@signal-kernel/core";
import { createResource, createRevision } from "@signal-kernel/async-runtime";
import type { Job, JobEvent, JobLog, JobStatus, JobSummary } from "./types";
import type { JobTransport } from "./transport/JobTransport";

export type CreateJobKernelOptions = {
  transport: JobTransport;
};

function calculateDuration(job: Job, timestamp: number) {
  return job.startedAt ? timestamp - job.startedAt : job.durationMs;
}

export function createJobKernel(options: CreateJobKernelOptions) {
  const { transport } = options;

  const jobs = signal<Job[]>([]);
  const logs = signal<JobLog[]>([]);
  const selectedJobId = signal<string | null>(null);
  const statusFilter = signal<JobStatus | "all">("all");
  const jobsRevision = createRevision();

  function updateJob(jobId: string, updater: (job: Job) => Job) {
    jobs.set(jobs.get().map((job) => (job.id === jobId ? updater(job) : job)));
  }

  function applyJobEvent(event: JobEvent) {
    switch (event.type) {
      case "job_created":
        jobs.set([...jobs.get(), event.job]);
        break;

      case "job_started":
        updateJob(event.jobId, (job) => ({
          ...job,
          status: "running",
          startedAt: event.timestamp,
        }));
        break;

      case "job_progressed":
        updateJob(event.jobId, (job) => ({
          ...job,
          status: "running",
          progress: event.progress,
        }));
        break;

      case "job_succeeded":
        updateJob(event.jobId, (job) => ({
          ...job,
          status: "succeeded",
          progress: 100,
          finishedAt: event.timestamp,
          durationMs: calculateDuration(job, event.timestamp),
          error: undefined,
        }));
        break;

      case "job_failed":
        updateJob(event.jobId, (job) => ({
          ...job,
          status: "failed",
          error: event.error,
          finishedAt: event.timestamp,
          durationMs: calculateDuration(job, event.timestamp),
        }));
        break;

      case "job_retrying":
        updateJob(event.jobId, (job) => ({
          ...job,
          status: "retrying",
          progress: 0,
          error: undefined,
          finishedAt: undefined,
          durationMs: undefined,
        }));
        break;

      case "job_cancelled":
        updateJob(event.jobId, (job) => ({
          ...job,
          status: "cancelled",
          finishedAt: event.timestamp,
          durationMs: calculateDuration(job, event.timestamp),
        }));
        break;

      case "log_appended":
        logs.set([...logs.get(), event.log]);
        break;
    }
  }

  const jobsResource = createResource({
    observe: () => {
      jobsRevision.get();
    },
    run: async (_input: undefined, ctx) => {
      return transport.fetchJobs({ signal: ctx.signal });
    },
    onSuccess: (fetchedJobs) => {
      jobs.set(fetchedJobs);
      if (!selectedJobId.peek() && fetchedJobs[0]) {
        selectedJobId.set(fetchedJobs[0].id);
      }
    },
  });

  const [, retryJobMeta] = createResource({
    trigger: "manual",
    run: async (jobId: string, ctx) => {
      await transport.retryJob(jobId, { signal: ctx.signal });
      return { jobId };
    },
    invalidates: () => [jobsRevision],
  });

  const [, cancelJobMeta] = createResource({
    trigger: "manual",
    run: async (jobId: string, ctx) => {
      await transport.cancelJob(jobId, { signal: ctx.signal });
      return { jobId };
    },
    invalidates: () => [jobsRevision],
  });

  const filteredJobs = computed(() => {
    const currentJobs = jobs.get();
    const filter = statusFilter.get();

    if (filter === "all") return currentJobs;
    return currentJobs.filter((job) => job.status === filter);
  });

  const selectedJob = computed(() => {
    const id = selectedJobId.get();
    if (!id) return null;

    return jobs.get().find((job) => job.id === id) ?? null;
  });

  const jobSummary = computed<JobSummary>(() => {
    const currentJobs = jobs.get();
    const completedJobs = currentJobs.filter((job) => job.durationMs != null);

    return {
      total: currentJobs.length,
      queued: currentJobs.filter((job) => job.status === "queued").length,
      running: currentJobs.filter((job) => job.status === "running").length,
      succeeded: currentJobs.filter((job) => job.status === "succeeded").length,
      failed: currentJobs.filter((job) => job.status === "failed").length,
      retrying: currentJobs.filter((job) => job.status === "retrying").length,
      cancelled: currentJobs.filter((job) => job.status === "cancelled").length,
      averageDurationMs:
        completedJobs.length === 0
          ? null
          : completedJobs.reduce(
              (sum, job) => sum + (job.durationMs ?? 0),
              0,
            ) / completedJobs.length,
    };
  });

  const selectedJobLogs = computed(() => {
    const id = selectedJobId.get();
    if (!id) return [];

    return logs.get().filter((log) => log.jobId === id);
  });

  let stopEvents: (() => void) | undefined;

  function start() {
    if (stopEvents) return;
    stopEvents = transport.subscribeJobEvents(applyJobEvent);
  }

  function stop() {
    stopEvents?.();
    stopEvents = undefined;
  }

  async function retryJob(jobId: string) {
    applyJobEvent({
      type: "job_retrying",
      jobId,
      timestamp: Date.now(),
    });

    const result = await retryJobMeta.run(jobId);

    if (retryJobMeta.status() === "error") {
      applyJobEvent({
        type: "job_failed",
        jobId,
        error: String(retryJobMeta.error() ?? "Retry failed"),
        timestamp: Date.now(),
      });
    }

    return result;
  }

  async function cancelJob(jobId: string) {
    const result = await cancelJobMeta.run(jobId);

    if (result) {
      applyJobEvent({
        type: "job_cancelled",
        jobId,
        timestamp: Date.now(),
      });
    }

    return result;
  }

  return {
    state: {
      jobs,
      logs,
      selectedJobId,
      statusFilter,
    },
    resources: {
      jobsResource,
    },
    revisions: {
      jobsRevision,
    },
    computed: {
      filteredJobs,
      selectedJob,
      jobSummary,
      selectedJobLogs,
    },
    mutations: {
      retryJob: retryJobMeta,
      cancelJob: cancelJobMeta,
    },
    actions: {
      selectJob: selectedJobId.set,
      setStatusFilter: statusFilter.set,
      retryJob,
      cancelJob,
      dispatch: applyJobEvent,
      start,
      stop,
    },
  };
}

export type JobKernel = ReturnType<typeof createJobKernel>;
