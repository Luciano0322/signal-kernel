<p align="center">
  <img src="https://github.com/Luciano0322/signal-kernel/tree/main/assets/brands/core-icon.svg" alt="signal-kernel logo" width="120" />
</p>
<h1 align="center">@signal-kernel/core</h1>
<p align="center">
A minimal, deterministic, fine-grained reactivity engine.
</p>
<p align="center">
  Build reactive systems without frameworks — from UI adapters to async dataflow runtimes.
</p>
<p align="center">
  Think of this as a <b>reactive runtime kernel</b>, not a framework.
</p>

---

## Installation

```bash
npm install @signal-kernel/core
```

---

## Quick Start

```ts
import { signal, computed, createEffect } from "@signal-kernel/core";

const count = signal(0);

const doubled = computed(() => count.get() * 2);

createEffect(() => {
  console.log("doubled =", doubled.get());
});

count.set(1);
count.set(2);
```

Output:

```
doubled = 2
doubled = 4
```

---

## What is this?

`@signal-kernel/core` is a **framework-agnostic reactive runtime**.

It provides the minimal primitives needed to build reactive systems:

* `signal()` — mutable state
* `computed()` — lazy derived values
* `createEffect()` — reactive side effects
* `batch()` — update coalescing
* deterministic scheduler

Unlike frameworks (React, Vue), this library:

* does **not render UI**
* does **not manage DOM**
* focuses purely on **reactive dataflow and execution order**

---

## When to use this

Use `@signal-kernel/core` if you need:

* Fine-grained reactivity (no VDOM diffing)
* Deterministic update ordering
* A foundation for building:

  * UI adapters (React/Vue/Solid)
  * async data pipelines
  * reactive state machines
  * server-side reactive graphs

This is **not a UI framework** — it is a **low-level reactive kernel**.

---

## Core Concepts

### signal()

```ts
const count = signal(0);

count.get();
count.peek();
count.set(1);
```

---

### computed()

```ts
const doubled = computed(() => count.get() * 2);
```

---

### createEffect()

```ts
createEffect(() => {
  console.log(count.get());
});
```

---

### batch()

```ts
batch(() => {
  count.set(1);
  count.set(2);
});
```

---

## Scheduler Model

![Two-phase scheduler](https://github.com/Luciano0322/signal-kernel/tree/main/docs/scheduler.svg)

This runtime uses a **two-phase deterministic scheduler**:

1. Recompute all stale computed nodes
2. Execute all effects

→ Guarantees stable and predictable execution order.

---

## Architecture Overview

![Reactive Graph](https://github.com/Luciano0322/signal-kernel/tree/main/docs/architecture.svg)

For full details, see:

👉 [Architecture Documentation](https://github.com/Luciano0322/signal-kernel/tree/main/docs/architecture.md)

---

## Public API

```ts
export { signal } from "./signal.js";
export { computed } from "./computed.js";
export { createEffect, onCleanup } from "./effect.js";
export { batch } from "./scheduler.js";
```

---

## Design Goals

* Deterministic scheduling
* Lazy computation
* Explicit dependency graph
* Zero framework assumptions
* Adapter-friendly architecture

---

## Ecosystem

`@signal-kernel/core` is the foundation of the Signal Kernel ecosystem.

Future packages:

* async runtime
* framework adapters

---

## License

MIT © Luciano
