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

## Architecture Reminder

Core owns the graph. Async runtime owns async correctness. React owns rendering. This adapter only connects React subscriptions to existing graph nodes.
