import { Hono } from "hono";
import { jobsRoute } from "./routes/jobs";

export function createApp() {
  const app = new Hono();

  app.get("/", (c) =>
    c.json({
      name: "@signal-kernel/example-hono-reactive-job-runtime",
      status: "ready",
    }),
  );

  app.get("/health", (c) =>
    c.json({
      ok: true,
      service: "hono-reactive-job-runtime",
    }),
  );

  app.route("/jobs", jobsRoute);

  return app;
}

export type HonoReactiveJobApp = ReturnType<typeof createApp>;
