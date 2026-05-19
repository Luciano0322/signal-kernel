import type { ReactiveProxyConfig } from "./schema";

export const defaultReactiveProxyConfig: ReactiveProxyConfig = {
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
        url: "http://localhost:3004",
      },
    ],
    "api-pool": [
      {
        id: "api-a",
        url: "http://localhost:3001",
      },
      {
        id: "api-b",
        url: "http://localhost:3002",
      },
    ],
    "web-pool": [
      {
        id: "web-a",
        url: "http://localhost:3003",
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
