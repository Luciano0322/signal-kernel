# RFC: DevOps Runtime Example

This RFC is not yet the RFC for `@signal-kernel/ops-runtime`.

It is a pressure-test example for discovering what an ops-runtime package should eventually abstract:
- operational input normalization
- deployment graph modeling
- derived operational decisions
- stream-driven health state
- automation effects
- future snapshot boundaries

Status: proposed

## Problem Statement

`signal-kernel` is a framework-agnostic reactive runtime, but the first examples are still close to UI-facing async state.

The next example should prove a larger architectural claim:

> Operational state can be modeled as a deterministic reactive graph. Rendering and automation are effects of that graph.

Modern backend systems often describe themselves as stateless, but DevOps workflows are not stateless. They carry state across commits, CI jobs, artifacts, deployments, health checks, approvals, rollbacks, and incident decisions.

That state is usually spread across several tools:

* Git providers
* CI systems
* artifact registries
* deployment platforms
* Kubernetes or similar control planes
* observability systems
* approval and audit systems

The example should demonstrate how `signal-kernel` can aggregate those operational inputs into a small control-plane graph without making React or Vue own the orchestration logic.

This example is also a precursor to the future snapshot package. Before designing snapshot APIs, the project should observe which runtime states are worth capturing, which should be refetched, and which should be recomputed.

---

## Positioning

This example should position `signal-kernel` as a runtime for operational state graphs.

It is not an OpenTelemetry replacement. OpenTelemetry can provide logs, metrics, and traces as inputs, but the `signal-kernel` graph should derive operational meaning from those inputs.

It is not a Kubernetes replacement. Kubernetes owns cluster reconciliation. The example may borrow control-plane language, but it should remain a local runtime model.

It is not a Temporal, Argo, or Step Functions replacement. Those systems own durable workflow execution. This example should focus on deterministic state modeling, async correctness, and derived decisions.

It is not a dashboard framework. React and Vue render graph state through thin adapters.

The intended mental model is:

```txt
external systems -> operational inputs -> signal-kernel graph -> UI and automation effects
```

---

## Goals

* Demonstrate a DevOps control-plane style runtime graph.
* Model operational state across a small deployment pipeline.
* Show async correctness when selected commits or deployment intents change.
* Show derived decisions such as `canDeploy`, `canPromote`, `blockedReason`, and `riskLevel`.
* Show streaming or incremental runtime updates such as deployment logs or health events.
* Keep React and Vue as rendering adapters only.
* Identify future snapshot boundaries without implementing snapshot support.
* Make the example small enough to understand, but realistic enough to stress the runtime model.

---

## Non-Goals

* Building a real CI/CD platform.
* Calling real GitHub, Docker, Kubernetes, or OpenTelemetry APIs.
* Implementing durable workflow execution.
* Implementing retry policy, queueing, scheduling, or worker orchestration.
* Implementing snapshot capture or restore in this RFC.
* Replacing Kubernetes, Terraform, Temporal, Argo, GitHub Actions, or OpenTelemetry.
* Moving deployment logic into React hooks or Vue watchers.
* Building a polished SaaS dashboard.

---

## Core Scenario

The example should model a small deployment flow:

```txt
select commit
-> CI checks run
-> artifact becomes available
-> staging rollout starts
-> health events stream in
-> graph computes promotion eligibility
-> manual approval is granted
-> production promotion becomes allowed or blocked
```

The flow should be deterministic and fake, but it should feel like a real DevOps control-plane slice.

Suggested commit fixtures:

```txt
commit-a: slow CI, healthy rollout
commit-b: fast CI, unhealthy rollout
commit-c: medium CI, healthy rollout
```

Switching commits while async work is running must not allow stale CI, artifact, deployment, or health results to overwrite the current commit's state.

---

## Operational State Model

The graph should separate source state, async resources, streams, derived decisions, and effects.

### Signals

Signals should represent explicit user or runtime inputs:

```ts
const selectedCommit = signal<CommitId>("commit-a");
const targetEnvironment = signal<Environment>("staging");
const manualApproval = signal(false);
const rolloutIntent = signal<RolloutIntent>("idle");
```

Examples:

* selected commit
* target environment
* manual approval
* requested rollout action
* selected service
* requested rollback target

### Async Resources

Resources should represent fetch-like operational state:

```ts
const ciStatus = createResource(
  selectedCommit.get,
  (commitId, ctx) => fakeCiApi(commitId, ctx),
);
```

Examples:

* CI status
* artifact status
* staging deployment status
* production deployment status
* current service version

Async resources should preserve latest-wins behavior. If the selected commit changes, old resource results must not become authoritative.

### Stream Resources

Stream resources should represent incremental operational updates:

* deployment logs
* rollout progress
* health check events
* synthetic telemetry events

The example may use the existing stream resource API if it fits the current package surface. If not, the first implementation can simulate streaming through a framework-neutral signal updated by controlled timers.

The stream should remain graph-owned. React and Vue should not own the stream lifecycle beyond adapter subscription.

### Computed Decisions

Computed values should derive operational meaning:

```ts
const canPromote = computed(() => {
  return (
    ciStatus().state === "success" &&
    artifactStatus().state === "ready" &&
    stagingHealth().state === "healthy" &&
    manualApproval.get()
  );
});
```

Examples:

* pipeline phase
* can deploy
* can promote
* blocked reason
* risk level
* current version
* rollback availability
* rollout health

Computed values should be recomputable from graph inputs. They should not become separate source-of-truth state.

### Effects

Effects may include:

* rendering through React
* rendering through Vue
* appending audit events
* simulating deployment commands
* simulating notifications

Effects should not own business rules.

---

## Proposed Example Layout

```txt
examples/
  devops-runtime/
    README.md
    package.json
    vite.config.ts
    src/
      graph/
        commits.ts
        fakeArtifactApi.ts
        fakeCiApi.ts
        fakeDeploymentApi.ts
        fakeHealthStream.ts
        devopsGraph.ts
        devopsGraph.test.ts
        types.ts
      react/
        ReactPanel.tsx
      vue/
        VuePanel.ts
      eventLog.ts
      main.tsx
```

The exact structure can change during implementation, but graph code must remain separate from framework views.

The example may follow the search race-condition example's single Vite page pattern so React and Vue can consume the same graph side by side.

---

## UI Design

The UI should be plain and concept-focused.

Suggested layout:

```txt
Commit selector + controls

Pipeline timeline
  commit selected
  CI checks
  artifact ready
  staging rollout
  health stream
  approval
  production promotion

Decision panel
  pipeline phase
  can deploy
  can promote
  blocked reason
  risk level

React + signal-kernel panel
  renders graph state through @signal-kernel/react

Vue + signal-kernel panel
  renders graph state through @signal-kernel/vue

Event log
  shows async starts, cancellations, ignored stale results, stream updates, and derived decisions
```

The UI should make operational state visible, but it should not imply that `signal-kernel` is a dashboard framework.

---

## React Adapter Boundary

The React view should:

* read graph state through `@signal-kernel/react`
* render pipeline state, derived decisions, and logs
* trigger graph actions through event handlers
* avoid implementing async latest-wins logic in React state
* avoid using React `useEffect()` as the orchestration mechanism

React owns rendering. The graph owns operational state and decisions.

---

## Vue Adapter Boundary

The Vue view should:

* read graph state through `@signal-kernel/vue`
* render pipeline state, derived decisions, and logs
* trigger graph actions through event handlers
* avoid implementing async latest-wins logic in Vue refs
* avoid using Vue `watch()` as the orchestration mechanism

Vue owns rendering. The graph owns operational state and decisions.

---

## Expected Behavior

### Commit Switching

If the user selects `commit-a`, then quickly switches to `commit-b`, late results from `commit-a` must not overwrite `commit-b`.

The event log should make ignored stale results visible.

### Promotion Gate

Production promotion should only become available when:

* CI succeeds
* artifact is ready
* staging rollout succeeds
* health is acceptable
* manual approval is granted

If any dependency fails or becomes unhealthy, `canPromote` should become false and `blockedReason` should explain why.

### Health Stream

Health updates should affect derived decisions without being owned by UI components.

For example:

```txt
latency normal + error rate low -> healthy
latency high + error rate high -> degraded
degraded health -> promotion blocked
```

### Rollback or Cancel

The example may include a simple cancel or rollback action.

Canceling a rollout should update graph state and prevent late rollout results from becoming authoritative.

---

## Snapshot Discovery Questions

This RFC does not implement snapshot support, but the example should expose snapshot design questions.

Future snapshot work should answer:

* Which graph signals are authoritative source state?
* Which async resource values should be captured?
* Which async resources should be refetched after restore?
* Should in-flight resource state be restored, cancelled, or restarted?
* Should computed values be serialized or recomputed?
* Are stream events state, audit history, or transient runtime output?
* How should manual approvals and deployment intents be restored?
* What is the difference between graph state and audit log state?
* What should happen if a snapshot is restored after the external world has changed?

The example should produce enough pressure to answer those questions later with concrete use cases instead of abstract API guesses.

---

## Testing Strategy

Tests should prioritize graph semantics over UI implementation details.

Required graph-level tests:

* selecting a new commit ignores stale CI results from older commits
* selected commit changes cancel or supersede in-flight artifact and deployment work
* `canPromote` requires CI success, artifact readiness, healthy staging, and manual approval
* unhealthy stream events block promotion
* healthy stream events can unblock promotion when other gates pass
* cancel or rollback updates derived pipeline phase
* derived values can be tested without mounting React or Vue

Framework-level checks should be lighter:

* the example typechecks
* the example builds with React and Vue mounted on the same page
* React reads graph state through the React adapter
* Vue reads graph state through the Vue adapter
* neither framework view owns operational decisions

Tests should not inspect private async-runtime tokens or internal graph structures.

---

## Documentation Requirements

The example README should explain:

* what DevOps operational state means in this example
* why stateless backend handlers do not make DevOps workflows stateless
* how external tools map to graph inputs
* why OpenTelemetry is an input source, not the whole problem space
* how `signal-kernel` derives control-plane decisions
* why React and Vue remain thin adapters
* which future snapshot questions the example reveals

The README should avoid describing `signal-kernel` as a dashboard library or CI/CD replacement.

---

## Open Questions

### Should the first version include both React and Vue?

Using both adapters reinforces rendering independence, but the DevOps domain may already be complex.

The preferred default is to follow the search race-condition example and mount both React and Vue on one Vite page, as long as the UI remains simple.

### Should stream state use `createStreamResource()` immediately?

If the existing stream API is stable enough, the example should use it.

If using it would distract from the control-plane model, the first version can simulate stream updates through a graph-owned signal and leave stream-resource integration as a follow-up.

### Should the example include a naive comparison?

The search race-condition example already demonstrates naive Promise failure clearly.

This example should probably focus on the positive architecture: a graph-owned operational model. A naive DevOps implementation may add too much noise.

### Should snapshot notes live in this RFC or a separate snapshot RFC?

This RFC should list snapshot discovery questions only.

Snapshot API design should happen in a later RFC after the DevOps example reveals concrete state boundaries.

---

## Decision

Build a DevOps runtime example around a small deployment control-plane graph.

Use fake but deterministic APIs for CI, artifact readiness, deployment status, and health events.

Keep operational logic inside the framework-neutral graph.

Use React and Vue only as thin renderers over the graph.

Do not implement snapshot yet. Use this example to discover what snapshot should eventually capture, restore, refetch, or recompute.
