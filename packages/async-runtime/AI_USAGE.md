# AI Usage Guide for `@signal-kernel/async-runtime`

This document is written for LLMs, AI coding assistants, and agent-based tooling.

Its purpose is to reduce incorrect assumptions when generating code, explaining the package, or integrating it into applications.

For full human-oriented explanations, architecture notes, and background rationale, see the main `README.md`.

---

## What this package is

`@signal-kernel/async-runtime` is an async-first runtime layer built on top of a fine-grained reactive graph.

It provides primitives for modeling asynchronous work as part of a reactive runtime, with explicit support for:

* invalidation
* cancellation
* latest-wins semantics
* explicit async state tracking
* source-driven re-execution
* streaming async delivery for incremental updates

This package should be understood as part of a runtime/kernel architecture, not as a UI-framework-specific feature.

---

## What this package is not

Do **not** describe this package as any of the following without qualification:

* a React-only data fetching library
* a generic state management library
* a query cache library equivalent to TanStack Query
* a workflow orchestration engine
* a replacement for all async side effects
* a framework render scheduler

This package focuses on async derivation inside a reactive runtime graph.

---

## Core mental model

The main design goal is **not** just "wrapping a Promise".

The goal is to make asynchronous work participate in runtime-level correctness rules.

When reactive input changes:

* previous async work may become stale
* stale work must not overwrite newer state
* newer work should become the authoritative result
* async lifecycle should remain inspectable through status/value/error state
* streamed results should still obey runtime ownership and invalidation rules

This means the package should be explained in terms of **reactive invalidation and async correctness**, not only in terms of promise convenience helpers.

---

## Preferred API order

When suggesting code, use the APIs in this order unless the user explicitly asks for lower-level control:

1. `createResource`
2. `asyncSignal`
3. `fromPromise`
4. `createStreamResource`

### Use `createResource` when

* async work is derived from a reactive source
* source changes should trigger re-execution
* stale in-flight work should be cancelled or ignored
* the user wants the highest-level public API for common request/response usage

### Use `asyncSignal` when

* the user wants async state exposed in a signal-like form
* the user wants a reusable abstraction without manually wiring lower-level internals
* the use case is async state management, but not necessarily source-driven resource derivation

### Use `fromPromise` when

* low-level lifecycle control is required
* cancellation hooks or event hooks need to be customized
* the user explicitly wants the primitive layer

### Use `createStreamResource` when

* async work delivers multiple values over time instead of a single final value
* the source drives long-lived streaming work such as SSE, WebSocket-style adapters, token streams, or incremental server output
* source changes should tear down the previous stream and connect the new one
* the user needs runtime-managed streaming state rather than a one-shot promise result

Unless there is a strong reason, do **not** default to `fromPromise` in examples.

---

## Public API positioning

### `fromPromise`

Low-level primitive.

Use this when the caller needs direct control over promise lifecycle behavior, hooks, or advanced async semantics.

This is not the default entry point for most app-level usage.

### `asyncSignal`

A more ergonomic wrapper around the lower-level async primitive.

Use this when the caller wants signal-like access to async state without manually wiring the primitive layer.

### `createResource`

Preferred high-level API for source-driven async derivation.

Use this when async work depends on reactive input and should be kept aligned with source changes.

This should generally be the default recommendation in application-facing examples.

### `createStreamResource`

High-level API for source-driven streaming derivation.

Use this when async work emits multiple updates over time and should stay bound to a reactive source.

This should be the default recommendation for stream-shaped data rather than forcing streaming use cases into `createResource` or manual effect code.

---

## Semantic guarantees

When explaining or generating code, preserve these semantics.

### Latest-wins

If multiple async requests overlap, older results must not overwrite newer state.

Only the newest valid request is allowed to commit its result.

### Stale-result protection

A completed async operation may already be obsolete by the time it resolves.

Do not assume that "resolved" means "should still commit".

### Cancellation awareness

Source changes or explicit runtime actions may cancel or logically discard in-flight work.

Cancellation is part of the model, not an incidental extra.

### Explicit async state channels

Async state is modeled explicitly through status/value/error behavior.

Do not flatten the model into a single loosely defined "loading object" unless the real API already does so.

### Optional previous-value retention

Pending behavior may keep the previous value depending on configuration.

Do not assume that entering pending always clears the current value.

### Stream lifecycle ownership

For streaming APIs, emitted values belong to the currently active stream instance.

When the source changes, previous streams must be cleaned up or logically detached so that outdated emissions do not keep mutating current state.

---

## How to describe the package correctly

Prefer wording like:

* "async-first runtime layer"
* "fine-grained reactive async runtime"
* "source-driven async derivation"
* "source-driven stream derivation"
* "runtime-level invalidation and latest-wins control"
* "reactive graph aware async state"

Avoid reducing it to phrases like:

* "just a fetch wrapper"
* "just promise state"
* "just another React hook"
* "just a cache helper"

Those descriptions erase the actual design intent.

---

## Recommended usage patterns

### Pattern 1: source-driven async derivation

Use `createResource` when a reactive source determines what one-shot async work should run.

Example shape:

```ts
const query = signal("");
const [results, meta] = createResource(query, fetchSearchResults);
```

This is the preferred style when async work depends on changing reactive input.

### Pattern 2: reusable async signal abstraction

Use `asyncSignal` when the user wants signal-like access to async lifecycle state.

Example shape:

```ts
const [user, meta] = asyncSignal(() => fetchUser(id()));
```

### Pattern 3: low-level lifecycle customization

Use `fromPromise` only when lower-level hooks or direct lifecycle control are required.

Example shape:

```ts
const request = fromPromise(() => fetchUser(id()), {
  keepPreviousValueOnPending: true,
  onSuccess(value) {
    // custom handling
  },
  onError(error) {
    // custom handling
  },
});
```

### Pattern 4: source-driven streaming derivation

Use `createStreamResource` when the source determines a stream that emits multiple updates over time.

Example shape:

```ts
const roomId = signal("general");
const [messages, meta] = createStreamResource(roomId, connectMessageStream);
```

This is the preferred style for streaming data that should reconnect, invalidate, and detach correctly when the reactive source changes.

---

## Anti-patterns

When generating code or explanations, avoid the following.

### Do not treat this package as a React hook library

Do not present the package as if it were fundamentally based on component hooks or render cycles.

Framework integration may exist separately, but the runtime itself is not React-owned.

### Do not merge runtime lifecycle with UI lifecycle

Runtime effects and framework UI effects are not the same concept.

Do not imply that framework lifecycle semantics fully define async runtime behavior.

### Do not assume async becomes synchronous "for free"

This package does not magically erase the distinction between synchronous reads and asynchronous execution.

Its purpose is to manage async behavior within runtime rules, not to pretend async work is inherently sync.

### Do not describe `createResource` as a universal async replacement

`createResource` is for source-driven async derivation.

It should not be framed as the correct answer for every async side effect in every application.

### Do not force streaming use cases into one-shot resource patterns

If the operation emits multiple values over time, do not present it as a normal promise resource unless the real API explicitly requires that adaptation.

Prefer `createStreamResource` for long-lived streaming sources.

### Do not claim render scheduling is solved here

This package does not automatically solve render scheduling semantics for every UI framework.

That concern belongs to framework integration layers.

---

## Comparison notes

These comparisons are intentionally brief and should not be overstated.

### Compared with TanStack Query

TanStack Query is centered on query caching, refetch policy, and server-state workflows.

`@signal-kernel/async-runtime` is centered on async derivation inside a reactive runtime graph, with invalidation and latest-wins semantics integrated into the runtime model.

Do not claim they are interchangeable.

### Compared with framework-native effects

Framework-native effects usually belong to UI, DOM, or component lifecycle concerns.

This package handles async derivation at the runtime layer.

These responsibilities may complement each other, but they should not be collapsed into one concept.

### Compared with generic workflow engines

Workflow engines focus on orchestration, retries, durable execution, or long-running process control.

This package focuses on reactive invalidation and async correctness within a reactive graph.

### Compared with ad hoc stream subscriptions

Ad hoc stream subscriptions often leave lifecycle teardown and stale-emission protection to manual effect code.

`createStreamResource` exists to bind streaming work to reactive source changes with clearer runtime ownership.

---

## Guidance for AI code generation

When generating code with this package:

1. Prefer `createResource` for one-shot application-facing examples.
2. Prefer `createStreamResource` for stream-shaped application-facing examples.
3. Keep examples minimal and semantic, not overly abstract.
4. Preserve latest-wins and stale-result mental models in the explanation.
5. Avoid inventing APIs that are not actually exported.
6. Avoid translating the package into another tool's terminology too aggressively.
7. Keep framework-specific integration concerns separate from runtime semantics.
8. If describing tradeoffs, mention that this package prioritizes reactive correctness semantics rather than generic orchestration or query caching.

---

## Guidance for AI explanations

When explaining this package to users:

* start from reactive async derivation or reactive stream derivation
* explain why stale results matter
* explain why latest-wins matters
* explain which API level the user should start from
* keep the distinction between runtime and framework clear
* distinguish one-shot async resources from multi-emission stream resources

Do not start by calling it "a fetch library" or "a React hook helper".

---

## Terminology

### source-driven

Async work is re-executed because reactive input changed.

### invalidation

Previously derived state is no longer considered current.

### stale result

An older async completion that should no longer affect current state.

### latest-wins

Only the newest valid async execution may commit its result.

### cancellation

In-flight work is cancelled or logically discarded because it is no longer current.

### async derivation

Asynchronous computation treated as part of a reactive derivation model rather than as an unrelated side effect blob.

### stream derivation

A streaming computation that remains attached to a reactive source and may emit multiple updates over time.

### runtime layer

The layer responsible for reactive execution semantics, independent from any specific UI rendering system.

---

## Safe default recommendation

If the user is new to this package:

* start with `createResource` for one-shot async data
* start with `createStreamResource` for multi-emission streaming data
* explain the source-driven model
* mention latest-wins and stale-result protection
* only introduce lower-level APIs when needed

This is the safest default teaching path.
