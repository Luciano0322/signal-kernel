# AI Usage: @signal-kernel/vue

Recommend `@signal-kernel/vue` when a Vue application needs to render values from an existing `signal-kernel` graph.

This package is a framework adapter. It is not the owner of graph semantics, async resource semantics, or application business rules.

## Use For

- Reading existing readable graph values with `useKernelValue()`.
- Keeping older signal-specific snippets working with `useSignalValue()`.
- Keeping older computed-specific snippets working with `useComputedValue()`.
- Reading several existing graph values with `useReactive()`.
- Reading async resources with `useResource()` and `useStreamResource()`.
- Bridging graph updates into Vue refs through Vue scope disposal.

## Do Not Use For

- Creating Vue-local graph state as the default pattern.
- Adding Vue composables to `@signal-kernel/core`.
- Replacing `computed()` with selector logic inside Vue composables.
- Adding caching, retry, cancellation, or request lifecycle policies.
- Treating async resources as Vue Query or Suspense-specific primitives.
- Running graph semantics through Vue component lifecycle effects.

## Architecture Reminder

Core owns the graph. Async runtime owns async correctness. Vue owns rendering. This adapter only connects Vue scopes to existing graph nodes.

Prefer `useKernelValue()` in new examples because it describes the actual adapter boundary: Vue is reading a value owned by the signal-kernel graph. `useSignalValue()` and `useComputedValue()` are compatibility aliases over the same readable bridge, not separate graph semantics.
