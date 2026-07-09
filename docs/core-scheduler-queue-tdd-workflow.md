# Core Scheduler Queue TDD Workflow

Status: planning workflow

## Purpose

This document defines the TDD workflow for optimizing the internal scheduler queue in `@signal-kernel/core`.

The optimization target is the computed scheduler queue. The current implementation uses `Set` plus `Array.from()` during flush. That is simple and correct, but it creates a full array copy for every computed flush batch.

The proposed direction is to evaluate an internal deduped linked queue for computed jobs while keeping the public core API and scheduler semantics unchanged.

This is an implementation optimization, not a public API redesign.

## Architectural Boundary

Core continues to own graph scheduling semantics.

This work must not introduce:

* React, Vue, DOM, or renderer lifecycle assumptions.
* Async resource policy.
* Snapshot encoding behavior.
* Framework adapter behavior.

Downstream packages should not need API changes if this work succeeds.

## Non-Goals

This workflow does not try to optimize every graph data structure.

The following structures should stay unchanged unless benchmark data later proves otherwise:

* Graph `deps` and `subs` sets.
* Atomic write logs.
* Effect registry symbol storage.
* Effect priority scheduling.

In particular, the atomic write log should remain iterable. A `WeakMap` is not a good replacement for rollback logs because rollback needs to iterate written nodes and previous values.

## Current Scheduler Semantics To Preserve

Any queue implementation must preserve these observable behaviors:

* A disposed job is not scheduled.
* The same job scheduled multiple times before flush runs once.
* Computed jobs run before effect jobs.
* Computed jobs produced during effect execution run in the next scheduler loop before later effect work.
* `batch()` defers flushing until the outermost batch exits.
* `atomic()` and `transaction()` commit flush normally.
* `atomic()` and `transaction()` rollback restores values, marks downstream computed nodes stale, and clears pending queues.
* `flushSync()` is a no-op when there is no scheduled work.
* Effect priority ordering remains unchanged.

## Design Hypothesis

A linked list alone is not enough to replace `Set`.

The current `Set` provides two behaviors:

* Queue membership dedupe.
* Iteration order.

A linked list can provide queue order and O(1) dequeue, but it cannot provide O(1) dedupe without another membership mechanism.

The preferred implementation direction is an intrusive queue:

* The linked list owns ordering.
* A non-enumerable symbol slot on the job owns membership.
* Dequeue clears the symbol slot.
* Queue clear also clears all symbol slots.

This matches the existing `EffectSlot` strategy in `registry.ts` and avoids introducing another long-lived `Map`.

## First Optimization Scope

Start with computed jobs only.

The computed queue has no priority ordering, so it is the safest place to validate the queue structure.

The effect queue should remain `Set` plus priority sort for the first pass. This preserves current effect ordering and keeps the optimization narrow.

## TDD Rules

Use vertical slices.

Do not write all tests first and then rewrite the scheduler. Each cycle should follow:

```txt
RED: Add or tighten one behavior test.
GREEN: Make the smallest implementation change.
REFACTOR: Improve the internal queue only while tests are green.
```

Tests should verify scheduler behavior through exported core APIs or exported scheduler functions already used by core tests. They should not assert linked list internals, symbol names, node shapes, or queue entry structures.

## Phase 0: Baseline

Before changing the scheduler:

1. Run existing core tests.
2. Run full package typecheck if the scheduler type surface changes.
3. Record the current scheduler behavior tests as the baseline.

Suggested commands:

```sh
pnpm --filter @signal-kernel/core test
pnpm --filter @signal-kernel/core typecheck
```

Optional benchmark baseline:

```sh
pnpm --filter @signal-kernel/core bench
```

Only add the benchmark command after a benchmark script exists.

### Phase 0 Baseline Record

Recorded on 2026-07-09 before changing scheduler internals.

Current core test surface:

```txt
packages/core/src/__tests__/scheduler.test.ts
```

Existing scheduler tests:

* `runs computed before effects in the same tick`
* `effects are sorted by priority (small -> large)`
* `computed produced during effects runs in the next loop before next effects`
* `batch(): defers flush until batch exit`
* `transaction(): commit keeps changes and flushes normally`
* `transaction(): rollback restores values, marks downstream computed stale, and clears queues`
* `nested atomic: inner commit + outer rollback restores all written nodes`
* `inAtomic() reflects current atomic depth`
* `flushSync() no-ops when nothing scheduled`
* `scheduleJob respects disposed flag`

Baseline command results:

```txt
pnpm.cmd --filter @signal-kernel/core test
1 test file passed, 10 tests passed.

pnpm.cmd --filter @signal-kernel/core typecheck
TypeScript passed with no errors.
```

Notes:

* The current core test suite is scheduler-focused. It does not yet provide broad public-API characterization tests for `signal()`, `computed()`, `createEffect()`, and `batch()` working together.
* The rollback scheduler test currently logs an expected `Error: boom` through `console.error` while still passing. This is baseline behavior, not a scheduler failure.
* No core benchmark script exists yet, so Phase 0 has no benchmark baseline.
* On Windows PowerShell, use `pnpm.cmd` if `pnpm.ps1` is blocked by execution policy.

## Phase 1: Characterization Tests

Add characterization tests before changing queue internals.

These tests may pass immediately with the current implementation. That is acceptable because their job is to lock behavior before refactoring.

Recommended tests:

* `scheduleJob dedupes repeated computed jobs before flush`
* `batch dedupes repeated computed jobs until batch exits`
* `rollback clears pending computed jobs`
* `computed jobs scheduled during effects run in a later scheduler loop`
* `effect priority ordering is unchanged while computed queue changes`

The first new tracer bullet should be:

```txt
same computed job scheduled many times before flush runs once
```

This test protects the most important behavior currently provided by `Set`.

### Phase 1 Characterization Record

Recorded on 2026-07-09.

Added characterization tests:

* `scheduleJob dedupes repeated computed jobs before flush`
* `batch dedupes repeated computed jobs until batch exits`
* `transaction rollback clears pending computed jobs before they run`
* `runs computed before priority-sorted effects in a mixed flush`
* `dedupes computed jobs scheduled during an effect before the next loop`

Command results:

```txt
pnpm.cmd --filter @signal-kernel/core test
1 test file passed, 15 tests passed.

pnpm.cmd --filter @signal-kernel/core typecheck
TypeScript passed with no errors.
```

Notes:

* No scheduler implementation code changed in Phase 1.
* These tests intentionally pass against the current `Set`-based queue. Their job is to preserve existing behavior before replacing the computed queue internals.
* The effect queue remains protected by both standalone priority tests and a mixed computed/effect flush test.

## Phase 2: Introduce Internal Queue Module

Create a small internal queue module only if the tests justify the implementation change.

Candidate file:

```txt
packages/core/src/dedupedJobQueue.ts
```

Candidate internal shape:

```ts
type QueueEntry<T> = {
  value: T;
  prev: QueueEntry<T> | null;
  next: QueueEntry<T> | null;
};
```

The public scheduler API must not expose this module.

The first implementation should support:

* `enqueue(job)`
* `shift()`
* `clear()`
* `size`

Avoid adding priority behavior in this module during the first pass.

### Phase 2 Internal Queue Record

Recorded on 2026-07-09.

Added files:

```txt
packages/core/src/dedupedJobQueue.ts
packages/core/src/__tests__/dedupedJobQueue.test.ts
```

Implemented internal queue behaviors:

* FIFO insertion and shifting.
* O(1) membership dedupe through a private symbol slot on the queued job.
* `shift()` clears the membership slot so the same job can be queued again.
* `clear()` clears all membership slots so rollback-style queue clearing can safely requeue jobs later.
* `size` tracks queued jobs.

Command results:

```txt
pnpm.cmd --filter @signal-kernel/core test
2 test files passed, 19 tests passed.

pnpm.cmd --filter @signal-kernel/core typecheck
TypeScript passed with no errors.
```

Notes:

* The new queue is internal and is not exported from the package public API.
* The scheduler has not been changed yet. Phase 2 only introduces and tests the queue module.
* Priority behavior is intentionally absent from `dedupedJobQueue.ts`; effect queue behavior remains a Phase 5 decision if benchmarks ever justify it.

## Phase 3: Replace Computed Queue Only

Replace only the computed queue path.

Do not change the effect queue in the same step.

The scheduler should still read as a two-phase scheduler:

```txt
while computed queue has jobs:
  run computed jobs

if effect queue has jobs:
  sort effects by priority
  run effects
```

The implementation may stop using `Array.from(computeQ)` for computed jobs, but behavior must remain identical.

Rollback must clear the computed queue and all queue membership slots.

### Phase 3 Computed Queue Replacement Record

Recorded on 2026-07-09.

Added scheduler guard test:

* `transaction rollback allows the same computed job to be scheduled again`

Changed implementation:

* `computeQ` now uses `createDedupedJobQueue<Job>()`.
* Computed jobs are scheduled through `computeQ.enqueue(job)`.
* Computed flush uses `batchSize` plus `shift()` instead of `Array.from(computeQ)`.
* Computed batch boundaries are preserved: computed jobs scheduled while a computed batch is running are left for the next computed batch before effects run.
* Rollback still calls `computeQ.clear()`, which now also clears queue membership slots.
* `effectQ` remains `Set` plus `Array.from(effectQ).sort(...)`.

Command results:

```txt
pnpm.cmd --filter @signal-kernel/core test
2 test files passed, 20 tests passed.

pnpm.cmd --filter @signal-kernel/core typecheck
TypeScript passed with no errors.
```

Notes:

* `Array.from(computeQ)` has been removed.
* `Array.from(effectQ)` remains intentionally unchanged because effect queue priority ordering is outside Phase 3.
* No downstream package API changes are required.

## Phase 4: Benchmark

After behavior tests pass, add or run benchmark cases that measure the scheduler workload directly.

Useful benchmark dimensions:

* enqueue cost
* dedupe cost
* flush cost
* cascade cost
* wide fanout graph cost
* mixed computed and effect queue cost

Suggested input sizes:

```txt
100
1_000
10_000
100_000
```

Suggested metrics:

* enqueueMs
* flushMs
* totalMs
* jobRunCount
* heapUsedDelta, optional

The benchmark should compare the current baseline against the linked computed queue.

Do not keep a more complex queue if it only improves one synthetic case while making normal scheduler behavior slower or harder to maintain.

### Phase 4 Benchmark Record

Recorded on 2026-07-09.

Added files and scripts:

```txt
packages/core/bench/scheduler.bench.ts
packages/core/package.json -> bench script
```

Benchmark command:

```txt
pnpm.cmd --filter @signal-kernel/core bench
```

The script runs:

```txt
vitest bench --run bench/scheduler.bench.ts
```

Benchmark workloads:

* enqueue and flush distinct computed jobs
* dedupe repeated scheduling of the same computed job
* cascade through computed jobs scheduled by previous computed jobs

Input sizes:

```txt
100
1_000
10_000
```

Local benchmark result from this run:

```txt
enqueue and flush 100 distinct computed jobs       mean 0.0279 ms
enqueue and flush 1000 distinct computed jobs      mean 0.2733 ms
enqueue and flush 10000 distinct computed jobs     mean 3.4130 ms

dedupe same computed job scheduled 100 times       mean 0.0038 ms
dedupe same computed job scheduled 1000 times      mean 0.0288 ms
dedupe same computed job scheduled 10000 times     mean 0.2802 ms

cascade through 100 computed jobs                  mean 0.0399 ms
cascade through 1000 computed jobs                 mean 0.3174 ms
cascade through 10000 computed jobs                mean 3.2021 ms
```

Command results:

```txt
pnpm.cmd --filter @signal-kernel/core bench
1 benchmark file passed.

pnpm.cmd --filter @signal-kernel/core test
2 test files passed, 20 tests passed.

pnpm.cmd --filter @signal-kernel/core typecheck
TypeScript passed with no errors.
```

Notes:

* These numbers are local benchmark observations, not release guarantees.
* This benchmark was added after replacing the computed queue, so it is a post-change baseline for future scheduler work.
* No pre-change benchmark exists for direct numeric comparison because Phase 0 had no benchmark script.
* Phase 4 initially targeted scheduler computed queue workloads. Phase 5 extends the same benchmark file with effect queue decision data.

## Phase 5: Decide Whether Effect Queue Needs Work

Do not optimize the effect queue unless benchmark or profiling data shows that `Array.from(effectQ).sort(...)` is a real cost.

If effect queue optimization becomes necessary, evaluate separately:

* Sorted linked insertion.
* Priority buckets.
* Keeping `Set` plus sort.

This decision should be documented before implementation because effect priority ordering is observable scheduler behavior.

### Phase 5 Effect Queue Decision Record

Recorded on 2026-07-09.

Added benchmark workloads:

* enqueue and flush priority-sorted effect jobs
* enqueue and flush mixed computed plus priority-sorted effect jobs

Input sizes:

```txt
100
1_000
10_000
```

Local benchmark result from this run:

```txt
enqueue and flush 100 priority-sorted effect jobs                         mean 0.0091 ms
enqueue and flush 1000 priority-sorted effect jobs                        mean 0.0705 ms
enqueue and flush 10000 priority-sorted effect jobs                       mean 0.9197 ms

enqueue and flush 100 computed plus 100 priority-sorted effect jobs       mean 0.0357 ms
enqueue and flush 1000 computed plus 1000 priority-sorted effect jobs     mean 0.3400 ms
enqueue and flush 10000 computed plus 10000 priority-sorted effect jobs   mean 4.4357 ms
```

Decision:

```txt
Keep effectQ as Set plus Array.from(effectQ).sort(...).
Do not optimize the effect queue in this phase.
```

Rationale:

* The benchmark does not show effect priority sorting as an obvious current bottleneck.
* In this local run, flushing 10,000 priority-sorted effect jobs had a mean of `0.9197 ms`.
* The same run measured 10,000 distinct computed jobs at `2.6898 ms`.
* Changing effect queue internals now would add complexity around observable priority ordering without enough evidence.
* Revisit only if production-style profiling or larger graph benchmarks show `Array.from(effectQ).sort(...)` dominating scheduler cost.

Command results:

```txt
pnpm.cmd --filter @signal-kernel/core bench
1 benchmark file passed.

pnpm.cmd --filter @signal-kernel/core test
2 test files passed, 20 tests passed.

pnpm.cmd --filter @signal-kernel/core typecheck
TypeScript passed with no errors.
```

## Acceptance Criteria

This optimization is complete when:

* Core tests pass.
* Scheduler behavior tests cover dedupe, batching, rollback, computed-before-effect ordering, and effect priority preservation.
* Downstream packages require no API changes.
* Computed queue no longer needs `Array.from()` during flush.
* Effect queue behavior is unchanged.
* Any benchmark result is recorded with enough context to explain the tradeoff.

## Release Note Guidance

If public behavior does not change, this should be treated as a patch-level core optimization.

A release note can describe it as:

```txt
Improve internal computed scheduler queue behavior without changing public graph semantics.
```

Do not present this as a new API feature.
