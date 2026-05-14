<p align="center">
  <img src="https://github.com/Luciano0322/signal-kernel/blob/main/assets/brands/adapter-react-icon" alt="adapter react logo" width="120" />
</p>
<h1 align="center">@signal-kernel/react</h1>

---

React lifecycle adapter for `signal-kernel`.

This package lets React components observe existing `@signal-kernel/core` graph values without moving graph ownership into React. Core signals, computed values, effects, batching, and invalidation semantics remain owned by `@signal-kernel/core`; React only subscribes and renders snapshots.

## Install

```sh
pnpm add @signal-kernel/react @signal-kernel/core @signal-kernel/async-runtime
```

`react` and `react-dom` are peer dependencies and are expected to already exist in the React application.

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
import { computed, signal } from "@signal-kernel/core";
import { useReactive } from "@signal-kernel/react";

const count = signal(1);
const doubled = computed(() => count.get() * 2);
const status = signal("idle");

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
import { signal } from "@signal-kernel/core";
import { createResource } from "@signal-kernel/async-runtime";
import { useResource } from "@signal-kernel/react";

const userId = signal("1");

const userResource = createResource(
  userId.get,
  async (id, ctx) => {
    const response = await fetch(`/api/users/${id}`, {
      signal: ctx.signal,
    });

    return response.json() as Promise<{ name: string }>;
  },
);

function UserView() {
  const [user, meta] = useResource(userResource);

  if (meta.status() === "pending") return <div>Loading...</div>;
  if (meta.status() === "error") return <div>{String(meta.error())}</div>;

  return <div>{user?.name}</div>;
}
```

The async hooks consume resource tuples created by `@signal-kernel/async-runtime`. They observe resource value and metadata getters so metadata-only transitions can re-render React. They do not add caching, retry, cancellation, or Suspense policy.

## Boundary

Use React event handlers to write to graph values. Use `computed()` for graph derivation. Use React `useEffect()` for imperative component lifecycle work such as DOM APIs, browser subscriptions, focus management, and third-party widgets.
