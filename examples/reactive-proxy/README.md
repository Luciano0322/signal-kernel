# Reactive Proxy Example

This example models an nginx-like routing, upstream health, policy, and proxy decision layer as a `signal-kernel` graph.

The first implementation milestone is graph-only:

```txt
routes + upstreams + health + policy
  -> availableUpstreams
  -> resolveProxyDecision(requestInput)
  -> decision trace
```

It does not yet start an HTTP proxy server. That will be added after the decision graph is stable.

## Run

```sh
pnpm -F @signal-kernel/example-reactive-proxy dev
```

## Test

```sh
pnpm -F @signal-kernel/example-reactive-proxy test
```

## Key Idea

TypeScript is used as an executable prototype. The goal is to prove the decision graph boundary, not to compete with nginx on network I/O throughput.

The graph layer stays portable. Proxying, health probes, logging, and server startup belong in an effects layer.
