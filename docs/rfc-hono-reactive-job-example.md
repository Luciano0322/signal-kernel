# RFC: Hono Reactive Job Runtime Example

## 1. Background

This example demonstrates how `signal-kernel` can be used in a backend API server, not as a database/cache replacement, but as an in-process reactive runtime for modeling long-running async jobs.

The goal is to compare a traditional handler-centric API server with a graph-centric runtime model.

In a normal API server, route handlers usually own most of the lifecycle logic:

```txt
request comes in
  -> create job state
  -> start async task
  -> manually update status
  -> manually update progress
  -> manually emit SSE
  -> manually handle cancel
  -> manually reset retry state
```

With `signal-kernel`, route handlers should only send events into the runtime graph:

```txt
request comes in
  -> create job runtime
  -> update source signal
  -> async resource reacts
  -> computed state updates
  -> effects emit SSE
  -> snapshot exports current graph state
```

Core idea:

> Hono is the transport layer.
> signal-kernel is the runtime correctness layer.

---

## 2. Goals

This example should demonstrate:

1. How to model a long-running async job as a reactive graph.
2. How `signal`, `computed`, and `createEffect` reduce manual state synchronization.
3. How job status, progress, result, error, and derived flags stay consistent.
4. How SSE can be driven by reactive effects instead of being manually pushed everywhere.
5. How cancellation and retry can be expressed as runtime actions.
6. How snapshot/restore can be introduced later as an explicit runtime boundary.

---

## 3. Non-goals

This demo should **not** include:

1. Database integration.
2. Redis integration.
3. Queue workers.
4. Multi-instance server coordination.
5. Authentication.
6. Real file upload.
7. Real AI/LLM API integration.
8. Production persistence guarantees.

This is intentionally an **in-memory single-process runtime demo**.

The first version should focus on clarity of the state model.

---

## 4. Tech Stack

Use:

```txt
Hono
TypeScript
@signal-kernel/core
@signal-kernel/async-runtime
@signal-kernel/snapshot
```

Do not add unnecessary dependencies.

The server can run on Node.js first. Edge compatibility can be considered later.

V1 should use `createStreamResource()` for the long-running job execution layer.
`createEffect()` should notify SSE listeners when public state changes, but it
should not be the primitive that runs the job itself.

V1 should use `@signal-kernel/snapshot` for `GET /jobs/:id/snapshot`.
Snapshot restore of a running job should remain out of scope for V1.

---

## 5. Example Scenario

Build a mock document analysis job.

A user sends text content to the server. The server creates a long-running job that simulates several steps:

```txt
1. Parse document
2. Extract keywords
3. Summarize sections
4. Generate final report
```

Each step should update progress.

The client can:

```txt
POST /jobs/analyze
GET /jobs/:id
GET /jobs/:id/events
POST /jobs/:id/cancel
POST /jobs/:id/retry
GET /jobs/:id/snapshot
```

`POST /jobs/:id/restore` should not be implemented in V1. Restoring a running
async job is a resume/replay problem, not just a graph state transfer problem.

---

## 6. API Design

### 6.1 Create analysis job

```http
POST /jobs/analyze
```

Request body:

```json
{
  "content": "Long text content to analyze"
}
```

Response:

```json
{
  "jobId": "job_xxx",
  "status": "pending"
}
```

Behavior:

1. Create a new job runtime.
2. Store it in an in-memory job registry.
3. Start the job.
4. Return the job id.

---

### 6.2 Get job state

```http
GET /jobs/:id
```

Response:

```json
{
  "id": "job_xxx",
  "status": "running",
  "progress": 50,
  "currentStep": "summarize_sections",
  "partialResult": "...",
  "stableResult": null,
  "visibleResult": "...",
  "error": null,
  "canCancel": true,
  "canRetry": false,
  "isTerminal": false
}
```

---

### 6.3 Subscribe to job events

```http
GET /jobs/:id/events
```

Use Server-Sent Events.

Every time the reactive job state changes, emit a state snapshot:

```txt
event: state
data: {...}
```

When the job reaches a terminal state, emit:

```txt
event: done
data: {...}
```

Terminal states:

```txt
success
error
cancelled
```

---

### 6.4 Cancel job

```http
POST /jobs/:id/cancel
```

Behavior:

1. If the job is cancellable, cancel the running task.
2. Update status to `cancelled`.
3. Preserve partial result for visibility.
4. Emit updated state through SSE.

Response:

```json
{
  "ok": true,
  "status": "cancelled"
}
```

---

### 6.5 Retry job

```http
POST /jobs/:id/retry
```

Behavior:

1. Only allow retry when status is `error` or `cancelled`.
2. Clear error.
3. Reset progress.
4. Restart the mock analysis process.
5. Emit updated state.

Response:

```json
{
  "ok": true,
  "status": "pending"
}
```

---

### 6.6 Snapshot job

```http
GET /jobs/:id/snapshot
```

Response:

```json
{
  "id": "job_xxx",
  "snapshot": {
    "schema": "signal-kernel.snapshot.v1",
    "graph": {
      "id": "hono-reactive-job",
      "version": "0.1.0"
    },
    "createdAt": 123,
    "nodes": []
  }
}
```

In V1, this should be a real `@signal-kernel/snapshot` document. The job runtime
can register source signals, derived inspection values, and the stream resource
in inspect-only mode.

Do not implement restore in V1.

---

## 7. Runtime Model

Create a `createJobRuntime()` function.

Suggested file:

```txt
src/runtime/createJobRuntime.ts
```

The runtime should own all job state.

### 7.1 Source signals

```ts
const content = signal(initialContent)
const attempt = signal(0)
```

The job execution itself should be modeled with `createStreamResource()`.
The stream source should include the content and attempt number:

```ts
const runSource = computed(() => ({
  attempt: attempt.get(),
  content: content.get(),
}))

const analysis = createStreamResource(
  () => runSource.get(),
  analyzeDocument,
  {
    initialValue: initialExecutionState,
    onCancel: 'keep-partial',
    onError: 'keep-partial',
    reduce: reduceAnalysisChunk,
  },
)
```

This lets async-runtime own run invalidation, cancellation, stale-write
prevention, partial value handling, and stable committed value handling.

The public job signals below can be derived from the stream value and metadata.
Do not keep separate writable signals for derived status, progress, result, or
retry flags unless they are true source state.

Job status:

```ts
type JobStatus =
  | 'idle'
  | 'pending'
  | 'running'
  | 'success'
  | 'error'
  | 'cancelled'
```

Job steps:

```ts
type JobStep =
  | 'parse_document'
  | 'extract_keywords'
  | 'summarize_sections'
  | 'generate_report'
```

---

### 7.2 Derived state

Use `computed()` for derived state.

```ts
const [execution, executionMeta] = analysis

const status = computed<JobStatus>(() => {
  const streamStatus = executionMeta.status()

  if (streamStatus === 'streaming') return 'running'
  if (streamStatus === 'cancelled') return 'cancelled'
  if (streamStatus === 'error') return 'error'
  if (streamStatus === 'success') return 'success'
  if (streamStatus === 'pending') return 'pending'

  return 'idle'
})

const progress = computed(() => execution()?.progress ?? 0)
const currentStep = computed(() => execution()?.currentStep ?? null)
const partialResult = computed(() => execution()?.partialResult ?? '')
const stableResult = computed(() => {
  return executionMeta.stableValue()?.stableResult ?? null
})
const error = computed(() => {
  const err = executionMeta.error()
  return err instanceof Error ? err.message : err ? String(err) : null
})

const canCancel = computed(() => {
  return status.get() === 'pending' || status.get() === 'running'
})

const canRetry = computed(() => {
  return status.get() === 'error' || status.get() === 'cancelled'
})

const isTerminal = computed(() => {
  return (
    status.get() === 'success' ||
    status.get() === 'error' ||
    status.get() === 'cancelled'
  )
})

const visibleResult = computed(() => {
  if (status.get() === 'running' || status.get() === 'cancelled') {
    return partialResult.get()
  }

  return stableResult.get()
})
```

This is the main point of the demo.

Do not manually maintain `status`, `progress`, `currentStep`, `canCancel`,
`canRetry`, `isTerminal`, or `visibleResult` from route handlers.

They must be derived from source signals, stream value, or stream metadata.

---

## 8. Job Runtime API

`createJobRuntime()` should return an object like:

```ts
type JobRuntime = {
  id: string
  start(): void
  cancel(): void
  retry(): void
  getState(): JobStateView
  subscribe(listener: (state: JobStateView) => void): () => void
  snapshot(): SnapshotDocument
  dispose(): void
}
```

`getState()` should return the current public state:

```ts
type JobStateView = {
  id: string
  status: JobStatus
  progress: number
  currentStep: JobStep | null
  partialResult: string
  stableResult: string | null
  visibleResult: string | null
  error: string | null
  canCancel: boolean
  canRetry: boolean
  isTerminal: boolean
}
```

### 8.1 Snapshot boundary

`snapshot()` should use `@signal-kernel/snapshot`, not a custom JSON shape.

Suggested pattern:

```ts
function createJobSnapshotScope() {
  const scope = createSnapshotScope({
    graphId: 'hono-reactive-job',
    graphVersion: '0.1.0',
    instanceId: id,
  })

  scope.signal('attempt', attempt)
  scope.signal('content', content, {
    redaction: {
      redact: (value) => ({
        length: value.length,
      }),
    },
  })

  scope.computed('status', status)
  scope.computed('progress', progress)
  scope.computed('currentStep', currentStep)
  scope.computed('visibleResult', visibleResult)
  scope.computed('canCancel', canCancel)
  scope.computed('canRetry', canRetry)
  scope.computed('isTerminal', isTerminal)

  scope.stream('analysis', analysis, {
    restore: 'inspect-only',
    sourceKey: {
      attempt: attempt.peek(),
      jobId: id,
    },
  })

  return scope
}

function snapshot() {
  return captureSnapshot(createJobSnapshotScope())
}
```

This keeps snapshot as a transfer/inspection boundary. It does not claim that a
running async job can be resumed from the document.

---

## 9. SSE Design

Avoid manually calling `sendSSE()` inside every job step.

Instead, use a subscription/effect model.

Inside the runtime:

```ts
const listeners = new Set<(state: JobStateView) => void>()

const stopNotify = createEffect(() => {
  const state = getState()
  for (const listener of listeners) {
    listener(state)
  }
})

function subscribe(listener: (state: JobStateView) => void) {
  listener(getState())
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

function dispose() {
  executionMeta.cancel()
  stopNotify()
  listeners.clear()
}
```

`createEffect()` is used here as a notification bridge from the reactive graph
to SSE listeners. It should be disposed when the job runtime is disposed.

The long-running job execution itself should stay in `createStreamResource()`.

The Hono SSE route should only subscribe:

```ts
const unsubscribe = runtime.subscribe((state) => {
  stream.writeSSE({
    event: 'state',
    data: JSON.stringify(state),
  })
})
```

This is the key contrast:

```txt
Traditional:
job steps manually push SSE

signal-kernel:
state changes trigger SSE effect
```

---

## 10. Mock Analysis Process

Create a mock stream producer:

```txt
src/mock/analyzeDocument.ts
```

It should simulate delay and chunked updates. It should be passed to
`createStreamResource()` as the streamer.

Pseudo behavior:

```txt
wait 300ms

ctx.emit parse_document progress 20 partial result

wait 500ms

ctx.emit extract_keywords progress 45 partial result

wait 500ms

ctx.emit summarize_sections progress 70 partial result

wait 500ms

ctx.emit generate_report progress 90 partial result

wait 500ms

ctx.done final report with progress 100 and stable result
```

Support cancellation through `createStreamResource()`:

```ts
if (ctx.isCancelled()) return
```

The runtime's `cancel()` action should call:

```ts
executionMeta.cancel()
```

Use `onCancel: 'keep-partial'` so a cancelled job keeps the latest visible
partial result.

If aborted:

```txt
stream status = cancelled
preserve partialResult
do not write stableResult
```

If error:

```txt
stream status = error
error = message
preserve partialResult
```

`createStreamResource()` already guards against stale writes from older runs.
Retry should update the source signal, for example by incrementing `attempt`,
instead of starting an unrelated async task from a route handler.

---

## 11. Job Registry

Use an in-memory registry for V1.

Suggested file:

```txt
src/runtime/jobRegistry.ts
```

Shape:

```ts
const jobs = new Map<string, JobRuntime>()

export function createJob(content: string): JobRuntime
export function getJob(id: string): JobRuntime | null
export function deleteJob(id: string): boolean
```

Optional cleanup:

```txt
If a job is terminal for more than 10 minutes, dispose and remove it.
```

Cleanup is optional for V1.

---

## 12. Project Structure

Suggested structure:

```txt
examples/hono-reactive-job-runtime/
  package.json
  tsconfig.json
  src/
    app.ts
    routes/
      jobs.ts
    runtime/
      createJobRuntime.ts
      jobRegistry.ts
      jobTypes.ts
    mock/
      analyzeDocument.ts
    stream/
      sse.ts
    utils/
      sleep.ts
```

---

## 13. Implementation Principles

The implementation should follow these rules:

1. Hono routes must stay thin.
2. Route handlers should not manually compute derived state.
3. Route handlers should not manually emit every state transition.
4. Job state should live inside `createJobRuntime()`.
5. Derived values should use `computed()`.
6. SSE should be driven by reactive subscriptions/effects.
7. Job execution should use `createStreamResource()`.
8. Cancellation should call the stream resource metadata `cancel()`.
9. Retry should update source state, such as the attempt signal, not derived state.
10. Snapshot should use `@signal-kernel/snapshot` to export the runtime boundary.
11. Do not introduce DB/Redis in V1.

---

## 14. Expected Difference from Normal Backend Code

The demo should make this contrast obvious.

### Traditional handler-centric model

```txt
Route handler and async task own the lifecycle.

Every transition needs manual wiring:
- update status
- update progress
- update derived flags
- push SSE
- reset error
- preserve or clear partial result
- decide retry behavior
```

Problems:

```txt
state transition logic is scattered
derived state can drift
SSE emission is manually wired
cancel/retry rules are duplicated
snapshot boundary is unclear
```

---

### signal-kernel graph-centric model

```txt
The job runtime owns the lifecycle.

Routes only send commands:
- start
- cancel
- retry
- read state
- subscribe
- snapshot
```

Advantages:

```txt
source state is explicit
derived state is declarative
SSE follows graph changes
cancel/retry rules are centralized
snapshot boundary is clear
```

Core message:

> In a normal API server, the handler owns the lifecycle.
> In signal-kernel, the graph owns the lifecycle.

---

## 15. Demo Script

The final demo should support this flow:

```bash
pnpm dev
```

Create job:

```bash
curl -X POST http://localhost:3000/jobs/analyze \
  -H "Content-Type: application/json" \
  -d '{"content":"This is a long document to analyze."}'
```

Subscribe to events:

```bash
curl http://localhost:3000/jobs/<jobId>/events
```

Read job state:

```bash
curl http://localhost:3000/jobs/<jobId>
```

Cancel job:

```bash
curl -X POST http://localhost:3000/jobs/<jobId>/cancel
```

Retry job:

```bash
curl -X POST http://localhost:3000/jobs/<jobId>/retry
```

Snapshot job:

```bash
curl http://localhost:3000/jobs/<jobId>/snapshot
```

---

## 16. Success Criteria

The demo is successful if:

1. A job can be started through Hono.
2. The job progresses through multiple async steps.
3. State can be read at any time.
4. SSE receives state updates automatically.
5. Derived state stays consistent without manual updates.
6. Cancellation works.
7. Retry works.
8. Snapshot returns a `signal-kernel.snapshot.v1` document.
9. The route layer remains thin.
10. The difference between handler-centric and graph-centric code is obvious.

---

## 17. Future Extensions

After V1 is working, future versions may add:

```txt
V2:
- Redis-backed job registry
- persisted snapshot
- restore from snapshot
- multi-process coordination

V3:
- real LLM streaming job
- provider-backed streaming job
- advanced interruption policy comparison: keep-partial / rollback / clear

V4:
- dashboard UI
- React client consuming SSE
- comparison page: traditional vs signal-kernel implementation
```

---

## 18. Agent Instruction Summary

Use this summary as the actual instruction if you want to give it to an implementation agent:

```txt
Build an example project named examples/hono-reactive-job-runtime.

Use Hono + TypeScript + @signal-kernel/core, @signal-kernel/async-runtime,
and @signal-kernel/snapshot. Do not use DB or Redis.

The example should implement a mock long-running document analysis job.

Expose these routes:

POST /jobs/analyze
GET /jobs/:id
GET /jobs/:id/events
POST /jobs/:id/cancel
POST /jobs/:id/retry
GET /jobs/:id/snapshot

Use signal-kernel to model job state.

Source state:
content and attempt.

Execution state:
use createStreamResource() to model the long-running analysis job.

Derived state:
status, progress, currentStep, partialResult, stableResult, error, canCancel,
canRetry, isTerminal, visibleResult.

Use computed() for derived state.

Use createEffect() to notify SSE listeners whenever the public job state
changes. Dispose the effect when the runtime is disposed.

Do not manually maintain derived state.

Do not manually emit SSE inside every route handler.

The Hono routes should remain thin and delegate lifecycle management to createJobRuntime().

Use an in-memory Map as the job registry.

Support cancellation with createStreamResource metadata cancel().

Support retry for error or cancelled jobs.

Provide a snapshot() method that uses @signal-kernel/snapshot to export the
current runtime state as a signal-kernel.snapshot.v1 document.

The goal is to demonstrate the difference between a traditional handler-centric API server and a signal-kernel graph-centric runtime.
```

---

## 19. V1 Positioning

V1 should intentionally avoid DB/Redis.

DB / Redis would shift the discussion toward persistence, queue design, multi-instance coordination, and cache invalidation. Those are important later, but they dilute the core purpose of this first demo.

The V1 boundary should stay simple:

```txt
Hono = HTTP host
signal-kernel = job lifecycle runtime
in-memory Map = demo registry
```

This keeps the difference between handler-centric and graph-centric backend code clear.
