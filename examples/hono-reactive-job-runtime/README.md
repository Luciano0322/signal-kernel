# Hono Reactive Job Runtime Example

This example will demonstrate a Hono API server whose long-running job lifecycle
is owned by a `signal-kernel` graph.

Step 1 only scaffolds the project:

```txt
Hono app
  -> health route
  -> job route skeleton
  -> Node server entry
```

The job runtime, `createStreamResource()` execution layer, SSE subscription, and
snapshot endpoint will be added in later steps.

## Run

```sh
pnpm -F @signal-kernel/example-hono-reactive-job-runtime dev
```

The server uses port `3000` by default.

## Health Check

```sh
curl http://localhost:3000/health
```

## Typecheck

```sh
pnpm -F @signal-kernel/example-hono-reactive-job-runtime typecheck
```

## Test

```sh
pnpm -F @signal-kernel/example-hono-reactive-job-runtime test
```
