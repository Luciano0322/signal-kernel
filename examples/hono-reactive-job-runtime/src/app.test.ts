import { describe, expect, it } from "vitest";
import { createApp } from "./app";

describe("hono reactive job runtime app", () => {
  it("responds to health checks", async () => {
    const app = createApp();
    const response = await app.request("/health");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      service: "hono-reactive-job-runtime",
    });
  });

  it("exposes job route placeholders for the next implementation steps", async () => {
    const app = createApp();
    const response = await app.request("/jobs/job_1");

    expect(response.status).toBe(501);
    expect(await response.json()).toEqual({
      error: "Not implemented in Step 1",
      id: "job_1",
      nextStep: "Read runtime state in Step 4",
    });
  });
});
