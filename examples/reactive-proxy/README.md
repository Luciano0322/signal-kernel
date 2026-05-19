# Reactive Proxy Example

This example models an nginx-like routing, upstream health, policy, and proxy decision layer as a `signal-kernel` graph.

It uses TypeScript and Node.js as an executable prototype. It is not a production nginx replacement and does not claim to compete on network I/O throughput.

The decision layer is graph-owned:

```txt
routes + upstreams + health + policy
  -> availableUpstreams
  -> resolveProxyDecision(requestInput)
  -> decision trace
  -> proxy request effect
```

Proxying, health probes, logging, and server startup are explicit effects outside the graph.

## Run

```sh
pnpm -F @signal-kernel/example-reactive-proxy dev
```

The dev script starts:

```txt
proxy        http://localhost:18080
api-a        http://localhost:3001
api-b        http://localhost:3002
web-a        http://localhost:3003
api-admin-a  http://localhost:3004
```

The proxy port can be overridden with `REACTIVE_PROXY_PORT` or `PORT`.

## Try

```sh
curl http://localhost:18080/api/users
curl http://localhost:18080/api/admin/users
curl http://localhost:18080/web/home
```

Toggle one upstream health state:

```sh
curl http://localhost:3001/toggle-health
```

The health-check effect updates graph health state, and future proxy decisions avoid unhealthy upstreams.

## Test

```sh
pnpm -F @signal-kernel/example-reactive-proxy test
```

## Key Idea

The graph layer stays portable. Proxying, health probes, logging, and server startup belong in an effects layer.

Incoming requests are not stored in a global signal. They are ephemeral inputs passed to `resolveProxyDecision(requestInput)`.
