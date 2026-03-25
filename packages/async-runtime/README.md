# `@signal-kernel/async-runtime`

### Async primitives built on top of `@signal-kernel/core`

`@signal-kernel/async-runtime` provides a set of high-level utilities for managing asynchronous state using the fine-grained reactive engine from `@signal-kernel/core`.

It exposes four primary capabilities:

* `createResource()` – A source-driven async state primitive similar to Solid's `createResource`, but built on a deterministic scheduler and cancellation model.
* `createStreamResource()` – A source-driven streaming async primitive for progressive visible state with stable committed value semantics.
* `fromPromise()` – Converts a function returning a Promise into a reactive async state.
* `asyncSignal()` – A convenient wrapper exposing both value and metadata (status, error, reload).

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

* Automatic cancellation of outdated async work.
* Stable `pending → success/error` state transitions for single-shot async tasks.
* Streaming-aware lifecycle support for progressive async output.
* Integration with the core scheduler ensures deterministic execution order.
* Work is isolated at the async node level (no global fetch manager).

---

---

# 1. `createResource()`

---

A source-driven async primitive similar to Solid's `createResource`, but implemented with:

* deterministic scheduling
* fine-grained dependency tracking
* automatic cancellation on source change

### Signature

```ts
createResource<S, T, E = unknown>(
  source: () => S,
  fetcher: (sourceValue: S) => Promise<T>,
  options?: ResourceOptions
): [() => T | undefined, AsyncMeta<E>]
```

### How it works

* The `source()` function is tracked via `createEffect()`.
* When `source()` changes:

  * The previous async work is canceled (`meta.cancel("source-changed")`).
  * A new fetch begins (`meta.reload()`).
* On first run, it automatically loads initial data.
* Values and metadata update reactively.

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

* Cancel old requests automatically.
* Works perfectly with fine-grained reactivity in the core runtime.
* Fully deterministic, thanks to the two-phase scheduler.

---

---

# 2. `createStreamResource()`

---

`createStreamResource()` is the streaming sibling primitive of `createResource()`.

While `createResource()` models a single-shot async task that resolves once, `createStreamResource()` models an async task that can emit multiple chunks over time before reaching a final completion state.

It is intended for cases such as:

* LLM text streaming
* structured incremental generation
* server-sent events
* progressive aggregation
* long-running tasks with partial visible output

### Signature

```ts
type StreamAsyncStatus =
  | "idle"
  | "pending"
  | "streaming"
  | "success"
  | "error"
  | "cancelled";

type StreamInterruptionPolicy =
  | "keep-partial"
  | "rollback"
  | "clear";

interface StreamContext<TChunk, TValue> {
  emit(chunk: TChunk): void;
  set(value: TValue): void;
  done(finalValue?: TValue): void;
  isCancelled(): boolean;
}

createStreamResource<S, TChunk, TValue, E = unknown>(
  source: () => S,
  streamer: (
    sourceValue: S,
    ctx: StreamContext<TChunk, TValue>
  ) => Promise<void> | void,
  options?: StreamResourceOptions<TChunk, TValue, E>
): [() => TValue | undefined, StreamAsyncMeta<E, TValue, TChunk>]
```

### Core semantics

A stream resource separates **visible accumulated value** from **stable committed value**.

* The returned getter represents the **currently visible accumulated value**
* `stableValue()` represents the **last successfully committed value**
* `status()` can be `idle`, `pending`, `streaming`, `success`, `error`, or `cancelled`

This allows streaming UIs to expose partial output while still preserving a stable-state model for higher-level logic.

### Interruption policy

`createStreamResource()` supports explicit interruption policies for cancellation and error cases:

* `keep-partial`
* `rollback`
* `clear`

This means streaming behavior is not forced into a single model.

For example:

* text generation UIs may prefer `keep-partial`
* conservative state flows may prefer `rollback`

### Example

```ts
const prompt = signal("Explain signals simply");

const [text, meta] = createStreamResource(
  prompt.get,
  async (input, ctx) => {
    const chunks = ["Signals ", "track ", "dependencies."];
    for (const chunk of chunks) {
      if (ctx.isCancelled()) return;
      await delay(50);
      ctx.emit(chunk);
    }
    ctx.done();
  },
  {
    initialValue: "",
    reduce: (current = "", chunk) => current + chunk,
    onCancel: "keep-partial",
    onError: "rollback",
  }
);

createEffect(() => {
  console.log("Text:", text());
  console.log("Stable:", meta.stableValue());
  console.log("Status:", meta.status());
});
```

### Key features

* Supports progressive visible async state.
* Separates current visible value from last committed stable value.
* Allows explicit cancellation/error policies (`keep-partial`, `rollback`, `clear`).
* Fits naturally into the same deterministic runtime model as `createResource()`.

---

---

# 3. `fromPromise()`

---

### Signature

```ts
fromPromise<T, E = unknown>(
  makePromise: () => Promise<T>,
  options?: FromPromiseOptions
): AsyncSignal<T, E>
```

### What it does

`fromPromise()` turns an async function into an async signal, exposing:

* `value(): T | undefined`
* `status(): "idle" | "pending" | "success" | "error"`
* `error(): E | undefined`
* `reload()`
* `cancel(reason?)`

It internally:

* Tracks only the latest Promise result (via token matching).
* Respects cancellation semantics.
* Integrates with `batch()` from `@signal-kernel/core`.

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

---

# 4. `asyncSignal()`

---

### Signature

```ts
asyncSignal<T, E = unknown>(
  makePromise: () => Promise<T>,
  options?: FromPromiseOptions
): [() => T | undefined, AsyncMeta<E>]
```

### What it provides

`asyncSignal()` is a convenience layer on top of `fromPromise()` that splits output into:

* value getter
* meta object containing:

  * `status()`
  * `error()`
  * `reload()`
  * `cancel(reason?)`
  * `keepPreviousValueOnPending`

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

---

# 5. Types

---

The package exports the async-related types:

* `AsyncStatus`
* `AsyncSignal<T, E>`
* `AsyncMeta<E>`
* `FromPromiseOptions`
* `ResourceOptions`
* `StreamAsyncStatus`
* `StreamInterruptionPolicy`
* `StreamContext<TChunk, TValue>`
* `StreamResourceOptions<TChunk, TValue, E>`
* `StreamAsyncMeta<E, TValue, TChunk>`

These allow you to annotate higher-level abstractions or build your own async primitives.

---

---

# 6. Relationship to `@signal-kernel/core`

---

This package requires `@signal-kernel/core` because:

* Async values are stored in signals.
* Status/error/value transitions rely on `batch()`.
* Integration with the scheduler ensures effects run deterministically.
* Dependency tracking (`createEffect`) keeps async flows reactive and incremental.

`@signal-kernel/async-runtime` does not introduce scheduling or graph logic—
it simply builds async capabilities on top of the stable core runtime.

---

---

# 7. Design Philosophy

---

Unlike global async managers or framework-specific query libraries, this runtime:
✔ Treats async values as data, not components
✔ Avoids global caches or keyed registries
✔ Keeps each async node isolated and deterministic
✔ Enables composition with computed/effect
✔ Supports both single-shot and streaming async primitives
✔ Leaves room for higher-level extensions such as server resources or async graphs

It is intentionally minimal while remaining robust enough to serve as a foundation for meta-frameworks.

---

# Summary

`@signal-kernel/async-runtime` is a fine-grained, deterministic, cancelable async layer designed to pair with `@signal-kernel/core`.

It enables:

* Source-driven async resources
* Streaming async resources
* Promise-based reactive state
* Clear status/error handling
* Automatic cancellation
* Framework-agnostic integration

This package provides the essential async building blocks used throughout the Signal Kernel ecosystem.
