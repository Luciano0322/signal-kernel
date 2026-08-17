# Async Runtime Stream Lifecycle TDD Workflow

Status: planning workflow

Target release: `@signal-kernel/async-runtime` v0.4

## Purpose

This document defines the TDD workflow for extending
`createStreamResource()` from a finite pull-oriented stream primitive into a
framework-neutral primitive that also supports long-lived push producers.

The target producer families include:

* AsyncIterable and fetch `ReadableStream`
* LLM token streams
* Server-sent events and EventSource-style transports
* WebSocket
* Observable subscriptions
* Node event emitters and callback-based event sources

The public primitive remains `createStreamResource()`. This work extends its
lifecycle contract rather than adding separate LLM and live-stream APIs.

## Architectural Boundary

`@signal-kernel/async-runtime` owns:

* active stream run identity
* cancellation and abort signaling
* stale callback isolation
* producer cleanup
* terminal success and error transitions
* permanent resource disposal

It does not own:

* WebSocket or EventSource construction
* transport parsing
* reconnect, heartbeat, or backoff policy
* Vue, React, Nuxt, or component lifecycle
* snapshotting live connections or subscriptions

Framework adapters may expose stream state to renderers. They must not
implicitly take ownership of externally created shared resources.

## Public Interface Target

The planned additive interface is:

```ts
export type StreamCleanup = () => void;

export interface StreamContext<TChunk, TValue, E = unknown> {
  emit(chunk: TChunk): void;
  set(value: TValue): void;
  done(finalValue?: TValue): void;
  fail(error: E): void;
  readonly signal: AbortSignal;
  onCleanup(cleanup: StreamCleanup): void;
  isCancelled(): boolean;
}

export interface StreamAsyncMeta<E, TValue> {
  status(): StreamAsyncStatus;
  error(): E | undefined;
  reload(): void;
  cancel(reason?: unknown): void;
  stableValue(): TValue | undefined;
  dispose(): void;
}
```

Existing stream producers that only use `emit()`, `set()`, `done()`, and
`isCancelled()` must continue to work without modification.

## Semantics To Preserve

The current observable behavior remains the baseline:

* A stream starts in `pending`.
* The first `emit()` or `set()` moves it to `streaming`.
* `done()` commits the visible value into `stableValue()` and enters
  `success`.
* A source change starts a new stream session.
* Stale emissions from an older session do not update the active value.
* `reload()` starts a new stream session.
* `keep-partial`, `rollback`, and `clear` remain the interruption policies.
* `input()` and `observe()` changes in one batch start only one new session.
* Positional stream resource syntax remains a v0.x compatibility shorthand.

## New Lifecycle Contract

The new behavior must satisfy:

* Every run receives its own `AbortSignal`.
* Supersession, reload, cancel, and dispose abort the active signal.
* Cleanup runs once for every registration when its run closes.
* A run is closed before abort listeners and cleanup callbacks execute.
* Stale or closed runs cannot emit, set, complete, or fail.
* Cleanup registered after a run closes executes immediately.
* `fail(error)`, synchronous throw, and Promise rejection share one error path.
* Returning from `stream()` does not imply `done()`.
* `cancel()` closes only the active run and keeps reactive observation alive.
* `dispose()` is idempotent, closes the active run, stops reactive observation,
  and prevents `reload()` from restarting the resource.

## Non-Goals

This workflow does not add:

* `createLLMStreamResource()`
* `createLiveStreamResource()`
* automatic retry or reconnect
* intermediate stable-value checkpoints
* transport-specific status values
* component-owned lifecycle as the default
* live stream serialization or resume through snapshot

Long-lived streams may remain in `streaming` indefinitely. Stable value remains
the value committed by the latest explicit `done()`.

## TDD Rules

Use vertical slices. Complete one RED-GREEN-REFACTOR cycle before adding the
next behavior.

```txt
RED: Add one public behavior test and confirm the expected failure.
GREEN: Make the smallest implementation change that passes that test.
REFACTOR: Improve internals only while the focused and existing tests are green.
```

Tests must exercise `createStreamResource()` through its public tuple,
`StreamContext`, and `StreamAsyncMeta`. Do not assert private run objects,
version counters, cleanup collections, or effect instances.

At the end of every phase:

```sh
pnpm --filter @signal-kernel/async-runtime test
pnpm --filter @signal-kernel/async-runtime typecheck
```

Run adapter and repository-wide checks only at the phases where the public type
surface changes or at final verification.

## Workflow Progress

Mark a phase complete only after every task and exit condition in that phase is
checked.

- [x] Phase 0: Baseline
- [x] Phase 1: Manual cancellation owns producer teardown
- [x] Phase 2: Supersession and reload close the previous run
- [x] Phase 3: Completion is terminal
- [x] Phase 4: Push producers can fail explicitly
- [x] Phase 5: Dispose permanently stops the resource
- [x] Phase 6: Adapter ownership audit
- [x] Phase 7: Push transport proof
- [ ] Phase 8: Refactor, documentation, and verification

## Phase 0: Baseline

Before changing runtime code:

### Tasks

- [x] Run the existing async-runtime tests.
- [x] Run async-runtime typecheck.
- [x] Run the async-runtime package build.
- [x] Confirm the existing stream characterization file contains 19 tests.
- [x] Run the React adapter tests.
- [x] Run the Vue adapter tests.
- [x] Record the command results and current date under `Phase 0 Record`.
- [x] Confirm the worktree contains no production changes from this workflow.

Commands:

```sh
pnpm --filter @signal-kernel/async-runtime test
pnpm --filter @signal-kernel/async-runtime typecheck
pnpm --filter @signal-kernel/async-runtime build
pnpm --filter @signal-kernel/react test
pnpm --filter @signal-kernel/vue test
```

Current stream characterization surface:

```txt
packages/async-runtime/src/__test__/createStreamResource.test.ts
```

The file currently contains 19 tests covering finite streaming, replacement
updates, stable commits, interruption policies, stale async work, object-form
input, observation, batching, and parameterless descriptors.

### Phase 0 Record

```txt
Date: 2026-08-12

async-runtime test: passed, 5 files and 64 tests
createStreamResource characterization: passed, 19 tests
async-runtime typecheck: passed
async-runtime build: passed, CJS/ESM/DTS outputs generated
React adapter test: passed, 1 file and 12 tests
Vue adapter test: passed, 1 file and 9 tests

Notes:
* The worktree was clean before baseline commands ran.
* No production source files were changed during Phase 0.
* Sandbox execution initially blocked esbuild and Vitest workers with
  `spawn EPERM`. The same commands passed outside the sandbox; this was an
  execution-environment restriction rather than a project failure.
```

Exit condition:

- [x] Baseline command results are recorded in this document.
- [x] No production behavior has changed.

## Phase 1: Manual Cancellation Owns Producer Teardown

Tracer bullet:

```txt
cancel aborts the active producer and runs its cleanup exactly once
```

### Cycle 1A: Active Cancellation

RED tasks:

- [x] Add one test that starts a stream and records `ctx.signal`.
- [x] Register one observable cleanup through `ctx.onCleanup()`.
- [x] Call `meta.cancel("manual")`.
- [x] Assert the signal is aborted and exposes the cancellation reason.
- [x] Assert cleanup runs exactly once.
- [x] Assert status becomes `cancelled` and the existing interruption policy is
  preserved.
- [x] Run the focused test and confirm it fails for the missing lifecycle
  behavior.

GREEN tasks:

- [x] Add `StreamCleanup`, `signal`, and `onCleanup()` to the public context.
- [x] Introduce only enough per-run lifecycle state to support active
  cancellation.
- [x] Mark the run closed before aborting its signal.
- [x] Drain registered cleanup obligations after the run is closed.
- [x] Make the focused test pass.
- [x] Run the complete async-runtime stream test file.

### Cycle 1A Record

```txt
Date: 2026-08-12

RED: focused test failed because ctx.signal was undefined
GREEN: focused test passed, 1 test passed and 19 skipped
stream regression: passed, 1 file and 20 tests
async-runtime regression: passed, 5 files and 65 tests
async-runtime typecheck: passed
async-runtime build: passed, CJS/ESM/DTS outputs generated
```

### Cycle 1B: Cancellation Before Producer Start

- [x] RED: Add one test that cancels synchronously before the deferred producer
  invocation.
- [x] RED: Assert the stale producer function is never invoked.
- [x] RED: Run the focused test and confirm the expected failure.
- [x] GREEN: Guard deferred producer invocation with active-run validity.
- [x] GREEN: Make the focused and existing tests pass.

### Cycle 1B Record

```txt
Date: 2026-08-13

RED: focused test failed because the deferred producer was called once with an
aborted signal
GREEN: focused test passed, 1 test passed and 20 skipped
stream regression: passed, 1 file and 21 tests
async-runtime regression: passed, 5 files and 66 tests
async-runtime typecheck: passed
async-runtime build: passed, CJS/ESM/DTS outputs generated
```

REFACTOR tasks:

- [x] Centralize active-run validity checking.
- [x] Remove cancellation code duplicated by the new close path.
- [x] Run async-runtime test and typecheck after refactoring.

Exit condition:

- [x] Add or retain coverage proving repeated `cancel()` does not run cleanup
  twice.
- [x] Existing finite stream tests remain green.
- [x] Phase 1 public types build successfully.

### Phase 1 Completion Record

```txt
Date: 2026-08-13

refactor baseline: passed, 1 stream file and 21 tests
refactor regression: passed, 1 stream file and 21 tests
async-runtime regression: passed, 5 files and 66 tests
async-runtime typecheck: passed
async-runtime build: passed, CJS/ESM/DTS outputs generated
public declarations: StreamCleanup, StreamContext.signal, and
StreamContext.onCleanup exported

Notes:
* deactivateRun() now owns active identity, closed state, cancellation state,
  and active pointer removal.
* cancelRun() adds AbortSignal and cleanup teardown on top of deactivateRun().
* input, observe, and reload supersession still do not abort or clean up the
  previous producer; that behavior remains scoped to Phase 2.
```

## Phase 2: Supersession And Reload Close The Previous Run

First cycle:

```txt
an input change aborts and cleans up the old producer before the new run emits
```

Second cycle:

```txt
reload aborts and cleans up the old producer before starting a replacement run
```

### Cycle 2A: Input Supersession

- [x] RED: Add one test that captures the contexts and cleanup calls for two
  input-driven runs.
- [x] RED: Change tracked input and assert the old signal is aborted.
- [x] RED: Assert old cleanup completes before the replacement run becomes
  authoritative.
- [x] RED: Invoke `emit()`, `set()`, and `done()` from the retained old context
  and assert they cannot change active state.
- [x] RED: Run the focused test and confirm the expected failure.
- [x] GREEN: Route input supersession through the shared close-and-replace
  behavior.
- [x] GREEN: Make the focused and existing tests pass.

### Cycle 2A Record

```txt
Date: 2026-08-13

RED: focused test failed because the superseded run signal remained active and
its cleanup did not run
GREEN: focused test passed, 1 test passed and 21 skipped
stream regression: passed, 1 file and 22 tests
async-runtime regression: passed, 5 files and 67 tests
async-runtime typecheck: passed
async-runtime build: passed, CJS/ESM/DTS outputs generated

Notes:
* Reactive input supersession now aborts and cleans up the active run before
  starting its replacement.
* Retained emit(), set(), and done() callbacks from the old context remain
  unable to mutate active value, status, or stable value.
* reload() still uses the previous logical invalidation path and remains scoped
  to Cycle 2B.
```

### Cycle 2B: Manual Reload

- [x] RED: Add one test that reloads an active stream.
- [x] RED: Assert reload aborts and cleans up the previous run exactly once.
- [x] RED: Assert reload starts one replacement run with the current input.
- [x] RED: Run the focused test and confirm the expected failure.
- [x] GREEN: Route reload through the same close-and-replace behavior.
- [x] GREEN: Preserve existing visible-value reset and stable-value behavior.
- [x] GREEN: Make the focused and existing tests pass.

### Cycle 2B Record

```txt
Date: 2026-08-13

RED: focused test failed because reload left the previous run signal active and
did not run its cleanup
GREEN: focused test passed, 1 test passed and 22 skipped
stream regression: passed, 1 file and 23 tests
async-runtime regression: passed, 5 files and 68 tests
async-runtime typecheck: passed
async-runtime build: passed, CJS/ESM/DTS outputs generated

Notes:
* reload() now closes the active run with reason "reload" before creating its
  replacement.
* The replacement uses the current tracked input and starts exactly once.
* Reload still resets visible value to initialValue while preserving the last
  stable value.
```

### Cycle 2C: Rapid Supersession

- [x] RED: Add one test that changes input before the deferred old producer
  invocation starts.
- [x] RED: Assert the superseded producer never opens a stale subscription.
- [x] RED: Run the focused test and confirm the expected failure.
- [x] GREEN: Skip deferred invocation for inactive runs.
- [x] GREEN: Make the focused and existing tests pass.

### Cycle 2C Record

```txt
Date: 2026-08-13

RED: focused test observed producer starts for both stale input "a" and current
input "b"
GREEN: focused test passed, 1 test passed and 23 skipped
stream regression: passed, 1 file and 24 tests
async-runtime regression: passed, 5 files and 69 tests
async-runtime typecheck: passed
async-runtime build: passed, CJS/ESM/DTS outputs generated

Notes:
* Producer invocation now waits through a microtask checkpoint so queued graph
  invalidation can close a superseded run first.
* The existing active-run guard then skips the stale producer invocation.
* Rapid input supersession starts only the latest producer and does not open a
  stale subscription.
```

REFACTOR tasks:

- [x] Route `observe()` invalidation through the same supersession path.
- [x] Remove shared cancellation flags once per-run state owns validity.
- [x] Keep active run identity and internal tokens out of public behavior tests.
- [x] Run async-runtime test and typecheck after refactoring.

Exit condition:

- [x] Supersession cleanup occurs before the replacement producer becomes
  authoritative.
- [x] Existing batched input and observe behavior still starts one run.
- [x] All callbacks from old runs are stale-safe.

### Phase 2 Completion Record

```txt
Date: 2026-08-13

observe characterization: passed directly GREEN, 1 test passed and 23 skipped
stream regression after refactor: passed, 1 file and 24 tests
async-runtime regression: passed, 5 files and 69 tests
async-runtime typecheck: passed
async-runtime build: passed, CJS/ESM/DTS outputs generated

Notes:
* input(), observe(), and reload replacement now share replaceRun().
* observe invalidation aborts and cleans up the old run before the replacement
  producer starts, while keeping the observed revision out of producer input.
* The runtime has one active run pointer and per-run cancellation state; the
  former shared version and cancellation flags are gone.
* Public behavior tests retain only StreamContext references and never inspect
  active run identity, private tokens, or cleanup collections.
* Batched input and observe changes still produce one replacement session.
```

## Phase 3: Completion Is Terminal

First cycle:

```txt
done closes the run and ignores later emit, set, and done callbacks
```

Second cycle:

```txt
cleanup registered after a run closes executes immediately
```

### Cycle 3A: Terminal Completion

- [x] RED: Add one test that calls `done()` and retains the completed context.
- [x] RED: Call `emit()`, `set()`, and `done()` again from that context.
- [x] RED: Assert visible value, stable value, status, and `onSuccess` do not
  change after the first completion.
- [x] RED: Assert completion runs every registered cleanup once.
- [x] RED: Run the focused test and confirm the expected failure.
- [x] GREEN: Close the run before stable commit effects and cleanup execute.
- [x] GREEN: Ignore every mutation from the completed context.
- [x] GREEN: Make the focused and existing tests pass.

#### Cycle 3A Completion Record

```txt
Date: 2026-08-13

RED: failed as expected because done() executed 0 of 2 cleanup registrations
GREEN: focused test passed, 1 test passed and 24 skipped
stream regression: passed, 1 file and 25 tests
async-runtime regression: passed, 5 files and 70 tests
async-runtime typecheck: passed
async-runtime build: passed, CJS/ESM/DTS outputs generated

Notes:
* done() closes the active run before committing its stable value and success
  status.
* Completion drains every cleanup registration exactly once, including
  duplicate registrations of the same function.
* emit(), set(), and repeated done() calls from the completed context are
  ignored.
* Successful completion is terminal but is not reported as cancellation by
  isCancelled().
```

### Cycle 3B: Late Cleanup Registration

- [x] RED: Add one test that cancels or completes while async setup is pending.
- [x] RED: Register cleanup only after the run has closed.
- [x] RED: Assert the late cleanup executes immediately and only once.
- [x] RED: Run the focused test and confirm the expected failure.
- [x] GREEN: Execute cleanup immediately when registration occurs on a closed
  run.
- [x] GREEN: Make the focused and existing tests pass.

#### Cycle 3B Completion Record

```txt
Date: 2026-08-13

RED: failed as expected because the closed run discarded late cleanup,
     leaving its call count at 0
GREEN: focused test passed, 1 test passed and 25 skipped
stream regression: passed, 1 file and 26 tests
async-runtime regression: passed, 5 files and 71 tests
async-runtime typecheck: passed
async-runtime build: passed, CJS/ESM/DTS outputs generated

Notes:
* A producer may finish asynchronous setup after its run has already closed.
* onCleanup() executes such a late registration before returning and does not
  retain it for another cleanup pass.
* Cleanup failures remain isolated from resource lifecycle state.
* The behavior depends only on run closure, so it applies equally to
  completion, cancellation, reload, and source supersession.
```

REFACTOR tasks:

- [x] Drain cleanup registrations without function-identity deduplication.
- [x] Ensure duplicate registrations represent separate cleanup obligations.
- [x] Keep cleanup behavior independent of transport type.
- [x] Run async-runtime test and typecheck after refactoring.

Exit condition:

- [x] `onSuccess` runs at most once for a run.
- [x] A late-created subscription cannot leak after its run has closed.
- [x] Emissions after `done()` are ignored.

### Phase 3 Completion Record

```txt
Date: 2026-08-13

refactor baseline: passed, 2 focused tests and 24 skipped
refactor verification: passed, 2 focused tests and 24 skipped
stream regression: passed, 1 file and 26 tests
async-runtime regression: passed, 5 files and 71 tests
async-runtime typecheck: passed
async-runtime build: passed, CJS/ESM/DTS outputs generated

Notes:
* This was a GREEN-to-GREEN TDD refactor because Cycles 3A and 3B already
  specified the required public behavior.
* Cleanup registrations are detached from the run before execution and are
  drained in their existing LIFO order.
* No function-identity deduplication occurs; duplicate registrations remain
  separate teardown obligations.
* Lifecycle cleanup remains expressed only as StreamCleanup callbacks, without
  WebSocket, SSE, Observable, or framework-specific transport assumptions.
* Completion closes run authority, invokes onSuccess at most once, rejects all
  later mutations, and immediately tears down cleanup registered after close.
```

## Phase 4: Push Producers Can Fail Explicitly

Tracer bullet:

```txt
a callback-based producer can fail the active stream through ctx.fail(error)
```

### Cycle 4A: Callback Failure

- [x] RED: Add one test whose producer returns after registering a callback.
- [x] RED: Call `ctx.fail(error)` through the retained callback.
- [x] RED: Assert error value, `error` status, interruption policy, cleanup, and
  `onErrorEffect`.
- [x] RED: Run the focused test and confirm the missing `fail()` behavior.
- [x] GREEN: Add the error generic and `fail(error)` to `StreamContext`.
- [x] GREEN: Implement one terminal error transition.
- [x] GREEN: Make the focused and existing tests pass.

#### Cycle 4A Completion Record

```txt
Date: 2026-08-13

RED: failed as expected with "ctx.fail is not a function"
GREEN: focused test passed, 1 test passed and 26 skipped
stream regression: passed, 1 file and 27 tests
async-runtime regression: passed, 5 files and 72 tests
async-runtime typecheck: passed
async-runtime build: passed, CJS/ESM/DTS outputs generated

Notes:
* StreamContext now carries the resource error type as an optional third
  generic and exposes fail(error).
* A retained push callback can fail an active run after the producer function
  has returned.
* Callback failure first closes run authority, then applies the configured
  error policy, records the error status, drains cleanup, and invokes
  onErrorEffect.
* Failure is terminal but is not reported as cancellation and does not abort
  the run signal.
* Promise rejection retains its existing path until Cycle 4C unifies producer
  failures.
```

### Cycle 4B: Failure Isolation

- [x] RED: Add one test proving stale-run `fail()` is ignored.
- [x] GREEN: Make the stale failure test pass without changing active state.
- [x] RED: Add one test proving repeated `fail()` affects state and effects once.
- [x] GREEN: Make repeated failure idempotent.
- [x] Run the focused and existing tests after each cycle.

#### Cycle 4B Completion Record

```txt
Date: 2026-08-13

stale failure characterization: passed directly GREEN,
                                1 test passed and 27 skipped
stream regression after stale failure: passed, 1 file and 28 tests
repeated failure characterization: passed directly GREEN,
                                   1 test passed and 28 skipped
stream regression after repeated failure: passed, 1 file and 29 tests
async-runtime regression: passed, 5 files and 74 tests
async-runtime typecheck: passed
async-runtime build: passed, CJS/ESM/DTS outputs generated

Notes:
* Both new behavior tests passed without a production change because Cycle 4A
  already made failure a terminal active-run transition.
* A superseded context cannot close the replacement run, overwrite its value,
  set its error, or invoke its error effect.
* The first fail(error) closes run authority, so later failures from the same
  context cannot replace the committed error or rerun cleanup and effects.
* The tests retain only public StreamContext references and do not inspect
  internal run identity or closed flags.
```

### Cycle 4C: Unified Error Path

- [x] RED: Add or tighten tests comparing synchronous throw, Promise rejection,
  and `ctx.fail()`.
- [x] RED: Assert all three forms have the same observable error-policy result.
- [x] GREEN: Route all producer failures through the same terminal path.
- [x] GREEN: Confirm Promise fulfillment still does not imply `done()`.
- [x] Run the focused and existing tests.

#### Cycle 4C Completion Record

```txt
Date: 2026-08-13

failure parity RED: failed as expected because synchronous throw executed
                    0 registered cleanups
failure parity GREEN: passed, 1 test passed and 29 skipped
fulfillment characterization: passed directly GREEN,
                              1 test passed and 30 skipped
combined focused verification: passed, 2 tests passed and 29 skipped
stream regression: passed, 1 file and 31 tests
async-runtime regression: passed, 5 files and 76 tests
async-runtime typecheck: passed
async-runtime build: passed, CJS/ESM/DTS outputs generated

Notes:
* Synchronous throw, returned Promise rejection, and ctx.fail(error) now enter
  the same failRun() terminal transition.
* All three forms record the same error, apply rollback, drain cleanup, invoke
  onErrorEffect once, and reject later context emissions.
* Stale Promise rejection remains harmless because failRun() owns the active
  run guard.
* Producer Promise fulfillment leaves the run open and does not commit stable
  value or imply done(); retained push callbacks may continue emitting.
```

REFACTOR tasks:

- [x] Remove duplicated error transition code.
- [x] Keep producer failure separate from transport retry policy.
- [x] Run async-runtime test and typecheck after refactoring.

Exit condition:

- [x] All error policies work for returned Promise errors and callback failure.
- [x] Promise fulfillment still does not imply completion.
- [x] Closed-run failures cannot change state or rerun effects.

### Phase 4 Completion Record

```txt
Date: 2026-08-13

focused baseline: passed, 5 tests passed and 26 skipped
callback error-policy matrix: passed directly GREEN,
                              1 test passed and 31 skipped
stream regression: passed, 1 file and 32 tests
async-runtime regression: passed, 5 files and 77 tests
async-runtime typecheck: passed
async-runtime build: passed, CJS/ESM/DTS outputs generated

Notes:
* Cycle 4C removed the former Promise-catch error transition duplication;
  ctx.fail(), synchronous throw, and Promise rejection now share failRun().
* Callback failure was verified against rollback, keep-partial, and clear with
  distinct initial, stable, and partial values so each policy branch has an
  observable result.
* Returned Promise rejection already has direct coverage for all three error
  policies.
* Promise fulfillment remains non-terminal, while stale and repeated failures
  cannot alter state or rerun cleanup and effects.
* The runtime terminates failed runs but defines no reconnect, backoff, or retry
  behavior; those transport policies remain producer or application concerns.
```

## Phase 5: Dispose Permanently Stops The Resource

Tracer bullet:

```txt
dispose closes the active run and prevents future input changes from restarting it
```

### Cycle 5A: Active Disposal

- [x] RED: Add one test that disposes an active stream.
- [x] RED: Assert its signal aborts and cleanup runs exactly once.
- [x] RED: Change tracked input and call `reload()` after disposal.
- [x] RED: Assert no later producer session starts.
- [x] RED: Run the focused test and confirm the expected failure.
- [x] GREEN: Add `dispose()` to `StreamAsyncMeta`.
- [x] GREEN: Retain and invoke the disposer returned by internal
  `createEffect()`.
- [x] GREEN: Guard input observation and manual reload after disposal.
- [x] GREEN: Make the focused and existing tests pass.

#### Cycle 5A Completion Record

```txt
Date: 2026-08-13

RED: failed as expected with "meta.dispose is not a function"
GREEN: focused test passed, 1 test passed and 32 skipped
stream regression: passed, 1 file and 33 tests
async-runtime regression: passed, 5 files and 78 tests
async-runtime typecheck: passed
async-runtime build: passed, CJS/ESM/DTS outputs generated

Notes:
* StreamAsyncMeta now exposes dispose().
* Disposal marks the resource permanently disposed, stops the internal
  createEffect(), and tears down the active run through cancellation cleanup.
* Active disposal aborts the producer signal and drains each cleanup
  registration once.
* Both reactive input invalidation and manual reload are guarded after
  disposal, so neither path can start another producer session.
* Idempotency and terminal-state policy remain scoped to Cycle 5B tests.
```

### Cycle 5B: Disposal Idempotency And Terminal State

- [x] RED: Add one test proving repeated `dispose()` is a no-op.
- [x] GREEN: Make repeated disposal idempotent.
- [x] RED: Add one test disposing an already completed resource.
- [x] RED: Assert committed value, stable value, and terminal state are retained.
- [x] GREEN: Preserve terminal state when no active run exists.
- [x] RED: Add or tighten a test that active disposal applies cancel policy and
  enters `cancelled`.
- [x] GREEN: Make active disposal follow the documented policy.
- [x] Run the focused and existing tests after each cycle.

#### Cycle 5B Completion Record

```txt
Date: 2026-08-13

repeated disposal characterization: passed directly GREEN,
                                   1 test passed and 33 skipped
stream regression after idempotency: passed, 1 file and 34 tests
completed disposal characterization: passed directly GREEN,
                                    1 test passed and 34 skipped
stream regression after terminal preservation: passed, 1 file and 35 tests
active policy characterization: passed directly GREEN,
                                1 test passed and 35 skipped
combined focused verification: passed, 3 tests passed and 33 skipped
stream regression: passed, 1 file and 36 tests
async-runtime regression: passed, 5 files and 81 tests
async-runtime typecheck: passed
async-runtime build: passed, CJS/ESM/DTS outputs generated

Notes:
* All three tests passed without production changes because Cycle 5A already
  separated permanent resource disposal from active-run cancellation.
* Repeated dispose() calls do not abort, clean up, or transition state again.
* Disposing after done() preserves visible value, stable value, success status,
  and the completed signal state while still stopping reactive observation.
* Disposing an active run aborts it, applies the configured onCancel policy,
  and enters cancelled; keep-partial coverage proves disposal is more than an
  AbortSignal operation.
```

REFACTOR tasks:

- [x] Keep `cancel()` and `dispose()` paths explicit: cancellation is temporary,
  disposal is permanent.
- [x] Remove lifecycle branches made obsolete by the disposer.
- [x] Run async-runtime test, typecheck, and build after refactoring.

Exit condition:

- [x] The disposed resource has no remaining reactive observation.
- [x] The disposed resource has no active producer or pending deferred start.
- [x] Public declarations include `dispose()` correctly.

### Phase 5 Completion Record

```txt
Date: 2026-08-13

deferred disposal characterization: passed directly GREEN,
                                   1 test passed and 36 skipped
tightened reload-input assertion RED: failed as expected because disposed
                                     reload read input a second time
tightened assertion GREEN: passed, 1 test passed and 36 skipped
Phase 5 focused verification: passed, 5 tests passed and 32 skipped
stream regression: passed, 1 file and 37 tests
async-runtime regression: passed, 5 files and 82 tests
async-runtime typecheck: passed
async-runtime build: passed, CJS/ESM/DTS outputs generated

Notes:
* Synchronous disposal closes the pending run before deferred producer
  invocation, so no producer setup begins after ownership ends.
* Disposed reload now returns before evaluating input, making it a complete
  no-op rather than only blocking producer replacement.
* cancel() and dispose() remain distinct public paths. They share only the
  active-run cancellation transition; dispose() additionally marks permanent
  ownership termination and stops reactive observation.
* The createEffect disposer makes callback-level disposed guards unnecessary;
  manual reload retains its own outer guard because it is an independent entry.
* Input invalidation, reload, active teardown, deferred start, idempotency,
  terminal-state preservation, and generated dispose() declarations all have
  direct verification.
```

## Phase 6: Adapter Ownership Audit

The public metadata change may require adapter test fixtures and types to add
`dispose()`, but adapters must not take ownership implicitly.

### Tasks

- [x] Locate every React and Vue structural `StreamAsyncMeta` fixture.
- [x] Add or tighten a Vue characterization test showing scope disposal does not
  automatically dispose an externally supplied stream resource.
- [x] Add or tighten the equivalent React unmount characterization test.
- [x] Run each focused adapter test and confirm it protects ownership behavior.
- [x] GREEN: Update structural metadata fixtures with `dispose()`.
- [x] GREEN: Update exported adapter types affected by the new meta surface.
- [x] GREEN: Continue exposing the original `meta`, including `dispose()`.
- [x] Confirm no unconditional Vue `onScopeDispose(meta.dispose)` is added.
- [x] Confirm no unconditional React effect cleanup owns the resource.
- [x] Run React adapter test and typecheck.
- [x] Run Vue adapter test and typecheck.

Optional follow-up API requires a separate decision:

```txt
explicit adapter-owned or opt-in disposal
```

Exit condition:

- [x] Shared graph resources survive consumer unmount.
- [x] Application code can explicitly connect `meta.dispose()` to an owning
  scope.
- [x] Adapter documentation does not imply component ownership by default.

### Phase 6 Completion Record

```txt
Date: 2026-08-17

initial React adapter typecheck: passed directly GREEN
initial Vue adapter typecheck: passed directly GREEN
Vue ownership characterization: passed directly GREEN,
                                1 test passed and 8 skipped
Vue adapter regression: passed, 1 file and 9 tests
React ownership characterization: passed directly GREEN,
                                  1 test passed and 11 skipped
React adapter regression: passed, 1 file and 12 tests
React adapter typecheck and build: passed, CJS/ESM/DTS outputs generated
Vue adapter typecheck and build: passed, CJS/ESM/DTS outputs generated

Notes:
* React and Vue each had one structural StreamAsyncMeta fixture; both now
  include dispose() and verify that adapter teardown does not invoke it.
* The ownership tests passed without adapter runtime changes because existing
  teardown already owns only adapter-created subscriptions.
* React returns the original generic metadata M. Vue retains meta: M on
  VueStreamResource. Generated declarations therefore preserve dispose()
  without adding a new adapter-specific lifecycle API.
* Vue scope stop and React unmount do not call cancel() or dispose(). Application
  code can still invoke the original meta.dispose() from an explicitly owning
  lifecycle.
* README, AI_USAGE, and adapter RFC guidance now state that component or scope
  disposal does not imply ownership of a shared stream resource.
```

## Phase 7: Push Transport Proof

Prove the public API with a framework-neutral fake push transport before
depending on browser networking in unit tests.

Tracer bullet:

```txt
a subscription source removes its old listener and rejects stale events after resubscription
```

### Cycle 7A: Framework-Neutral Subscription Proof

- [x] Build a small fake push transport inside the test file.
- [x] RED: Add one test proving a listener can emit after the producer function
  returns.
- [x] GREEN: Make multiple pushed events update visible value through public
  APIs.
- [x] Run the focused and existing tests.
- [x] RED: Add one test changing source identity and asserting the old listener
  is removed.
- [x] GREEN: Make source replacement unsubscribe exactly once.
- [x] Run the focused and existing tests.
- [x] RED: Add one test pushing an event through the retained old listener.
- [x] GREEN: Make the stale event leave active state unchanged.
- [x] Run the focused and existing tests.
- [x] RED: Add one test reporting an error through the push callback.
- [x] GREEN: Make callback failure use the terminal error contract.
- [x] Run the focused and existing tests.
- [x] RED: Add one test disposing the active subscription.
- [x] GREEN: Make disposal remove the active listener exactly once.
- [x] Run the focused and existing tests.
- [x] REFACTOR: Keep the fake transport local to tests and free of framework
  assumptions.

### Cycle 7A Completion Record

```txt
Date: 2026-08-17

producer-return push characterization: passed directly GREEN
source replacement characterization: passed directly GREEN
retained stale listener characterization: passed directly GREEN
push callback failure characterization: passed directly GREEN
active subscription disposal characterization: passed directly GREEN
async-runtime regression: passed, 5 files and 87 tests
async-runtime typecheck: passed
async-runtime build: passed, CJS/ESM/DTS outputs generated

Notes:
* Five public behavior tests use a test-local callback subscription transport.
* Producer return remains distinct from done(); pushed events continue to update
  a pending or streaming run after setup returns.
* Source replacement and disposal unsubscribe exactly once. A retained callback
  from a closed run cannot mutate active state.
* Callback errors use the same terminal error and cleanup contract as producer
  failures.
* All characterization tests passed directly GREEN because Phases 1-5 had
  already established the required lifecycle behavior. No production runtime
  change was needed in Cycle 7A.
* The fake transport has no WebSocket, EventSource, DOM, or framework type
  dependency.
```

After the runtime proof is green, evaluate migrating the existing Nuxt job
monitor SSE ownership into `createStreamResource()`. That example is useful
integration evidence, but it must not determine the runtime API.

### Cycle 7B: Existing SSE Example Evaluation

- [x] Document how the Nuxt job monitor currently owns EventSource
  subscription and cleanup.
- [x] Decide whether migration proves the new public API without obscuring the
  example's Vue-versus-kernel comparison.
- [x] When adopted, migrate one SSE ownership path at a time with focused tests.
- [x] The deferral branch is not applicable because the kernel-owned migration
  was adopted.

Exit condition:

- [x] At least one push-style integration test uses only public async-runtime
  APIs.
- [x] No WebSocket, EventSource, Vue, React, or DOM dependency is added to the
  async-runtime package.
- [x] Producer return remains distinct from explicit stream completion.

### Phase 7 Completion Record

```txt
Date: 2026-08-17

Pre-migration ownership:
* createNuxtJobTransport() constructed EventSource and returned unsubscribe.
* createJobKernel() stored that unsubscribe in stopEvents and called it from
  stop().
* vue-owned.vue separately stored unsubscribe and released it from
  onBeforeUnmount().

Decision:
* Adopt migration only for the kernel-owned path.
* Keep the Vue-owned lifecycle path unchanged as the comparison baseline.
* Keep EventSource construction, parsing, and reconnect notifications in the
  transport rather than async-runtime.

Migration evidence:
* jobEventsResource owns the kernel subscription run through public
  createStreamResource(), StreamContext, and StreamAsyncMeta APIs.
* start() enables a restartable source; stop() synchronously cancels the active
  run and then disables the source.
* Pushed events update both the stream resource value and the job graph after
  passing the active-run guard.
* Retained callbacks cannot update the graph after stop().
* EventSource-style reconnect errors remain transport notifications and do not
  become terminal ctx.fail() transitions.
* Snapshot registers the real jobEventsResource as inspect-only metadata and
  does not claim live SSE restoration.

Verification:
* Nuxt focused RED confirmed jobEventsResource was absent before migration.
* Synchronous stop RED confirmed signal-only disable delayed cleanup.
* Inspect-only snapshot RED confirmed the old synthetic stream tuple remained.
* Nuxt job monitor regression passed, 2 files and 14 tests.
* Nuxt job monitor typecheck passed.
* Nuxt job monitor production build passed.
* Async-runtime regression passed, 5 files and 87 tests.
* Async-runtime typecheck passed.
```

## Phase 8: Refactor, Documentation, And Verification

While all tests are green:

### Refactor Tasks

- [ ] Simplify active-run lifecycle code.
- [ ] Remove obsolete shared cancellation state.
- [ ] Keep terminal transitions behind one internal boundary.
- [ ] Review cleanup reentrancy and exactly-once behavior.
- [ ] Confirm closed-run guards are applied consistently.
- [ ] Run focused tests after each refactor step.

### Documentation Tasks

- [ ] Update `packages/async-runtime/README.md`.
- [ ] Update `packages/async-runtime/AI_USAGE.md`.
- [ ] Update React package documentation only if its public surface changes.
- [ ] Update Vue package documentation only if its public surface changes.
- [ ] Verify examples still teach object-form descriptors.
- [ ] Add release notes for the v0.4 lifecycle contract.

### Verification Tasks

- [ ] Run async-runtime tests.
- [ ] Run async-runtime typecheck.
- [ ] Run async-runtime build.
- [ ] Run React adapter tests.
- [ ] Run Vue adapter tests.
- [ ] Run repository-wide typecheck.
- [ ] Run repository-wide tests.
- [ ] Review the final diff for unrelated changes.
- [ ] Run `git diff --check`.

Final commands:

```sh
pnpm --filter @signal-kernel/async-runtime test
pnpm --filter @signal-kernel/async-runtime typecheck
pnpm --filter @signal-kernel/async-runtime build
pnpm --filter @signal-kernel/react test
pnpm --filter @signal-kernel/vue test
pnpm -r typecheck
pnpm -r test
```

## Acceptance Criteria

The work is complete when:

- [ ] Existing finite and LLM-style stream producers remain source-compatible.
- [ ] Push producers can abort, clean up, fail, complete, and dispose.
- [ ] Every closed run rejects stale callbacks.
- [ ] Cleanup is deterministic and exactly once per registration.
- [ ] `dispose()` permanently stops reactive observation.
- [ ] Framework adapters do not implicitly own shared resources.
- [ ] SSE, WebSocket, Observable, and event subscription patterns can be
  expressed without transport-specific runtime APIs.
- [ ] Runtime, adapter, and repository verification commands pass.

## Release Guidance

This is primarily an additive public API change, but it also tightens terminal
behavior by ignoring emissions after `done()`, `fail()`, cancellation, or
disposal.

For the current `0.x` line, publish it as `@signal-kernel/async-runtime` v0.4
rather than hiding the lifecycle change in a patch release.

Release notes should call out:

* new `StreamContext.signal`
* new `StreamContext.onCleanup()`
* new `StreamContext.fail()`
* new `StreamAsyncMeta.dispose()`
* actual producer cancellation and stale callback protection
* unchanged finite stream and object-form descriptor usage
