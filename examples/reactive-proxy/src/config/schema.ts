export interface RouteRule {
  id: string;
  pathPrefix: string;
  upstreamPool: string;
}

export interface UpstreamServer {
  id: string;
  url: string;
}

export type UpstreamPools = Record<string, UpstreamServer[]>;

export type HealthStatus = "unknown" | "healthy" | "unhealthy" | "stale";

export interface ServerHealth {
  status: HealthStatus;
  checkedAt?: number;
  latencyMs?: number;
  error?: string;
}

export type HealthMap = Record<string, ServerHealth>;

export type LoadBalancingStrategy = "first-healthy" | "round-robin";

export interface TrafficPolicy {
  strategy: LoadBalancingStrategy;
  timeoutMs: number;
  retry: number;
}

export type RoundRobinCursor = Record<string, number>;

export interface RequestInput {
  method: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
}

export interface DecisionTraceStep {
  stage: string;
  message: string;
  data?: unknown;
}

export interface ProxyDecision {
  ok: true;
  routeId: string;
  upstreamPool: string;
  upstreamId: string;
  targetUrl: string;
  trace: DecisionTraceStep[];
}

export interface ProxyRejectDecision {
  ok: false;
  statusCode: 404 | 503;
  reason: string;
  trace: DecisionTraceStep[];
}

export type Decision = ProxyDecision | ProxyRejectDecision;

export interface ReactiveProxyConfig {
  routes: RouteRule[];
  upstreams: UpstreamPools;
  health?: HealthMap;
  policy: TrafficPolicy;
}

export type AvailableUpstreams = Record<string, UpstreamServer[]>;

export interface Readable<T> {
  get(): T;
  peek(): T;
}

export interface WritableSignal<T> extends Readable<T> {
  set(next: T): void;
}
