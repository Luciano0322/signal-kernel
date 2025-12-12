# `@signal-kernel/async-runtime`
### Async primitives built on top of `@signal-kernel/core`
`@signal-kernel/async-runtime` provides a set of high-level utilities for managing asynchronous state using the fine-grained reactive engine from `@signal-kernel/core`.

It exposes three primary capabilities:  
- `fromPromise()` – Converts a function returning a Promise into a reactive async state.  
- `asyncSignal()` – A convenient wrapper exposing both value and metadata (status, error, reload).  
- `createResource()` – A source-driven async state primitive similar to Solid's `createResource`, but built on a deterministic scheduler and cancelation model. 

This package does not depend on any frontend framework.
It can be used in browser apps, server runtimes, CLI tools, or any JS environment.

---

# Installation
```bash
npm install @signal-kernel/core @signal-kernel/async-runtime
```

---

# Overview
This runtime implements a deterministic, cancelable, fine-grained async system that integrates fully with `signal`, `computed`, and `effect`.

Some highlights:  
- Automatic cancellation of outdated async work.  
- Stable `pending → success/error` state transitions.  
- Integration with the core scheduler ensures deterministic execution order.  
- Work is isolated at the async node level (no global fetch manager).  

---

---------------------------------------------------------
# 1. `fromPromise()`
---------------------------------------------------------
### Signature
```ts
fromPromise<T, E = unknown>(
  makePromise: () => Promise<T>,
  options?: FromPromiseOptions
): AsyncSignal<T, E>
```

### What it does
`fromPromise()` turns an async function into an async signal, exposing:  
- `value(): T | undefined`  
- `status(): "idle" | "pending" | "success" | "error"`  
- `error(): E | undefined`  
- `reload()`  
- `cancel(reason?)`  

It internally:  
- Tracks only the latest Promise result (via token matching).  
- Respects cancellation semantics.  
- Integrates with `batch()` from `@signal-kernel/core`.  

### Example
```ts
import { fromPromise } from "@signal-kernel/async-runtime";

const user = fromPromise(async () => {
  const res = await fetch("/api/user");
  return res.json();
});

createEffect(() => {
  console.log("Status:", user.status());
  console.log("Value:", user.value());
});
```

---

---------------------------------------------------------
# 2. `asyncSignal()`
---------------------------------------------------------
### Signature
```ts
asyncSignal<T, E = unknown>(
  makePromise: () => Promise<T>,
  options?: FromPromiseOptions
): [() => T | undefined, AsyncMeta<E>]
```

### What it provides
`asyncSignal()` is a convenience layer on top of fromPromise() that splits output into:  
- value getter  
- meta object containing:  
    - `status()`  
    - `error()`  
    - `reload()`  
    - `cancel(reason?)`  
    - `keepPreviousValueOnPending`  

### Example
```ts
const [user, meta] = asyncSignal(async () => {
  const res = await fetch("/api/user");
  return res.json();
});

createEffect(() => {
  console.log("User:", user());
  console.log("Loading:", meta.status() === "pending");
});
```

---

---------------------------------------------------------
# 3. `createResource()`
---------------------------------------------------------
A source-driven async primitive similar to Solid's `createResource`, but implemented with:  
- deterministic scheduling  
- fine-grained dependency tracking  
- automatic cancellation on source change  

### Signature
```ts
createResource<S, T, E = unknown>(
  source: () => S,
  fetcher: (sourceValue: S) => Promise<T>,
  options?: ResourceOptions
): [() => T | undefined, AsyncMeta<E>]
```

### How it works
- The `source()` function is tracked via `createEffect()`.  
- When `source()` changes:  
    - The previous async work is canceled (`meta.cancel("source-changed")`).  
    - A new fetch begins (`meta.reload()`).  
- On first run, it automatically loads initial data.  
- Values and metadata update reactively.  

### Example
```ts
const id = signal(1);

const [user, meta] = createResource(
  id.get,
  async (id) => {
    const res = await fetch(`/api/user/${id}`);
    return res.json();
  }
);

createEffect(() => {
  console.log("User:", user());
  console.log("Status:", meta.status());
});

// Changing source triggers new fetch
id.set(2);
```

### Key features
- Cancel old requests automatically.  
- Works perfectly with fine-grained reactivity in the core runtime.  
- Fully deterministic, thanks to the two-phase scheduler.  

---

---------------------------------------------------------
# 4. Types
---------------------------------------------------------
The package exports the async-related types:  
- `AsyncStatus`  
- `AsyncSignal<T, E>`  
- `AsyncMeta<E>`  
- `FromPromiseOptions`  
- `ResourceOptions`  

These allow you to annotate higher-level abstractions or build your own async primitives.

---

---------------------------------------------------------
# 5. Relationship to `@signal-kernel/core`
---------------------------------------------------------
This package requires `@signal-kernel/core` because:  
- Async values are stored in signals.  
- Status/error/value transitions rely on `batch()`.  
- Integration with the scheduler ensures effects run deterministically.  
- Dependency tracking (`createEffect`) keeps async flows reactive and incremental.  

`@signal-kernel/async-runtime` does not introduce scheduling or graph logic—
it simply builds async capabilities on top of the stable core runtime.  

---

---------------------------------------------------------
# 6. Design Philosophy
---------------------------------------------------------
Unlike global async managers or framework-specific query libraries, this runtime:  
✔ Treats async values as data, not components  
✔ Avoids global caches or keyed registries  
✔ Keeps each async node isolated and deterministic  
✔ Enables composition with computed/effect  
✔ Allows future extensions (e.g., streaming, server resources, async graphs)  

It is intentionally minimal while remaining robust enough to serve as a foundation for meta-frameworks.  

---

# Summary
`@signal-kernel/async-runtime` is a fine-grained, deterministic, cancelable async layer designed to pair with `@signal-kernel/core`.  

It enables:  
- Promise-based reactive state  
- Source-driven async resources  
- Clear status/error handling  
- Automatic cancellation  
- Framework-agnostic integration  

This package provides the essential async building blocks used throughout the Signal Kernel ecosystem.
