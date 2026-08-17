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
- `@signal-kernel/async-runtime` for query resources, manual mutation resources, invalidation revisions, and the SSE subscription lifecycle
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

The stream connection status is part of the graph on the kernel-owned page. Nuxt owns the HTTP/SSE route, `createNuxtJobTransport()` owns the browser `EventSource`, and `jobEventsResource` owns the active subscription run, cleanup, and stale-callback boundary. `createJobKernel()` applies events accepted by that run to business state.

The Vue-owned page deliberately keeps direct `onMounted()` / `onBeforeUnmount()` subscription ownership. This preserves the comparison: both pages share the same transport, while only the kernel-owned path can keep its stream lifecycle outside Vue. EventSource `onerror` is treated as a reconnecting transport notification rather than an automatic terminal resource failure.

## Snapshot Handoff

The kernel-owned page also exposes a small snapshot handoff panel:

- `Capture` serializes the explicit job graph state with `@signal-kernel/snapshot`.
- `Reset` clears writable graph state and closes the current event stream.
- `Restore` restores writable signals into the same compatible graph and starts the SSE connection again.

The snapshot scope intentionally restores only writable signals such as jobs, logs, selected job, filter, and last event time. Computed values are captured for inspection but recompute after restore. The actual `jobEventsResource` is captured as inspect-only metadata; the snapshot does not serialize `EventSource`, promises, timers, abort controllers, or any live async work.
