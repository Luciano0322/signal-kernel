# @signal-kernel/react

React lifecycle adapter for `signal-kernel`.

This package lets React components observe existing `@signal-kernel/core` graph values without moving graph ownership into React. Core signals, computed values, effects, batching, and invalidation semantics remain owned by `@signal-kernel/core`; React only subscribes and renders snapshots.

## Install

```sh
pnpm add @signal-kernel/react @signal-kernel/core react react-dom
```

Async helpers are exported from `@signal-kernel/react` and expect `@signal-kernel/async-runtime` to be installed by applications that use resources.

## Core Bridge

```tsx
import { computed, signal } from "@signal-kernel/core";
import { useComputedValue, useSignalValue } from "@signal-kernel/react";

const count = signal(0);
const doubled = computed(() => count.get() * 2);

export function Counter() {
  const value = useSignalValue(count);
  const label = useComputedValue(doubled);

  return (
    <button onClick={() => count.set(value + 1)}>
      Count: {value}, doubled: {label}
    </button>
  );
}
```

## Reading Multiple Values

Use `useReactive()` to read an existing reactive scope from React. Derived graph logic should still live in `computed()` or other runtime primitives.

```tsx
import { useReactive } from "@signal-kernel/react";

function Dashboard() {
  const state = useReactive(() => ({
    count: count.get(),
    doubled: doubled.get(),
    status: status.get(),
  }));

  return <div>{state.doubled}</div>;
}
```

## Async Bridge

```tsx
import { useResource } from "@signal-kernel/react";

function UserView() {
  const [user, meta] = useResource(userResource);

  if (meta.status() === "pending") return <div>Loading...</div>;
  if (meta.status() === "error") return <div>{String(meta.error())}</div>;

  return <div>{user?.name}</div>;
}
```

The async hooks observe resource value and metadata getters so metadata-only transitions can re-render React. They do not add caching, retry, cancellation, or Suspense policy.

## Boundary

Use React event handlers to write to graph values. Use `computed()` for graph derivation. Use React `useEffect()` for imperative component lifecycle work such as DOM APIs, browser subscriptions, focus management, and third-party widgets.
