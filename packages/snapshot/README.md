<h1 align="center">@signal-kernel/snapshot</h1>

<p align="center">
Framework-neutral graph state capture, JSON-safe transfer, diff, and restore.
</p>

---

## Status

`@signal-kernel/snapshot` is an early package.

The first implementation focuses on the smallest useful boundary:

```txt
explicit graph nodes
  -> capture snapshot document
  -> encode JSON
  -> decode JSON
  -> restore writable signals into a compatible graph
  -> computed values recompute
```

It is not a React hydration layer, Vue hydration layer, SSR framework, or durable replay system.

---

## What It Captures

V1 supports:

* registered writable signals
* registered computed values for inspection
* registered resources for inspect-only state capture
* registered streams for inspect-only state capture
* graph id / graph version compatibility
* JSON encode/decode
* snapshot diff
* node-level redaction by omission

Computed values are not restored directly. They recompute from restored source signals.

Resource and stream nodes are captured for inspection. Live async work, promises, abort controllers, and stream readers are not serialized.

---

## Quick Start

```ts
import { signal, computed } from "@signal-kernel/core";
import {
  captureSnapshot,
  createSnapshotScope,
  restoreSnapshot,
} from "@signal-kernel/snapshot";

const userId = signal("guest");
const plan = signal<"free" | "pro">("free");
const entitlement = computed(() =>
  plan.get() === "pro" ? "priority" : "standard",
);

const source = createSnapshotScope({
  graphId: "profile-graph",
  graphVersion: "0.1.0",
});

source.signal("userId", userId);
source.signal("plan", plan);
source.computed("entitlement", entitlement);

plan.set("pro");

const snapshot = captureSnapshot(source);
```

Restore into a compatible graph:

```ts
const targetUserId = signal("guest");
const targetPlan = signal<"free" | "pro">("free");
const targetEntitlement = computed(() =>
  targetPlan.get() === "pro" ? "priority" : "standard",
);

const target = createSnapshotScope({
  graphId: "profile-graph",
  graphVersion: "0.1.0",
});

target.signal("userId", targetUserId);
target.signal("plan", targetPlan);
target.computed("entitlement", targetEntitlement);

restoreSnapshot(target, snapshot);

targetEntitlement.get(); // "priority"
```

---

## JSON Codec

```ts
import { decodeJsonSnapshot, encodeJsonSnapshot } from "@signal-kernel/snapshot";

const text = encodeJsonSnapshot(snapshot);
const decoded = decodeJsonSnapshot(text);
```

Snapshot values must be JSON-compatible unless a node provides a serializer.

---

## Redaction

```ts
scope.signal("session.token", token, {
  redaction: "omit",
});
```

Omitted nodes are not included in the snapshot document.

---

## Diff

```ts
import { diffSnapshots } from "@signal-kernel/snapshot";

const diff = diffSnapshots(before, after);
```

Diff reports added, removed, and changed nodes. It does not imply merge semantics.

---

## Boundary

Snapshot does not capture:

* React component state
* Vue component state
* DOM state
* hook order
* component tree shape
* active effects
* cleanup callbacks
* promises
* abort controllers
* timers
* sockets
* stream readers
* functions or closures

Snapshot owns graph state transfer. Framework adapters or future SSR helpers may consume snapshot documents, but snapshot itself stays renderer-independent.

