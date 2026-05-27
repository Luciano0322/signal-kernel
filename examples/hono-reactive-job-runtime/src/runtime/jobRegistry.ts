import { createJobRuntime } from "./createJobRuntime";
import type { JobRuntime } from "./jobTypes";

const jobs = new Map<string, JobRuntime>();

export function createJob(content: string): JobRuntime {
  const runtime = createJobRuntime({ content });
  jobs.set(runtime.id, runtime);
  return runtime;
}

export function getJob(id: string): JobRuntime | null {
  return jobs.get(id) ?? null;
}

export function deleteJob(id: string): boolean {
  const runtime = jobs.get(id);

  if (!runtime) return false;

  runtime.dispose();
  return jobs.delete(id);
}

export function clearJobs() {
  for (const runtime of jobs.values()) {
    runtime.dispose();
  }

  jobs.clear();
}
