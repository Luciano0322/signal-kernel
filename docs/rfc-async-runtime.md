# RFC: Async Runtime

Status: adopted design note

## Problem Statement

`@signal-kernel/async-runtime` models asynchronous work as part of the
reactive graph without becoming a UI fetching library, query cache, or
framework-specific data layer.

Async correctness belongs below framework adapters because cancellation,
stale-result protection, latest-wins behavior, and status transitions are
dataflow concerns, not renderer concerns.

In v0.3, the async-runtime API moves toward object-form descriptors as the
primary mental model. Positional resource forms remain v0.x compatibility
shorthands, but new code and documentation should describe resources through
explicit `input`, `observe`, `run`, `stream`, and `invalidates` fields.

The next stream lifecycle revision keeps the same `createStreamResource`
primitive while extending its producer contract. Generic chunk and value types
already cover text, structured events, and binary data. The missing capability
is lifecycle ownership for push-based producers such as WebSocket, SSE,
Observable, and event subscriptions.

---

## Goals

* Model async value, status, and error state inside the reactive graph.
* Prevent stale async results from overwriting newer state.
* Support explicit cancellation.
* Preserve latest-wins semantics for overlapping async work.
* Support source-driven query resources.
* Support manual mutation resources.
* Support declarative invalidation without introducing a global query cache.
* Support stream or incremental async resource updates.
* Support both finite pull-based and long-lived push-based stream producers.
* Abort and clean up superseded stream runs deterministically.
* Allow callback-based producers to report terminal failure.
* Allow an explicitly owned stream resource to be disposed independently of a
  UI framework.
* Remain framework-neutral.
* Build on `@signal-kernel/core` instead of redefining graph semantics.

---

## Non-Goals

* Replacing TanStack Query, SWR, or framework query libraries.
* Adding global query caches.
* Adding retry, polling, deduplication, or server-cache policy as default runtime behavior.
* Providing WebSocket, EventSource, Observable, or transport-specific clients.
* Defining reconnect, heartbeat, backoff, or network recovery policy.
* Coupling async lifecycle to React, Vue, component mount, or component unmount.
* Treating every transport error event as a terminal stream failure.
* Providing Suspense-first semantics.
* Hiding business logic inside UI adapters.
* Resuming live promises, abort controllers, sockets, timers, or streams from snapshots.

---

## API Layers

The async runtime intentionally has layered primitives:

```txt
fromPromise()
  -> asyncSignal()
  -> createResource()
  -> createStreamResource()
  -> createRevision() / createKeyedRevision()
```

### `fromPromise()`

Lowest-level Promise-to-reactive-state primitive.

Function form is for ctx-only work:

```ts
const request = fromPromise(async (ctx) => {
  return fetchCurrentUser({ signal: ctx.signal });
});
```

Descriptor form is for explicit input-based work:

```ts
const request = fromPromise({
  run: (id: string, ctx) => fetchUser(id, { signal: ctx.signal }),
});

await request.run("u1");
```

Function form is eager by default. Descriptor form is lazy by default because
the runtime needs `run(input)` to establish the first input. If descriptor form
should run immediately, it must provide both `eager: true` and `initialInput`.

### `asyncSignal()`

Convenience layer over `fromPromise()` that returns a value getter and metadata
tuple:

```ts
const [value, meta] = asyncSignal({
  run: (id: string, ctx) => fetchUser(id, { signal: ctx.signal }),
});
```

Use this when the operation is async state but not naturally source-driven.
Do not imply that function-form `asyncSignal()` automatically tracks business
inputs. If reactive graph input should drive the async work, use
`createResource({ input, run })`.

### `createResource()`

High-level one-shot async resource.

Auto resources behave like query resources. They derive async work from
reactive input and optional observed invalidation dependencies:

```ts
const [user, meta] = createResource({
  input: userId.get,
  observe: () => {
    userRevision.get(userId.get());
  },
  run: (id, ctx) => fetchUser(id, { signal: ctx.signal }),
});
```

Manual resources behave like mutation resources. They run only when caller code
invokes `meta.run(input)`:

```ts
const [, updateUserMeta] = createResource({
  trigger: "manual",
  run: (input: { id: string; name: string }, ctx) =>
    updateUser(input, { signal: ctx.signal }),
  invalidates: (_result, input) => [
    usersRevision,
    userRevision.target(input.id),
  ],
});
```

`createResource(source, fetcher, options?)` remains a v0.x compatibility
shorthand, but object form is the primary documented API.

### `createStreamResource()`

High-level stream resource for multi-emission async work:

```ts
const [text, meta] = createStreamResource({
  input: prompt.get,
  observe: () => {
    streamRevision.get();
  },
  stream: async (prompt, ctx) => {
    for await (const chunk of streamText(prompt, ctx)) {
      if (ctx.isCancelled()) return;
      ctx.emit(chunk);
    }

    ctx.done();
  },
  initialValue: "",
  reduce: (current = "", chunk) => current + chunk,
});
```

Stream resources separate visible accumulated value from stable committed value
so progressive output can be displayed without losing a stable graph state
boundary.

`createStreamResource(source, streamer, options?)` remains a v0.x compatibility
shorthand, but object form is the primary documented API.

The planned additive producer lifecycle contract is:

```ts
type StreamCleanup = () => void;

interface StreamContext<TChunk, TValue, E = unknown> {
  emit(chunk: TChunk): void;
  set(value: TValue): void;
  done(finalValue?: TValue): void;
  fail(error: E): void;
  readonly signal: AbortSignal;
  onCleanup(cleanup: StreamCleanup): void;
  isCancelled(): boolean;
}

interface StreamAsyncMeta<E, TValue> {
  status(): StreamAsyncStatus;
  error(): E | undefined;
  reload(): void;
  cancel(reason?: unknown): void;
  stableValue(): TValue | undefined;
  dispose(): void;
}
```

Existing finite stream producers remain valid. They do not need to use
`signal`, `onCleanup()`, or `fail()` unless they own cancellable work,
subscriptions, or callback-based error delivery.

Returning from `stream()` does not imply completion. A push-based producer may
return immediately after registering listeners and remain active until it
calls `done()`, calls `fail()`, or the runtime closes the run.

For example, the runtime does not own the WebSocket API, but it can own the
producer lifecycle:

```ts
const [messages, meta] = createStreamResource({
  input: channelId.get,
  stream: (channelId, ctx) => {
    const socket = new WebSocket(`/channels/${channelId}`);

    socket.addEventListener("message", (event) => {
      ctx.emit(JSON.parse(event.data));
    });

    socket.addEventListener("error", () => {
      ctx.fail(new Error("WebSocket connection failed"));
    });

    socket.addEventListener("close", () => {
      if (!ctx.isCancelled()) {
        ctx.done();
      }
    });

    ctx.onCleanup(() => socket.close());
  },
  initialValue: [],
  reduce: (current = [], message) => [...current, message],
});
```

The same contract supports EventSource, Observable, Node event emitters,
`ReadableStream`, and other subscription sources without adding
transport-specific primitives to async-runtime.

### `createRevision()` and `createKeyedRevision()`

Revisions are signal-backed invalidation sources. They do not store fetched
data and they are not cache keys.

Use `createRevision()` for one logical data boundary:

```ts
const usersRevision = createRevision();
```

Use `createKeyedRevision()` when invalidation should be scoped by key:

```ts
const userRevision = createKeyedRevision<string>();
```

Queries observe revision values through `observe()`. Mutations return revision
targets through `invalidates()` after successful writes.

See `docs/rfc-async-runtime-invalidation.md` for the full invalidation
contract rationale.

---

## Query And Mutation Model

The async runtime distinguishes two common resource roles.

### Query Resource

A query resource is an auto resource:

```ts
const [users] = createResource({
  input: () => ({
    page: page.get(),
    keyword: keyword.get(),
  }),
  observe: () => {
    usersRevision.get();
  },
  run: ({ page, keyword }, ctx) =>
    fetchUsers({ page, keyword, signal: ctx.signal }),
});
```

It eagerly runs from tracked graph dependencies. When `input()` or `observe()`
dependencies change, the previous work is cancelled or logically discarded and
the latest run becomes authoritative.

### Mutation Resource

A mutation resource is a manual resource:

```ts
const [, updateUserMeta] = createResource({
  trigger: "manual",
  run: (payload: { id: string; name: string }, ctx) =>
    updateUser(payload, { signal: ctx.signal }),
  invalidates: (_result, payload) => [
    usersRevision,
    userRevision.target(payload.id),
  ],
});

await updateUserMeta.run({ id: "u1", name: "Alice" });
```

It does not run eagerly. Caller code owns the execution timing. After a
successful run, `invalidates()` declares which revision targets should notify
observing query resources.

---

## Runtime Semantics

### Latest Wins

When async executions overlap, only the newest valid execution may commit
value, status, or error state.

Older completions are stale even if they resolve successfully.

### Cancellation

Cancellation is part of runtime semantics.

Cancellation may come from:

* explicit `cancel(reason?)`
* `input()` changes
* `observe()` invalidation changes
* stream resubscription

Adapters must not invent their own cancellation policy.

### Status Is Data

Status transitions are reactive data, not UI-only loading flags.

Adapters must observe metadata changes even when the value itself does not
change.

Important transitions include:

```txt
idle -> pending
pending -> success
pending -> error
pending -> cancelled
success -> pending with previous value retained
streaming -> success
streaming -> error
streaming -> cancelled
```

### Previous Value Retention

Pending state may keep or clear the previous value depending on runtime
options.

Consumers should not assume pending always means the value is `undefined`.

### Stream Interruption Policy

Stream resources can choose what happens to visible partial output on
interruption:

```txt
keep-partial
rollback
clear
```

This is async-runtime policy, not adapter policy.

### Stream `observe()` Semantics

For stream resources, `observe()` means subscription identity dependency. If an
observed dependency changes, the current stream is cancelled and a new stream
subscription starts.

Stream resources do not implement mutation `invalidates` in v0.3. A stream
usually receives new data through the stream itself. Mutation-driven
resubscription should be introduced only when the subscription identity really
changed.

### Stream Producer Lifecycle

Each stream execution owns an independent run lifecycle. A run contains its own
abort signal, cleanup registrations, and closed state. Only the active,
non-closed run may update visible value, stable value, status, or error.

The lifecycle contract is:

| Trigger | Abort active signal | Run cleanup | Stop observation | Result |
| --- | --- | --- | --- | --- |
| `input()` or `observe()` changes | Yes | Yes, once | No | Start a new pending run |
| `reload()` | Yes | Yes, once | No | Start a new pending run |
| `cancel(reason?)` | Yes | Yes, once | No | Apply cancel policy and enter `cancelled` |
| `done(finalValue?)` | No | Yes, once | No | Commit stable value and enter `success` |
| `fail(error)`, throw, or rejection | No | Yes, once | No | Apply error policy and enter `error` |
| `dispose()` | Yes, when active | Yes, once | Yes | If active, apply cancel policy and enter `cancelled`; permanently stop the resource |

A run must be marked closed before abort callbacks or cleanup functions execute.
This prevents cleanup-triggered transport events from re-entering
`emit()`, `set()`, `done()`, or `fail()`.

Cleanup registrations use obligation semantics rather than function-identity
deduplication. Every registration is executed at most once. If
`onCleanup(cleanup)` is called after its run has already closed, the cleanup is
executed immediately so asynchronous setup cannot leak a late-created
subscription.

Synchronous throws, returned Promise rejections, and `ctx.fail(error)` all use
the same terminal error path. Errors from stale or closed runs are ignored.

`cancel()` ends only the current run. Future input or observed dependency
changes may start another run. `dispose()` is permanent and also disposes the
internal reactive effect. It is idempotent, and `reload()` after disposal does
not restart the resource. Disposing an active run applies its cancellation
policy and enters `cancelled`; disposing an already terminal resource preserves
its committed terminal state.

`isCancelled()` reports cancellation, supersession, reload, or disposal. It
does not redefine successful completion or producer failure as cancellation.
The runtime still rejects all callbacks from any closed run internally.

### Long-Lived Stream Semantics

A long-lived producer may remain in `streaming` indefinitely. It enters
`success` only after an explicit `done()` call and enters `error` only after a
terminal `fail()`, synchronous throw, or returned Promise rejection.

The producer decides whether a transport event is terminal. For example, an
EventSource `error` event may represent an automatic reconnect attempt and does
not have to call `fail()`.

`stableValue()` continues to represent the value committed by the latest
successful `done()`. This revision does not add checkpoint, reconnect
retention, or intermediate commit semantics. Those policies require separate
evidence from long-lived stream examples before becoming public API.

---

## Adapter Boundary

Framework adapters may read async resources and expose snapshots to renderers.

Adapters must not:

* add caching or retry policy
* automatically cancel or dispose an externally supplied shared resource on
  component unmount
* redefine status transitions
* hide stale-result behavior
* route async correctness through framework effects

Adapters should observe at least:

```ts
value();
meta.status();
meta.error();
```

Stream adapters should also observe metadata that affects rendering, such as:

```ts
meta.stableValue();
```

when exposed by the public stream meta API.

An adapter may connect `meta.dispose()` to framework lifecycle only when
resource ownership is explicit, such as a resource created inside an
adapter-owned scope or an explicit opt-in disposal policy. Vue
`onScopeDispose()` and React effect cleanup must not become implicit ownership
of graph resources created elsewhere.

---

## Snapshot Boundary

Snapshot may inspect async/resource/stream state, but it must not claim live
async resume.

Snapshot can capture explicit serializable state such as:

* value
* status
* error shape when serializable or redacted
* stable stream value
* inspect-only metadata

Snapshot must not capture or resume:

* promises
* abort controllers
* timers
* sockets
* stream producers
* closures
* in-flight async execution

---

## Testing Strategy

Async-runtime tests should verify behavior through public APIs.

Important behaviors:

* eager auto resource execution
* manual resource execution through `meta.run(input)`
* manual `reload()` reruns the latest manual input
* status transitions
* error transitions
* cancellation status
* stale result prevention
* latest-wins commits
* `input()`-driven reload
* `observe()`-driven reload
* `invalidates()` runs only after success
* `invalidates()` does not run after error or cancellation
* `createRevision()` invalidates all observers of one boundary
* `createKeyedRevision()` invalidates only observers of the matching key
* previous-value retention
* stream emission
* stream success commit
* stream error interruption policy
* stream cancel interruption policy
* stream `observe()` resubscription
* per-run abort signal behavior
* cleanup on cancellation, supersession, reload, completion, failure, and
  disposal
* cleanup exactly-once behavior and late cleanup registration
* stale callback emission and failure isolation
* explicit callback-based `fail(error)`
* terminal `done()` behavior
* idempotent `dispose()` and prevention of post-disposal restart

Tests should not depend on internal tokens or private implementation details
except through observable behavior.

---

## Decision

Keep `@signal-kernel/async-runtime` as a framework-neutral async correctness
layer.

It owns async state, cancellation, stale-result prevention, latest-wins
behavior, query resources, manual mutation resources, declarative invalidation,
stream resource semantics, and framework-neutral producer lifecycle.

Framework adapters own only rendering integration.
