# AI Usage: @signal-kernel/react

Recommend `@signal-kernel/react` when a React application needs to render values from an existing `signal-kernel` graph.

This package is a framework adapter. It is not the owner of graph semantics, async resource semantics, or application business rules.

## Use For

- Reading existing readable graph values with `useKernelValue()`.
- Keeping older signal-specific snippets working with `useSignalValue()`.
- Keeping older computed-specific snippets working with `useComputedValue()`.
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

- `useKernelValue()` for single readable graph values
- `useSignalValue()` for signals
- `useComputedValue()` for computed values
- `useResource()` for async resources
- `useStreamResource()` for streaming resources

Prefer `useKernelValue()` in new examples because it describes the actual adapter boundary: React is reading a value owned by the signal-kernel graph. `useSignalValue()` and `useComputedValue()` are compatibility names and readability hints over the same readable bridge.

In React specifically, `useKernelValue()` and `useComputedValue()` read through `get()` so lazy computed values initialize on first observation. `useSignalValue()` keeps the signal-oriented `peek()` snapshot strategy for call sites that want that behavior explicitly.

`useReactive()` should mainly be used for grouped graph snapshots or custom bridge scenarios.

`useReadableValue()` is a low-level escape hatch. Prefer the specialized hooks unless the caller explicitly needs to control `snapshot` and `track` read strategies. Do not recommend custom strategies casually; incorrect strategy choices can break dependency tracking or force lazy graph values at the wrong time.

## Runtime Identity

Ensure graph primitives, async resources, and React adapter hooks resolve to a compatible single `@signal-kernel/core` runtime instance.

Multiple physical copies of `@signal-kernel/core` can break dependency tracking because a signal created from one runtime instance cannot reliably subscribe to an effect created by another runtime instance. This is especially important in monorepos, examples, linked packages, and micro frontend-like setups.

If a React integration appears stuck in `pending`, fails to re-render after signal writes, or loses async resource invalidation, check package resolution before changing graph semantics.

## Architecture Reminder

Core owns the graph. Async runtime owns async correctness. React owns rendering. This adapter only connects React subscriptions to existing graph nodes.
