import http from "node:http";
import https from "node:https";
import type { IncomingHttpHeaders } from "node:http";
import type { ReactiveProxyGraph } from "../graph/reactiveProxyGraph";
import { logDecision } from "./decision-log";

function forwardHeaders(headers: IncomingHttpHeaders, target: URL) {
  const nextHeaders: IncomingHttpHeaders = { ...headers };

  delete nextHeaders.host;
  delete nextHeaders.connection;

  nextHeaders.host = target.host;

  return nextHeaders;
}

function writeJson(
  res: http.ServerResponse,
  statusCode: number,
  body: unknown,
) {
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(body, null, 2));
}

export function proxyRequest(
  graph: ReactiveProxyGraph,
  req: http.IncomingMessage,
  res: http.ServerResponse,
) {
  const decision = graph.resolveProxyDecision({
    method: req.method ?? "GET",
    path: req.url ?? "/",
    headers: req.headers,
  });

  logDecision(decision);

  if (!decision.ok) {
    writeJson(res, decision.statusCode, {
      error: decision.reason,
      trace: decision.trace,
    });
    return;
  }

  const target = new URL(decision.targetUrl);
  const transport = target.protocol === "https:" ? https : http;
  const upstreamReq = transport.request(
    target,
    {
      method: req.method,
      headers: forwardHeaders(req.headers, target),
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    },
  );

  upstreamReq.on("error", (error) => {
    if (res.headersSent) {
      res.destroy(error);
      return;
    }

    writeJson(res, 502, {
      error: "Upstream proxy request failed",
      message: error.message,
      trace: decision.trace,
    });
  });

  req.pipe(upstreamReq);
}
