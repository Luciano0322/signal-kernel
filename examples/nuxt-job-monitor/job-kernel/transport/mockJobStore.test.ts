import { describe, expect, it } from "vitest";
import { createMockJobStore } from "./mockJobStore";
import type { JobEvent, JobEventStreamStatus } from "../types";

describe("createMockJobStore", () => {
  it("emits server-style job events to subscribers", async () => {
    const store = createMockJobStore();
    const events: JobEvent[] = [];
    const unsubscribe = store.subscribeJobEvents((event) => {
      events.push(event);
    });

    await store.retryJob("job-report");
    unsubscribe();

    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "job_retrying",
          jobId: "job-report",
        }),
      ]),
    );
  });

  it("reports subscription status changes", () => {
    const store = createMockJobStore();
    const statuses: JobEventStreamStatus[] = [];
    const unsubscribe = store.subscribeJobEvents(
      () => {},
      {
        onStatusChange: (status) => {
          statuses.push(status);
        },
      },
    );

    unsubscribe();

    expect(statuses).toEqual(["open", "closed"]);
  });
});
