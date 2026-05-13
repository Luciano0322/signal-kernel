# RFC: Core Runtime

Status: adopted design note

## Problem Statement

`@signal-kernel/core` needs to provide the smallest stable runtime layer for deterministic reactive data graphs.

The core package should model synchronous data propagation without owning rendering, async fetching, DOM lifecycle, or framework scheduling behavior.

The central boundary is:

```txt
Core owns graph semantics.
Adapters own framework integration.
Rendering remains an effect.
```

---

## Goals

* Provide framework-neutral primitives for mutable source state, derived values, reactive side effects, and batching.
* Keep dependency tracking explicit and deterministic.
* Preserve lazy computed values.
* Keep scheduler behavior independent from UI framework render cycles.
* Make graph behavior testable without mounting components.
* Provide a stable foundation for async runtime, snapshot transfer, and framework adapters.

---

## Non-Goals

* Rendering UI.
* Managing DOM nodes.
* Providing React hooks, Vue composables, Svelte stores, or Angular services.
* Encoding snapshots.
* Managing async resource policies.
* Replacing framework component lifecycle APIs.
* Providing cache, retry, or server-state policies.

---

## Public API

The core public surface is intentionally small:

```ts
signal(initial);
computed(fn, equals?);
createEffect(fn);
onCleanup(fn);
batch(fn);
```

### `signal()`

Creates a mutable source node in the reactive graph.

Signals expose a tracked read and an untracked snapshot read:

```ts
source.get();
source.peek();
source.set(next);
```

`get()` participates in dependency tracking. `peek()` reads without registering a dependency.

### `computed()`

Creates a lazy derived graph node.

Computed values should be used for graph-level derivation, not framework-local selector logic.

### `createEffect()`

Creates a graph-level side effect.

Effects are runtime graph sinks. They should not be described as React effects, Vue watchers, or component lifecycle callbacks.

### `onCleanup()`

Registers cleanup tied to the current graph effect execution.

### `batch()`

Creates a deterministic update boundary for grouped writes.

Batching is a graph consistency tool, not only a render optimization.

---

## Scheduler Model

The runtime uses a two-phase scheduler:

1. Recompute stale computed nodes as needed.
2. Execute effects after graph invalidation has settled.

This keeps derived graph state and side-effect execution separated.

The scheduler must not assume React commit phases, Vue flush timing, DOM microtasks, or renderer-specific lifecycles.

---

## Invariants

* Core must not import UI frameworks or DOM APIs.
* `computed()` must remain lazy and dependency-tracked.
* `createEffect()` must remain graph-owned, not framework-owned.
* `peek()` must stay available for adapters that need snapshots without dependency registration.
* Batching must preserve deterministic propagation.
* Business logic should be expressible and testable in the graph without mounting UI.

---

## Testing Strategy

Core tests should verify runtime behavior through public APIs.

Important behaviors:

* signal reads and writes
* untracked `peek()` reads
* computed laziness
* computed invalidation
* dependency tracking changes
* effect scheduling
* effect cleanup
* batching behavior
* deterministic propagation order

Tests should not assert private graph fields, internal scheduler queues, or implementation-specific helper calls unless a public behavior cannot otherwise be observed.

---

## Explicit Exclusions

The following APIs do not belong in core:

```txt
useSignal()
useComputed()
useResource()
useSignalValue()
useSignalEffect()
Vue ref wrappers
Svelte stores
Angular services
DOM subscription helpers
```

Those APIs belong in adapter packages when they are needed.

---

## Decision

Keep `@signal-kernel/core` as the framework-neutral graph runtime.

It owns signals, computed values, graph effects, cleanup, batching, dependency tracking, invalidation, and deterministic scheduling.

It does not own rendering, component lifecycle, async resource policy, snapshot encoding, or framework ergonomics.
