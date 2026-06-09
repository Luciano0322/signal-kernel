import type { Job, JobEvent, JobLog } from "../types";
import type { JobTransport, TransportOptions } from "./JobTransport";

export type MockJobStore = JobTransport;

function cloneJob(job: Job): Job {
  return { ...job };
}

function wait(ms: number, signal?: AbortSignal) {
  if (signal?.aborted) return Promise.reject(signal.reason);

  return new Promise<void>((resolve, reject) => {
    const id = setTimeout(resolve, ms);

    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(id);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

function makeLog(
  jobId: string,
  message: string,
  level: JobLog["level"] = "info",
): JobLog {
  const timestamp = Date.now();

  return {
    id: `log-${jobId}-${timestamp}-${Math.round(Math.random() * 1000)}`,
    jobId,
    timestamp,
    level,
    message,
  };
}

function createInitialJobs(now = Date.now()): Job[] {
  return [
    {
      id: "job-import",
      name: "Import customer records",
      status: "running",
      progress: 46,
      createdAt: now - 1000 * 60 * 12,
      startedAt: now - 1000 * 60 * 10,
    },
    {
      id: "job-invoice",
      name: "Generate monthly invoices",
      status: "queued",
      progress: 0,
      createdAt: now - 1000 * 60 * 6,
    },
    {
      id: "job-report",
      name: "Build revenue report",
      status: "failed",
      progress: 67,
      createdAt: now - 1000 * 60 * 22,
      startedAt: now - 1000 * 60 * 21,
      finishedAt: now - 1000 * 60 * 19,
      durationMs: 1000 * 60 * 2,
      error: "CSV export timed out",
    },
    {
      id: "job-cleanup",
      name: "Archive old task logs",
      status: "succeeded",
      progress: 100,
      createdAt: now - 1000 * 60 * 35,
      startedAt: now - 1000 * 60 * 34,
      finishedAt: now - 1000 * 60 * 32,
      durationMs: 1000 * 60 * 2,
    },
  ];
}

export function createMockJobStore(): MockJobStore {
  let jobs = createInitialJobs();
  let timer: ReturnType<typeof setInterval> | undefined;
  const listeners = new Set<(event: JobEvent) => void>();

  function emit(event: JobEvent) {
    for (const listener of listeners) {
      listener(event);
    }
  }

  function replaceJob(jobId: string, update: (job: Job) => Job) {
    jobs = jobs.map((job) => (job.id === jobId ? update(job) : job));
  }

  function tick() {
    const now = Date.now();
    const active = jobs.find(
      (job) => job.status === "running" || job.status === "retrying",
    );

    if (active) {
      const nextProgress = Math.min(100, active.progress + 9 + (now % 13));

      if (nextProgress >= 100) {
        replaceJob(active.id, (job) => ({
          ...job,
          status: "succeeded",
          progress: 100,
          finishedAt: now,
          durationMs: job.startedAt ? now - job.startedAt : job.durationMs,
          error: undefined,
        }));

        emit({ type: "job_succeeded", jobId: active.id, timestamp: now });
        emit({
          type: "log_appended",
          log: makeLog(active.id, "Job completed successfully"),
        });
        return;
      }

      replaceJob(active.id, (job) => ({
        ...job,
        status: "running",
        progress: nextProgress,
        startedAt: job.startedAt ?? now,
      }));

      emit({
        type: "job_progressed",
        jobId: active.id,
        progress: nextProgress,
        timestamp: now,
      });
      emit({
        type: "log_appended",
        log: makeLog(active.id, `Progress advanced to ${nextProgress}%`),
      });
      return;
    }

    const queued = jobs.find((job) => job.status === "queued");
    if (!queued) return;

    replaceJob(queued.id, (job) => ({
      ...job,
      status: "running",
      startedAt: now,
    }));

    emit({ type: "job_started", jobId: queued.id, timestamp: now });
    emit({
      type: "log_appended",
      log: makeLog(queued.id, "Job moved from queue to running"),
    });
  }

  function ensureTimer() {
    if (timer) return;
    timer = setInterval(tick, 1400);
  }

  function stopTimerIfIdle() {
    if (listeners.size > 0 || !timer) return;
    clearInterval(timer);
    timer = undefined;
  }

  return {
    async fetchJobs(options?: TransportOptions) {
      await wait(260, options?.signal);
      return jobs.map(cloneJob);
    },

    async retryJob(jobId: string, options?: TransportOptions) {
      await wait(180, options?.signal);
      const now = Date.now();

      replaceJob(jobId, (job) => ({
        ...job,
        status: "retrying",
        progress: 0,
        error: undefined,
        startedAt: now,
        finishedAt: undefined,
        durationMs: undefined,
      }));

      emit({ type: "job_retrying", jobId, timestamp: now });
      emit({
        type: "log_appended",
        log: makeLog(jobId, "Retry requested"),
      });
    },

    async cancelJob(jobId: string, options?: TransportOptions) {
      await wait(140, options?.signal);
      const now = Date.now();

      replaceJob(jobId, (job) => ({
        ...job,
        status: "cancelled",
        finishedAt: now,
        durationMs: job.startedAt ? now - job.startedAt : job.durationMs,
      }));

      emit({ type: "job_cancelled", jobId, timestamp: now });
      emit({
        type: "log_appended",
        log: makeLog(jobId, "Job cancellation requested", "warn"),
      });
    },

    subscribeJobEvents(onEvent, options) {
      options?.onStatusChange?.("open");
      listeners.add(onEvent);
      ensureTimer();

      return () => {
        listeners.delete(onEvent);
        stopTimerIfIdle();
        options?.onStatusChange?.("closed");
      };
    },
  };
}
