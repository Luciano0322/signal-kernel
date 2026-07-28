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

- [ ] Phase 0: Baseline
- [ ] Phase 1: Manual cancellation owns producer teardown
- [ ] Phase 2: Supersession and reload close the previous run
- [ ] Phase 3: Completion is terminal
- [ ] Phase 4: Push producers can fail explicitly
- [ ] Phase 5: Dispose permanently stops the resource
- [ ] Phase 6: Adapter ownership audit
- [ ] Phase 7: Push transport proof
- [ ] Phase 8: Refactor, documentation, and verification

## Phase 0: Baseline

Before changing runtime code:

### Tasks

- [ ] Run the existing async-runtime tests.
- [ ] Run async-runtime typecheck.
- [ ] Run the async-runtime package build.
- [ ] Confirm the existing stream characterization file contains 19 tests.
- [ ] Run the React adapter tests.
- [ ] Run the Vue adapter tests.
- [ ] Record the command results and current date under `Phase 0 Record`.
- [ ] Confirm the worktree contains no production changes from this workflow.

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
Date:

async-runtime test:
async-runtime typecheck:
async-runtime build:
React adapter test:
Vue adapter test:

Notes:
```

Exit condition:

- [ ] Baseline command results are recorded in this document.
- [ ] No production behavior has changed.

## Phase 1: Manual Cancellation Owns Producer Teardown

Tracer bullet:

```txt
cancel aborts the active producer and runs its cleanup exactly once
```

### Cycle 1A: Active Cancellation

RED tasks:

- [ ] Add one test that starts a stream and records `ctx.signal`.
- [ ] Register one observable cleanup through `ctx.onCleanup()`.
- [ ] Call `meta.cancel("manual")`.
- [ ] Assert the signal is aborted and exposes the cancellation reason.
- [ ] Assert cleanup runs exactly once.
- [ ] Assert status becomes `cancelled` and the existing interruption policy is
  preserved.
- [ ] Run the focused test and confirm it fails for the missing lifecycle
  behavior.

GREEN tasks:

- [ ] Add `StreamCleanup`, `signal`, and `onCleanup()` to the public context.
- [ ] Introduce only enough per-run lifecycle state to support active
  cancellation.
- [ ] Mark the run closed before aborting its signal.
- [ ] Drain registered cleanup obligations after the run is closed.
- [ ] Make the focused test pass.
- [ ] Run the complete async-runtime stream test file.

### Cycle 1B: Cancellation Before Producer Start

- [ ] RED: Add one test that cancels synchronously before the deferred producer
  invocation.
- [ ] RED: Assert the stale producer function is never invoked.
- [ ] RED: Run the focused test and confirm the expected failure.
- [ ] GREEN: Guard deferred producer invocation with active-run validity.
- [ ] GREEN: Make the focused and existing tests pass.

REFACTOR tasks:

- [ ] Centralize active-run validity checking.
- [ ] Remove cancellation code duplicated by the new close path.
- [ ] Run async-runtime test and typecheck after refactoring.

Exit condition:

- [ ] Add or retain coverage proving repeated `cancel()` does not run cleanup
  twice.
- [ ] Existing finite stream tests remain green.
- [ ] Phase 1 public types build successfully.

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

- [ ] RED: Add one test that captures the contexts and cleanup calls for two
  input-driven runs.
- [ ] RED: Change tracked input and assert the old signal is aborted.
- [ ] RED: Assert old cleanup completes before the replacement run becomes
  authoritative.
- [ ] RED: Invoke `emit()`, `set()`, and `done()` from the retained old context
  and assert they cannot change active state.
- [ ] RED: Run the focused test and confirm the expected failure.
- [ ] GREEN: Route input supersession through the shared close-and-replace
  behavior.
- [ ] GREEN: Make the focused and existing tests pass.

### Cycle 2B: Manual Reload

- [ ] RED: Add one test that reloads an active stream.
- [ ] RED: Assert reload aborts and cleans up the previous run exactly once.
- [ ] RED: Assert reload starts one replacement run with the current input.
- [ ] RED: Run the focused test and confirm the expected failure.
- [ ] GREEN: Route reload through the same close-and-replace behavior.
- [ ] GREEN: Preserve existing visible-value reset and stable-value behavior.
- [ ] GREEN: Make the focused and existing tests pass.

### Cycle 2C: Rapid Supersession

- [ ] RED: Add one test that changes input before the deferred old producer
  invocation starts.
- [ ] RED: Assert the superseded producer never opens a stale subscription.
- [ ] RED: Run the focused test and confirm the expected failure.
- [ ] GREEN: Skip deferred invocation for inactive runs.
- [ ] GREEN: Make the focused and existing tests pass.

REFACTOR tasks:

- [ ] Route `observe()` invalidation through the same supersession path.
- [ ] Remove shared cancellation flags once per-run state owns validity.
- [ ] Keep active run identity and internal tokens out of public behavior tests.
- [ ] Run async-runtime test and typecheck after refactoring.

Exit condition:

- [ ] Supersession cleanup occurs before the replacement producer becomes
  authoritative.
- [ ] Existing batched input and observe behavior still starts one run.
- [ ] All callbacks from old runs are stale-safe.

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

- [ ] RED: Add one test that calls `done()` and retains the completed context.
- [ ] RED: Call `emit()`, `set()`, and `done()` again from that context.
- [ ] RED: Assert visible value, stable value, status, and `onSuccess` do not
  change after the first completion.
- [ ] RED: Assert completion runs every registered cleanup once.
- [ ] RED: Run the focused test and confirm the expected failure.
- [ ] GREEN: Close the run before stable commit effects and cleanup execute.
- [ ] GREEN: Ignore every mutation from the completed context.
- [ ] GREEN: Make the focused and existing tests pass.

### Cycle 3B: Late Cleanup Registration

- [ ] RED: Add one test that cancels or completes while async setup is pending.
- [ ] RED: Register cleanup only after the run has closed.
- [ ] RED: Assert the late cleanup executes immediately and only once.
- [ ] RED: Run the focused test and confirm the expected failure.
- [ ] GREEN: Execute cleanup immediately when registration occurs on a closed
  run.
- [ ] GREEN: Make the focused and existing tests pass.

REFACTOR tasks:

- [ ] Drain cleanup registrations without function-identity deduplication.
- [ ] Ensure duplicate registrations represent separate cleanup obligations.
- [ ] Keep cleanup behavior independent of transport type.
- [ ] Run async-runtime test and typecheck after refactoring.

Exit condition:

- [ ] `onSuccess` runs at most once for a run.
- [ ] A late-created subscription cannot leak after its run has closed.
- [ ] Emissions after `done()` are ignored.

## Phase 4: Push Producers Can Fail Explicitly

Tracer bullet:

```txt
a callback-based producer can fail the active stream through ctx.fail(error)
```

### Cycle 4A: Callback Failure

- [ ] RED: Add one test whose producer returns after registering a callback.
- [ ] RED: Call `ctx.fail(error)` through the retained callback.
- [ ] RED: Assert error value, `error` status, interruption policy, cleanup, and
  `onErrorEffect`.
- [ ] RED: Run the focused test and confirm the missing `fail()` behavior.
- [ ] GREEN: Add the error generic and `fail(error)` to `StreamContext`.
- [ ] GREEN: Implement one terminal error transition.
- [ ] GREEN: Make the focused and existing tests pass.

### Cycle 4B: Failure Isolation

- [ ] RED: Add one test proving stale-run `fail()` is ignored.
- [ ] GREEN: Make the stale failure test pass without changing active state.
- [ ] RED: Add one test proving repeated `fail()` affects state and effects once.
- [ ] GREEN: Make repeated failure idempotent.
- [ ] Run the focused and existing tests after each cycle.

### Cycle 4C: Unified Error Path

- [ ] RED: Add or tighten tests comparing synchronous throw, Promise rejection,
  and `ctx.fail()`.
- [ ] RED: Assert all three forms have the same observable error-policy result.
- [ ] GREEN: Route all producer failures through the same terminal path.
- [ ] GREEN: Confirm Promise fulfillment still does not imply `done()`.
- [ ] Run the focused and existing tests.

REFACTOR tasks:

- [ ] Remove duplicated error transition code.
- [ ] Keep producer failure separate from transport retry policy.
- [ ] Run async-runtime test and typecheck after refactoring.

Exit condition:

- [ ] All error policies work for returned Promise errors and callback failure.
- [ ] Promise fulfillment still does not imply completion.
- [ ] Closed-run failures cannot change state or rerun effects.

## Phase 5: Dispose Permanently Stops The Resource

Tracer bullet:

```txt
dispose closes the active run and prevents future input changes from restarting it
```

### Cycle 5A: Active Disposal

- [ ] RED: Add one test that disposes an active stream.
- [ ] RED: Assert its signal aborts and cleanup runs exactly once.
- [ ] RED: Change tracked input and call `reload()` after disposal.
- [ ] RED: Assert no later producer session starts.
- [ ] RED: Run the focused test and confirm the expected failure.
- [ ] GREEN: Add `dispose()` to `StreamAsyncMeta`.
- [ ] GREEN: Retain and invoke the disposer returned by internal
  `createEffect()`.
- [ ] GREEN: Guard input observation and manual reload after disposal.
- [ ] GREEN: Make the focused and existing tests pass.

### Cycle 5B: Disposal Idempotency And Terminal State

- [ ] RED: Add one test proving repeated `dispose()` is a no-op.
- [ ] GREEN: Make repeated disposal idempotent.
- [ ] RED: Add one test disposing an already completed resource.
- [ ] RED: Assert committed value, stable value, and terminal state are retained.
- [ ] GREEN: Preserve terminal state when no active run exists.
- [ ] RED: Add or tighten a test that active disposal applies cancel policy and
  enters `cancelled`.
- [ ] GREEN: Make active disposal follow the documented policy.
- [ ] Run the focused and existing tests after each cycle.

REFACTOR tasks:

- [ ] Keep `cancel()` and `dispose()` paths explicit: cancellation is temporary,
  disposal is permanent.
- [ ] Remove lifecycle branches made obsolete by the disposer.
- [ ] Run async-runtime test, typecheck, and build after refactoring.

Exit condition:

- [ ] The disposed resource has no remaining reactive observation.
- [ ] The disposed resource has no active producer or pending deferred start.
- [ ] Public declarations include `dispose()` correctly.

## Phase 6: Adapter Ownership Audit

The public metadata change may require adapter test fixtures and types to add
`dispose()`, but adapters must not take ownership implicitly.

### Tasks

- [ ] Locate every React and Vue structural `StreamAsyncMeta` fixture.
- [ ] Add or tighten a Vue characterization test showing scope disposal does not
  automatically dispose an externally supplied stream resource.
- [ ] Add or tighten the equivalent React unmount characterization test.
- [ ] Run each focused adapter test and confirm it protects ownership behavior.
- [ ] GREEN: Update structural metadata fixtures with `dispose()`.
- [ ] GREEN: Update exported adapter types affected by the new meta surface.
- [ ] GREEN: Continue exposing the original `meta`, including `dispose()`.
- [ ] Confirm no unconditional Vue `onScopeDispose(meta.dispose)` is added.
- [ ] Confirm no unconditional React effect cleanup owns the resource.
- [ ] Run React adapter test and typecheck.
- [ ] Run Vue adapter test and typecheck.

Optional follow-up API requires a separate decision:

```txt
explicit adapter-owned or opt-in disposal
```

Exit condition:

- [ ] Shared graph resources survive consumer unmount.
- [ ] Application code can explicitly connect `meta.dispose()` to an owning
  scope.
- [ ] Adapter documentation does not imply component ownership by default.

## Phase 7: Push Transport Proof

Prove the public API with a framework-neutral fake push transport before
depending on browser networking in unit tests.

Tracer bullet:

```txt
a subscription source removes its old listener and rejects stale events after resubscription
```

### Cycle 7A: Framework-Neutral Subscription Proof

- [ ] Build a small fake push transport inside the test file.
- [ ] RED: Add one test proving a listener can emit after the producer function
  returns.
- [ ] GREEN: Make multiple pushed events update visible value through public
  APIs.
- [ ] Run the focused and existing tests.
- [ ] RED: Add one test changing source identity and asserting the old listener
  is removed.
- [ ] GREEN: Make source replacement unsubscribe exactly once.
- [ ] Run the focused and existing tests.
- [ ] RED: Add one test pushing an event through the retained old listener.
- [ ] GREEN: Make the stale event leave active state unchanged.
- [ ] Run the focused and existing tests.
- [ ] RED: Add one test reporting an error through the push callback.
- [ ] GREEN: Make callback failure use the terminal error contract.
- [ ] Run the focused and existing tests.
- [ ] RED: Add one test disposing the active subscription.
- [ ] GREEN: Make disposal remove the active listener exactly once.
- [ ] Run the focused and existing tests.
- [ ] REFACTOR: Keep the fake transport local to tests and free of framework
  assumptions.

After the runtime proof is green, evaluate migrating the existing Nuxt job
monitor SSE ownership into `createStreamResource()`. That example is useful
integration evidence, but it must not determine the runtime API.

### Cycle 7B: Existing SSE Example Evaluation

- [ ] Document how the Nuxt job monitor currently owns EventSource
  subscription and cleanup.
- [ ] Decide whether migration proves the new public API without obscuring the
  example's Vue-versus-kernel comparison.
- [ ] When adopted, migrate one SSE ownership path at a time with focused tests.
- [ ] When deferred, record the reason and keep the framework-neutral proof as
  the release evidence.

Exit condition:

- [ ] At least one push-style integration test uses only public async-runtime
  APIs.
- [ ] No WebSocket, EventSource, Vue, React, or DOM dependency is added to the
  async-runtime package.
- [ ] Producer return remains distinct from explicit stream completion.

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
