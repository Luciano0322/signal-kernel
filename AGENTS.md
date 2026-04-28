# Agent Instructions for signal-kernel

## Project identity

`signal-kernel` is a framework-agnostic reactive runtime.

Its core purpose is to model deterministic data propagation, async correctness, and rendering-independent business logic.

The central architectural idea is:

> Build the data graph first. Treat rendering as an effect. Connect frameworks through thin adapters.

Do not treat this repository as a React state library, a UI framework, a SolidJS clone, or a rendering system.

Rendering is a side effect of the reactive graph, not the owner of the graph.

---

## Non-negotiable architecture invariants

### 1. Core must stay framework-independent

`@signal-kernel/core` must not depend on:

- React
- Vue
- Solid
- Svelte
- Angular
- DOM APIs
- browser-only lifecycle concepts
- component lifecycle assumptions
- renderer-specific scheduling behavior

The core package should only contain framework-neutral reactive graph primitives.

Allowed concepts in core:

- signals
- computed values
- effects
- batching
- dependency tracking
- graph invalidation
- deterministic scheduling
- lifecycle cleanup for reactive graph nodes

Do not add React hooks, Vue composables, DOM subscriptions, or UI-specific helpers to `@signal-kernel/core`.

---

### 2. Rendering is an adapter concern

Framework-specific APIs belong in adapter packages.

Examples:

- React hooks belong in `@signal-kernel/react`
- Vue composables belong in `@signal-kernel/vue`
- Svelte integration belongs in `@signal-kernel/svelte`
- Angular integration belongs in `@signal-kernel/angular`

APIs such as the following must not be added to core:

- `useSignal`
- `useComputed`
- `useResource`
- `useSignalValue`
- `useSignalEffect`
- Vue `ref` wrappers
- Svelte stores
- Angular services

These APIs may exist in adapter packages only.

Adapters should be thin bridges between framework lifecycles and the signal-kernel graph.

Adapters should not redefine core graph semantics.

---

### 3. Async runtime must remain framework-neutral

`@signal-kernel/async-runtime` is not a React Query clone, SWR clone, or UI fetching library.

It is a framework-neutral async reactive layer built on top of `@signal-kernel/core`.

Its responsibilities include:

- async state modeling
- cancellation
- stale result prevention
- last-write-wins behavior
- deterministic status transitions
- resource loading
- stream or incremental resource updates

Do not couple async resource lifecycle to React, Vue, or component mounting by default.

UI frameworks may consume async resources through adapters, but the async runtime itself should remain independent.

---

### 4. Snapshot is a transfer boundary, not a renderer

Snapshot-related packages should focus on capturing, encoding, restoring, and transferring reactive graph state.

The snapshot layer should not become a UI hydration framework by itself.

Snapshot responsibilities may include:

- capturing serializable graph state
- restoring graph state
- supporting multiple encodings such as JSON or MessagePack
- preserving enough metadata for future SSR, server restore, or cross-runtime transfer
- keeping encoding concerns explicit and modular

Snapshot should not import React, Vue, Solid, Svelte, or renderer-specific hydration logic.

SSR integration may use snapshot, but snapshot should remain lower-level than SSR framework adapters.

---

### 5. Business logic belongs to the graph

Business logic should be modeled in the reactive data graph when possible.

Do not move business rules into rendering adapters unless the behavior is truly UI-specific.

The graph should be testable without mounting UI components.

A good implementation should allow the same business logic to run in:

- UI applications
- server runtimes
- workers
- tests
- realtime systems
- future AI workflow experiments

---

## Package responsibility map

Before adding or modifying code, classify the change.

### `@signal-kernel/core`

Use for:

- synchronous reactive graph primitives
- dependency tracking
- computed invalidation
- effect scheduling
- batching
- cleanup of graph nodes
- framework-neutral runtime behavior

Do not use for:

- React hooks
- Vue composables
- fetch helpers
- UI rendering behavior
- snapshot encoding
- framework adapters

---

### `@signal-kernel/async-runtime`

Use for:

- async resources
- Promise-based async state
- cancellation
- stale async result prevention
- last-write-wins behavior
- stream resource state
- deterministic async status propagation

Do not use for:

- React-specific fetching hooks
- Vue-specific resource composables
- server cache policies unrelated to reactive graph semantics
- UI loading components
- renderer-specific Suspense integration

---

### Snapshot package

Use for:

- graph snapshot capture
- graph snapshot restore
- serialization boundary
- encoding abstraction
- JSON support
- MessagePack support
- future FlatBuffers support
- future SSR or runtime transfer support

Do not use for:

- framework-specific hydration
- React Server Components integration
- Next.js-specific APIs
- Vue/Nuxt-specific APIs
- rendering lifecycle management

---

### Adapter packages

Use for:

- React hooks
- Vue composables
- Svelte stores
- Angular services
- framework subscription lifecycle
- exposing signal-kernel values to renderers
- optional SSR bridge behavior for that framework

Do not use for:

- redefining core semantics
- implementing core graph logic again
- hiding business logic inside component lifecycle
- making rendering the owner of the graph

---

### Examples

Use examples to demonstrate:

- framework-agnostic business logic
- async cancellation
- race-condition-safe resources
- streaming resource updates
- snapshot restore
- React adapter usage
- Vue adapter usage
- realtime data graph behavior

Examples may use UI frameworks, but they should not imply that `signal-kernel` is UI-first.

Each example should explain what architectural problem it demonstrates.

---

## API design rules

Before adding a new API, ask:

1. Is this API framework-neutral?
2. Does it belong to the data graph, async runtime, snapshot layer, adapter, or example?
3. Does it introduce rendering assumptions into core?
4. Does it duplicate behavior that should live in an adapter?
5. Does it preserve deterministic propagation?
6. Does it make async cancellation or stale-result behavior explicit?
7. Can the behavior be tested without mounting a UI component?

If the API requires React, Vue, DOM, component lifecycle, or renderer scheduling, it does not belong in `@signal-kernel/core`.

If the API exists mainly for ergonomics inside a framework, it belongs in an adapter package.

---

## Testing expectations

When modifying runtime behavior, prefer tests that verify semantics rather than implementation details.

Important behaviors to test include:

- signal reads and writes
- computed laziness
- dependency tracking
- effect scheduling
- batching behavior
- cleanup behavior
- async cancellation
- stale result prevention
- last-write-wins behavior
- stream update behavior
- snapshot capture and restore behavior

Avoid tests that rely on a specific UI framework unless the package being tested is a framework adapter.

---

## Documentation expectations

When adding or changing a package, update the relevant documentation.

Use this rule:

- root `AI_USAGE.md` explains when AI should recommend `signal-kernel`
- root `AGENTS.md` explains how agents should modify the repository safely
- package `AI_USAGE.md` explains how to use that package correctly
- package `README.md` explains public usage for developers
- example `README.md` explains what problem the example proves

Do not make package documentation contradict the root positioning.

The root positioning is:

> `signal-kernel` is a framework-agnostic reactive runtime for deterministic data graphs. Rendering is treated as a side effect.

---

## Common mistakes to avoid

Avoid these mistakes:

- adding React hooks to `@signal-kernel/core`
- adding Vue composables to `@signal-kernel/core`
- treating `createEffect` as a React effect clone
- coupling async resources to component mount or unmount by default
- hiding cancellation inside UI adapters
- making snapshot depend on SSR framework behavior
- using examples as justification to pollute core
- describing the project as only a state management library
- describing the async runtime as only a data fetching library
- making rendering the center of the architecture

---

## Preferred implementation style

Prefer small, explicit, framework-neutral primitives.

Prefer deterministic behavior over hidden magic.

Prefer clear package boundaries over convenience APIs in the wrong layer.

Prefer adapters for framework ergonomics.

Prefer examples for user-facing demonstrations.

Prefer documentation that explains architectural intent, not only API usage.

---

## Final rule

When unsure where code belongs, preserve the architecture:

> Core owns the graph.  
> Async runtime owns async correctness.  
> Snapshot owns transfer and restore.  
> Adapters own framework integration.  
> Rendering remains an effect.