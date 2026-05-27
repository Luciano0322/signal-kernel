import { Hono } from "hono";

function stepNotImplemented(step: string) {
  return {
    error: "Not implemented in Step 1",
    nextStep: step,
  };
}

export const jobsRoute = new Hono();

jobsRoute.post("/analyze", (c) =>
  c.json(stepNotImplemented("Create createJobRuntime() in Step 2"), 501),
);

jobsRoute.get("/:id", (c) =>
  c.json(
    {
      id: c.req.param("id"),
      ...stepNotImplemented("Read runtime state in Step 4"),
    },
    501,
  ),
);

jobsRoute.get("/:id/events", (c) =>
  c.json(
    {
      id: c.req.param("id"),
      ...stepNotImplemented("Add SSE subscription in Step 5"),
    },
    501,
  ),
);

jobsRoute.post("/:id/cancel", (c) =>
  c.json(
    {
      id: c.req.param("id"),
      ...stepNotImplemented("Call runtime.cancel() in Step 4"),
    },
    501,
  ),
);

jobsRoute.post("/:id/retry", (c) =>
  c.json(
    {
      id: c.req.param("id"),
      ...stepNotImplemented("Call runtime.retry() in Step 4"),
    },
    501,
  ),
);

jobsRoute.get("/:id/snapshot", (c) =>
  c.json(
    {
      id: c.req.param("id"),
      ...stepNotImplemented("Export @signal-kernel/snapshot document in Step 6"),
    },
    501,
  ),
);
