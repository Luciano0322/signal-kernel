# RFC: Snapshot Package

## 0. Status

**Status:** Draft
**Target:** `packages/snapshot`
**Primary Goal:** Define a framework-neutral snapshot boundary for capturing, encoding, comparing, and restoring compatible `signal-kernel` graph state.
**Non-goal:** Build a React hydration layer, Vue hydration layer, SSR framework integration, persistence database, event-sourcing system, or general-purpose time-travel debugger.

---

## 1. Executive Summary

`@signal-kernel/snapshot` should be a graph transfer boundary.

It should answer this question:

```txt
Given a compatible graph instance, what serializable runtime state can be captured,
encoded, compared, transferred, and restored without depending on a renderer?
```

The package should not treat snapshot as UI hydration. React, Vue, SSR, workers, AI memory, streaming chat, micro frontend graphs, and backend runtime examples may all consume snapshot behavior, but none of them should define the snapshot core by themselves.

The package should start from a conservative model:

```txt
capture opt-in graph state
  -> encode as explicit document
  -> decode document
  -> restore only compatible writable state
  -> recompute derived state
```

This RFC intentionally avoids promising durable replay in the first version. Durable replay requires stronger semantics around async resources, stream resources, effects, external IO, event logs, and restore policies.

---

## 2. Background

The current examples have clarified the snapshot boundary:

```txt
search-race-condition
  -> async state needs stable value / status / stale-result context

next-ai-chatbot
  -> stream state needs partial value / stable value / cancellation policy awareness

micro-frontend-runtime
  -> snapshot must target shared graph contracts, not React or Vue component trees

devops-runtime
  -> snapshot may capture runtime decision points without becoming observability tooling

reactive-proxy
  -> snapshot may capture runtime config and decision state, but not sockets or HTTP handles

ai-memory-correctness
  -> snapshot starts as inspection artifact before becoming replay / restore infrastructure

server-graph-transfer
  -> writable server graph state can be encoded as JSON and restored into a compatible client graph
```

These examples suggest that snapshot should not be designed as a single app-specific JSON shape. It should be a package-level boundary with explicit node identity, graph compatibility, encoding rules, and restore policy.

The `server-graph-transfer` example is especially important because it proves the minimum useful transfer path before this package exists:

```txt
server graph
  -> example-local JSON-safe payload
  -> client compatible graph
  -> restored writable signals
  -> recomputed computed values
```

That local payload is a validation artifact, not a stable snapshot API.

---

## 3. Problem Statement

Reactive graphs contain several kinds of state:

* writable signal state
* derived computed state
* async resource state
* stream resource state
* event or debug metadata
* external side effects

Not all of these should be snapshotted in the same way.

The main problems are:

1. **Renderer coupling risk**
   Snapshot can easily be mistaken for React hydration, Vue hydration, or SSR payload management.

2. **Opaque graph identity**
   Current graph values do not carry stable app-level IDs. A useful snapshot needs opt-in node identity.

3. **Computed state ambiguity**
   Computed values can be observed, but the durable source of truth should usually be their dependencies.

4. **Async restore ambiguity**
   A resource may be pending, cancelled, stale, successful, or failed. Capturing these states is easier than restoring them correctly.

5. **Stream restore ambiguity**
   A stream may have partial value, stable value, cancellation policy, and interruption policy. Running streams cannot be serialized.

6. **External effect boundary**
   Effects, subscriptions, timers, sockets, file handles, `Promise` instances, and `AbortController` instances should not be captured as portable state.

7. **Security and redaction**
   Snapshots may include prompts, memory, deployment metadata, API responses, or user data. Exporting snapshots without redaction is risky.

---

## 4. Positioning

### 4.1 What Snapshot Is

Snapshot is:

* a graph state capture boundary
* a graph compatibility contract
* an encoding boundary
* a restore boundary for compatible graph instances
* a comparison boundary for inspection and debugging
* a future foundation for SSR restore, worker transfer, offline resume, and replay experiments

### 4.2 What Snapshot Is Not

Snapshot is not:

* a React hydration system
* a Vue hydration system
* a DOM persistence layer
* a component tree serializer
* an event sourcing framework
* a database
* a request cache
* a devtools timeline by itself
* a durable replay guarantee in v1

### 4.3 Positioning Statement

```txt
Core owns graph semantics.
Async runtime owns async correctness.
Snapshot owns graph state capture, encode, compare, and restore boundaries.
Adapters own renderer integration.
```

---

## 5. Design Principles

### 5.1 Framework-Neutral

`@signal-kernel/snapshot` must not import React, Vue, Solid, Svelte, Angular, DOM APIs, Next.js, Nuxt, or browser-only lifecycle concepts.

Framework integrations may use snapshot documents, but the snapshot package must remain lower-level than framework hydration.

### 5.2 Opt-In Capture

Snapshot should not try to discover every graph node automatically in v1.

The current core primitives do not expose stable IDs, package names, graph schema names, or node ownership. Therefore v1 should use explicit registration:

```ts
const scope = createSnapshotScope({
  graphId: "commerce-graph",
  graphVersion: "1.0.0",
})

scope.signal("accountId", accountId)
scope.signal("cart", cart)
scope.computed("cartTotal", cartTotal)
scope.resource("inventory", inventoryResource)
scope.stream("assistantStream", assistantStream)
```

This keeps the package honest: an application graph decides what is snapshot-worthy.

### 5.2.1 Validation Examples Before Package Extraction

Before `@signal-kernel/snapshot` exists, examples may use local transfer payload helpers to validate package requirements.

Those helpers must be clearly documented as example-local and unstable:

```txt
captureProfileGraphPayload
restoreProfileGraphPayload
signal-kernel.example.server-graph-transfer.v0
```

They should not be presented as the final package API. Their job is to prove boundaries before extraction:

```txt
local helper proves requirement
  -> snapshot RFC incorporates the requirement
  -> package API is designed deliberately
  -> example later migrates to official package
```

### 5.3 Stable Node Identity

Every captured node must have a stable ID.

Node IDs should be app-defined and stable across compatible graph versions:

```txt
cart.items
account.activeAccountId
memory.recalledFacts
chat.assistantStream
proxy.healthState
```

Snapshot should not rely on object identity, memory address, component identity, hook order, or module load order.

### 5.4 Source State Over Derived State

Writable signal values are the primary restore target.

Computed values should usually be recomputed after restore. They may be captured for inspection, diff, or validation, but should not be treated as the durable source of truth by default.

### 5.5 Restore Is Compatibility-Gated

Restoring a snapshot should require compatible graph identity:

```txt
snapshot graphId == target graphId
snapshot graphVersion is compatible with target graphVersion
snapshot node IDs exist or are explicitly ignored by policy
```

Strict restore should fail when compatibility is unclear.

### 5.6 Async Restore Must Be Policy-Based

Async resources are not all restorable.

The package should distinguish:

```txt
capture for inspection
capture for preload
capture for restore
capture for resume
```

In v1, async and stream nodes may be captured for inspection and diff even if full restore is not supported yet.

### 5.7 Effects Are Not Snapshot State

Effects are runtime behavior. They may restart after graph restore, but a running effect should not be serialized.

Snapshot should not capture:

* cleanup callbacks
* active subscriptions
* timers
* sockets
* file handles
* in-flight promises
* abort controllers
* closures

### 5.8 Redaction Is a First-Class Concern

Snapshot capture should allow node-level redaction or serialization policy:

```ts
scope.signal("session.token", token, {
  redaction: "omit",
})

scope.signal("user.email", email, {
  redact: (value) => maskEmail(value),
})
```

The default v1 behavior should prefer explicit serialization over accidental secret export.

---

## 6. Requirements Matrix

| Scenario | Signal | Computed | Resource | Stream | Effects | Metadata |
| --- | --- | --- | --- | --- | --- | --- |
| Search race example | capture query/input | recompute results view | capture status/value/stable state | not required | exclude | source key, race label |
| Next AI chatbot | capture prompt/input/history | recompute UI view | capture request status | capture partial/stable value | exclude | interruption policy |
| Micro frontend | capture shared graph state | recompute selectors | optional | optional | exclude | graph contract version |
| DevOps runtime | capture config and decision inputs | recompute decisions | capture async probe status | capture health stream value | exclude | decision id |
| Reactive proxy | capture routes/upstreams/policy | recompute selected upstream | optional probe status | optional | exclude | config version |
| AI memory correctness | capture memory scope and store snapshot | recompute prompt | capture recall status/value | capture model stream status/value | exclude | turn id, memory version |
| Server graph transfer | capture server writable signals | recompute on client | not required in first proof | not required in first proof | exclude | graph id/version |
| SSR restore | capture server graph state | recompute on client | capture success/preload state | optional completed/stable value | exclude | schema version |
| Worker transfer | capture structured clone safe state | recompute in worker | capture transferable value state | optional | exclude | runtime version |
| Offline resume | capture durable writable state | recompute | policy-based | policy-based | exclude | resume policy |
| Optimistic rollback | capture committed base and optimistic value | recompute | capture mutation status | optional | exclude | mutation id |

This matrix suggests that v1 should support signal capture / restore first, computed inspection second, and async / stream snapshot inspection before promising full async restore.

The server graph transfer row is the first proof target. It demonstrates that writable signals alone can restore a compatible graph enough for computed values to continue correctly on the client.

---

## 7. Snapshot Categories

### 7.1 Core State

Core state is snapshot-worthy by default when explicitly registered:

* graph identity
* graph version
* node identity
* writable signal values
* serializable app payloads

### 7.2 Derived State

Derived state may be captured for inspection:

* computed value
* computed dependency metadata if exposed in the future
* validation checksum

Derived state should normally be restored by recomputing from source state.

### 7.3 Async State

Async state may include:

* status
* value
* error safe representation
* stable value
* source key
* last successful value
* restore policy

Async state should not include:

* `Promise`
* `AbortController`
* `AbortSignal`
* fetch handle
* request object
* socket

### 7.4 Stream State

Stream state may include:

* status
* current partial value
* stable value
* error safe representation
* interruption policy metadata
* source key

Stream state should not include:

* live stream reader
* generator instance
* network stream
* timer handle
* async iterator object

### 7.5 Debug Metadata

Debug metadata may include:

* event log reference
* createdAt
* label
* graph instance id
* scenario id
* trace id

Debug metadata should be optional and clearly separated from restore-critical state.

---

## 8. Non-Snapshot State

The following should not be captured by snapshot core:

* React component state
* Vue component state
* DOM nodes
* DOM event listeners
* component tree shape
* hook order
* framework scheduler internals
* active subscriptions
* effect cleanup callbacks
* in-flight promises
* abort controllers
* timers
* sockets
* file handles
* database connections
* functions
* closures
* class instances without an explicit serializer
* raw secrets without explicit opt-in and redaction policy

---

## 9. Proposed Package Scope

### 9.1 Package Name

```txt
@signal-kernel/snapshot
```

### 9.2 Proposed Structure

```txt
packages/snapshot/
  package.json
  README.md
  AI_USAGE.md
  tsconfig.json
  tsconfig.dts.json
  src/
    index.ts
    types.ts
    scope.ts
    capture.ts
    restore.ts
    diff.ts
    codecs/
      json.ts
```

### 9.3 Initial Dependencies

The snapshot package may depend on:

* `@signal-kernel/core`
* `@signal-kernel/async-runtime` types if async snapshot adapters are included

It must not depend on:

* React
* Vue
* DOM APIs
* Next.js
* Vite
* Node-specific server APIs

If Node-specific helpers are needed later, they should live in a separate package or optional entrypoint.

---

## 10. Snapshot Document Shape

V1 should use a stable document shape.

```ts
export type SnapshotDocument = {
  schema: "signal-kernel.snapshot.v1";
  graph: {
    id: string;
    version: string;
    instanceId?: string;
  };
  createdAt: number;
  nodes: SnapshotNode[];
  metadata?: Record<string, JsonValue>;
};
```

Node entries should be explicit:

```ts
export type SnapshotNode =
  | SignalSnapshotNode
  | ComputedSnapshotNode
  | ResourceSnapshotNode
  | StreamSnapshotNode;
```

### 10.1 Signal Node

```ts
export type SignalSnapshotNode = {
  id: string;
  kind: "signal";
  value: JsonValue;
};
```

Signals are the primary restore target.

### 10.2 Computed Node

```ts
export type ComputedSnapshotNode = {
  id: string;
  kind: "computed";
  value?: JsonValue;
  restore: "recompute";
};
```

Computed values are captured for inspection and validation. Restore should recompute them.

### 10.3 Resource Node

```ts
export type ResourceSnapshotNode = {
  id: string;
  kind: "resource";
  status: string;
  value?: JsonValue;
  error?: JsonValue;
  sourceKey?: JsonValue;
  restore: "inspect-only" | "reload" | "seed";
};
```

In v1, resource restore should be conservative. If the async runtime does not expose a safe seed/restore API, resource nodes should be inspect-only or reload-based.

### 10.4 Stream Node

```ts
export type StreamSnapshotNode = {
  id: string;
  kind: "stream";
  status: string;
  value?: JsonValue;
  stableValue?: JsonValue;
  error?: JsonValue;
  sourceKey?: JsonValue;
  restore: "inspect-only" | "stable-value" | "reload";
};
```

In v1, stream nodes should not pretend that a live stream can be resumed from a serialized generator or network reader.

---

## 11. Type Model

Snapshot values should be JSON-compatible by default:

```ts
export type JsonPrimitive = string | number | boolean | null;

export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };
```

Non-JSON data should require explicit serialization:

```ts
type SnapshotSerializer<T> = {
  encode(value: T): JsonValue;
  decode(value: JsonValue): T;
};
```

Errors should be normalized:

```ts
export type SnapshotError = {
  name?: string;
  message: string;
  code?: string;
};
```

---

## 12. API Sketch

### 12.1 Scope Creation

```ts
import { createSnapshotScope } from "@signal-kernel/snapshot";

const scope = createSnapshotScope({
  graphId: "ai-memory-graph",
  graphVersion: "0.1.0",
});
```

### 12.2 Register Signals

```ts
scope.signal("currentUserMessage", currentUserMessage);
scope.signal("memoryRevision", memoryRevision);
```

### 12.3 Register Computed Values

```ts
scope.computed("renderedPrompt", renderedPrompt, {
  captureValue: true,
});
```

### 12.4 Register Resources

```ts
scope.resource("recalledFacts", recalledFacts, {
  restore: "inspect-only",
});
```

### 12.5 Register Streams

```ts
scope.stream("assistantStream", assistantStream, {
  restore: "stable-value",
});
```

### 12.6 Capture

```ts
const snapshot = captureSnapshot(scope, {
  label: "after-stream",
  metadata: {
    turnId: "turn-2",
  },
});
```

### 12.7 Encode / Decode

```ts
const encoded = encodeJsonSnapshot(snapshot);
const decoded = decodeJsonSnapshot(encoded);
```

### 12.8 Restore

```ts
restoreSnapshot(scope, decoded, {
  mode: "strict",
});
```

In strict mode, restore should fail if the graph identity, version, node IDs, or node kinds are incompatible.

---

## 13. Restore Semantics

### 13.1 Strict Restore

Strict restore should:

* validate schema
* validate graph ID
* validate compatible graph version
* validate node IDs
* validate node kinds
* restore writable signals
* recompute computed values
* fail on unsupported resource / stream restore policies

### 13.2 Best-Effort Restore

Best-effort restore may:

* restore known compatible signal nodes
* skip unknown nodes
* skip unsupported async nodes
* collect warnings

Best-effort restore should return a report:

```ts
type RestoreReport = {
  restored: string[];
  skipped: Array<{ id: string; reason: string }>;
  warnings: string[];
};
```

### 13.3 Computed Restore

Computed nodes should not be set directly.

Restore should set source signals, then computed values should update through existing graph semantics.

### 13.4 Async Restore

Async restore should be opt-in and policy-based.

For v1:

* `inspect-only` means capture for debugging, no restore.
* `reload` means restore source signals, then allow resource to run again.
* `seed` requires a future async-runtime API or custom restorer.

### 13.5 Stream Restore

Stream restore should be conservative.

For v1:

* `inspect-only` means capture for debugging, no restore.
* `stable-value` may restore stable output only if the target stream adapter supports it.
* `reload` means restore source signals, then allow stream to run again.

Live stream continuation is out of scope for v1.

---

## 14. Diff Semantics

Snapshot diff should compare documents without requiring restore.

```ts
const diff = diffSnapshots(before, after);
```

Diff should report:

* added nodes
* removed nodes
* changed signal values
* changed computed observed values
* changed resource status/value/error
* changed stream status/value/stableValue/error
* metadata changes

Diff is useful before full replay exists. It is also safer than promising merge semantics.

V1 should explicitly be:

```txt
diffable: yes
mergeable: no
```

---

## 15. Encoding

### 15.1 JSON Codec

V1 should provide JSON encoding:

```ts
encodeJsonSnapshot(document): string
decodeJsonSnapshot(text): SnapshotDocument
```

### 15.2 Future Codecs

Future codecs may include:

* MessagePack
* binary formats
* compressed payloads

Encoding should remain modular. The core snapshot document model should not assume JSON forever.

---

## 16. Redaction and Serialization

Snapshot capture should support node-level policies:

```ts
scope.signal("session.token", token, {
  redaction: "omit",
});

scope.signal("user.email", email, {
  redact: (value) => maskEmail(value),
});

scope.signal("createdAt", createdAt, {
  serializer: dateSerializer,
});
```

Suggested policies:

```ts
type RedactionPolicy<T> =
  | "include"
  | "omit"
  | { redact(value: T): JsonValue };
```

The default should be explicit and conservative. If a value cannot be serialized safely, capture should fail or omit it according to policy.

---

## 17. Integration Boundaries

### 17.1 React

React adapters may consume snapshots, but snapshot must not know React.

React-specific concerns that do not belong in snapshot core:

* component tree
* hook state
* Suspense boundaries
* React hydration
* React Server Components payload

### 17.2 Vue

Vue adapters may consume snapshots, but snapshot must not know Vue.

Vue-specific concerns that do not belong in snapshot core:

* component instances
* SFC lifecycle
* template refs
* Vue hydration
* Nuxt payload conventions

### 17.3 SSR

SSR is a validation scenario, not the defining use case.

Snapshot may support this flow:

```txt
server creates graph
server captures graph snapshot
client creates compatible graph
client restores snapshot
adapter renders restored graph
```

Snapshot should not own:

* Next.js route cache
* RSC payload
* Nuxt payload
* request headers
* cookies
* server-only functions

### 17.4 Workers

Worker transfer is a strong validation scenario because it has no UI.

Snapshot should be structured-clone friendly when using JSON-compatible values.

### 17.5 AI Memory

AI memory snapshots should capture memory graph state and lifecycle metadata, but the snapshot package should not understand memory engines, vector stores, prompts, or agent frameworks by default.

### 17.6 DevOps Runtime

DevOps snapshots should capture graph state and decision metadata, but not sockets, subprocess handles, deployment credentials, or live connections.

---

## 18. Testing Strategy

V1 tests should cover:

1. Capturing registered signal nodes.
2. Restoring registered signal nodes into a compatible graph.
3. Rejecting incompatible graph IDs in strict mode.
4. Rejecting incompatible node kinds in strict mode.
5. Capturing computed values for inspection while restoring by recomputation.
6. Capturing resource status/value/error in inspect-only mode.
7. Capturing stream value/stableValue/status in inspect-only mode.
8. JSON encode/decode round trip.
9. Redaction omission.
10. Snapshot diff for changed signal values.

Tests should not mount React or Vue components.

---

## 19. Implementation Phases

### Phase 1: RFC and Package Scaffold

* Add `packages/snapshot`
* Add type definitions
* Add README and AI usage docs
* Add no framework dependencies

Goal: establish package boundary.

### Phase 2: Signal Capture and Restore

* Register signal nodes
* Capture serializable signal values
* Restore signal values into compatible graph
* Add strict restore validation

Goal: deliver the first useful snapshot proof.

This phase should be treated as the first real package milestone, not merely an internal step. The `server-graph-transfer` example has already validated the minimum behavior:

```txt
writable signals captured on server
  -> JSON-safe payload
  -> compatible client graph
  -> restored signals
  -> computed values recompute
```

The official package should generalize this behavior without importing renderer or server framework concepts.

### Phase 3: JSON Codec and Diff

* Add JSON encode/decode
* Add snapshot diff
* Add redaction support

Goal: make snapshot portable and inspectable.

### Phase 4: Computed Inspection

* Register computed nodes
* Capture observed computed value
* Restore by recomputation only

Goal: make derived state visible without making it the source of truth.

### Phase 5: Async and Stream Inspection

* Register resource nodes
* Register stream nodes
* Capture status/value/error/stableValue where available
* Keep restore policy conservative

Goal: support examples without pretending live async work is serializable.

### Phase 6: Validation Examples

Use the snapshot package in examples:

* AI memory correctness V2 for replay / diff prototype
* Server graph transfer migration from local payload helpers to official snapshot APIs
* SSR mini example only after graph transfer remains framework-neutral
* Worker transfer example if needed

Goal: validate package boundaries after core semantics exist.

---

## 20. V1 Success Criteria

V1 is successful if:

1. A graph can explicitly register snapshot-worthy nodes.
2. Writable signals can be captured and restored in a compatible graph.
3. Computed values are captured for inspection but recomputed after restore.
4. Resource and stream values can be captured for inspection without false resume guarantees.
5. Snapshot documents are JSON-serializable.
6. Snapshot documents can be diffed.
7. Redaction prevents accidental secret export.
8. The package has no React, Vue, DOM, Next.js, or Nuxt dependency.
9. Existing examples can use the package without changing their core architecture.

---

## 21. Explicit Non-Goals for V1

V1 should not implement:

* full durable replay
* live stream continuation
* promise serialization
* effect serialization
* component hydration
* route cache hydration
* CRDT merge
* multi-writer conflict resolution
* database persistence
* storage adapters
* browser devtools
* source-map-like graph introspection

---

## 22. Open Questions

1. Should graph version compatibility be exact match in v1, or should semver ranges be supported?
2. Should `@signal-kernel/core` eventually expose optional node debug IDs, or should snapshot remain fully opt-in?
3. Should async-runtime add seed/restore APIs for resources, or should snapshot keep async restore external?
4. Should stream stable value restore belong to async-runtime or snapshot?
5. Should event logs be a separate package or optional snapshot metadata?
6. Should redaction default to fail-closed for unknown non-JSON values?
7. Should snapshot diff operate only on documents, or also on live graph scopes?
8. Should SSR integration live in framework adapters or a separate `@signal-kernel/ssr` package later?

---

## 23. Recommended First Implementation

The first implementation should be deliberately small:

```txt
createSnapshotScope
register signal
captureSnapshot
restoreSnapshot
encodeJsonSnapshot
decodeJsonSnapshot
diffSnapshots
```

Do not start with SSR, AI memory replay, or async resource resume.

Recommended first proof:

```txt
signal graph A
  -> capture snapshot
  -> encode JSON
  -> decode JSON
  -> restore into compatible graph B
  -> computed values in graph B recompute
```

This will anchor the package in graph state transfer rather than framework hydration.

The existing `server-graph-transfer` example is the concrete precursor for this proof. Its local payload should eventually be replaced by:

```txt
captureProfileGraphPayload
  -> createSnapshotScope + captureSnapshot

restoreProfileGraphPayload
  -> restoreSnapshot

signal-kernel.example.server-graph-transfer.v0
  -> signal-kernel.snapshot.v1
```

That migration should preserve the example's boundary: the server transfers graph state, the client restores a compatible graph, and the renderer only reads from that graph.

---

## 24. Final Recommendation

Build `@signal-kernel/snapshot` as a conservative graph state boundary first.

The examples have shown that snapshot is important, but they have also shown why it should not be app-specific:

* search examples need async correctness visibility
* streaming examples need partial/stable value semantics
* micro frontend examples need shared graph contract compatibility
* DevOps examples need runtime decision checkpoints
* AI memory examples need inspection before replay
* SSR should validate graph transfer, not define the package

Recommended first claim:

```txt
@signal-kernel/snapshot captures and restores explicit graph state across
compatible graph instances. It is not a renderer hydration layer.
```
