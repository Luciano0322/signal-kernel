import type { Job, JobEvent } from "../types";

export type TransportOptions = {
  signal?: AbortSignal;
};

export type JobTransport = {
  fetchJobs(options?: TransportOptions): Promise<Job[]>;
  retryJob(jobId: string, options?: TransportOptions): Promise<void>;
  cancelJob(jobId: string, options?: TransportOptions): Promise<void>;
  subscribeJobEvents(onEvent: (event: JobEvent) => void): () => void;
};
