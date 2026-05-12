# RFC: `@signal-kernel/react` Adapter

## Problem Statement

`signal-kernel` provides a framework-agnostic reactive runtime, but React users lack a first-party adapter that allows React components to observe values from the reactive graph without changing core semantics.

The adapter should make it easy to read signals, computed values, resources, and stream resources from React components while preserving runtime ownership, deterministic propagation, and async correctness.

The React adapter is not a state manager, query layer, or scheduling layer. It is a lifecycle bridge between React rendering and the `signal-kernel` reactive graph.

---

## Goals

* Provide a minimal, idiomatic React adapter for reading `signal-kernel` graph values in components.
* Preserve core semantics: dependency tracking, invalidation, batching, and propagation stay in `@signal-kernel/core`.
* Preserve async semantics: latest-wins, cancellation, status transitions, and stream policies stay in `@signal-kernel/async-runtime`.
* Keep the adapter thin and non-opinionated about application architecture.
* Avoid re-implementing runtime behavior inside React.
* Avoid encouraging React-local signal state as the default usage pattern.
* Make the boundary between rendering effects and dataflow effects explicit.

---

## Non-Goals

* Introducing new caching, retry, refetch, or query policies.
* Introducing React-specific async semantics.
* Introducing Suspense-first or React-specific scheduling behavior.
* Replacing core or async-runtime APIs with React-only abstractions.
* Providing React-local state helpers such as `useSignalState()` in the initial release.
* Providing selector APIs that move derived graph logic into React hooks.
* Providing `useEffect`-style wrappers for `createEffect()` in the initial release.
* Routing signal-kernel dataflow through React lifecycle effects.
* Using React effects as the default mechanism for synchronizing graph state.

---

## Design Principles

### Core owns the graph

Signals, computed values, effects, dependency tracking, invalidation, batching, and scheduling remain owned by `@signal-kernel/core`.

React should not own the graph. React should only observe the graph and re-render when the observed values change.

### Async runtime owns async correctness

Resources, stream resources, cancellation, latest-wins behavior, status transitions, and error states remain owned by `@signal-kernel/async-runtime`.

The React adapter must not add its own caching, retry, cancellation, or request lifecycle policy.

### Adapter only bridges lifecycles

The adapter connects React component lifecycles to existing `signal-kernel` graph nodes.

It should subscribe on mount, notify React on graph updates, and unsubscribe on unmount.

Unmounting a React component should not automatically cancel async work unless the user explicitly calls runtime APIs such as `cancel()`.

### Prefer existing graph nodes over local React graph creation

The initial adapter should focus on reading existing signals, computed values, and resources.

Derived state should be created through `computed()` in the runtime graph, then read from React.

```ts
const doubled = computed(() => count.get() * 2);

function Counter() {
  const value = useComputedValue(doubled);
  return <div>{value}</div>;
}
```

The adapter should avoid making this the primary pattern:

```ts
function Counter() {
  const doubled = useComputed(() => count.get() * 2);
}
```

That pattern creates graph nodes inside React component lifecycles and makes the adapter look like a React state library.

### Event-driven writes, graph-driven derivation

React components may write to signals from event handlers such as `onClick`, `onChange`, or `onSubmit`.

These writes are event-driven, not render-effect-driven.

Derived state should be expressed with `computed()` in the signal-kernel graph, not synchronized through React `useEffect()` after rendering.

Async and streaming state should be modeled with `createResource()` and `createStreamResource()`.

React `useEffect()` should be reserved for imperative lifecycle bridges, such as DOM APIs, third-party widgets, focus management, layout measurement, browser subscriptions, or component-scoped external resources.

The intended data flow is:

```txt
event / external input
  -> signal-kernel graph
  -> React adapter
  -> render
```

Not:

```txt
render
  -> React useEffect
  -> synchronize more graph state
```

---

## Proposed API

### 1. `useSignalValue(signal)`

Purpose: read an existing signal-like readable value and re-render when it changes.

```ts
type Readable<T> = {
  get(): T;
  peek(): T;
};

function useSignalValue<T>(src: Readable<T>): T;
```

Example:

```tsx
const count = signal(0);

function Counter() {
  const value = useSignalValue(count);

  return (
    <button onClick={() => count.set(value + 1)}>
      {value}
    </button>
  );
}
```

---

### 2. `useComputedValue(computed)`

Purpose: read an existing computed value and re-render when it is invalidated and its value changes.

```ts
function useComputedValue<T>(src: Readable<T>): T;
```

`useComputedValue` is intentionally a thin wrapper over the same readable subscription mechanism used by `useSignalValue`.

Example:

```tsx
const count = signal(0);
const doubled = computed(() => count.get() * 2);

function Counter() {
  const value = useComputedValue(doubled);

  return <div>{value}</div>;
}
```

---

### 3. `useReactive(read)`

Purpose: read a reactive scope from React when a component needs to observe multiple existing graph values at once.

```ts
function useReactive<T>(read: () => T): T;
```

Example:

```tsx
function UserPanel() {
  const state = useReactive(() => ({
    user: user.get(),
    displayName: displayName.get(),
    isAdmin: isAdmin.get(),
  }));

  return <div>{state.displayName}</div>;
}
```

`useReactive()` should be used as a bridge for reading existing graph state. It should not create new state, computed values, effects, resources, or async policies.

---

### 4. `useResource(resourceTuple)`

Purpose: read a `createResource()` tuple in React while keeping async semantics in the runtime.

```ts
function useResource<T, E>(
  resource: [() => T | undefined, AsyncMeta<E>]
): [T | undefined, AsyncMeta<E>];
```

Example:

```tsx
const userId = signal("1");

const userResource = createResource(
  userId.get,
  async (id) => {
    const res = await fetch(`/api/users/${id}`);
    return res.json();
  }
);

function UserView() {
  const [user, meta] = useResource(userResource);

  if (meta.status() === "pending") {
    return <div>Loading...</div>;
  }

  if (meta.status() === "error") {
    return <div>Failed to load user</div>;
  }

  return <div>{user?.name}</div>;
}
```

Implementation requirement:

`useResource()` must track both the resource value getter and reactive metadata getters that affect rendering.

At minimum, it should observe:

```ts
value();
meta.status();
meta.error();
```

This ensures React re-renders not only when the value changes, but also when async state changes from `idle`, `pending`, `success`, `error`, or `cancelled`.

---

### 5. `useStreamResource(resourceTuple)`

Purpose: read a `createStreamResource()` tuple in React while keeping stream semantics in the runtime.

```ts
function useStreamResource<T, E>(
  resource: [() => T | undefined, StreamAsyncMeta<E, T>]
): [T | undefined, StreamAsyncMeta<E, T>];
```

Example:

```tsx
const streamResource = createStreamResource(
  prompt.get,
  async function* (prompt) {
    // stream implementation
  }
);

function StreamView() {
  const [text, meta] = useStreamResource(streamResource);

  if (meta.status() === "pending") {
    return <div>Streaming...</div>;
  }

  return <pre>{text}</pre>;
}
```

Implementation requirement:

`useStreamResource()` must track the stream value and relevant reactive metadata.

At minimum, it should observe:

```ts
value();
meta.status();
meta.error();
```

If the stream meta exposes additional reactive getters that affect UI rendering, such as partial state, streaming state, or interruption state, the adapter should track those as well.

---

## Implementation Notes

### Use `useSyncExternalStore`

The adapter should use React 18's `useSyncExternalStore` to safely bridge an external reactive graph into React rendering.

The core mechanism is:

1. React subscribes through `useSyncExternalStore`.
2. The adapter creates a `signal-kernel` tracking scope using `createEffect()`.
3. The effect reads the target value with `get()` to register graph dependencies.
4. On subsequent invalidations, the adapter calls React's `notify()`.
5. React re-renders and reads the latest snapshot.

### Reading snapshots

For single readable values, the adapter should prefer `peek()` for the React snapshot read.

```ts
const getSnapshot = () => src.peek();
```

This avoids creating dependency tracking during React render.

`get()` should be used inside the runtime-owned tracking scope.

```ts
const stop = createEffect(() => {
  src.get();
  notify();
});
```

### First-run notification

The subscription effect should avoid notifying React on the first run.

```ts
let first = true;

const stop = createEffect(() => {
  src.get();

  if (first) {
    first = false;
    return;
  }

  notify();
});
```

This prevents the adapter from causing a React update during initial subscription setup.

### Cleanup

The adapter should unsubscribe from the runtime graph on unmount.

Cleanup should only dispose the subscription created by the adapter.

It should not dispose user-created signals, computed values, resources, or stream resources.

It should not cancel async work automatically.

```ts
return () => stop();
```

### Resource metadata tracking

Resource hooks must observe both value and metadata.

This is important because async metadata can change even when the resource value does not.

For example:

```ts
pending -> success
pending -> error
success -> pending with keepPreviousValueOnPending
pending -> cancelled
```

If the adapter only tracks the resource value, React may miss metadata-only updates.

---

## Package Layout

```txt
packages/
  react/
    src/
      index.ts
      readable.ts
      useSignalValue.ts
      useComputedValue.ts
      useReactive.ts
      async.ts
      useResource.ts
      useStreamResource.ts
    package.json
    tsconfig.json
    README.md
```

---

## Exports

### Core React bridge

```ts
import {
  useSignalValue,
  useComputedValue,
  useReactive,
} from "@signal-kernel/react";
```

### Async bridge

```ts
import {
  useResource,
  useStreamResource,
} from "@signal-kernel/react/async";
```

The async helpers should be exposed from a subpath export so users who only need core graph integration do not need to depend directly on async-runtime types.

---

## Dependencies

### Peer dependencies

```json
{
  "peerDependencies": {
    "react": ">=18",
    "react-dom": ">=18"
  }
}
```

### Runtime dependencies

```json
{
  "dependencies": {
    "@signal-kernel/core": "workspace:*"
  }
}
```

### Optional peer dependency

```json
{
  "peerDependencies": {
    "@signal-kernel/async-runtime": "workspace:*"
  },
  "peerDependenciesMeta": {
    "@signal-kernel/async-runtime": {
      "optional": true
    }
  }
}
```

If TypeScript type resolution becomes awkward with optional async-runtime types, async helpers can remain isolated under the `@signal-kernel/react/async` subpath.

---

## Examples

Examples should be framework-minimal and focus on preserving runtime semantics.

### Reading a signal

```tsx
const count = signal(0);

function Counter() {
  const value = useSignalValue(count);

  return (
    <button onClick={() => count.set(value + 1)}>
      Count: {value}
    </button>
  );
}
```

### Reading a computed value

```tsx
const count = signal(0);
const doubled = computed(() => count.get() * 2);

function CounterLabel() {
  const value = useComputedValue(doubled);

  return <div>Doubled: {value}</div>;
}
```

### Reading multiple graph values

```tsx
function Dashboard() {
  const state = useReactive(() => ({
    count: count.get(),
    doubled: doubled.get(),
    status: status.get(),
  }));

  return (
    <div>
      <p>Count: {state.count}</p>
      <p>Doubled: {state.doubled}</p>
      <p>Status: {state.status}</p>
    </div>
  );
}
```

### Reading a source-driven async resource

```tsx
const userId = signal("1");

const userResource = createResource(
  userId.get,
  async (id) => {
    const res = await fetch(`/api/users/${id}`);
    return res.json();
  }
);

function UserView() {
  const [user, meta] = useResource(userResource);

  if (meta.status() === "pending") {
    return <div>Loading...</div>;
  }

  if (meta.status() === "error") {
    return <div>Error: {String(meta.error())}</div>;
  }

  return <div>{user?.name}</div>;
}
```

### Reading a stream resource

```tsx
function AssistantResponse() {
  const [text, meta] = useStreamResource(responseResource);

  if (meta.status() === "pending") {
    return <div>Generating...</div>;
  }

  return <pre>{text}</pre>;
}
```

---

## Open Questions

### 1. Should short names be used?

Possible shorter names:

```ts
useSignal()
useComputed()
```

Potential issue:

`useComputed()` may be confused with an API that creates a computed value inside React.

For the initial version, the more explicit names are safer:

```ts
useSignalValue()
useComputedValue()
```

Shorter names can be introduced later if documentation clearly states that they read existing graph nodes.

### 2. Should `useReactive()` be public?

`useReactive()` is useful for reading multiple graph values and for implementing resource hooks.

However, it is more flexible and easier to misuse than `useSignalValue()`.

If exposed publicly, documentation should emphasize that it reads existing graph state and should not be treated as a local state factory.

### 3. Should resource hooks return snapshots?

Current proposal:

```ts
const [value, meta] = useResource(resource);
```

Alternative React-friendly snapshot API:

```ts
const resource = useResourceSnapshot(userResource);

resource.value;
resource.status;
resource.error;
resource.reload();
resource.cancel();
```

The snapshot API may feel more idiomatic in React, but it adds another abstraction layer over async-runtime.

For the initial release, tuple-preserving APIs are preferred because they stay closer to runtime semantics.

---

## Decision

Start with a minimal React lifecycle bridge:

```ts
useSignalValue()
useComputedValue()
useReactive()
```

Expose async helpers through a subpath:

```txt
@signal-kernel/react/async
```

with:

```ts
useResource()
useStreamResource()
```

The adapter must not introduce caching, retry, cancellation, invalidation, scheduling, or async lifecycle policies.

Those remain owned by:

```txt
@signal-kernel/core
@signal-kernel/async-runtime
```

Future APIs should only be added when they reduce React integration friction without changing runtime semantics.

### Effect wrappers

React-specific wrappers around `createEffect()` are intentionally excluded from the initial release.

Use React `useEffect()` for component lifecycle effects.

Use `signal-kernel` `createEffect()` for graph-level side effects.

If a graph effect must be scoped to a React component, users can create it inside React `useEffect()` and dispose it in cleanup. The adapter does not provide a dedicated helper for this in the initial release because it may blur the boundary between React lifecycle effects and signal-kernel graph effects.

---

## Initial Release Scope

Included:

* `useSignalValue()`
* `useComputedValue()`
* `useReactive()`
* `useResource()`
* `useStreamResource()`

Excluded:

* `useSignalState()`
* `useComputed(fn)`
* `useSignalSelector()`
* React-specific `createEffect()` wrappers such as `useSignalEffect()` or `useGraphEffect()`
* APIs that encourage synchronizing graph state through React `useEffect()`
* Suspense-first resource APIs
* React-owned async lifecycle policies
