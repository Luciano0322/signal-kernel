# RFC: Nuxt Job Monitor Demo with External Async Reactive Graph

## 1. Summary

This RFC defines a demo project built with **Nuxt 3 + Vue + signal-kernel**.

The goal is not to build a normal Nuxt dashboard, nor to prove that Vue reactivity is insufficient. Instead, this demo is designed to demonstrate a specific architectural boundary:

> Nuxt/Vue owns the application shell, routing, UI rendering, and user interactions.  
> signal-kernel owns the async reactive graph outside the framework.

The demo will simulate an **Async Job / Workflow Monitor**. Users can view background jobs, monitor job progress, inspect logs, retry failed jobs, cancel running jobs, and observe derived summary state.

The job state will be driven by a mock async event stream. signal-kernel will own the job graph, derived state, resource lifecycle, mutation invalidation, and event reconciliation. Nuxt/Vue will only consume live graph values through readonly Vue refs exposed by the Vue adapter.

---

## 2. Motivation

signal-kernel can easily be misunderstood as:

> another React state management library

However, its intended position is closer to:

> a framework-agnostic reactive runtime primitive

Vue developers already understand `ref`, `computed`, `watchEffect`, Composition API, and the value of fine-grained reactivity. This makes the Vue ecosystem a better audience for explaining signal-kernel's core idea than developers who have no reactive graph mental model at all.

However, a simple example like this is not persuasive:

```ts
const count = signal(0)
const countValue = useSignalValue(count)
```

A Vue developer would reasonably respond:

> I can just use Vue `ref`.

Therefore, this demo should not try to prove that "Vue can use signal-kernel." Instead, it should demonstrate:

> What happens when the reactive graph should not belong to the Vue app?

---

## 3. Core Thesis

The core thesis of this demo is:

> Vue reactivity is excellent inside Vue.  
> signal-kernel explores what happens when the async reactive graph should live outside Vue.

This is not a replacement argument.

It is a graph ownership argument.

---

## 4. Goals

### 4.1 Demonstrate external graph ownership

The core job state, derived state, async resources, mutations, and event handling should live inside an independent `job-kernel` package.

Nuxt should only own:

```txt
routing
layout
components
user interaction
rendering bridged graph values
```

signal-kernel should own:

```txt
signals
computed state
async resources
event stream integration
mutation lifecycle
invalidation
graph updates
```

---

### 4.2 Demonstrate Vue as renderer

Vue components should not directly own the job graph.

Vue components should only consume the graph through `@signal-kernel/vue`:

```ts
const jobs = useSignalValue(kernel.computed.filteredJobs)
const summary = useSignalValue(kernel.computed.jobSummary)
const selectedJob = useSignalValue(kernel.computed.selectedJob)
```

The intended boundary is:

```txt
signal-kernel owns the graph
Vue renders the graph
Nuxt hosts the app
```

---

### 4.3 Demonstrate async job lifecycle

The demo should simulate background jobs moving through a lifecycle:

```txt
queued
running
succeeded
failed
retrying
cancelled
```

Job state should evolve through a mock event stream, not only through one-time fetching.

---

### 4.4 Demonstrate derived state

The demo should show meaningful computed graph values, such as:

```txt
total jobs
queued count
running count
failed count
succeeded count
cancelled count
average duration
selected job
filtered jobs
selected job logs
```

These values should be computed by signal-kernel, not by Vue component-level `computed()` calls.

---

### 4.5 Demonstrate mutation and invalidation

The demo should support:

```txt
retry failed job
cancel running job
```

Mutations should trigger graph updates and/or resource invalidation.

The intended model is:

```txt
mutation is intentional
query/resource is reactive
invalidation is explicit
graph reconciliation is centralized
```

---

### 4.6 Demonstrate event stream integration

The first version does not need WebSocket or SSE.

A mock event stream is sufficient:

```ts
subscribeJobEvents((event) => {
  kernel.actions.dispatch(event)
})
```

The mock transport may use `setInterval` to simulate progress updates, status transitions, and log events.

---

## 5. Non-Goals

### 5.1 No real backend in the first version

The first version does not need:

```txt
PostgreSQL
Redis
BullMQ
Kafka
WebSocket server
Docker Compose
authentication
real deployment pipeline
```

The goal is to demonstrate reactive graph ownership, not backend infrastructure.

---

### 5.2 Not a replacement for Vue reactivity

This demo must not claim:

```txt
signal-kernel is better than Vue ref
signal-kernel replaces computed
signal-kernel replaces Pinia
signal-kernel replaces Nuxt useFetch
```

The correct positioning is:

```txt
Use Vue reactivity when state naturally belongs to Vue.
Use signal-kernel when the graph should live outside Vue.
```

---

### 5.3 Not a generic AI chatbot

This demo should not be a normal AI chatbot.

A chatbot demo can easily shift attention toward:

```txt
LLMs
streaming text
prompts
RAG
agents
model providers
```

Those concerns would distract from signal-kernel's architectural value.

A future extension may evolve this demo into:

```txt
AI workflow monitor
agent execution graph
tool call monitor
streaming task inspector
```

But the first version should focus on async job monitoring.

---

### 5.4 Not a full observability dashboard

This demo is not intended to compete with Grafana, Prometheus, or Datadog.

It should not focus on:

```txt
CPU usage
memory usage
service uptime
metrics query languages
alerting rules
distributed tracing
```

This demo monitors job lifecycle, not server health.

---

## 6. Project Name

Recommended repository name:

```txt
nuxt-job-monitor-signal-kernel-demo
```

Alternative concept name:

```txt
vue-as-renderer-demo
```

Recommended public title:

```txt
Nuxt Job Monitor: External Async Reactive Graph Demo
```

One-line description:

> A Nuxt dashboard demonstrating how Vue can consume an external async reactive graph owned by signal-kernel.

---

## 7. Architecture Overview

### 7.1 High-level architecture

```txt
+----------------------------------------------+
| Nuxt 3 App                                  |
|                                              |
| - pages / components / layouts              |
| - render UI                                 |
| - handle user interaction                   |
| - consume readonly graph refs               |
+-----------------------+----------------------+
                        |
                        | @signal-kernel/vue
                        v
+----------------------------------------------+
| Job Kernel Package                           |
|                                              |
| - signals                                    |
| - computed values                            |
| - async resources                            |
| - manual mutation resources                  |
| - event reducers                             |
| - graph ownership                            |
+-----------------------+----------------------+
                        |
                        | transport interface
                        v
+----------------------------------------------+
| Mock Transport Layer                         |
|                                              |
| - fetchJobs                                  |
| - retryJob                                   |
| - cancelJob                                  |
| - subscribeJobEvents                         |
| - subscribeJobLogs                           |
+----------------------------------------------+
```

---

### 7.2 Ownership boundary

| Layer | Responsibility | Owns Graph? |
|---|---|---:|
| Nuxt app | Routing, layout, SSR app shell | No |
| Vue components | Rendering, click handlers, local UI state | No |
| `@signal-kernel/vue` | Bridge signal-kernel graph to Vue | No |
| `job-kernel` | Domain reactive graph | Yes |
| Transport | API/event source abstraction | No |
| signal-kernel core | Reactive primitives | Infrastructure |
| async-runtime | Async resource and mutation lifecycle | Infrastructure |

---

## 8. Proposed Directory Structure

Recommended monorepo structure:

```txt
nuxt-job-monitor-signal-kernel-demo/
  apps/
    nuxt-dashboard/
      app.vue
      nuxt.config.ts
      pages/
        index.vue
        kernel-owned.vue
        vue-owned.vue
      components/
        JobList.vue
        JobSummary.vue
        JobDetail.vue
        JobLogPanel.vue
        JobToolbar.vue
        StatusFilter.vue
      composables/
        useJobKernel.ts
      plugins/
        job-kernel.client.ts

  packages/
    job-kernel/
      src/
        index.ts
        types.ts
        createJobKernel.ts

        graph/
          jobSignals.ts
          jobResources.ts
          jobComputed.ts
          jobMutations.ts
          jobEvents.ts

        transport/
          JobTransport.ts
          mockJobTransport.ts

        fixtures/
          createMockJobs.ts

        tests/
          jobComputed.test.ts
          jobEvents.test.ts
          jobMutations.test.ts

  package.json
  pnpm-workspace.yaml
  README.md
```

---

## 9. Data Model

### 9.1 JobStatus

```ts
export type JobStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'retrying'
  | 'cancelled'
```

---

### 9.2 Job

```ts
export type Job = {
  id: string
  name: string
  status: JobStatus
  progress: number

  createdAt: number
  startedAt?: number
  finishedAt?: number

  durationMs?: number
  error?: string
}
```

---

### 9.3 JobLog

```ts
export type JobLog = {
  id: string
  jobId: string
  timestamp: number
  level: 'info' | 'warn' | 'error'
  message: string
}
```

---

### 9.4 JobEvent

```ts
export type JobEvent =
  | {
      type: 'job_created'
      job: Job
    }
  | {
      type: 'job_started'
      jobId: string
      timestamp: number
    }
  | {
      type: 'job_progressed'
      jobId: string
      progress: number
      timestamp: number
    }
  | {
      type: 'job_succeeded'
      jobId: string
      timestamp: number
    }
  | {
      type: 'job_failed'
      jobId: string
      error: string
      timestamp: number
    }
  | {
      type: 'job_retrying'
      jobId: string
      timestamp: number
    }
  | {
      type: 'job_cancelled'
      jobId: string
      timestamp: number
    }
  | {
      type: 'log_appended'
      log: JobLog
    }
```

---

### 9.5 JobSummary

```ts
export type JobSummary = {
  total: number
  queued: number
  running: number
  succeeded: number
  failed: number
  retrying: number
  cancelled: number
  averageDurationMs: number | null
}
```

---

## 10. Transport Interface

`job-kernel` should not depend on Nuxt API routes or any real backend implementation.

It should depend on a transport interface:

```ts
export type JobTransport = {
  fetchJobs(options?: { signal?: AbortSignal }): Promise<Job[]>

  retryJob(jobId: string, options?: { signal?: AbortSignal }): Promise<void>

  cancelJob(jobId: string, options?: { signal?: AbortSignal }): Promise<void>

  subscribeJobEvents(
    onEvent: (event: JobEvent) => void
  ): () => void
}
```

The first implementation should be mock-based:

```ts
export function createMockJobTransport(): JobTransport {
  // Internal mock job state.
  // setInterval emits:
  // - job_progressed
  // - job_succeeded
  // - job_failed
  // - log_appended
}
```

Future implementations may include:

```txt
createHttpJobTransport()
createSseJobTransport()
createWebSocketJobTransport()
```

The graph should not need to change when the transport changes.

---

## 11. Kernel API Design

### 11.1 createJobKernel

The `job-kernel` package should expose a factory:

```ts
export function createJobKernel(options: {
  transport: JobTransport
}) {
  // create signals
  // create resources
  // create computed values
  // create manual mutation resources
  // subscribe to event stream

  return {
    state: {
      jobs,
      logs,
      selectedJobId,
      statusFilter,
    },

    resources: {
      jobsResource,
    },

    computed: {
      filteredJobs,
      selectedJob,
      jobSummary,
      selectedJobLogs,
    },

    mutations: {
      retryJob: retryJobMeta,
      cancelJob: cancelJobMeta,
    },

    actions: {
      selectJob,
      setStatusFilter,
      retryJob,
      cancelJob,
      dispatch,
      start,
      stop,
    },
  }
}
```

---

### 11.2 Signals

```ts
const jobs = signal<Job[]>([])
const logs = signal<JobLog[]>([])

const selectedJobId = signal<string | null>(null)
const statusFilter = signal<JobStatus | 'all'>('all')
```

---

### 11.3 Computed values

```ts
const filteredJobs = computed(() => {
  const currentJobs = jobs.get()
  const filter = statusFilter.get()

  if (filter === 'all') return currentJobs

  return currentJobs.filter(job => job.status === filter)
})
```

```ts
const selectedJob = computed(() => {
  const id = selectedJobId.get()
  if (!id) return null

  return jobs.get().find(job => job.id === id) ?? null
})
```

```ts
const jobSummary = computed<JobSummary>(() => {
  const currentJobs = jobs.get()

  const completedJobs = currentJobs.filter(
    job => job.durationMs != null
  )

  return {
    total: currentJobs.length,
    queued: currentJobs.filter(job => job.status === 'queued').length,
    running: currentJobs.filter(job => job.status === 'running').length,
    succeeded: currentJobs.filter(job => job.status === 'succeeded').length,
    failed: currentJobs.filter(job => job.status === 'failed').length,
    retrying: currentJobs.filter(job => job.status === 'retrying').length,
    cancelled: currentJobs.filter(job => job.status === 'cancelled').length,
    averageDurationMs:
      completedJobs.length === 0
        ? null
        : completedJobs.reduce((sum, job) => sum + (job.durationMs ?? 0), 0) /
          completedJobs.length,
  }
})
```

```ts
const selectedJobLogs = computed(() => {
  const id = selectedJobId.get()
  if (!id) return []

  return logs.get().filter(log => log.jobId === id)
})
```

---

## 12. Event Handling

### 12.1 Centralized event reducer

Job events should be applied through a centralized reducer.

```ts
function applyJobEvent(event: JobEvent) {
  switch (event.type) {
    case 'job_created':
      jobs.set([...jobs.get(), event.job])
      break

    case 'job_started':
      updateJob(event.jobId, job => ({
        ...job,
        status: 'running',
        startedAt: event.timestamp,
      }))
      break

    case 'job_progressed':
      updateJob(event.jobId, job => ({
        ...job,
        progress: event.progress,
      }))
      break

    case 'job_succeeded':
      updateJob(event.jobId, job => ({
        ...job,
        status: 'succeeded',
        progress: 100,
        finishedAt: event.timestamp,
        durationMs: job.startedAt
          ? event.timestamp - job.startedAt
          : job.durationMs,
      }))
      break

    case 'job_failed':
      updateJob(event.jobId, job => ({
        ...job,
        status: 'failed',
        error: event.error,
        finishedAt: event.timestamp,
        durationMs: job.startedAt
          ? event.timestamp - job.startedAt
          : job.durationMs,
      }))
      break

    case 'job_retrying':
      updateJob(event.jobId, job => ({
        ...job,
        status: 'retrying',
        progress: 0,
        error: undefined,
      }))
      break

    case 'job_cancelled':
      updateJob(event.jobId, job => ({
        ...job,
        status: 'cancelled',
        finishedAt: event.timestamp,
      }))
      break

    case 'log_appended':
      logs.set([...logs.get(), event.log])
      break
  }
}
```

---

### 12.2 updateJob helper

```ts
function updateJob(
  jobId: string,
  updater: (job: Job) => Job
) {
  jobs.set(
    jobs.get().map(job =>
      job.id === jobId ? updater(job) : job
    )
  )
}
```

---

## 13. Async Resource Design

The first version should include an initial jobs resource using the current `@signal-kernel/async-runtime` object-form API.

`createResource()` does not use query keys or fetchers. A query-like resource is an auto resource:

```ts
import { createResource, createRevision } from '@signal-kernel/async-runtime'

const jobsRevision = createRevision()

const jobsResource = createResource({
  observe: () => {
    jobsRevision.get()
  },
  run: async (_input: undefined, ctx) => {
    return transport.fetchJobs({ signal: ctx.signal })
  },
  onSuccess: fetchedJobs => {
    jobs.set(fetchedJobs)
  },
})
```

The resource runs when it is created and re-runs whenever its observed revision changes. The revision is not a cache key and it does not store fetched data. It is a signal-backed invalidation source.

The intended semantics are:

```txt
resource owns initial async loading
event stream owns continuous updates
manual resource owns intentional mutation calls
revision owns declarative invalidation
computed owns derived state
```

---

## 14. Mutation Design

`signal-kernel` does not currently expose a separate `createMutation()` API.

Mutation-like work should be modeled with `createResource({ trigger: "manual", run, invalidates })`. The returned metadata exposes `run(input)`, `reload()`, `cancel()`, `status()`, and `error()`.

### 14.1 Retry job

```ts
const [, retryJobMeta] = createResource({
  trigger: 'manual',
  run: async (jobId: string, ctx) => {
    await transport.retryJob(jobId, { signal: ctx.signal })
    return { jobId }
  },
  invalidates: () => [jobsRevision],
})

async function retryJob(jobId: string) {
  applyJobEvent({
    type: 'job_retrying',
    jobId,
    timestamp: Date.now(),
  })

  const result = await retryJobMeta.run(jobId)

  if (retryJobMeta.status() === 'error') {
    applyJobEvent({
      type: 'job_failed',
      jobId,
      error: String(retryJobMeta.error() ?? 'Retry failed'),
      timestamp: Date.now(),
    })
  }

  return result
}
```

---

### 14.2 Cancel job

```ts
const [, cancelJobMeta] = createResource({
  trigger: 'manual',
  run: async (jobId: string, ctx) => {
    await transport.cancelJob(jobId, { signal: ctx.signal })
    return { jobId }
  },
  invalidates: () => [jobsRevision],
})

async function cancelJob(jobId: string) {
  const result = await cancelJobMeta.run(jobId)

  if (result) {
    applyJobEvent({
      type: 'job_cancelled',
      jobId,
      timestamp: Date.now(),
    })
  }

  return result
}
```

If the mock event stream is the authoritative source of truth, the mutation may rely on the stream to reconcile final state. Keeping `invalidates: () => [jobsRevision]` is still useful when the demo wants a post-mutation refetch boundary.

---

## 15. Nuxt Integration

### 15.1 Nuxt plugin setup

The Nuxt app may create a singleton kernel through a client plugin.

```ts
// apps/nuxt-dashboard/plugins/job-kernel.client.ts
import { createJobKernel } from '@demo/job-kernel'
import { createMockJobTransport } from '@demo/job-kernel/transport'

export default defineNuxtPlugin(() => {
  const kernel = createJobKernel({
    transport: createMockJobTransport(),
  })

  kernel.actions.start()

  return {
    provide: {
      jobKernel: kernel,
    },
  }
})
```

The first version should use `.client.ts` to avoid SSR and hydration complexity.

SSR snapshot support can be explored in a later phase.

---

### 15.2 Composable wrapper

```ts
// apps/nuxt-dashboard/composables/useJobKernel.ts
export function useJobKernel() {
  const { $jobKernel } = useNuxtApp()
  return $jobKernel
}
```

---

### 15.3 Vue component consuming the graph

```vue
<script setup lang="ts">
import { useResource, useSignalValue } from '@signal-kernel/vue'

const kernel = useJobKernel()

const jobs = useSignalValue(kernel.computed.filteredJobs)
const summary = useSignalValue(kernel.computed.jobSummary)
const filter = useSignalValue(kernel.state.statusFilter)
const jobsResource = useResource(kernel.resources.jobsResource)
const jobsStatus = jobsResource.status

function setFilter(nextFilter) {
  kernel.actions.setStatusFilter(nextFilter)
}

function reloadJobs() {
  void jobsResource.reload()
}
</script>

<template>
  <section>
    <JobSummary :summary="summary" />
    <JobToolbar :status="jobsStatus" @reload="reloadJobs" />
    <StatusFilter :value="filter" @change="setFilter" />
    <JobList :jobs="jobs" />
  </section>
</template>
```

---

## 16. Pages

### 16.1 `/`

The index page should explain the purpose of the demo.

It should include:

```txt
This demo is not a replacement for Vue reactivity.
It demonstrates external async reactive graph ownership.
Vue consumes the graph through @signal-kernel/vue.
```

---

### 16.2 `/kernel-owned`

This is the main demo page.

It should use signal-kernel as the graph owner.

The page should include:

```txt
summary cards
status filter
job list
selected job detail
log panel
retry/cancel actions
```

---

### 16.3 `/vue-owned`

This is an optional comparison page.

It should implement a simplified version using ordinary Vue/Nuxt ownership:

```txt
ref
computed
useAsyncData / useFetch
manual refresh
component/composable-owned state
```

This page must not frame Vue as inferior.

It should state:

> This version is perfectly valid for normal Nuxt apps.  
> The kernel-owned version becomes useful when the graph needs to outlive Vue/Nuxt.

---

## 17. UI Requirements

The first version does not need a highly polished UI, but the graph behavior should be easy to see.

### 17.1 Summary cards

Display:

```txt
Total
Queued
Running
Failed
Succeeded
Average Duration
```

---

### 17.2 Job list

Each row should display:

```txt
name
status
progress
duration
actions
```

Actions:

```txt
Select
Retry
Cancel
```

Retry should only be shown for failed jobs.

Cancel should only be shown for queued, running, or retrying jobs.

---

### 17.3 Job detail

The selected job detail panel should display:

```txt
job id
name
status
progress
created at
started at
finished at
duration
error
```

---

### 17.4 Log panel

The log panel should display logs for the selected job.

Logs should update as new `log_appended` events are emitted.

---

## 18. State Flow

### 18.1 Initial load

```txt
Nuxt plugin creates kernel
kernel.start()
jobsResource is created
createResource auto-runs
transport.fetchJobs({ signal })
jobs signal is updated
computed values re-evaluate
Vue components receive readonly refs through @signal-kernel/vue
```

---

### 18.2 Event stream update

```txt
mock transport emits job_progressed
kernel.applyJobEvent(event)
jobs signal is updated
filteredJobs recomputes
jobSummary recomputes
selectedJob recomputes if needed
Vue UI updates through adapter
```

---

### 18.3 Retry failed job

```txt
user clicks Retry
Vue calls kernel.actions.retryJob(jobId)
manual resource calls transport.retryJob(jobId)
kernel applies optimistic job_retrying
manual resource invalidates jobsRevision after success
resource refetches or event stream reconciles state
UI updates
```

---

### 18.4 Cancel running job

```txt
user clicks Cancel
Vue calls kernel.actions.cancelJob(jobId)
manual resource calls transport.cancelJob(jobId)
kernel applies job_cancelled
UI updates
```

---

## 19. Testing Requirements

### 19.1 Kernel tests

`job-kernel` should be testable without starting Nuxt.

Test cases should include:

```txt
filteredJobs reacts to statusFilter
selectedJob reacts to selectedJobId and jobs
jobSummary calculates status counts correctly
applyJobEvent updates jobs correctly
log_appended updates selectedJobLogs
retryJob calls transport.retryJob
cancelJob calls transport.cancelJob
```

---

### 19.2 Nuxt/manual verification

The first version does not need full E2E coverage.

Manual verification should include:

```txt
page loads without hydration errors
job progress updates automatically
summary updates with job status
filter works
select job works
logs append over time
retry failed job works
cancel running job works
```

---

## 20. README Positioning

The README should not start with API details.

It should start with the boundary problem.

Recommended opening:

```md
# Nuxt Job Monitor: External Async Reactive Graph Demo

This demo is not a replacement for Vue reactivity, Pinia, or Nuxt data fetching.

Vue and Nuxt are excellent when the state naturally belongs to the Vue application.

This demo explores a different boundary:

What if the async reactive graph should live outside Nuxt, while Vue only consumes live readonly graph refs?
```

---

## 21. Messaging Guidelines

### 21.1 Recommended phrases

Use phrases like:

```txt
external reactive graph
framework-agnostic runtime
Vue as renderer
Nuxt as application shell
async graph ownership
resource and mutation boundary
event-driven reactive graph
```

---

### 21.2 Phrases to avoid

Avoid:

```txt
better than Vue ref
replacement for Vue reactivity
Nuxt useFetch is not enough
Pinia is limited
Vue should not own state
```

Instead, prefer:

```txt
Vue-owned state is valid for normal Vue apps.
Kernel-owned graph is useful when the graph needs to outlive Vue.
```

---

## 22. Implementation Phases

### Phase 1: Pure Job Kernel

Goal:

Build the framework-agnostic graph first.

Deliverables:

```txt
packages/job-kernel
types
mock transport
signals
computed values
event reducer
basic tests
```

Acceptance criteria:

```txt
job-kernel can run in a Node test environment
events update jobs correctly
computed summary updates correctly
no Vue/Nuxt dependency
```

---

### Phase 2: Nuxt Dashboard

Goal:

Build the Nuxt 3 app that consumes the job kernel.

Deliverables:

```txt
apps/nuxt-dashboard
Nuxt plugin
useJobKernel composable
JobSummary component
JobList component
JobDetail component
JobLogPanel component
StatusFilter component
kernel-owned page
```

Acceptance criteria:

```txt
Nuxt page displays jobs
jobs update over time
summary updates over time
filter works
selected job works
logs update
retry/cancel actions work
```

---

### Phase 3: Vue-Owned Comparison Page

Goal:

Create a comparison page that demonstrates the ownership difference.

Deliverables:

```txt
vue-owned page
short explanation block
side-by-side architecture comparison
```

Acceptance criteria:

```txt
vue-owned page works
README explains this is not a superiority comparison
kernel-owned page clearly shows the external graph boundary
```

---

### Phase 4: Snapshot / SSR Exploration

Goal:

Extend the demo toward signal-kernel snapshot support.

Deliverables:

```txt
optional snapshot export
optional hydration example
documentation of SSR boundary
```

Acceptance criteria:

```txt
kernel graph can produce a serializable snapshot document
Nuxt can restore an explicit initial snapshot into the client graph
client event stream continues after hydration
```

This phase is not required for the first version.

---

### Phase 5: Future AI Workflow Extension

Goal:

Evolve the job monitor into an AI workflow monitor.

Possible job statuses or stages:

```txt
planning
retrieving
tool_calling
generating
validating
retrying
completed
```

This should become a second demo, not part of the first version.

---

## 23. Success Criteria

This demo is successful if readers can understand:

```txt
signal-kernel is not trying to replace Vue reactivity
Vue can consume an external graph
the graph can live outside Nuxt/Vue
async resources, mutations, events, and derived state can be centralized
the same graph can theoretically be consumed by React, CLI, workers, or explicit snapshot documents
```

The goal is not to prove that every Vue app needs signal-kernel.

The goal is to prove that signal-kernel has a meaningful role when the reactive graph should not belong to the UI framework.

---

## 24. Risks

### 24.1 Misunderstood as a Vue state management library

Mitigation:

The README should clearly state:

```txt
This is not a replacement for Vue ref, computed, Pinia, or Nuxt useFetch.
```

---

### 24.2 Demo is too simple and dismissed as ref-replaceable

Mitigation:

Do not use counter or todo examples.

Use job monitoring to demonstrate:

```txt
event stream
mutation
invalidation
derived summary
selected detail
logs
```

---

### 24.3 Demo is too complex and loses focus

Mitigation:

The first version should avoid:

```txt
real backend
auth
database
AI
deployment infrastructure
```

---

### 24.4 Some Vue developers still do not care

Mitigation:

Accept this.

The target audience is not every Vue developer.

The target audience is:

> Vue developers who understand Vue deeply enough to know where Vue should stop.

---

## 25. Recommended Article Angle

After the demo is complete, it can be introduced through an article.

Recommended English titles:

```txt
Vue as Renderer: Moving Async Reactive Graph Ownership Outside Nuxt
```

```txt
When Vue Should Not Own the Whole Reactive Graph
```

```txt
Nuxt Job Monitor: An External Async Reactive Graph Demo
```

---

## 26. Final Positioning

The final positioning of this demo should be:

> A Nuxt dashboard where Vue renders an async reactive graph owned outside the framework.

The most important message is:

> This is not about replacing Vue reactivity.  
> This is about deciding where the reactive graph should live.
