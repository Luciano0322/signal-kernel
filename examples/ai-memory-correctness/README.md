# AI Memory Correctness Example

This example demonstrates how `signal-kernel` can model AI memory as a correctness-sensitive runtime lifecycle.

It does not try to replace LangGraph, TanStack AI, Vercel AI SDK, mem0, Hindsight, or Honcho.

The narrower claim is:

```txt
AI memory is not only storage and retrieval.
It is a lifecycle that can suffer from stale recall, derived prompt drift,
partial retain failures, and weak inspection boundaries.
```

## Current Status

This directory currently implements Task 1 through Task 6 from the RFC.

Task 1 provides the static shell:

* Vite + React example shell
* domain types for memory facts, candidate facts, turns, events, and snapshots
* static chat panel
* static memory panel
* static rendered prompt panel
* static timeline panel
* static graph inspector
* static snapshot inspection panel

Task 2 provides the local memory driver:

* in-memory scoped fact store
* keyword recall
* inspect snapshots
* consolidation plan application
* failure injection for partial retain scenarios
* restore helper for later retain transaction rollback
* driver tests that document the storage/runtime boundary

Task 3 currently provides the memory graph core:

* `createMemoryRuntime()`
* `createMemoryGraph()`
* `currentUserMessage` signal
* `recallQuery` computed value
* `recalledFacts` async resource through `createResource()`
* `renderedMemoryPrompt` computed value
* memory refresh invalidation through a revision signal
* tests for stale recall race and prompt derivation

Task 4 provides mock model streaming:

* deterministic mock model stream
* `modelStream` resource through `createStreamResource()`
* model stream input derived from current user message and rendered memory prompt
* generation is gated on successful recall
* cancellation keeps partial streamed text
* tests for streaming, source changes, and cancellation

Task 5 provides the retention lifecycle:

* deterministic candidate extraction
* deterministic consolidation planning
* insert / merge / supersede / skip actions
* explicit retain transaction
* rollback through driver snapshot restore
* `retainTurn` graph action
* `retainState` signal for lifecycle visibility
* tests for commit and partial-write rollback

Task 6 provides snapshot timeline inspection:

* graph-owned runtime event log
* graph-owned runtime snapshots
* manual `recordSnapshot()` action
* automatic recall and stream checkpoints
* retain commit / rollback checkpoints
* React workbench wired through `@signal-kernel/react`
* UI controls that call graph actions instead of owning memory lifecycle state
* selectable snapshot detail view for captured prompt, statuses, facts, and
  recent lifecycle events
* selectable scenario path so readers can map the UI to the RFC correctness
  cases

The React workbench now renders live graph state. It uses adapter hooks only at
the rendering boundary:

* `useSignalValue()` for graph signals
* `useComputedValue()` for derived prompt and recall status
* `useResource()` for recalled facts
* `useStreamResource()` for the mock model stream

## Run

```sh
pnpm -F @signal-kernel/example-ai-memory-correctness dev
```

The dev server uses port `5178`.

## Typecheck

```sh
pnpm -F @signal-kernel/example-ai-memory-correctness typecheck
```

## Implemented Phases

```txt
Task 1: static demo shell and domain model
Task 2: local memory driver and failure injection
Task 3: signal-kernel memory graph core
Task 4: mock model streaming
Task 5: extraction, consolidation, retain transaction
Task 6: snapshot timeline inspection and documentation
```

## V1 Boundary

V1 should prove:

* latest recall wins when async recall requests resolve out of order
* rendered memory prompts are derived state
* candidate facts are not committed memory facts
* retention commits or rolls back as an explicit lifecycle transition
* snapshots are local runtime inspection artifacts

## Snapshot Boundary

Snapshots in this example are inspection artifacts, not the final
`@signal-kernel/snapshot` format.

Each snapshot captures:

* current memory driver snapshot
* rendered memory prompt
* stream status
* retain status
* lifecycle events that happened before the snapshot

The point is to make memory lifecycle state observable before defining durable
replay, cross-runtime transfer, or a stable snapshot serialization package.

V1 should not define:

* a production memory provider
* a vector database integration
* a full AI runtime
* durable replay semantics
* the final `@signal-kernel/snapshot` package format
* a published `@signal-kernel/memory-runtime` package
