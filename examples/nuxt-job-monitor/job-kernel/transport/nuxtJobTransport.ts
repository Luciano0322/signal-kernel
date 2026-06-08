import type { Job, JobEvent } from "../types";
import type { JobTransport, TransportOptions } from "./JobTransport";

export type CreateNuxtJobTransportOptions = {
  basePath?: string;
};

async function requestJson<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      accept: "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Job API request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function createNuxtJobTransport(
  options: CreateNuxtJobTransportOptions = {},
): JobTransport {
  const basePath = options.basePath ?? "/api/jobs";

  return {
    fetchJobs(transportOptions?: TransportOptions) {
      return requestJson<Job[]>(basePath, {
        signal: transportOptions?.signal,
      });
    },

    async retryJob(jobId: string, transportOptions?: TransportOptions) {
      await requestJson<{ ok: true }>(
        `${basePath}/${encodeURIComponent(jobId)}/retry`,
        {
          method: "POST",
          signal: transportOptions?.signal,
        },
      );
    },

    async cancelJob(jobId: string, transportOptions?: TransportOptions) {
      await requestJson<{ ok: true }>(
        `${basePath}/${encodeURIComponent(jobId)}/cancel`,
        {
          method: "POST",
          signal: transportOptions?.signal,
        },
      );
    },

    subscribeJobEvents(onEvent: (event: JobEvent) => void) {
      const source = new EventSource(`${basePath}/events`);

      source.onmessage = (message) => {
        onEvent(JSON.parse(message.data) as JobEvent);
      };

      return () => {
        source.close();
      };
    },
  };
}
