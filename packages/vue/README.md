# @signal-kernel/vue

Vue scope adapter for `signal-kernel`.

This package lets Vue components and composables observe existing `@signal-kernel/core` graph values without moving graph ownership into Vue. Core signals, computed values, effects, batching, and invalidation semantics remain owned by `@signal-kernel/core`; Vue only receives readonly ref snapshots.

## Install

```sh
pnpm add @signal-kernel/vue @signal-kernel/core vue
```

Async helpers expect `@signal-kernel/async-runtime` to be installed by applications that use resources.

## Core Bridge

```ts
import { computed, signal } from "@signal-kernel/core";
import { useComputedValue, useSignalValue } from "@signal-kernel/vue";

const count = signal(0);
const doubled = computed(() => count.get() * 2);

export function useCounter() {
  const value = useSignalValue(count);
  const label = useComputedValue(doubled);

  function increment() {
    count.set(count.peek() + 1);
  }

  return { value, label, increment };
}
```

## Reading Multiple Values

Use `useReactive()` to read an existing reactive scope from Vue. Derived graph logic should still live in `computed()` or other runtime primitives.

```ts
import { useReactive } from "@signal-kernel/vue";

export function useDashboard() {
  return useReactive(() => ({
    count: count.get(),
    doubled: doubled.get(),
    status: status.get(),
  }));
}
```

## Async Bridge

```ts
import { useResource } from "@signal-kernel/vue";

export function useUserView() {
  const user = useResource(userResource);

  return {
    value: user.value,
    status: user.status,
    error: user.error,
    reload: user.reload,
    cancel: user.cancel,
  };
}
```

Resource helpers observe value and metadata getters so metadata-only transitions update Vue refs. They do not add caching, retry, cancellation, or Suspense policy.

## Boundary

Use Vue event handlers or composable actions to write to graph values. Use `computed()` for graph derivation. Use Vue lifecycle APIs for imperative component lifecycle work such as DOM APIs, browser subscriptions, focus management, and third-party widgets.
