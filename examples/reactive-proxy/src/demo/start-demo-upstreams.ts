import { createServer, type Server, type ServerResponse } from "node:http";

type DemoUpstream = {
  id: string;
  port: number;
};

type DemoUpstreamRuntime = {
  id: string;
  port: number;
  url: string;
  server: Server;
  isHealthy(): boolean;
  setHealthy(nextHealthy: boolean): void;
};

export type DemoUpstreamsRuntime = {
  upstreams: DemoUpstreamRuntime[];
  close(): Promise<void>;
};

const demoUpstreams: DemoUpstream[] = [
  { id: "api-a", port: 3001 },
  { id: "api-b", port: 3002 },
  { id: "web-a", port: 3003 },
  { id: "api-admin-a", port: 3004 },
];

function jsonResponse(
  statusCode: number,
  body: unknown,
  res: ServerResponse,
) {
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(body, null, 2));
}

function listen(server: Server, port: number) {
  return new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
}

function closeServer(server: Server) {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

async function startDemoUpstream(
  upstream: DemoUpstream,
): Promise<DemoUpstreamRuntime> {
  let healthy = true;
  const url = `http://localhost:${upstream.port}`;
  const server = createServer((req, res) => {
    const requestUrl = new URL(req.url ?? "/", url);

    if (req.method === "GET" && requestUrl.pathname === "/health") {
      jsonResponse(
        healthy ? 200 : 503,
        {
          upstream: upstream.id,
          status: healthy ? "healthy" : "unhealthy",
        },
        res,
      );
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/toggle-health") {
      healthy = !healthy;
      jsonResponse(
        200,
        {
          upstream: upstream.id,
          status: healthy ? "healthy" : "unhealthy",
        },
        res,
      );
      return;
    }

    if (!healthy) {
      jsonResponse(
        503,
        {
          upstream: upstream.id,
          path: requestUrl.pathname,
          error: "upstream is unhealthy",
        },
        res,
      );
      return;
    }

    jsonResponse(
      200,
      {
        upstream: upstream.id,
        method: req.method,
        path: requestUrl.pathname,
        query: requestUrl.searchParams.toString(),
      },
      res,
    );
  });

  await listen(server, upstream.port);

  return {
    id: upstream.id,
    port: upstream.port,
    url,
    server,
    isHealthy: () => healthy,
    setHealthy: (nextHealthy) => {
      healthy = nextHealthy;
    },
  };
}

export async function startDemoUpstreams(): Promise<DemoUpstreamsRuntime> {
  const upstreams = await Promise.all(demoUpstreams.map(startDemoUpstream));

  return {
    upstreams,
    close: async () => {
      await Promise.all(upstreams.map((upstream) => closeServer(upstream.server)));
    },
  };
}
