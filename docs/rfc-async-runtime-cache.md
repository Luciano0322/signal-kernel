# RFC: Declarative Invalidation Contract for `@signal-kernel/async-runtime`

## Status

Draft

## Package Scope

`@signal-kernel/async-runtime`

This RFC changes the existing async-runtime API surface. It does not introduce a
new cache package.

The filename still says `cache` because the motivating problem overlaps with
server-state cache invalidation, but the proposed solution is not a query cache.
It is a declarative invalidation contract built into `@signal-kernel/async-runtime`.

## Motivation

The current `createResource` API models this flow well:

```txt
reactive input changed
  → cancel previous async task
  → reload async task
  → expose value / status / error
```

However, it does not fully model a common CRUD/server-state scenario:

```txt
PUT /users/:id succeeds
  → GET /users should become stale and reload
```

In this case, `GET /users` and `PUT /users/:id` may have no direct reactive dependency in JavaScript.

For example:

```ts
const [users] = createResource(
  () => ({
    page: page.get(),
    keyword: keyword.get(),
  }),
  fetchUsers
)
```

This resource depends on `page` and `keyword`, but it has no way to know that `updateUser(id)` affects the users collection.

The original idea of wrapping resources in `computed` is insufficient because computed dependencies only describe internal dataflow dependencies. They cannot describe external consistency dependencies between unrelated server-state operations.

This RFC introduces a minimal invalidation model that converts external consistency events into reactive graph dependencies.

The intended direction is:

```txt
createResource remains the async resource primitive
fromPromise / asyncSignal gain input-based run semantics
revision signals model external consistency
object-form resources declare input, observation, execution, and invalidation
```

## Core Problem

Manual update hell is not caused by the existence of dependency contracts.

It is caused by those contracts being scattered across components, event handlers, and effects.

Bad pattern:

```ts
async function onSubmit(payload) {
  await api.updateUser(payload)

  refetchUsers()
  refetchUserDetail(payload.id)
  refetchDepartmentMembers(payload.departmentId)
}
```

This causes several problems:

1. Every call site must remember which resources are affected.
2. Update rules are duplicated across handlers.
3. Missing a refetch causes stale UI or derived-state drift.
4. The async runtime cannot consistently cancel, batch, or propagate invalidation.
5. External server-state dependencies are not part of the reactive graph.

The desired model is:

```txt
query resource declares what it observes
mutation resource declares what it invalidates
runtime propagates invalidation after successful mutation
```

## Design Goals

1. Keep `createResource` as a general async operation primitive.
2. Support both query-like and mutation-like async operations.
3. Avoid becoming a full query-cache library.
4. Represent external consistency through reactive revision signals.
5. Allow resources to observe invalidation dependencies without passing those dependencies to the fetcher.
6. Allow manual resources to declare `invalidates`.
7. Preserve the existing positional API where possible.
8. Add an object-form API for advanced usage and avoid long positional signatures.
9. Allow parameterless resources without forcing fake business parameters.
10. Keep the implementation minimal and compatible with the existing signal-kernel graph model.

## Non-Goals

This RFC does not aim to implement:

1. Query cache storage.
2. Query key registry.
3. Stale time / cache time.
4. Refetch on window focus.
5. Optimistic update.
6. Mutation cache.
7. Automatic server-state relationship inference.
8. A TanStack Query replacement.
9. Transport-level fetch/cache management.
10. Browser HTTP cache management.

## Key Concept: Revision

A revision is a signal-backed invalidation source.

It does not store business data. It stores only a version number.

```txt
resource observes revision.get()
mutation success calls revision.invalidate()
revision changes
  → observing resources rerun
```

A revision acts as a bridge:

```txt
external consistency event
  → revision.invalidate()
  → signal graph dependency changes
  → resource reloads
```

## Proposed API: `createRevision`

```ts
export interface Revision {
  get(): number
  peek(): number
  invalidate(reason?: string): void
}

export function createRevision(initial?: number): Revision
```

### Example

```ts
const usersRevision = createRevision()
```

A query resource observes it:

```ts
const [users] = createResource({
  input: () => ({
    page: page.get(),
    keyword: keyword.get(),
  }),

  observe: () => {
    usersRevision.get()
  },

  run: (query, ctx) => {
    return api.getUsers(query, { signal: ctx.signal })
  },
})
```

A mutation invalidates it:

```ts
const [updatedUser, updateUserMeta] = createResource({
  trigger: "manual",

  run: (payload, ctx) => {
    return api.updateUser(payload, { signal: ctx.signal })
  },

  invalidates: () => [
    usersRevision,
  ],
})
```

Usage:

```ts
await updateUserMeta.run(payload)
```

After the mutation succeeds, the runtime calls:

```ts
usersRevision.invalidate()
```

Then any resource observing `usersRevision.get()` reloads.

## Proposed API: `createKeyedRevision`

Some invalidation targets are entity-specific.

Example:

```txt
GET /users/:id
PUT /users/:id
```

For this case, support keyed revisions.

```ts
export interface KeyedRevision<K> {
  get(key: K): number
  peek(key: K): number
  invalidate(key: K, reason?: string): void
  target(key: K): InvalidationTarget
}

export function createKeyedRevision<K>(): KeyedRevision<K>
```

### Example

```ts
const usersRevision = createRevision()
const userRevision = createKeyedRevision<string>()
```

User detail resource:

```ts
const [user] = createResource({
  input: () => userId.get(),

  observe: () => {
    userRevision.get(userId.get())
  },

  run: (id, ctx) => {
    return api.getUser(id, { signal: ctx.signal })
  },
})
```

Update mutation:

```ts
const [updatedUser, updateUserMeta] = createResource({
  trigger: "manual",

  run: (payload, ctx) => {
    return api.updateUser(payload, { signal: ctx.signal })
  },

  invalidates: (result, payload) => [
    usersRevision,
    userRevision.target(payload.id),
  ],
})
```

`target()` returns an invalidation target for one key. This avoids overloading
the word "key" and keeps the mutation contract focused on invalidation targets.

## Invalidation Target

To support both normal revisions and keyed revisions, define a small invalidation target abstraction.

```ts
export interface InvalidationTarget {
  invalidate(reason?: string): void
}
```

`Revision` should implement `InvalidationTarget`.

For keyed revisions, expose:

```ts
userRevision.target(id)
```

Example:

```ts
invalidates: (result, payload) => [
  usersRevision,
  userRevision.target(payload.id),
]
```

Recommended first-version API:

```ts
export interface KeyedRevision<K> {
  get(key: K): number
  peek(key: K): number
  invalidate(key: K, reason?: string): void
  target(key: K): InvalidationTarget
}
```

## Proposed API: Object-form `createResource`

The existing positional API is good for simple auto resources:

```ts
createResource(source, fetcher, options)
```

But it cannot express:

```txt
input
observe
run
trigger
invalidates
```

Therefore, add an object-form API.

This is also the preferred shape for new advanced resource features. Once a
resource needs more than `source`, `run`, and `options`, object form is clearer
than extending positional arguments.

## Auto Resource Descriptor

Auto resources rerun when their reactive dependencies change.

```ts
export interface AutoResourceDescriptor<I, T, E = unknown>
  extends ResourceOptions {
  trigger?: "auto"

  input?: () => I

  observe?: () => void

  run: (input: I, ctx: ResourceContext) => Promise<T>
}
```

### Semantics

```txt
input()
  → produces the async operation input
  → signal reads inside input are tracked
  → if omitted, the input is undefined

observe()
  → reads additional reactive invalidation dependencies
  → these dependencies do not get passed to run()

run(input, ctx)
  → executes the async operation
```

When `input()` or `observe()` dependencies change:

```txt
cancel previous in-flight task
reload with latest input
```

### Parameterless Auto Resources

A resource should not be forced to create a revision only because its fetch call
has no parameters.

This should be valid:

```ts
const [users] = createResource({
  run: (_input, ctx) => {
    return api.getUsers({ signal: ctx.signal })
  },
})
```

If a parameterless resource needs to reload after external mutations, it can
observe a revision:

```ts
const usersRevision = createRevision()

const [users] = createResource({
  observe: () => {
    usersRevision.get()
  },

  run: (_input, ctx) => {
    return api.getUsers({ signal: ctx.signal })
  },
})
```

In other words:

```txt
no request parameters does not mean no invalidation dependencies
```

## Manual Resource Descriptor

Manual resources run only when explicitly called.

```ts
export interface ManualResourceDescriptor<I, T, E = unknown>
  extends ResourceOptions {
  trigger: "manual"

  run: (input: I, ctx: ResourceContext) => Promise<T>

  invalidates?: (
    result: T,
    input: I
  ) => InvalidationTarget[]
}
```

### Semantics

```txt
manual run(input)
  → pending
  → success(result)
  → call invalidates(result, input)
  → invalidate returned targets
```

Important:

```txt
invalidates must only run after success.
invalidates must not run after error.
invalidates must not run after cancel.
```

## Required `AsyncMeta` Extension

The current `AsyncMeta` supports:

```ts
meta.reload()
meta.cancel()
meta.status()
meta.error()
```

Manual resources require:

```ts
meta.run(input)
```

Recommended type:

```ts
export interface RunnableAsyncMeta<I, T, E = unknown>
  extends AsyncMeta<E> {
  run(input: I): Promise<T | undefined>
}
```

If the existing `asyncSignal` cannot pass input directly into the runner,
refactor it to support an input-based run model.

This does not change the fundamental Promise semantics:

```txt
run(input)
  → starts one async operation
  → returns a Promise for that operation result
  → sets status/value/error for the latest operation
  → cancels or ignores stale operations according to existing latest-wins rules
```

The important change is that the runtime no longer needs a mutable closure such
as `currentInput` to tell the promise producer what to run.

Current pattern:

```ts
let currentInput!: I

const [value, meta] = asyncSignal<T, E>(
  (ctx) => run(currentInput, ctx),
  { eager: false }
)
```

Preferred model:

```ts
const [value, meta] = asyncSignal<I, T, E>(
  (input, ctx) => run(input, ctx),
  { eager: false }
)

meta.run(input)
```

This removes the need for mutable closure state and makes manual resources natural.

For auto resources, `createResource` owns the latest input and can call
`meta.run(latestInput)` when `input()` or `observe()` dependencies change.

For manual resources, user code calls `meta.run(input)` directly.

`reload()` can remain on `AsyncMeta` for auto resources, where it reruns the
latest known input. For manual resources, `reload()` should either rerun the
latest manual input or be documented as unavailable until a first `run(input)`
has established one. The implementation should choose one behavior and test it.

## Backward Compatibility

The existing positional API should remain supported:

```ts
createResource(source, fetcher, options)
```

It should internally be treated as:

```ts
createResource({
  trigger: "auto",
  input: source,
  run: fetcher,
  ...options,
})
```

This avoids breaking existing examples.

## Example: Users CRUD

### Revisions

```ts
const usersRevision = createRevision()
const userRevision = createKeyedRevision<string>()
```

### Users Collection Resource

```ts
const [users, usersMeta] = createResource({
  input: () => ({
    page: page.get(),
    keyword: keyword.get(),
  }),

  observe: () => {
    usersRevision.get()
  },

  run: (query, ctx) => {
    return api.getUsers(query, { signal: ctx.signal })
  },
})
```

### User Detail Resource

```ts
const [user, userMeta] = createResource({
  input: () => userId.get(),

  observe: () => {
    userRevision.get(userId.get())
  },

  run: (id, ctx) => {
    return api.getUser(id, { signal: ctx.signal })
  },
})
```

### Update User Mutation

```ts
const [updatedUser, updateUserMeta] = createResource({
  trigger: "manual",

  run: (payload: UpdateUserPayload, ctx) => {
    return api.updateUser(payload, { signal: ctx.signal })
  },

  invalidates: (result, payload) => [
    usersRevision,
    userRevision.target(payload.id),
  ],
})
```

### Component/Event Usage

```ts
await updateUserMeta.run({
  id: userId,
  name: nextName,
})
```

The handler does not call:

```ts
refetchUsers()
refetchUserDetail()
```

The invalidation contract lives in the mutation resource definition.

## Why This Solves Manual Update Hell

This does not remove dependency contracts.

Instead, it moves them from scattered imperative call sites into declarative resource definitions.

Before:

```ts
async function onSubmit(payload) {
  await api.updateUser(payload)

  refetchUsers()
  refetchUser(payload.id)
}
```

After:

```ts
const updateUser = createResource({
  trigger: "manual",
  run: updateUserApi,
  invalidates: (result, payload) => [
    usersRevision,
    userRevision.target(payload.id),
  ],
})
```

Usage:

```ts
await updateUserMeta.run(payload)
```

The runtime owns the propagation.

## Conceptual Distinction

There are two dependency types:

### 1. Dataflow Dependency

Tracked automatically by signal reads.

Example:

```txt
userId signal
  → user resource
  → computed userName
```

This is handled by `signal`, `computed`, `createEffect`, and the existing resource input tracking.

### 2. External Consistency Dependency

Cannot be inferred from JavaScript closure dependencies.

Example:

```txt
PUT /users/:id
  → GET /users should reload
```

This is handled by:

```txt
observe + revision + invalidates
```

Important wording:

```txt
computed solves derived state.
invalidates solves external consistency.
```

## `createStreamResource` Considerations

`createStreamResource` has the same source/observe gap as `createResource`, but
it should not automatically copy all mutation invalidation semantics.

For streams, `observe` can make sense:

```ts
const [messages, meta] = createStreamResource({
  input: () => ({
    roomId: roomId.get(),
  }),

  observe: () => {
    roomSubscriptionRevision.get()
  },

  stream: (input, ctx) => {
    return streamMessages(input.roomId, ctx)
  },
})
```

For stream resources:

```txt
input changed
  → cancel current stream
  → resubscribe

observe changed
  → cancel current stream
  → resubscribe
```

However, invalidation has a different meaning for streams.

A stream usually receives new data through the stream itself. A mutation should not automatically cause stream resubscription unless the subscription scope itself changed.

Therefore:

1. Add `observe` support to `createStreamResource`.
2. Prefer object form for stream resources once `input` and `observe` are both needed.
3. Do not add `invalidates` to stream resources in the first version unless there is a clear use case.
4. Document that stream `observe` means subscription identity dependency, not normal stale-data invalidation.

## Implementation Plan

### Phase 1: Add Revision Primitives

Implement:

```ts
createRevision()
createKeyedRevision()
InvalidationTarget
```

Tests:

1. `revision.get()` tracks dependency inside `createEffect`.
2. `revision.invalidate()` triggers dependent effects.
3. `keyedRevision.get(id)` only tracks that key.
4. `keyedRevision.invalidate(id)` only triggers observers of that key.

### Phase 2: Add Object-form `createResource`

Support:

```ts
createResource({
  input,
  observe,
  run,
})
```

Tests:

1. `input()` dependencies trigger reload.
2. `observe()` dependencies trigger reload.
3. `observe()` values are not passed to `run`.
4. Changing both input and observe in the same batch should not cause duplicate reloads if batching is supported.
5. Existing positional API still works.
6. Parameterless object-form resources can run with `undefined` input.

### Phase 3: Add Manual Resource Mode

Support:

```ts
createResource({
  trigger: "manual",
  run,
  invalidates,
})
```

Tests:

1. Manual resource does not run eagerly.
2. `meta.run(input)` executes the operation.
3. Status becomes pending during run.
4. Value updates on success.
5. Error updates on failure.
6. `invalidates` runs only on success.
7. `invalidates` does not run on error.
8. `invalidates` does not run on cancel.

### Phase 4: Connect Invalidates to Revisions

Test full CRUD flow:

```txt
users resource observes usersRevision
updateUser manual resource invalidates usersRevision
running updateUser causes users resource to reload
```

Tests:

1. `GET /users` resource reloads after `updateUserMeta.run()` success.
2. `GET /users` does not reload if `updateUserMeta.run()` fails.
3. `GET /users/:id` reloads only when matching keyed revision is invalidated.
4. Non-matching keyed revisions do not reload.

### Phase 5: Review `createStreamResource`

Support object form with:

```ts
input
observe
stream
```

Tests:

1. `input()` changes cancel current stream and resubscribe.
2. `observe()` changes cancel current stream and resubscribe.
3. Stream resource does not automatically implement mutation invalidation behavior.

## Implementation Notes

### Avoid Query Cache Registry

Do not implement:

```ts
queryKey
mutationKey
key registry
cache map
staleTime
cacheTime
```

This RFC uses revision signals, not a query cache.

### Avoid Over-inference

The runtime should not try to infer that:

```txt
PUT /users/:id affects GET /users
```

That is domain knowledge and must be declared by `invalidates`.

### Preserve Runtime Responsibility

The runtime should own:

```txt
success-only invalidation
cancellation behavior
dependency propagation
reload scheduling
```

The user should own:

```txt
declaring which external consistency targets are affected
```

## Documentation Updates

Update async-runtime documentation to say:

```txt
createResource tracks reactive input dependencies automatically.

External server-state dependencies cannot be inferred from JavaScript closures.
They should be represented explicitly through revision signals and invalidation contracts.

Manual update hell is not solved by removing dependency contracts.
It is solved by moving those contracts from imperative call sites into declarative resource definitions.
```

Recommended phrase:

```txt
Declarative invalidation instead of imperative refetch chains.
```

Another recommended phrase:

```txt
computed solves derived state.
invalidates solves external consistency.
```

Also document:

```txt
Parameterless resources do not need revisions by default.
They need revisions only when external consistency events should reload them.
```

## Acceptance Criteria

This RFC is considered implemented when the following scenario works:

```ts
const usersRevision = createRevision()

const [users] = createResource({
  input: () => ({
    page: page.get(),
  }),

  observe: () => {
    usersRevision.get()
  },

  run: (query, ctx) => api.getUsers(query, ctx),
})

const [_, updateUserMeta] = createResource({
  trigger: "manual",

  run: (payload, ctx) => api.updateUser(payload, ctx),

  invalidates: () => [
    usersRevision,
  ],
})

await updateUserMeta.run({
  id: "u1",
  name: "Alice",
})
```

Expected behavior:

```txt
updateUser succeeds
  → usersRevision invalidates
  → users resource detects observed revision change
  → previous users request is cancelled if in-flight
  → users resource reloads
```

The event handler should not manually call:

```ts
usersMeta.reload()
```

or:

```ts
refetchUsers()
```

## Summary

This change completes the missing semantic loop in `createResource`.

Before:

```txt
reactive input
  → async resource
  → value/status/error
```

After:

```txt
reactive input
  → async resource
  → value/status/error

external mutation success
  → invalidation contract
  → revision change
  → observed resources reload
```

This keeps signal-kernel aligned with its core design:

```txt
dependencies should become part of the graph,
not remain scattered as imperative update code.
```
