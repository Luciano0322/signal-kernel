import { serve } from "@hono/node-server";
import { createApp } from "./app";

const app = createApp();
const port = Number(process.env.PORT ?? 3000);
const hostname = process.env.HOST ?? "127.0.0.1";

serve({
  fetch: app.fetch,
  hostname,
  port,
});

console.log(
  `Hono reactive job runtime example: http://${hostname}:${port}`,
);
