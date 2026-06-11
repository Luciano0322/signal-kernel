<p align="center">
  <img src="./assets/brands/signal-kernel-icon-transparent.svg" alt="signal-kernel logo" width="120" />
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@signal-kernel/core"><img alt="@signal-kernel/core" src="https://img.shields.io/npm/v/@signal-kernel/core?label=core"></a>
  <a href="https://www.npmjs.com/package/@signal-kernel/async-runtime"><img alt="@signal-kernel/async-runtime" src="https://img.shields.io/npm/v/@signal-kernel/async-runtime?label=async-runtime"></a>
  <a href="https://www.npmjs.com/package/@signal-kernel/react"><img alt="@signal-kernel/react" src="https://img.shields.io/npm/v/@signal-kernel/react?label=react"></a>
  <a href="https://www.npmjs.com/package/@signal-kernel/vue"><img alt="@signal-kernel/vue" src="https://img.shields.io/npm/v/@signal-kernel/vue?label=vue"></a>
  <a href="https://www.npmjs.com/package/@signal-kernel/snapshot"><img alt="@signal-kernel/snapshot" src="https://img.shields.io/npm/v/@signal-kernel/snapshot?label=snapshot"></a>
</p>

<h1 align="center">signal-kernel</h1>

<p align="center">
  A framework-agnostic reactive kernel for deterministic sync/async dataflow.
</p>

<p align="center">
  Build the data graph first. Treat rendering as an effect. Connect frameworks through thin adapters.
</p>

<p align="center">
  It models async state as part of the reactive graph, with explicit invalidation, cancellation, and controlled propagation.
</p>

---

## What is signal-kernel?

**signal-kernel** is a lightweight, framework-agnostic runtime for fine-grained reactivity.

It starts with a small synchronous reactive core, then extends the same graph model to async state, resource loading, and streaming scenarios.

Instead of treating async behavior as a completely external side effect, signal-kernel brings it back into the runtime graph as a first-class part of dataflow orchestration.

Most frontend frameworks are rendering-centered, but most product requirements are data-centered.

signal-kernel starts from the data graph instead of the rendering layer.

Business logic, derived state, async resources, and invalidation rules can be modeled independently from React, Vue, Solid, Svelte, or any other renderer.

Rendering is only one possible side effect of the graph.

This project is not a framework.
It is the reactive kernel that frameworks and adapters can build on top of.

> Note: signal-kernel is currently in v0.x. APIs may continue to evolve before v1.0.

---

## Current Status

Today, the project includes five published packages:

* **`@signal-kernel/core`** - the synchronous reactive kernel
* **`@signal-kernel/async-runtime`** - async/runtime primitives built on top of core
* **`@signal-kernel/react`** - a thin React lifecycle adapter for reading existing graph values
* **`@signal-kernel/vue`** - a thin Vue scope adapter for reading existing graph values
* **`@signal-kernel/snapshot`** - graph state capture, JSON-safe transfer, compatible restore, diff, and redaction

Framework adapters follow the same **thin-wrapper approach**: preserve runtime semantics instead of hiding them behind heavy framework-specific abstractions.

---

## Packages Overview

| Package                          | npm                                                               | Description                                                                                      |
| -------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **@signal-kernel/core**          | [npm](https://www.npmjs.com/package/@signal-kernel/core)          | Sync reactivity: signals, computed values, effects, dependency graph, scheduler                  |
| **@signal-kernel/async-runtime** | [npm](https://www.npmjs.com/package/@signal-kernel/async-runtime) | Async runtime primitives: `fromPromise`, `asyncSignal`, `createResource`, `createStreamResource` |
| **@signal-kernel/react**         | [npm](https://www.npmjs.com/package/@signal-kernel/react)         | Thin React adapter for reading existing signal-kernel graph values in React                      |
| **@signal-kernel/vue**           | [npm](https://www.npmjs.com/package/@signal-kernel/vue)           | Thin Vue adapter for exposing existing signal-kernel graph values as readonly Vue refs           |
| **@signal-kernel/snapshot**      | [npm](https://www.npmjs.com/package/@signal-kernel/snapshot)      | Graph state capture, JSON-safe transfer, compatible restore, diff, and redaction                 |

---

## Installation

```bash
npm install @signal-kernel/core @signal-kernel/async-runtime
```

```bash
pnpm add @signal-kernel/core @signal-kernel/async-runtime
```

React adapter:

```bash
pnpm add @signal-kernel/react @signal-kernel/core @signal-kernel/async-runtime
```

Vue adapter:

```bash
pnpm add @signal-kernel/vue @signal-kernel/core @signal-kernel/async-runtime
```

Snapshot:

```bash
pnpm add @signal-kernel/snapshot
```

`react`, `react-dom`, and `vue` are peer dependencies of their adapter packages and are expected to already exist in framework applications.

---

## When should you use signal-kernel?

Use signal-kernel when you need:

- framework-agnostic business logic
- deterministic reactive data propagation
- derived state outside UI components
- async state with cancellation and stale result protection
- explicit graph snapshots for transfer, inspection, or compatible restore
- reusable dataflow across React, Vue, server runtimes, workers, or tests
- a thin adapter model where rendering frameworks consume the graph instead of owning it
- business logic that should survive framework migration

Do not use signal-kernel as a simple `useState` replacement.

If your state is purely local to a UI component, the native state model of your framework is probably enough.

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

New async-runtime code should use object form. It keeps reactive input and
async execution explicit, and leaves room for declarative invalidation when a
resource needs to stay consistent with external mutations.

```ts
import { signal } from "@signal-kernel/core";
import { createResource } from "@signal-kernel/async-runtime";

const userId = signal(1);

const [user, meta] = createResource({
  input: userId.get,
  run: async (id, ctx) => {
    const response = await fetch(`/api/user/${id}`, {
      signal: ctx.signal,
    });

    return response.json();
  },
});

userId.set(2);
```

Behavior:

* changing `input()` cancels the previous request
* stale async results do not overwrite fresh state
* pending state can preserve the previous value when desired

### Declarative Invalidation Example

Use `createRevision()` when a manual mutation should cause an auto resource to
reload after success.

```ts
import { createResource, createRevision } from "@signal-kernel/async-runtime";

type User = {
  id: string;
  name: string;
};

const usersRevision = createRevision();

const [users] = createResource({
  observe: () => {
    usersRevision.get();
  },
  run: async (_input, ctx): Promise<User[]> => {
    const response = await fetch("/api/users", {
      signal: ctx.signal,
    });

    return response.json();
  },
});

const [, updateUserMeta] = createResource({
  trigger: "manual",
  run: async (input: { id: string; name: string }, ctx): Promise<User> => {
    const response = await fetch(`/api/users/${input.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: input.name }),
      signal: ctx.signal,
    });

    return response.json();
  },
  invalidates: () => [usersRevision],
});

await updateUserMeta.run({ id: "u1", name: "Alice" });
```

`createKeyedRevision()` provides the same invalidation mechanism per key, which
is useful for detail resources such as `GET /api/users/:id`.

---

## Stream Example

```ts
import { createStreamResource } from "@signal-kernel/async-runtime";

const [text, meta] = createStreamResource({
  input: () => "Explain signals simply",
  stream: async (_prompt, ctx) => {
    for (const chunk of ["Signals ", "track ", "dependencies."]) {
      if (ctx.isCancelled()) return;
      ctx.emit(chunk);
    }

    ctx.done();
  },
  initialValue: "",
  reduce: (current = "", chunk) => current + chunk,
});
```

Use `createStreamResource()` when the source is not a one-shot Promise,
but an ongoing stream or incremental async producer.

### v0.x compatibility note

Older code may still use positional resource forms such as
`createResource(source, fetcher, options?)` or
`createStreamResource(source, streamer, options?)` during the v0.x migration
window. Treat those as compatibility shorthands. New examples and
documentation prefer object form because it scales better to `input`,
`observe`, manual execution, and declarative invalidation.

---

## Async Runtime Layers

```text
fromPromise()
  -> asyncSignal()
  -> createResource()
  -> createStreamResource()
```

This gives you a progression from one-shot Promise handling
to graph-aware resource loading and stream-driven state updates.

---

## Architecture

```mermaid
flowchart TD
    subgraph CORE["Sync Reactive Core"]
        S[signal]
        C[computed]
        E[effect]
        G[dependency graph]
        SCH[scheduler]
    end

    subgraph ASYNC["Async Runtime"]
        FP[fromPromise]
        AS[asyncSignal]
        RES[createResource]
        STR[createStreamResource]
    end

    subgraph ADAPTERS["Thin Framework Adapters"]
        R[React adapter]
        V[Vue adapter]
        O[Other renderers]
    end

    subgraph SNAPSHOT["Snapshot Boundary"]
        CAP[capture]
        ENC[encode / decode]
        REST[restore]
    end

    subgraph EFFECTS["Side Effects"]
        UI[UI rendering]
        LOG[logging]
        IO[IO / network]
        WORKER[worker / server task]
    end

    P[Promise / fetch / RPC] --> FP
    ST[Stream / socket / subscription] --> STR

    FP --> AS --> RES
    STR --> S

    S --> G
    C --> G
    RES --> G
    G --> SCH
    SCH --> E

    E --> LOG
    E --> IO
    E --> WORKER

    G --> SNAPSHOT
    SNAPSHOT --> REST
    REST --> S

    G --> ADAPTERS
    ADAPTERS --> UI
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

| API                                                  | Description                                                            |
| ---------------------------------------------------- | ---------------------------------------------------------------------- |
| `fromPromise(fetcher or { run, ... })`               | Convert a Promise producer into reactive async state                   |
| `asyncSignal(fetcher or { run, ... })`               | Async operation with status, error, reload, and cancel metadata        |
| `createResource({ input?, observe?, run, ... })`     | Source-driven or manual async resource with latest-wins behavior       |
| `createStreamResource({ input?, observe?, stream })` | Graph-aware resource for streaming or subscription-style async sources |
| `createRevision()`                                   | Signal-backed invalidation source for collection or global boundaries  |
| `createKeyedRevision()`                              | Per-key invalidation source for entity/detail boundaries               |

### Framework Adapters

| Package                | APIs                                                                                    | Description                                        |
| ---------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `@signal-kernel/react` | `useSignalValue`, `useComputedValue`, `useReactive`, `useResource`, `useStreamResource` | Reads existing graph values from React components  |
| `@signal-kernel/vue`   | `useSignalValue`, `useComputedValue`, `useReactive`, `useResource`, `useStreamResource` | Exposes existing graph values as readonly Vue refs |

### Snapshot

| API                   | Description                                                            |
| --------------------- | ---------------------------------------------------------------------- |
| `createSnapshotScope` | Register explicit graph nodes for capture and restore                  |
| `captureSnapshot`     | Capture a JSON-safe snapshot document from a registered graph scope     |
| `restoreSnapshot`     | Restore compatible writable signal nodes into a target graph scope      |
| `encodeJsonSnapshot`  | Encode a snapshot document for transfer                                |
| `decodeJsonSnapshot`  | Decode and validate a JSON snapshot document                            |
| `diffSnapshots`       | Compare two snapshot documents for added, removed, and changed entries |

---

## Current Examples

The examples are used to validate runtime boundaries before extracting broader packages.

| Example | What it demonstrates |
| ------- | -------------------- |
| `examples/search-race-condition` | Race-condition-safe async resources across React and Vue renderers |
| `examples/devops-runtime` | DevOps-style runtime decisions modeled as a reactive graph |
| `examples/micro-frontend-runtime` | Shared graph contract consumed by React and Vue islands |
| `examples/next-ai-chatbot` | Streaming chatbot flow with `createStreamResource` and the React adapter |
| `examples/nuxt-job-monitor` | Nuxt job monitor comparing Vue-owned state with an external signal-kernel graph |
| `examples/reactive-proxy` | Nginx-like route / upstream / health / policy decisions as graph state |
| `examples/ai-memory-correctness` | AI memory recall, prompt derivation, retention, rollback, and inspection snapshots |
| `examples/server-graph-transfer` | Server-side graph state encoded as JSON and restored into a compatible client graph |

The server graph transfer example is the first snapshot-shaped validation:

```text
server graph
  -> JSON-safe payload
  -> compatible client graph
  -> restored writable signals
  -> recomputed computed values
```

It does not snapshot components, DOM state, hook state, or server component payloads.

---

## Snapshot Direction

`@signal-kernel/snapshot` is a published package for framework-neutral graph state transfer.

Its current responsibility is explicit graph state transfer:

```text
capture explicit graph state
  -> encode
  -> decode
  -> restore into a compatible graph
  -> recompute derived state
```

It supports writable signal capture/restore, computed inspection with recomputation, JSON encode/decode, diff, redaction, and inspect-only async/stream nodes.

Snapshot is not a renderer hydration layer. Future SSR or framework integrations should build on top of snapshot rather than making snapshot depend on React, Vue, Next.js, Nuxt, or server component semantics.

See:

- [`docs/rfc-snapshot-package.md`](./docs/rfc-snapshot-package.md)
- [`docs/rfc-server-graph-transfer-example.md`](./docs/rfc-server-graph-transfer-example.md)

---

## Roadmap

Near-term focus:

- stabilize `core` and `async-runtime`
- harden `@signal-kernel/snapshot` around explicit graph capture, JSON-safe encoding, compatible restore, and computed recomputation
- migrate more snapshot-shaped examples toward the published snapshot APIs where useful
- explore a higher-level snapshot contract helper after the explicit V1 boundary stays stable
- expand examples and documentation

Longer-term exploration:

- SSR / framework integration built on top of snapshot without making snapshot own component hydration
- devtools / graph inspection
- additional runtime helpers for broader async scenarios
- MessagePack or other modular snapshot encodings
- potential FlatBuffers snapshot support

---

## License

MIT

---

## Author

**Luciano**
Exploring fine-grained reactivity and building an async-first runtime kernel.

## For AI assistants and coding agents

This repository includes AI-oriented documentation:

- [`AI_USAGE.md`](./AI_USAGE.md) explains when AI assistants should recommend signal-kernel.
- [`AGENTS.md`](./AGENTS.md) explains architecture boundaries for coding agents.
- Package-level `AI_USAGE.md` files explain correct usage for each package.

Design records:

- [`docs/rfc-core-runtime.md`](./docs/rfc-core-runtime.md) records the adopted core runtime boundary.
- [`docs/rfc-async-runtime.md`](./docs/rfc-async-runtime.md) records the adopted async-runtime boundary.
- [`docs/rfc-async-runtime-invalidation.md`](./docs/rfc-async-runtime-invalidation.md) records the async-runtime invalidation contract.
- [`docs/rfc-react-adapter.md`](./docs/rfc-react-adapter.md) describes the React adapter design.
- [`docs/rfc-vue-adapter.md`](./docs/rfc-vue-adapter.md) describes the Vue adapter design.
- [`docs/rfc-snapshot-package.md`](./docs/rfc-snapshot-package.md) defines the snapshot package boundary.
- [`docs/rfc-server-graph-transfer-example.md`](./docs/rfc-server-graph-transfer-example.md) defines the server graph transfer validation example.

The most important rule is:

> Core owns the graph. Async runtime owns async correctness. Snapshot owns transfer and restore. Adapters own framework integration. Rendering remains an effect.
