import { describe, expect, it } from "vitest";
import { createReactiveProxyGraph } from "../graph/reactiveProxyGraph";

function request(path: string) {
  return {
    method: "GET",
    path,
    headers: {},
  };
}

describe("reactive proxy decision graph", () => {
  it("routes requests by longest path prefix", () => {
    const graph = createReactiveProxyGraph();

    const decision = graph.resolveProxyDecision(request("/api/admin/users"));

    expect(decision).toMatchObject({
      ok: true,
      routeId: "api-admin",
      upstreamPool: "api-admin-pool",
      upstreamId: "api-admin-a",
      targetUrl: "http://localhost:3004/api/admin/users",
    });
  });

  it("returns 404 when no route matches", () => {
    const graph = createReactiveProxyGraph();

    const decision = graph.resolveProxyDecision(request("/assets/logo.png"));

    expect(decision).toMatchObject({
      ok: false,
      statusCode: 404,
      reason: "No matching route",
    });
    expect(decision.trace.map((step) => step.stage)).toEqual([
      "request",
      "route",
    ]);
  });

  it("treats unknown health as initially available", () => {
    const graph = createReactiveProxyGraph();

    expect(graph.computed.availableUpstreams.get()["api-pool"]?.map((server) => server.id)).toEqual([
      "api-a",
      "api-b",
    ]);
  });

  it("updates available upstreams when health changes", () => {
    const graph = createReactiveProxyGraph();

    graph.actions.setServerHealth("api-a", {
      status: "unhealthy",
      checkedAt: 1,
      error: "connection refused",
    });

    expect(graph.computed.availableUpstreams.get()["api-pool"]?.map((server) => server.id)).toEqual([
      "api-b",
    ]);

    const decision = graph.resolveProxyDecision(request("/api/users"));

    expect(decision).toMatchObject({
      ok: true,
      upstreamId: "api-b",
    });
  });

  it("returns 503 when a route matches but no upstream is available", () => {
    const graph = createReactiveProxyGraph();

    graph.actions.setServerHealth("api-a", { status: "unhealthy" });
    graph.actions.setServerHealth("api-b", { status: "stale" });

    const decision = graph.resolveProxyDecision(request("/api/users"));

    expect(decision).toMatchObject({
      ok: false,
      statusCode: 503,
      reason: "No available upstream",
    });
    expect(decision.trace.map((step) => step.stage)).toEqual([
      "request",
      "route",
      "health",
    ]);
  });

  it("rotates available upstreams with round-robin policy scoped by pool", () => {
    const graph = createReactiveProxyGraph();

    graph.actions.setTrafficPolicy({
      strategy: "round-robin",
      timeoutMs: 2000,
      retry: 0,
    });

    expect(graph.resolveProxyDecision(request("/api/users"))).toMatchObject({
      ok: true,
      upstreamId: "api-a",
    });
    expect(graph.resolveProxyDecision(request("/api/users"))).toMatchObject({
      ok: true,
      upstreamId: "api-b",
    });
    expect(graph.resolveProxyDecision(request("/web/home"))).toMatchObject({
      ok: true,
      upstreamId: "web-a",
    });
    expect(graph.resolveProxyDecision(request("/api/projects"))).toMatchObject({
      ok: true,
      upstreamId: "api-a",
    });
    expect(graph.signals.roundRobinCursor.peek()).toEqual({
      "api-pool": 1,
      "web-pool": 0,
    });
  });
});
