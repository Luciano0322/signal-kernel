import { createServer, type Server } from "node:http";
import {
  createReactiveProxyConfig,
  type DemoProxyPortOverrides,
} from "./config/default-config";
import type { ReactiveProxyConfig } from "./config/schema";
import { createReactiveProxyGraph } from "./graph/reactiveProxyGraph";
import { startDemoUpstreams, type DemoUpstreamsRuntime } from "./demo/start-demo-upstreams";
import {
  startHealthChecks,
  type HealthChecksRuntime,
} from "./effects/health-check";
import { proxyRequest } from "./effects/proxy-request";

type ReactiveProxyServerOptions = {
  port?: number;
  healthIntervalMs?: number;
  demoPorts?: DemoProxyPortOverrides;
  config?: ReactiveProxyConfig;
};

export type ReactiveProxyServerRuntime = {
  graph: ReturnType<typeof createReactiveProxyGraph>;
  server: Server;
  demoUpstreams: DemoUpstreamsRuntime;
  healthChecks: HealthChecksRuntime;
  close(): Promise<void>;
};

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

export async function startReactiveProxyServer(
  options: ReactiveProxyServerOptions = {},
): Promise<ReactiveProxyServerRuntime> {
  const port = options.port ?? 18080;
  const graph = createReactiveProxyGraph(
    options.config ?? createReactiveProxyConfig(options.demoPorts),
  );
  const server = createServer((req, res) => {
    proxyRequest(graph, req, res);
  });
  const demoUpstreams = await startDemoUpstreams(options.demoPorts);
  const healthChecks = startHealthChecks(graph, {
    intervalMs: options.healthIntervalMs ?? 2000,
  });

  try {
    await listen(server, port);
  } catch (error) {
    healthChecks.stop();
    await demoUpstreams.close();
    throw error;
  }

  return {
    graph,
    server,
    demoUpstreams,
    healthChecks,
    close: async () => {
      healthChecks.stop();
      await closeServer(server);
      await demoUpstreams.close();
    },
  };
}
