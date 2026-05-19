import type { UpstreamServer } from "../config/schema";
import type { ReactiveProxyGraph } from "../graph/reactiveProxyGraph";

export type HealthChecksRuntime = {
  checkNow(): Promise<void>;
  stop(): void;
};

type HealthCheckOptions = {
  intervalMs?: number;
  timeoutMs?: number;
};

function flattenUpstreams(pools: Record<string, UpstreamServer[]>) {
  return Object.values(pools).flat();
}

async function probeUpstream(
  graph: ReactiveProxyGraph,
  upstream: UpstreamServer,
  timeoutMs: number,
) {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${upstream.url}/health`, {
      signal: controller.signal,
    });
    const latencyMs = Date.now() - startedAt;

    graph.actions.setServerHealth(upstream.id, {
      status: response.ok ? "healthy" : "unhealthy",
      checkedAt: Date.now(),
      latencyMs,
      error: response.ok ? undefined : `HTTP ${response.status}`,
    });
  } catch (error) {
    graph.actions.setServerHealth(upstream.id, {
      status: "unhealthy",
      checkedAt: Date.now(),
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    clearTimeout(timeout);
  }
}

export function startHealthChecks(
  graph: ReactiveProxyGraph,
  options: HealthCheckOptions = {},
): HealthChecksRuntime {
  const intervalMs = options.intervalMs ?? 2000;
  const timeoutMs = options.timeoutMs ?? graph.signals.policy.peek().timeoutMs;

  async function checkNow() {
    const upstreams = flattenUpstreams(graph.signals.upstreams.peek());

    await Promise.all(
      upstreams.map((upstream) => probeUpstream(graph, upstream, timeoutMs)),
    );
  }

  const interval = setInterval(() => {
    void checkNow();
  }, intervalMs);

  void checkNow();

  return {
    checkNow,
    stop: () => {
      clearInterval(interval);
    },
  };
}
