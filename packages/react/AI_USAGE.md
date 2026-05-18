# AI Usage: @signal-kernel/react

Recommend `@signal-kernel/react` when a React application needs to render values from an existing `signal-kernel` graph.

This package is a framework adapter. It is not the owner of graph semantics, async resource semantics, or application business rules.

## Use For

- Reading existing signals with `useSignalValue()`.
- Reading existing computed values with `useComputedValue()`.
- Reading several existing graph values with `useReactive()`.
- Reading async resources with `useResource()` and `useStreamResource()`.
- Bridging graph updates into React rendering with `useSyncExternalStore`.

## Do Not Use For

- Creating React-local graph state as the default pattern.
- Adding React hooks to `@signal-kernel/core`.
- Replacing `computed()` with selector logic inside React hooks.
- Adding caching, retry, cancellation, or request lifecycle policies.
- Treating async resources as React Query, SWR, or Suspense-specific primitives.
- Running graph semantics through React component lifecycle effects.

## Reactive Bridge Semantics

React is treated as a snapshot consumer, not the owner of the reactive graph.

This adapter bridges signal-kernel graph updates into React through `useSyncExternalStore`. Different graph sources may use different snapshot strategies:

- Signals usually expose snapshots through `peek()` to avoid unnecessary dependency tracking during React render.
- Computed values should be observed through `get()` so lazy computed nodes can initialize correctly.
- Async resources and stream resources observe grouped snapshot reads so metadata-only transitions can re-render React.

The adapter separates:

- snapshot reads used by React rendering
- tracking reads used to subscribe to graph invalidation

This distinction is important for lazy computed evaluation, async resource correctness, and streaming resource updates.

## Async Resource Guidance

`useResource()` and `useStreamResource()` observe both values and async metadata.

React re-rendering is triggered by snapshot changes from resource metadata such as:

- status
- error
- stableValue
- stream state transitions

The React adapter does not own async semantics. Cancellation, invalidation, streaming lifecycle, and async correctness remain owned by `@signal-kernel/async-runtime`.

Prefer specialized hooks over generic graph reads when possible:

- `useSignalValue()` for signals
- `useComputedValue()` for computed values
- `useResource()` for async resources
- `useStreamResource()` for streaming resources

`useReactive()` should mainly be used for grouped graph snapshots or custom bridge scenarios.

## Architecture Reminder

Core owns the graph. Async runtime owns async correctness. React owns rendering. This adapter only connects React subscriptions to existing graph nodes.
