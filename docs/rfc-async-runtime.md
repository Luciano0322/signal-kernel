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
* Remain framework-neutral.
* Build on `@signal-kernel/core` instead of redefining graph semantics.

---

## Non-Goals

* Replacing TanStack Query, SWR, or framework query libraries.
* Adding global query caches.
* Adding retry, polling, deduplication, or server-cache policy as default runtime behavior.
* Coupling async lifecycle to React, Vue, component mount, or component unmount.
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

---

## Adapter Boundary

Framework adapters may read async resources and expose snapshots to renderers.

Adapters must not:

* add caching or retry policy
* automatically cancel resources on component unmount
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

Tests should not depend on internal tokens or private implementation details
except through observable behavior.

---

## Decision

Keep `@signal-kernel/async-runtime` as a framework-neutral async correctness
layer.

It owns async state, cancellation, stale-result prevention, latest-wins
behavior, query resources, manual mutation resources, declarative invalidation,
and stream resource semantics.

Framework adapters own only rendering integration.
