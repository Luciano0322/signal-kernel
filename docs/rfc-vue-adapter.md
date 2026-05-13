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

const doubledRef = useComputedValue(doubled);
```

The initial adapter should avoid making this the main path:

```ts
const doubledRef = useComputed(() => count.get() * 2);
```

That pattern creates graph nodes inside Vue scope and makes the adapter look like a Vue state library.

---

## Proposed API

### 1. `useSignalValue(src)`

Purpose: expose an existing readable graph value as a readonly Vue ref.

```ts
type Readable<T> = {
  get(): T;
  peek(): T;
};

function useSignalValue<T>(src: Readable<T>): Readonly<Ref<T>>;
```

Example:

```ts
const count = signal(0);

const countRef = useSignalValue(count);
```

Implementation requirements:

* Initialize the ref from `src.peek()`.
* Use `createEffect()` to track `src.get()`.
* Use `shallowRef()` for the Vue snapshot.
* Use `onScopeDispose()` to stop the adapter subscription.
* Do not dispose the source signal.

### 2. `useComputedValue(src)`

Purpose: expose an existing computed value as a readonly Vue ref.

```ts
function useComputedValue<T>(src: Readable<T>): Readonly<Ref<T>>;
```

`useComputedValue()` should share the same readable bridge as `useSignalValue()`.

It should not create a new core computed value from a function in the initial release.

### 3. `useReactive(read)`

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

### 4. `useResource(resourceTuple)`

Purpose: expose a `createResource()` tuple as Vue refs while keeping async semantics in `@signal-kernel/async-runtime`.

```ts
function useResource<T, E>(
  resource: [() => T | undefined, AsyncMeta<E>]
): {
  value: Readonly<Ref<T | undefined>>;
  status: Readonly<Ref<AsyncStatus>>;
  error: Readonly<Ref<E | undefined>>;
  reload: () => void;
  cancel: (reason?: unknown) => void;
  meta: AsyncMeta<E>;
};
```

Implementation requirements:

* Observe the resource value getter.
* Observe `meta.status()`.
* Observe `meta.error()`.
* Preserve `reload()` and `cancel()` as runtime pass-throughs.
* Do not add cache, retry, refetch, or cancellation policy.
* Do not cancel automatically on Vue scope disposal.

### 5. `useStreamResource(resourceTuple)`

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

### `useSignalValue()`

* Initial ref value comes from `peek()`.
* Updating the source signal updates the Vue ref.
* Disposing the Vue scope stops future ref updates.
* Disposing the Vue scope does not dispose the source signal.

### `useComputedValue()`

* Existing computed values can be read as Vue refs.
* Dependency changes update the Vue ref.
* The adapter does not create a new computed value from a function.

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

Keep graph semantics in core, async semantics in async-runtime, and Vue rendering integration in the adapter.
