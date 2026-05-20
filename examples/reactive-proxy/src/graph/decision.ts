import type {
  AvailableUpstreams,
  Decision,
  DecisionTraceStep,
  Readable,
  RequestInput,
  RoundRobinCursor,
  RouteRule,
  TrafficPolicy,
  UpstreamServer,
  WritableSignal,
} from "../config/schema";
import { selectFirstHealthy, selectRoundRobin } from "./policy";
import { matchRoute } from "./routes";

export interface DecisionResolverDeps {
  routes: Readable<RouteRule[]>;
  availableUpstreams: Readable<AvailableUpstreams>;
  policy: Readable<TrafficPolicy>;
  roundRobinCursor: WritableSignal<RoundRobinCursor>;
}

interface DecisionContext {
  request: RequestInput;
  route: RouteRule;
  candidates: UpstreamServer[];
  policy: TrafficPolicy;
  trace: DecisionTraceStep[];
}

function buildTargetUrl(baseUrl: string, path: string) {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${normalizedBase}${normalizedPath}`;
}

function reject(
  statusCode: 404 | 503,
  reason: string,
  trace: DecisionTraceStep[],
): Decision {
  return {
    ok: false,
    statusCode,
    reason,
    trace,
  };
}

function buildDecisionContext(
  request: RequestInput,
  deps: DecisionResolverDeps,
): DecisionContext | Decision {
  const trace: DecisionTraceStep[] = [
    {
      stage: "request",
      message: `${request.method} ${request.path}`,
      data: {
        method: request.method,
        path: request.path,
      },
    },
  ];
  const route = matchRoute(deps.routes.get(), request.path);

  if (!route) {
    trace.push({
      stage: "route",
      message: "No route matched request path",
      data: { path: request.path },
    });

    return reject(404, "No matching route", trace);
  }

  trace.push({
    stage: "route",
    message: `Matched ${route.pathPrefix} -> ${route.upstreamPool}`,
    data: route,
  });

  const available = deps.availableUpstreams.get();
  const candidates = available[route.upstreamPool] ?? [];

  trace.push({
    stage: "health",
    message:
      candidates.length > 0
        ? `Available upstreams: ${candidates.map((server) => server.id).join(", ")}`
        : "No available upstreams for matched pool",
    data: {
      upstreamPool: route.upstreamPool,
      available: candidates.map((server) => server.id),
    },
  });

  if (candidates.length === 0) {
    return reject(503, "No available upstream", trace);
  }

  const policy = deps.policy.get();

  trace.push({
    stage: "policy",
    message: `Using ${policy.strategy}`,
    data: policy,
  });

  return {
    request,
    route,
    candidates,
    policy,
    trace,
  };
}

function selectUpstream(
  context: DecisionContext,
  deps: DecisionResolverDeps,
): UpstreamServer | undefined {
  if (context.policy.strategy === "round-robin") {
    return selectRoundRobin(
      context.route.upstreamPool,
      context.candidates,
      deps.roundRobinCursor,
    );
  }

  return selectFirstHealthy(context.candidates);
}

export function createDecisionResolver(deps: DecisionResolverDeps) {
  return (request: RequestInput): Decision => {
    const context = buildDecisionContext(request, deps);

    if ("ok" in context) {
      return context;
    }

    const selected = selectUpstream(context, deps);

    if (!selected) {
      return reject(503, "No available upstream", context.trace);
    }

    context.trace.push({
      stage: "decision",
      message: `Selected ${selected.id}`,
      data: {
        upstreamId: selected.id,
        targetUrl: buildTargetUrl(selected.url, request.path),
      },
    });

    return {
      ok: true,
      routeId: context.route.id,
      upstreamPool: context.route.upstreamPool,
      upstreamId: selected.id,
      targetUrl: buildTargetUrl(selected.url, request.path),
      trace: context.trace,
    };
  };
}
