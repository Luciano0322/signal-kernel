import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  startReactiveProxyServer,
  type ReactiveProxyServerRuntime,
} from "../server";
import type { DemoProxyPortOverrides } from "../config/default-config";

let nextBasePort = 32000;
let runtime: ReactiveProxyServerRuntime | undefined;

function nextPorts(): { proxyPort: number; demoPorts: DemoProxyPortOverrides } {
  const base = nextBasePort;
  nextBasePort += 10;

  return {
    proxyPort: base,
    demoPorts: {
      apiA: base + 1,
      apiB: base + 2,
      webA: base + 3,
      apiAdminA: base + 4,
    },
  };
}

async function startTestRuntime() {
  const ports = nextPorts();

  runtime = await startReactiveProxyServer({
    port: ports.proxyPort,
    demoPorts: ports.demoPorts,
    healthIntervalMs: 60_000,
  });

  await runtime.healthChecks.checkNow();

  return {
    ...ports,
    runtime,
    proxyUrl: `http://localhost:${ports.proxyPort}`,
  };
}

async function readJson(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

describe("reactive proxy server", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(async () => {
    await runtime?.close();
    runtime = undefined;
    vi.restoreAllMocks();
  });

  it("proxies matching requests to the selected upstream", async () => {
    const { proxyUrl } = await startTestRuntime();

    const response = await fetch(`${proxyUrl}/api/users`);
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      upstream: "api-a",
      method: "GET",
      path: "/api/users",
    });
  });

  it("routes future requests away from an unhealthy upstream", async () => {
    const { proxyUrl, demoPorts, runtime } = await startTestRuntime();

    await fetch(`http://localhost:${demoPorts.apiA}/toggle-health`);
    await runtime.healthChecks.checkNow();

    const response = await fetch(`${proxyUrl}/api/users`);
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      upstream: "api-b",
      path: "/api/users",
    });
  });

  it("returns 404 when no route matches", async () => {
    const { proxyUrl } = await startTestRuntime();

    const response = await fetch(`${proxyUrl}/assets/logo.png`);
    const body = await readJson(response);

    expect(response.status).toBe(404);
    expect(body.error).toBe("No matching route");
  });

  it("returns 503 when a matched route has no available upstream", async () => {
    const { proxyUrl, runtime } = await startTestRuntime();

    runtime.graph.actions.setServerHealth("api-a", { status: "unhealthy" });
    runtime.graph.actions.setServerHealth("api-b", { status: "stale" });

    const response = await fetch(`${proxyUrl}/api/users`);
    const body = await readJson(response);

    expect(response.status).toBe(503);
    expect(body.error).toBe("No available upstream");
  });

  it("releases ports when the runtime closes", async () => {
    const ports = nextPorts();

    runtime = await startReactiveProxyServer({
      port: ports.proxyPort,
      demoPorts: ports.demoPorts,
      healthIntervalMs: 60_000,
    });
    await runtime.close();

    runtime = await startReactiveProxyServer({
      port: ports.proxyPort,
      demoPorts: ports.demoPorts,
      healthIntervalMs: 60_000,
    });

    const response = await fetch(`http://localhost:${ports.proxyPort}/web/home`);
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      upstream: "web-a",
      path: "/web/home",
    });
  });
});
