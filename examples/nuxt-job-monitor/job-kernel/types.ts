export type JobStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "retrying"
  | "cancelled";

export type Job = {
  id: string;
  name: string;
  status: JobStatus;
  progress: number;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  durationMs?: number;
  error?: string;
};

export type JobLog = {
  id: string;
  jobId: string;
  timestamp: number;
  level: "info" | "warn" | "error";
  message: string;
};

export type JobEventStreamStatus =
  | "idle"
  | "connecting"
  | "open"
  | "reconnecting"
  | "closed";

export type JobQueueHealth = "healthy" | "attention" | "blocked";

export type JobEvent =
  | { type: "job_created"; job: Job }
  | { type: "job_started"; jobId: string; timestamp: number }
  | {
      type: "job_progressed";
      jobId: string;
      progress: number;
      timestamp: number;
    }
  | { type: "job_succeeded"; jobId: string; timestamp: number }
  | {
      type: "job_failed";
      jobId: string;
      error: string;
      timestamp: number;
    }
  | { type: "job_retrying"; jobId: string; timestamp: number }
  | { type: "job_cancelled"; jobId: string; timestamp: number }
  | { type: "log_appended"; log: JobLog };

export type JobSummary = {
  total: number;
  queued: number;
  running: number;
  succeeded: number;
  failed: number;
  retrying: number;
  cancelled: number;
  averageDurationMs: number | null;
};

export type JobListItem = Job & {
  canRetry: boolean;
  canCancel: boolean;
  isStuck: boolean;
  isSlaBreached: boolean;
};

export type JobRuntimeHealth = {
  connectionStatus: JobEventStreamStatus;
  lastEventAt: number | null;
  queueHealth: JobQueueHealth;
  stuckJobs: number;
  slaBreachedJobs: number;
};
