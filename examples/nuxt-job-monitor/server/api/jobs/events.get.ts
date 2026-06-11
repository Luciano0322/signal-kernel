import { defineEventHandler } from "h3";
import type { JobEvent } from "../../../job-kernel";
import { useJobStore } from "../../utils/jobStore";

function writeSseEvent(response: NodeJS.WritableStream, event: JobEvent) {
  response.write(`data: ${JSON.stringify(event)}\n\n`);
}

export default defineEventHandler((event) => {
  const response = event.node.res;

  response.statusCode = 200;
  response.setHeader("content-type", "text/event-stream");
  response.setHeader("cache-control", "no-cache, no-transform");
  response.setHeader("connection", "keep-alive");
  response.setHeader("x-accel-buffering", "no");
  response.write(": connected\n\n");

  return new Promise<void>((resolve) => {
    const unsubscribe = useJobStore().subscribeJobEvents((jobEvent) => {
      writeSseEvent(response, jobEvent);
    });

    const heartbeat = setInterval(() => {
      response.write(`: heartbeat ${Date.now()}\n\n`);
    }, 15000);

    function cleanup() {
      clearInterval(heartbeat);
      unsubscribe();
      resolve();
    }

    event.node.req.on("close", cleanup);
    event.node.req.on("aborted", cleanup);
  });
});
