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

  it("streams job state events through SSE", async () => {
    const app = createApp();
    const createResponse = await app.request("/jobs/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: "SSE job content.",
      }),
    });

    const created = (await createResponse.json()) as {
      jobId: string;
    };

    const eventResponse = await app.request(`/jobs/${created.jobId}/events`);

    expect(eventResponse.status).toBe(200);
    expect(eventResponse.headers.get("content-type")).toContain(
      "text/event-stream",
    );

    const reader = eventResponse.body?.getReader();

    expect(reader).toBeDefined();

    const decoder = new TextDecoder();
    const first = await reader!.read();

    expect(first.done).toBe(false);

    const cancelResponse = await app.request(`/jobs/${created.jobId}/cancel`, {
      method: "POST",
    });

    expect(cancelResponse.status).toBe(200);

    let text = first.value ? decoder.decode(first.value, { stream: true }) : "";

    for (let i = 0; i < 6 && !text.includes("event: done"); i += 1) {
      const next = await reader!.read();

      if (next.done) break;

      text += decoder.decode(next.value, { stream: true });
    }

    expect(text).toContain("event: state");
    expect(text).toContain("event: done");
    expect(text).toContain('"status":"cancelled"');
  });
});
