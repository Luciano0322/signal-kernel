import type { Job, JobEvent, JobEventStreamStatus } from "../types";

export type TransportOptions = {
  signal?: AbortSignal;
};

export type JobEventSubscriptionOptions = {
  onStatusChange?: (status: JobEventStreamStatus) => void;
  onError?: (error: unknown) => void;
};

export type JobTransport = {
  fetchJobs(options?: TransportOptions): Promise<Job[]>;
  retryJob(jobId: string, options?: TransportOptions): Promise<void>;
  cancelJob(jobId: string, options?: TransportOptions): Promise<void>;
  subscribeJobEvents(
    onEvent: (event: JobEvent) => void,
    options?: JobEventSubscriptionOptions,
  ): () => void;
};
