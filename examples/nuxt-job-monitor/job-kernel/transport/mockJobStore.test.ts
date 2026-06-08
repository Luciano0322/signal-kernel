import { describe, expect, it } from "vitest";
import { createMockJobStore } from "./mockJobStore";
import type { JobEvent } from "../types";

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
});
