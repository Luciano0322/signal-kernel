import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app";
import { clearJobs } from "./runtime/jobRegistry";

describe("hono reactive job runtime app", () => {
  beforeEach(() => {
    clearJobs();
  });

  it("responds to health checks", async () => {
    const app = createApp();
    const response = await app.request("/health");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      service: "hono-reactive-job-runtime",
    });
  });

  it("creates a job through the route layer and reads runtime state", async () => {
    const app = createApp();
    const createResponse = await app.request("/jobs/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: "Analyze this runtime note.",
      }),
    });

    expect(createResponse.status).toBe(201);

    const created = (await createResponse.json()) as {
      jobId: string;
      status: string;
    };

    expect(created.jobId).toMatch(/^job_/);
    expect(["pending", "running", "success"]).toContain(created.status);

    const stateResponse = await app.request(`/jobs/${created.jobId}`);

    expect(stateResponse.status).toBe(200);
    expect(await stateResponse.json()).toMatchObject({
      id: created.jobId,
      error: null,
      canRetry: false,
    });
  });

  it("validates create job request bodies", async () => {
    const app = createApp();
    const response = await app.request("/jobs/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: "",
      }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Request body must include a non-empty content string",
    });
  });

  it("returns 404 for unknown jobs", async () => {
    const app = createApp();
    const response = await app.request("/jobs/job_missing");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Job not found",
      id: "job_missing",
    });
  });

  it("cancels and retries jobs through thin route actions", async () => {
    const app = createApp();
    const createResponse = await app.request("/jobs/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: "Cancelable job content.",
      }),
    });

    const created = (await createResponse.json()) as {
      jobId: string;
    };

    const cancelResponse = await app.request(`/jobs/${created.jobId}/cancel`, {
      method: "POST",
    });

    expect(cancelResponse.status).toBe(200);
    expect(await cancelResponse.json()).toEqual({
      ok: true,
      status: "cancelled",
    });

    const retryResponse = await app.request(`/jobs/${created.jobId}/retry`, {
      method: "POST",
    });

    expect(retryResponse.status).toBe(200);

    const retried = (await retryResponse.json()) as {
      ok: boolean;
      status: string;
    };

    expect(retried.ok).toBe(true);
    expect(["pending", "running", "success"]).toContain(retried.status);
  });
});
