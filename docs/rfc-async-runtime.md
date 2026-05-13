# RFC: Async Runtime

Status: adopted design note

## Problem Statement

`@signal-kernel/async-runtime` needs to model asynchronous work as part of the reactive graph without becoming a UI fetching library.

Async correctness belongs below framework adapters because cancellation, stale-result protection, and latest-wins behavior are dataflow concerns, not renderer concerns.

---

## Goals

* Model async value, status, and error state inside the reactive graph.
* Prevent stale async results from overwriting newer state.
* Support explicit cancellation.
* Preserve latest-wins semantics for overlapping async work.
* Support source-driven resource loading.
* Support stream or incremental resource updates.
* Remain framework-neutral.
* Build on `@signal-kernel/core` instead of redefining graph semantics.

---

## Non-Goals

* Replacing TanStack Query, SWR, or framework query libraries.
* Adding global query caches.
* Adding retry, polling, deduplication, or server-cache policy as default runtime behavior.
* Coupling async lifecycle to React, Vue, component mount, or component unmount.
* Providing Suspense-first semantics.
* Hiding business logic inside UI adapters.

---

## API Layers

The async runtime intentionally has layered primitives:

```txt
fromPromise()
  -> asyncSignal()
  -> createResource()
  -> createStreamResource()
```

### `fromPromise()`

Lowest-level Promise-to-reactive-state primitive.

It exposes:

```ts
value();
status();
error();
reload();
cancel(reason?);
```

It owns token-based stale-result protection and cancellation-aware commits.

### `asyncSignal()`

Convenience layer that returns a value getter and metadata tuple:

```ts
const [value, meta] = asyncSignal(fetcher);
```

Use this when the operation is async state but not necessarily source-driven.

### `createResource()`

Source-driven one-shot async resource:

```ts
const [value, meta] = createResource(source, fetcher);
```

When `source()` changes, the previous work is cancelled or logically discarded and a new request becomes authoritative.

### `createStreamResource()`

Source-driven stream resource for multi-emission async work:

```ts
const [value, meta] = createStreamResource(source, streamer, options);
```

It separates visible accumulated value from stable committed value so progressive output can be displayed without losing a stable graph state boundary.

---

## Runtime Semantics

### Latest Wins

When async executions overlap, only the newest valid execution may commit value, status, or error state.

Older completions are stale even if they resolve successfully.

### Cancellation

Cancellation is part of runtime semantics.

Cancellation may come from:

* explicit `cancel(reason?)`
* source changes
* stream invalidation

Adapters must not invent their own cancellation policy.

### Status Is Data

Status transitions are reactive data, not UI-only loading flags.

Adapters must observe metadata changes even when the value itself does not change.

Important transitions include:

```txt
idle -> pending
pending -> success
pending -> error
pending -> cancelled
success -> pending with previous value retained
streaming -> success
streaming -> error
streaming -> cancelled
```

### Previous Value Retention

Pending state may keep or clear the previous value depending on runtime options.

Consumers should not assume pending always means the value is `undefined`.

### Stream Interruption Policy

Stream resources can choose what happens to visible partial output on interruption:

```txt
keep-partial
rollback
clear
```

This is async-runtime policy, not adapter policy.

---

## Adapter Boundary

Framework adapters may read async resources and expose snapshots to renderers.

Adapters must not:

* add caching or retry policy
* automatically cancel resources on component unmount
* redefine status transitions
* hide stale-result behavior
* route async correctness through framework effects

Adapters should observe at least:

```ts
value();
meta.status();
meta.error();
```

Stream adapters should also observe metadata that affects rendering, such as:

```ts
meta.stableValue();
```

when exposed by the public stream meta API.

---

## Testing Strategy

Async-runtime tests should verify behavior through public APIs.

Important behaviors:

* eager and manual reload behavior
* status transitions
* error transitions
* cancellation status
* stale result prevention
* latest-wins commits
* source-driven reload
* source-change cancellation
* previous-value retention
* stream emission
* stream success commit
* stream error interruption policy
* stream cancel interruption policy

Tests should not depend on internal tokens or private implementation details except through observable behavior.

---

## Decision

Keep `@signal-kernel/async-runtime` as a framework-neutral async correctness layer.

It owns async state, cancellation, stale-result prevention, latest-wins behavior, source-driven resources, and stream resource semantics.

Framework adapters own only rendering integration.
