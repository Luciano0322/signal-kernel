# Nuxt Job Monitor

Nuxt dashboard example for comparing two graph ownership models:

- `kernel-owned`: Nuxt renders readonly refs from an external `signal-kernel` async graph.
- `vue-owned`: Nuxt/Vue owns the same job monitor state with ordinary Vue `ref` and `computed`.

The example follows `docs/rfc-nuxt-job-monitor.md`.

The data source is a Nuxt server-side mock:

- `GET /api/jobs` returns the current job list.
- `POST /api/jobs/:id/retry` and `POST /api/jobs/:id/cancel` mutate the mock job store.
- `GET /api/jobs/events` emits Server-Sent Events for job progress and logs.

## Scripts

```sh
pnpm --filter @signal-kernel/example-nuxt-job-monitor dev
pnpm --filter @signal-kernel/example-nuxt-job-monitor test
pnpm --filter @signal-kernel/example-nuxt-job-monitor typecheck
pnpm --filter @signal-kernel/example-nuxt-job-monitor build
```

## Boundary

The transport interface is shared by both pages so the comparison stays focused on graph ownership instead of fake API details. The current UI uses `createNuxtJobTransport()` against Nuxt API routes, while `createMockJobTransport()` remains available for pure client-side tests or demos.

The kernel-owned page uses:

- `@signal-kernel/core` for signals and computed values
- `@signal-kernel/async-runtime` for resources, manual mutation resources, and invalidation revisions
- `@signal-kernel/vue` to expose graph values to Vue as readonly refs
- graph-owned view models for `canRetry`, `canCancel`, SLA flags, queue health, stream status, and last event time

The Vue-owned page uses:

- Vue `ref`
- Vue `computed`
- Vue lifecycle hooks
- component-owned copies of the same job action rules and stream status handling

This example is not a claim that Vue reactivity is insufficient. It demonstrates when a graph may be more useful outside the UI framework.

## Async Correctness

The retry action applies an optimistic `job_retrying` event before the server confirms the action. The cancel action applies a local confirmation after the server call succeeds. Server-Sent Events may still deliver the same status transition afterward; the graph reducer keeps these job status events idempotent.

The stream connection status is part of the graph on the kernel-owned page. Nuxt owns the HTTP/SSE route, `createNuxtJobTransport()` owns the browser transport, and `createJobKernel()` owns how events affect business state.
