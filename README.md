<p align="center">
  <img src="./assets/brands/signal-kernel-icon-transparent.svg" alt="signal-kernel logo" width="120" />
</p>

<h1 align="center">signal-kernel</h1>

<p align="center">
  A framework-agnostic reactive kernel for deterministic sync/async dataflow.
</p>

<p align="center">
  It models async state as part of the reactive graph, with explicit invalidation, cancellation, and controlled propagation.
</p>

---

## What is signal-kernel?

**signal-kernel** is a lightweight, framework-agnostic runtime for fine-grained reactivity.

It starts with a small synchronous reactive core, then extends the same graph model to async state, resource loading, and streaming scenarios.

Instead of treating async behavior as a completely external side effect, signal-kernel brings it back into the runtime graph as a first-class part of dataflow orchestration.

This project is not a framework.
It is the reactive kernel that frameworks and adapters can build on top of.

> ⚠️ signal-kernel is currently in v0.x. APIs may continue to evolve before v1.0.

---

## Current Status

Today, the project includes two usable packages:

* **`@signal-kernel/core`** — the synchronous reactive kernel
* **`@signal-kernel/async-runtime`** — async/runtime primitives built on top of the core

React and Vue adapters are planned next, with a **thin-wrapper approach** that preserves the runtime semantics instead of hiding them behind heavy framework-specific abstractions.

---

## Packages Overview

| Package                            | Description                                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------------------ |
| **@signal-kernel/core**            | Sync reactivity: signals, computed values, effects, dependency graph, scheduler                  |
| **@signal-kernel/async-runtime**   | Async runtime primitives: `fromPromise`, `asyncSignal`, `createResource`, `createStreamResource` |
| *(planned)* `@signal-kernel/react` | Thin React adapter over the core/runtime primitives                                              |
| *(planned)* `@signal-kernel/vue`   | Thin Vue adapter over the core/runtime primitives                                                |

---

## Installation

```bash
npm install @signal-kernel/core @signal-kernel/async-runtime
```

```bash
pnpm add @signal-kernel/core @signal-kernel/async-runtime
```

---

## Why signal-kernel?

### Fine-grained core

The core package provides:

* `signal()`
* `computed()`
* `createEffect()`
* deterministic dependency tracking
* scheduler-driven propagation

### Async as part of the graph

The async runtime builds on top of the same model and provides:

* request/resource state management
* stale result protection
* explicit cancellation
* controlled reload semantics
* streaming resource support

### Framework-agnostic by design

signal-kernel does not depend on a UI renderer.
It is designed to work with:

* React
* Vue
* custom renderers
* server runtimes
* workers / edge environments

Adapters should stay thin. The runtime logic belongs to the kernel.

---

## Core Example

```ts
import { signal, computed, createEffect } from "@signal-kernel/core";

const count = signal(1);
const doubled = computed(() => count.get() * 2);

createEffect(() => {
  console.log("doubled:", doubled.get());
});

count.set(2); // doubled: 4
```

---

## Async Example

```ts
import { signal } from "@signal-kernel/core";
import { createResource } from "@signal-kernel/async-runtime";

const userId = signal(1);

const [user, meta] = createResource(
  () => userId.get(),
  (id) => fetch(`/api/user/${id}`).then((r) => r.json())
);

userId.set(2);
```

Behavior:

* changing `source()` cancels the previous request
* stale async results do not overwrite fresh state
* pending state can preserve the previous value when desired

---

## Stream Example

```ts
import { createStreamResource } from "@signal-kernel/async-runtime";

// Example shape only — adapt to your actual API
const [messages, meta] = createStreamResource(() => {
  const socket = new WebSocket("wss://example.com/messages");

  return {
    subscribe(emit, error, done) {
      socket.onmessage = (event) => emit(JSON.parse(event.data));
      socket.onerror = error;
      socket.onclose = done;

      return () => socket.close();
    },
  };
});
```

Use `createStreamResource()` when the source is not a one-shot Promise,
but an ongoing stream or subscription-like async producer.

---

## Async Runtime Layers

```text
fromPromise()
  ↓
asyncSignal()
  ↓
createResource()
  ↓
createStreamResource()
```

This gives you a progression from one-shot Promise handling
to graph-aware resource loading and stream-driven state updates.

---

## Architecture

```mermaid
flowchart TD

    subgraph SYNC_CORE["Sync Reactive Core"]
        S[signal]
        C[computed]
        E[effect]
        G[dependency graph]
        SCH[scheduler]
    end

    subgraph ASYNC_RUNTIME["Async Runtime"]
        FP[fromPromise]
        AS[asyncSignal]
        RES[createResource]
        STR[createStreamResource]
    end

    P[Promise / fetch / RPC] --> FP
    ST[Stream / socket / subscription] --> STR

    FP --> AS --> RES
    STR --> S

    S --> G --> SCH --> E
    C --> G --> SCH --> E
    RES --> G
```

---

## API Overview

### Core

| API                | Description                                   |
| ------------------ | --------------------------------------------- |
| `signal(initial)`  | Smallest reactive unit                        |
| `computed(fn)`     | Lazy, memoized derived value                  |
| `createEffect(fn)` | Reactive side-effect with dependency tracking |
| `batch(fn)`        | Deterministic update grouping                 |

### Async Runtime

| API                                         | Description                                                            |
| ------------------------------------------- | ---------------------------------------------------------------------- |
| `fromPromise(fetcher, options?)`            | Convert a Promise producer into reactive async state                   |
| `asyncSignal(fetcher, options?)`            | Async operation with status, error, reload, and cancel metadata        |
| `createResource(source, fetcher, options?)` | Source-driven async resource with switchMap-style behavior             |
| `createStreamResource(source, options?)`    | Graph-aware resource for streaming or subscription-style async sources |

---

## Roadmap

Near-term focus:

* stabilize `core` and `async-runtime`
* expand examples and documentation
* add thin adapters for major frontend frameworks
* start with React and Vue
* keep adapters minimal and semantics-preserving

Longer-term exploration:

* SSR / hydration strategy
* devtools / graph inspection
* additional runtime helpers for broader async scenarios

---

## License

MIT

---

## Author

**Luciano**
Exploring fine-grained reactivity and building an async-first runtime kernel.
