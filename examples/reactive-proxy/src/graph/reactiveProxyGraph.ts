import { signal } from "@signal-kernel/core";
import { defaultReactiveProxyConfig } from "../config/default-config";
import type {
  HealthMap,
  ReactiveProxyConfig,
  RoundRobinCursor,
  RouteRule,
  ServerHealth,
  TrafficPolicy,
  UpstreamPools,
} from "../config/schema";
import { createAvailableUpstreams } from "./available-upstreams";
import { createDecisionResolver } from "./decision";
import { setHealthEntry } from "./health";
import { setPolicy as mergePolicy } from "./policy";

function cloneConfig(config: ReactiveProxyConfig): ReactiveProxyConfig {
  return {
    routes: config.routes.map((route) => ({ ...route })),
    upstreams: Object.fromEntries(
      Object.entries(config.upstreams).map(([poolId, servers]) => [
        poolId,
        servers.map((server) => ({ ...server })),
      ]),
    ),
    health: { ...(config.health ?? {}) },
    policy: { ...config.policy },
  };
}

export function createReactiveProxyGraph(
  config: ReactiveProxyConfig = defaultReactiveProxyConfig,
) {
  const initialConfig = cloneConfig(config);
  const routes = signal<RouteRule[]>(initialConfig.routes);
  const upstreams = signal<UpstreamPools>(initialConfig.upstreams);
  const health = signal<HealthMap>(initialConfig.health ?? {});
  const policy = signal<TrafficPolicy>(initialConfig.policy);
  const roundRobinCursor = signal<RoundRobinCursor>({});
  const availableUpstreams = createAvailableUpstreams(upstreams, health);
  const resolveProxyDecision = createDecisionResolver({
    routes,
    availableUpstreams,
    policy,
    roundRobinCursor,
  });

  function replaceRoutes(nextRoutes: RouteRule[]) {
    routes.set(nextRoutes.map((route) => ({ ...route })));
  }

  function replaceUpstreams(nextUpstreams: UpstreamPools) {
    upstreams.set(
      Object.fromEntries(
        Object.entries(nextUpstreams).map(([poolId, servers]) => [
          poolId,
          servers.map((server) => ({ ...server })),
        ]),
      ),
    );
  }

  function setServerHealth(serverId: string, nextHealth: ServerHealth) {
    health.set(setHealthEntry(health.peek(), serverId, nextHealth));
  }

  function setTrafficPolicy(nextPolicy: TrafficPolicy) {
    policy.set(mergePolicy(policy.peek(), nextPolicy));
  }

  function resetRoundRobinCursor() {
    roundRobinCursor.set({});
  }

  return {
    signals: {
      routes,
      upstreams,
      health,
      policy,
      roundRobinCursor,
    },
    computed: {
      availableUpstreams,
    },
    actions: {
      replaceRoutes,
      replaceUpstreams,
      setServerHealth,
      setTrafficPolicy,
      resetRoundRobinCursor,
    },
    resolveProxyDecision,
  };
}

export type ReactiveProxyGraph = ReturnType<typeof createReactiveProxyGraph>;
