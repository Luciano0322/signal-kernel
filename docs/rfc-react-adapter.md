# RFC: `@signal-kernel/react` Adapter

## Problem Statement

`signal-kernel` provides a framework-agnostic reactive runtime, but React users lack a first-party adapter that exposes the graph to components without changing core semantics. The adapter should make it easy to consume signals/computed/resources in React while preserving runtime ownership and deterministic propagation.

## Goals

- Provide a minimal, idiomatic React adapter for reading `signal-kernel` values in components.
- Preserve core/async semantics: invalidation, latest-wins, and cancellation stay in the runtime.
- Keep the adapter thin and non-opinionated about app architecture.
- Avoid re-implementing runtime behavior inside React.

## Non-Goals

- Introducing new caching, retry, or query policies.
- Framework-specific side-effect semantics that override runtime rules.
- Replacing core/async runtime APIs with React-only abstractions.
- Suspense-first or React-specific scheduling semantics.

## Design Principles

- Core owns the graph; async runtime owns async correctness; adapters only bridge lifecycles.
- Minimal surface area: start with the smallest API that solves real integration needs.
- Subscription-driven rendering: React should re-render on graph updates, not own the graph.

## Proposed API (Minimal)

### 1. `useSignal(signal)`

Purpose: read a signal and re-render on changes.

Signature (conceptual):

```
useSignal<T>(sig: { get(): T; subscribe(node): () => void }): T
```

### 2. `useComputed(computed)`

Purpose: read a computed value and re-render on invalidation.

Signature (conceptual):

```
useComputed<T>(c: { get(): T; subscribe(node): () => void }): T
```

### 3. `useResource(resourceTuple)`

Purpose: read `createResource` value + meta in React while keeping async semantics in the runtime.

Signature (conceptual):

```
useResource<T, E>(resource: [() => T | undefined, AsyncMeta<E>]): [T | undefined, AsyncMeta<E>]
```

### 4. `useStreamResource(resourceTuple)`

Purpose: read `createStreamResource` value + meta in React.

Signature (conceptual):

```
useStreamResource<T, E>(resource: [() => T | undefined, StreamAsyncMeta<E, T>]): [T | undefined, StreamAsyncMeta<E, T>]
```

These are minimal wrappers over existing primitives. No new semantics are introduced.

## Implementation Notes

- Use `useSyncExternalStore` (or a lightweight equivalent) for subscription-based updates.
- The adapter should subscribe to a node and force re-render when the node signals change.
- Cleanup on unmount should only unsubscribe from the node; it should not cancel async work automatically unless explicitly requested by the user through runtime APIs.

## Package Layout

```
packages/
  react/
    src/
      index.ts
      useSignal.ts
      useComputed.ts
      useResource.ts
      useStreamResource.ts
    package.json
    tsconfig.json
    README.md
```

## Compatibility

- Peer dependency on `react` and `react-dom` (React 18+).
- Regular dependency on `@signal-kernel/core`.
- Optional dependency on `@signal-kernel/async-runtime` for resource helpers.

## Examples

Examples should be framework-minimal and focus on runtime semantics:

- Reading a signal in a component.
- Derived computed values.
- Source-driven async resource.
- Stream resource with interruption policy.

## Open Questions

- Should `useResource`/`useStreamResource` live in the adapter or be provided as a separate helper package?
- Do we want optional `useEffect` wrappers, or keep effects exclusively in core/async runtime?

## Decision

Start with the minimal API surface above. Expand only after real usage exposes gaps.
