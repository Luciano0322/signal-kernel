# RFC: Server Graph Transfer Example

## 0. Status

**Status:** Draft
**Target:** `examples/server-graph-transfer`
**Primary Goal:** Prove that server-side `signal-kernel` graph state can be encoded into a JSON-safe payload, transferred to the client, restored into a compatible graph, and continued by the client runtime.
**Non-goal:** Build a full SSR framework integration, React Server Components demo, Next.js/Nuxt/TanStack Start/Vinxi adapter, component hydration layer, or final `@signal-kernel/snapshot` package implementation.

---

## 1. Executive Summary

This example should validate the most basic snapshot-shaped flow without depending on a full-stack framework:

```txt
server creates reactive graph
  -> server sets writable graph state
  -> server captures JSON-safe graph payload
  -> HTML transfers payload to client
  -> client creates compatible graph
  -> client restores writable graph state
  -> computed values recompute
  -> renderer reads restored graph
```

The example is intentionally named **server graph transfer**, not SSR.

The point is not to snapshot components. The point is to prove that `signal-kernel` graph state can cross a server/client runtime boundary as data.

---

## 2. Motivation

The snapshot package RFC defines snapshot as a graph transfer boundary, not a renderer hydration layer.

Before implementing `@signal-kernel/snapshot`, this example should prove the smallest useful version of that idea:

```txt
Can a server graph produce a JSON-safe payload that restores a client graph?
```

This example should help answer:

* What state must be captured?
* What state can be recomputed?
* What makes two graph instances compatible?
* What should be encoded into JSON?
* What must remain outside snapshot boundaries?
* How can a renderer consume restored graph state without owning it?

---

## 3. Positioning

### 3.1 What This Example Is

This example is a server-to-client graph transfer proof of concept.

It demonstrates:

* server-side graph creation
* JSON-safe graph state capture
* explicit graph compatibility metadata
* client-side graph recreation
* writable signal restore
* computed recomputation after restore
* React rendering as a thin read boundary

### 3.2 What This Example Is Not

This example is not:

* an SSR framework
* a React Server Components demo
* a Next.js demo
* a Nuxt demo
* a TanStack Start demo
* a Vinxi demo
* a route cache demo
* a component serializer
* a hook state serializer
* a DOM hydration layer
* a durable replay system
* the final `@signal-kernel/snapshot` API

### 3.3 Core Claim

```txt
Snapshot begins as graph state transfer.
Component rendering is only a consumer of the restored graph.
```

---

## 4. Architecture Boundary

### 4.1 Example Owns

The example may own:

* local server
* HTML rendering
* payload script tag injection
* example-local capture helper
* example-local restore helper
* compatible graph factory
* client bootstrapping
* React display

### 4.2 Future Snapshot Package Owns

`@signal-kernel/snapshot` should eventually own:

* snapshot document format
* node registration
* capture API
* restore API
* graph compatibility validation
* JSON codec
* diff
* redaction
* async/stream restore policies

### 4.3 Snapshot Must Not Own

Snapshot should not own:

* React components
* Vue components
* component tree shape
* hook state
* DOM state
* React hydration
* Server Components
* route cache
* request handlers
* cookies
* server-only closures

---

## 5. Proposed Example Structure

```txt
examples/server-graph-transfer/
  package.json
  README.md
  index.html
  vite.config.ts
  tsconfig.json
  src/
    shared/
      createProfileGraph.ts
      transferPayload.ts
    server/
      renderHtml.ts
      server.ts
    client/
      App.tsx
      main.tsx
    tests/
      transferPayload.test.ts
```

The example should use minimal dependencies:

* Node `http` for the server
* Vite for the client build/dev server
* React only as a renderer
* `@signal-kernel/core`
* `@signal-kernel/react`

Do not use a full-stack framework in v1.

---

## 6. Graph Model

Use a small profile/entitlement graph.

This graph is intentionally boring. The value of the example is the transfer boundary, not domain complexity.

```ts
const userId = signal("guest");
const plan = signal<"free" | "pro" | "enterprise">("free");
const usage = signal(0);

const entitlement = computed(() => {
  if (plan.get() === "enterprise") return "dedicated";
  if (plan.get() === "pro") return "priority";
  return "standard";
});

const overLimit = computed(() => {
  if (plan.get() === "enterprise") return false;
  if (plan.get() === "pro") return usage.get() > 1_000;
  return usage.get() > 100;
});
```

The graph should expose:

```ts
type ProfileGraph = {
  actions: {
    setProfile(input: {
      userId: string;
      plan: "free" | "pro" | "enterprise";
      usage: number;
    }): void;
  };
  computed: {
    entitlement: Readable<string>;
    overLimit: Readable<boolean>;
  };
  signals: {
    userId: Signal<string>;
    plan: Signal<Plan>;
    usage: Signal<number>;
  };
};
```

The writable signals are restored. The computed values are recomputed.

---

## 7. Transfer Payload

Because `@signal-kernel/snapshot` does not exist yet, the example should define an intentionally local payload shape.

Do not present this as the final snapshot API.

```ts
export type ServerGraphTransferPayload = {
  schema: "signal-kernel.example.server-graph-transfer.v0";
  graph: {
    id: "profile-graph";
    version: "0.1.0";
  };
  createdAt: number;
  signals: {
    userId: string;
    plan: "free" | "pro" | "enterprise";
    usage: number;
  };
};
```

This payload is deliberately smaller than the proposed `SnapshotDocument`.

It only validates:

* JSON-safe encoding
* graph identity
* graph version
* writable signal values
* restore into compatible graph

It does not validate:

* async resource restore
* stream restore
* diff
* redaction
* durable replay
* event logs

---

## 8. Server Flow

The server should:

1. Create a fresh profile graph.
2. Set server-side state.
3. Capture the transfer payload.
4. Render HTML with a JSON script tag.
5. Let the client continue from the payload.

Conceptual flow:

```ts
const graph = createProfileGraph();

graph.actions.setProfile({
  userId: "luciano",
  plan: "pro",
  usage: 42,
});

const payload = captureProfileGraphPayload(graph);

return renderHtml({ payload });
```

Payload injection:

```html
<script id="__SIGNAL_KERNEL_GRAPH__" type="application/json">
  {...}
</script>
```

The server may render a static text preview, but it should not attempt to serialize components.

---

## 9. Client Flow

The client should:

1. Read the JSON payload script tag.
2. Decode and validate it.
3. Create a compatible profile graph.
4. Restore writable signals.
5. Render graph state through React adapter hooks.

Conceptual flow:

```ts
const payload = readTransferPayload();
const graph = createProfileGraph();

restoreProfileGraphPayload(graph, payload);

createRoot(root).render(<App graph={graph} />);
```

React should only render:

```txt
restored signals
recomputed computed values
```

React should not own transfer, restore, or graph compatibility.

---

## 10. Example-Local Helpers

### 10.1 Capture

```ts
export function captureProfileGraphPayload(
  graph: ProfileGraph,
): ServerGraphTransferPayload {
  return {
    schema: "signal-kernel.example.server-graph-transfer.v0",
    graph: {
      id: "profile-graph",
      version: "0.1.0",
    },
    createdAt: Date.now(),
    signals: {
      userId: graph.signals.userId.peek(),
      plan: graph.signals.plan.peek(),
      usage: graph.signals.usage.peek(),
    },
  };
}
```

Use `.peek()` for capture because capture should read a snapshot of state without creating graph dependencies.

### 10.2 Restore

```ts
export function restoreProfileGraphPayload(
  graph: ProfileGraph,
  payload: ServerGraphTransferPayload,
) {
  assertCompatiblePayload(payload);

  graph.actions.setProfile(payload.signals);
}
```

Restore should set writable signals and let computed values recompute through normal graph semantics.

### 10.3 Compatibility Check

```ts
function assertCompatiblePayload(payload: ServerGraphTransferPayload) {
  if (payload.schema !== "signal-kernel.example.server-graph-transfer.v0") {
    throw new Error("Unsupported transfer payload schema");
  }

  if (payload.graph.id !== "profile-graph") {
    throw new Error("Incompatible graph id");
  }

  if (payload.graph.version !== "0.1.0") {
    throw new Error("Incompatible graph version");
  }
}
```

This compatibility check is intentionally small, but it should mirror the future snapshot package boundary.

---

## 11. UI Requirements

The UI should stay simple.

It should show:

* transferred user id
* transferred plan
* transferred usage
* recomputed entitlement
* recomputed over-limit status
* raw JSON payload
* short note that components were not snapshotted

Recommended panels:

```txt
Server Payload
  raw JSON-safe graph payload

Restored Graph
  signals restored from payload
  computed values recomputed on client

Boundary Notes
  snapshot does not include components / DOM / hook state
```

---

## 12. Test Strategy

Tests should cover the transfer boundary without mounting UI.

### 12.1 JSON-Safe Payload

Expected:

```txt
captureProfileGraphPayload(graph)
JSON.stringify(payload)
JSON.parse(encoded)
```

The parsed payload should equal the original JSON-compatible shape.

### 12.2 Restore Into Compatible Graph

Expected:

```txt
graph A set to pro / usage 42
capture payload
graph B starts as guest / free / 0
restore payload into graph B
graph B computed entitlement == priority
```

### 12.3 Computed Recomputes

Expected:

```txt
payload does not need to store entitlement
restore signals
entitlement recomputes from restored plan
```

### 12.4 Incompatible Graph Rejected

Expected:

```txt
payload graph.id != profile-graph
restore throws
```

### 12.5 Incompatible Version Rejected

Expected:

```txt
payload graph.version != 0.1.0
restore throws
```

---

## 13. Relationship to `@signal-kernel/snapshot`

This example should be treated as a precursor to `@signal-kernel/snapshot`.

The example-local helpers should eventually be replaced:

```txt
captureProfileGraphPayload
  -> captureSnapshot

restoreProfileGraphPayload
  -> restoreSnapshot

local payload schema
  -> SnapshotDocument
```

Until the package exists, this example should avoid naming its helpers as if they were official APIs.

The example should document:

```txt
This payload mirrors snapshot-package requirements, but it is not the final
snapshot document format.
```

---

## 14. Explicit Non-Goals

Do not implement:

* React Server Components
* Next.js
* Nuxt
* TanStack Start
* Vinxi
* Suspense
* streaming SSR
* route loaders
* server actions
* async resource restore
* stream restore
* diff
* redaction
* durable replay
* component tree serialization
* DOM hydration semantics

These can be future validation layers after `packages/snapshot` exists.

---

## 15. Implementation Phases

### Phase 1: RFC and Example Scaffold

* Add example package
* Add Vite client setup
* Add Node server entry
* Add README

Goal: establish the minimal runtime boundary.

### Phase 2: Shared Profile Graph

* Add `createProfileGraph()`
* Add writable signals
* Add computed values
* Add graph actions

Goal: define a compatible graph contract used by server and client.

### Phase 3: Local Transfer Payload

* Add payload type
* Add capture helper
* Add restore helper
* Add compatibility checks
* Add tests

Goal: prove JSON-safe graph transfer without snapshot package.

### Phase 4: Server HTML Transfer

* Create server graph
* Capture payload
* Inject JSON script tag
* Serve client entry

Goal: prove server-to-client graph data transfer.

### Phase 5: Client Restore and Render

* Read JSON payload
* Create compatible graph
* Restore payload
* Render graph with React adapter hooks

Goal: prove renderer consumes restored graph but does not own snapshot semantics.

---

## 16. Success Criteria

The example is successful if:

1. Server-created graph state is encoded as JSON-safe payload.
2. Client creates a compatible graph and restores writable signals.
3. Computed values are not stored as source of truth; they recompute after restore.
4. React renders restored graph state through adapter hooks only.
5. The example does not serialize components, DOM, hook state, or server component payloads.
6. Tests prove JSON round trip, restore, recomputation, and compatibility rejection.
7. The README clearly states this is not the final snapshot package API.

---

## 17. Future Extensions

After `@signal-kernel/snapshot` exists, this example can validate:

* official `SnapshotDocument`
* `createSnapshotScope()`
* `captureSnapshot()`
* `restoreSnapshot()`
* JSON codec
* redaction
* diff

Later validation examples may include:

* SSR mini example with official snapshot package
* worker transfer
* AI memory replay / diff
* TanStack Start integration
* Vinxi integration
* Next / Nuxt adapter story

These should come after the graph transfer boundary is proven.

---

## 18. Final Recommendation

Build this example before `packages/snapshot`, but keep it deliberately small.

Recommended first claim:

```txt
A server-side signal-kernel graph can be transferred as JSON-safe graph state
and restored into a compatible client graph without snapshotting components.
```

This gives the snapshot package a concrete validation path while preserving the core architecture:

```txt
graph state first
renderer second
component state never part of snapshot core
```

