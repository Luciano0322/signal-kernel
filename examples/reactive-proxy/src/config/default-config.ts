import type { ReactiveProxyConfig } from "./schema";

export type DemoProxyPorts = {
  apiA: number;
  apiB: number;
  webA: number;
  apiAdminA: number;
};

export type DemoProxyPortOverrides = Partial<DemoProxyPorts>;

export const defaultDemoProxyPorts: DemoProxyPorts = {
  apiA: 3001,
  apiB: 3002,
  webA: 3003,
  apiAdminA: 3004,
};

export function resolveDemoProxyPorts(
  overrides: DemoProxyPortOverrides = {},
): DemoProxyPorts {
  return {
    ...defaultDemoProxyPorts,
    ...overrides,
  };
}

export function createReactiveProxyConfig(
  portOverrides: DemoProxyPortOverrides = {},
): ReactiveProxyConfig {
  const ports = resolveDemoProxyPorts(portOverrides);

  return {
    routes: [
    {
      id: "api-admin",
      pathPrefix: "/api/admin",
      upstreamPool: "api-admin-pool",
    },
    {
      id: "api",
      pathPrefix: "/api",
      upstreamPool: "api-pool",
    },
    {
      id: "web",
      pathPrefix: "/web",
      upstreamPool: "web-pool",
    },
  ],
    upstreams: {
      "api-admin-pool": [
        {
          id: "api-admin-a",
          url: `http://localhost:${ports.apiAdminA}`,
        },
      ],
      "api-pool": [
        {
          id: "api-a",
          url: `http://localhost:${ports.apiA}`,
        },
        {
          id: "api-b",
          url: `http://localhost:${ports.apiB}`,
        },
      ],
      "web-pool": [
        {
          id: "web-a",
          url: `http://localhost:${ports.webA}`,
        },
      ],
    },
    health: {},
    policy: {
      strategy: "first-healthy",
      timeoutMs: 2000,
      retry: 0,
    },
  };
}

export const defaultReactiveProxyConfig: ReactiveProxyConfig =
  createReactiveProxyConfig();
