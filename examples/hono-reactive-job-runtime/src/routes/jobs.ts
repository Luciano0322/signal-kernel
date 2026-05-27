import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { createJob, getJob } from "../runtime/jobRegistry";

function stepNotImplemented(step: string) {
  return {
    error: "Not implemented yet",
    nextStep: step,
  };
}

export const jobsRoute = new Hono();

function jobNotFound(id: string) {
  return {
    error: "Job not found",
    id,
  };
}

jobsRoute.post("/analyze", async (c) => {
  const body = await c.req.json().catch(() => null);

  if (
    !body ||
    typeof body !== "object" ||
    !("content" in body) ||
    typeof body.content !== "string" ||
    body.content.trim().length === 0
  ) {
    return c.json(
      {
        error: "Request body must include a non-empty content string",
      },
      400,
    );
  }

  const runtime = createJob(body.content);
  runtime.start();

  return c.json(
    {
      jobId: runtime.id,
      status: runtime.getState().status,
    },
    201,
  );
});

jobsRoute.get("/:id", (c) => {
  const id = c.req.param("id");
  const runtime = getJob(id);

  if (!runtime) return c.json(jobNotFound(id), 404);

  return c.json(runtime.getState());
});

jobsRoute.get("/:id/events", (c) => {
  const id = c.req.param("id");
  const runtime = getJob(id);

  if (!runtime) return c.json(jobNotFound(id), 404);

  return streamSSE(c, async (stream) => {
    let unsubscribe: () => void = () => undefined;
    let closeEvents: () => void = () => undefined;

    const eventsClosed = new Promise<void>((resolve) => {
      closeEvents = resolve;
    });

    let writes = Promise.resolve();

    stream.onAbort(() => {
      unsubscribe();
      closeEvents();
    });

    unsubscribe = runtime.subscribe((state) => {
      writes = writes
        .then(async () => {
          if (stream.closed || stream.aborted) return;

          await stream.writeSSE({
            event: "state",
            data: JSON.stringify(state),
          });

          if (!state.isTerminal) return;

          await stream.writeSSE({
            event: "done",
            data: JSON.stringify(state),
          });

          closeEvents();
        })
        .catch(() => {
          closeEvents();
        });
    });

    await eventsClosed;
    unsubscribe();
    await writes;
  });
});

jobsRoute.post("/:id/cancel", (c) => {
  const id = c.req.param("id");
  const runtime = getJob(id);

  if (!runtime) return c.json(jobNotFound(id), 404);

  runtime.cancel();

  return c.json({
    ok: true,
    status: runtime.getState().status,
  });
});

jobsRoute.post("/:id/retry", (c) => {
  const id = c.req.param("id");
  const runtime = getJob(id);

  if (!runtime) return c.json(jobNotFound(id), 404);

  const state = runtime.getState();

  if (!state.canRetry) {
    return c.json(
      {
        ok: false,
        error: "Job is not retryable",
        status: state.status,
      },
      409,
    );
  }

  runtime.retry();

  return c.json({
    ok: true,
    status: runtime.getState().status,
  });
});

jobsRoute.get("/:id/snapshot", (c) =>
  c.json(
    {
      id: c.req.param("id"),
      ...stepNotImplemented("Export @signal-kernel/snapshot document in Step 6"),
    },
    501,
  ),
);
