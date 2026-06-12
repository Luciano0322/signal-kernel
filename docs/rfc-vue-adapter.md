# RFC: `@signal-kernel/vue` Adapter

Status: adopted initial design

## Problem Statement

`signal-kernel` provides a framework-agnostic reactive runtime, but Vue users need a first-party adapter that lets Vue components observe existing graph values without moving graph ownership into Vue.

The Vue adapter should expose graph snapshots as Vue refs while preserving core runtime semantics, async-runtime semantics, and the thin-adapter boundary.

The adapter is not a Vue reactivity replacement, a query layer, or a scheduler layer. It is a lifecycle bridge between Vue scopes and the `signal-kernel` graph.

---

## Goals

* Provide idiomatic Vue composables for reading existing `signal-kernel` graph values.
* Preserve `@signal-kernel/core` ownership of signals, computed values, effects, batching, and dependency tracking.
* Preserve `@signal-kernel/async-runtime` ownership of cancellation, latest-wins behavior, stale-result protection, status transitions, and stream policy.
* Expose Vue-friendly snapshots through refs.
* Clean up adapter-created subscriptions when the Vue scope is disposed.
* Avoid encouraging Vue component scope as the default place to create graph business logic.

---

## Non-Goals

* Creating Vue-local signal state as the default pattern.
* Adding `useSignal()` as a state factory.
* Adding `useComputed(fn)` as a graph-node factory in the initial release.
* Adding `useSignalEffect()` or `useGraphEffect()`.
* Replacing Vue reactivity.
* Replacing async-runtime with Vue-specific resource semantics.
* Adding cache, retry, refetch, polling, or Suspense policy.
* Automatically cancelling async resources when a component unmounts.

---

## Design Principles

### Core owns the graph

Signals, computed values, graph effects, batching, invalidation, and scheduling remain owned by `@signal-kernel/core`.

Vue should observe the graph and render snapshots. Vue should not become the owner of graph semantics.

### Async runtime owns async correctness

Resources, stream resources, cancellation, stale-result protection, latest-wins behavior, and status transitions remain owned by `@signal-kernel/async-runtime`.

The Vue adapter must not add its own async lifecycle policy.

### Adapter bridges Vue scopes

The adapter may create a graph subscription for a Vue scope and dispose that subscription with `onScopeDispose()`.

Scope disposal should stop the adapter subscription only. It should not dispose user-created signals, computed values, resources, or streams.

### Prefer existing graph nodes

Derived business logic should be created in the runtime graph first, then read from Vue:

```ts
const doubled = computed(() => count.get() * 2);

const doubledRef = useKernelValue(doubled);
```

The initial adapter should avoid making this the main path:

```ts
const doubledRef = useComputed(() => count.get() * 2);
```

That pattern creates graph nodes inside Vue scope and makes the adapter look like a Vue state library.

---

## Proposed API

### 1. `useKernelValue(src)`

Purpose: expose an existing signal-kernel readable graph value as a readonly Vue ref.

```ts
type Readable<T> = {
  get(): T;
  peek(): T;
};

function useKernelValue<T>(src: Readable<T>): Readonly<Ref<T>>;
```

Example:

```ts
const count = signal(0);
const doubled = computed(() => count.get() * 2);

const countRef = useKernelValue(count);
const doubledRef = useKernelValue(doubled);
```

`useKernelValue()` is the preferred public name for the shared readable bridge.
It intentionally accepts the structural readable protocol rather than only writable signals.

This matters more after snapshot handoff enters the architecture:

```txt
snapshot restores writable graph state
computed graph values recompute from restored state
Vue consumes readable graph values through the adapter
```

If the adapter continues to teach `useSignalValue()` as the primary API, examples such as this become semantically confusing:

```ts
const summary = useSignalValue(kernel.computed.jobSummary);
```

The code is technically valid because computed values are readable graph nodes, but the name suggests that the source must be a signal. `useKernelValue()` describes the actual boundary more accurately: Vue is reading a value from the signal-kernel graph.

`useKernelValue()` should not accept resource or stream resource tuples. Resources and stream resources include async metadata and control surfaces, so they should continue to use `useResource()` and `useStreamResource()`.

Implementation requirements:

* Initialize the ref from `src.peek()`.
* Use `createEffect()` to track `src.get()`.
* Use `shallowRef()` for the Vue snapshot.
* Use `onScopeDispose()` to stop the adapter subscription.
* Do not dispose the source graph node.

Compatibility:

* `useSignalValue()` remains supported as a compatibility alias for readable graph values.
* `useComputedValue()` remains supported as a compatibility alias for computed-readable examples.
* New documentation and examples should prefer `useKernelValue()`.
* Do not remove the older names during this naming refinement.

### 2. `useSignalValue(src)`

Purpose: expose an existing readable graph value as a readonly Vue ref.

```ts
function useSignalValue<T>(src: Readable<T>): Readonly<Ref<T>>;
```

Example:

```ts
const count = signal(0);

const countRef = useSignalValue(count);
```

`useSignalValue()` should delegate to the same implementation as `useKernelValue()`.
It remains useful for existing code and for signal-specific snippets, but it should no longer be the primary API name in new guide material.

### 3. `useComputedValue(src)`

Purpose: expose an existing computed value as a readonly Vue ref.

```ts
function useComputedValue<T>(src: Readable<T>): Readonly<Ref<T>>;
```

`useComputedValue()` should share the same readable bridge as `useKernelValue()`.

This API is still semantically useful, but it should be treated as an ergonomic name rather than a separate graph capability.

When a developer writes:

```ts
const total = useComputedValue(cartTotal);
```

the adapter is not receiving a fundamentally different kind of subscription from:

```ts
const total = useKernelValue(cartTotal);
```

Both calls read the same structural readable protocol:

```ts
get(): T
peek(): T
```

The difference is only what the call site wants to communicate.
`useComputedValue()` tells the reader that the source is expected to be a computed graph node.
`useKernelValue()` tells the reader that Vue is consuming a value owned by signal-kernel, regardless of whether that value is a signal or computed value.

For local component examples, `useComputedValue()` can remain a convenient readability hint.
For examples involving snapshot restore, SSR transfer, graph handoff, or framework-independent business logic, `useKernelValue()` should be preferred because it describes the architectural boundary more accurately.

This keeps the developer-facing mental model flexible without introducing two runtime semantics:

```txt
useKernelValue     canonical readable graph bridge
useSignalValue     compatibility / signal-specific alias
useComputedValue   compatibility / computed-specific alias
```

It should not create a new core computed value from a function in the initial release.

### 4. `useReactive(read)`

Purpose: observe a reactive read scope that may depend on multiple existing graph values.

```ts
function useReactive<T>(read: () => T): Readonly<Ref<T>>;
```

Example:

```ts
const state = useReactive(() => ({
  count: count.get(),
  doubled: doubled.get(),
  status: status.get(),
}));
```

`useReactive()` should read existing graph state. It should not create runtime state, async policies, or derived business rules.

### 5. `useResource(resourceTuple)`

Purpose: expose a `createResource()` tuple as Vue refs while keeping async semantics in `@signal-kernel/async-runtime`.

```ts
function useResource<T, E>(
  resource: [() => T | undefined, AsyncMeta<E, T>]
): {
  value: Readonly<Ref<T | undefined>>;
  status: Readonly<Ref<AsyncStatus>>;
  error: Readonly<Ref<E | undefined>>;
  reload: () => Promise<T | undefined>;
  cancel: (reason?: unknown) => void;
  meta: AsyncMeta<E, T>;
};
```

Implementation requirements:

* Observe the resource value getter.
* Observe `meta.status()`.
* Observe `meta.error()`.
* Preserve `reload()` and `cancel()` as runtime pass-throughs.
* Do not add cache, retry, refetch, or cancellation policy.
* Do not cancel automatically on Vue scope disposal.

### 6. `useStreamResource(resourceTuple)`

Purpose: expose a `createStreamResource()` tuple as Vue refs while keeping stream semantics in `@signal-kernel/async-runtime`.

```ts
function useStreamResource<T, E>(
  resource: [() => T | undefined, StreamAsyncMeta<E, T>]
): {
  value: Readonly<Ref<T | undefined>>;
  stableValue: Readonly<Ref<T | undefined>>;
  status: Readonly<Ref<StreamAsyncStatus>>;
  error: Readonly<Ref<E | undefined>>;
  reload: () => void;
  cancel: (reason?: unknown) => void;
  meta: StreamAsyncMeta<E, T>;
};
```

Implementation requirements:

* Observe the visible stream value getter.
* Observe `meta.stableValue()`.
* Observe `meta.status()`.
* Observe `meta.error()`.
* Preserve `reload()` and `cancel()` as runtime pass-throughs.
* Do not define stream interruption policy in the adapter.

---

## Implementation Notes

### Shared readable bridge

The sync bridge can be built around a small internal helper:

```ts
function useReadableRef<T>(src: Readable<T>): Readonly<Ref<T>> {
  const value = shallowRef(src.peek()) as Ref<T>;

  const stop = createEffect(() => {
    value.value = src.get();
  });

  onScopeDispose(stop);

  return readonly(value);
}
```

This keeps Vue as a snapshot consumer. The dependency tracking still belongs to `signal-kernel`.

### Reactive scope bridge

`useReactive()` can use the same subscription idea, but the read function itself is the tracked runtime scope:

```ts
function useReactive<T>(read: () => T): Readonly<Ref<T>> {
  const value = shallowRef<T>() as Ref<T>;

  const stop = createEffect(() => {
    value.value = read();
  });

  onScopeDispose(stop);

  return readonly(value);
}
```

### Vue ref choice

Use `shallowRef()` rather than deep Vue reactivity.

The signal-kernel graph owns invalidation. Vue should not deeply proxy graph values or reinterpret their structure.

### Scope disposal

Use `onScopeDispose()` instead of only `onUnmounted()`.

This supports component scopes and composable effect scopes.

---

## Testing Strategy

The adapter should be developed with vertical red-green-refactor cycles.

Do not write the complete test matrix first. Add one public behavior test, make it fail, write the smallest implementation that passes, then continue.

Tests should verify public adapter behavior, not internals.

### TDD tracer bullets for naming refinement

The `useKernelValue()` naming refinement should be implemented with vertical slices, not a broad rewrite.

Recommended red-green-refactor order:

1. Add one failing public test showing `useKernelValue(signal)` exposes the initial `peek()` snapshot and updates after signal writes.
2. Add the minimal implementation by delegating to the shared readable bridge.
3. Add one failing public test showing `useKernelValue(computed)` reads recomputed graph values after a dependency changes.
4. Keep `useSignalValue()` and `useComputedValue()` passing as compatibility aliases.
5. Add or update one example or README snippet to use `useKernelValue()`.

Do not change resource hooks in the same first cycle.

### `useKernelValue()`

* Initial ref value comes from `peek()`.
* Updating a source signal updates the Vue ref.
* Existing computed values can be read as Vue refs.
* Dependency changes update computed Vue refs.
* Disposing the Vue scope stops future ref updates.
* Disposing the Vue scope does not dispose the source graph node.

### `useSignalValue()`

* Initial ref value comes from `peek()`.
* Updating the source signal updates the Vue ref.
* Disposing the Vue scope stops future ref updates.
* Disposing the Vue scope does not dispose the source signal.
* Remains a compatibility alias for `useKernelValue()`.

### `useComputedValue()`

* Existing computed values can be read as Vue refs.
* Dependency changes update the Vue ref.
* The adapter does not create a new computed value from a function.
* Remains a compatibility alias for `useKernelValue()`.

### `useReactive()`

* Multiple existing graph reads can be observed together.
* Updating any dependency refreshes the snapshot.
* Disposal stops the adapter subscription.

### `useResource()`

* Resource value changes update `value`.
* `status()` changes update `status`.
* `error()` changes update `error`.
* Metadata-only transitions update Vue refs even if the value is unchanged.
* Vue scope disposal does not call `meta.cancel()`.

### `useStreamResource()`

* Visible stream value changes update `value`.
* Stable committed value changes update `stableValue`.
* `status()` changes update `status`.
* `error()` changes update `error`.
* Metadata-only transitions update Vue refs.
* Vue scope disposal does not call `meta.cancel()`.

---

## Why No Effect Wrapper

The initial Vue adapter intentionally excludes:

```txt
useSignalEffect()
useGraphEffect()
useEffect()
```

Vue lifecycle effects and signal-kernel graph effects are different concepts.

Vue effects belong to component lifecycle, DOM integration, browser subscriptions, and imperative UI work.

Signal-kernel `createEffect()` belongs to graph-level side effects.

Providing a Vue-specific graph effect wrapper too early would encourage business logic to move into component scope and would blur scheduler ownership. It would also create expectations about mount timing, cleanup timing, flush timing, async cancellation, and renderer scheduling.

If a component-scoped graph effect is truly needed, users can explicitly create it inside Vue lifecycle code and dispose it with `onScopeDispose()`.

That remains an escape hatch, not the main adapter API.

---

## Initial Release Scope

Included:

* `useKernelValue()`
* `useSignalValue()`
* `useComputedValue()`
* `useReactive()`
* `useResource()`
* `useStreamResource()`

Excluded:

* `useSignal()`
* `useComputed(fn)`
* `useSignalRef(fn)` as a graph-node factory
* `useSignalEffect()`
* `useGraphEffect()`
* Suspense-first resource APIs
* adapter-owned async policies

---

## Decision

Start with a minimal Vue scope bridge over existing signal-kernel graph nodes.

Expose snapshots as Vue refs because that is the idiomatic Vue consumption unit.

New guide material should present `useKernelValue()` as the primary way to read a single signal-kernel readable graph value from Vue.

This is a naming-policy decision, not a behavior split. `useSignalValue()` and `useComputedValue()` remain available for compatibility, for older examples, and for call sites that want a signal-specific or computed-specific readability cue. They should be treated as names over the same readable bridge rather than distinct graph semantics.

Do not make `useComputedValue()` more powerful than `useKernelValue()`. If a value can be read through `useComputedValue()`, it should also be readable through `useKernelValue()` as long as it satisfies the same `get()` / `peek()` readable protocol.

Keep graph semantics in core, async semantics in async-runtime, and Vue rendering integration in the adapter.
