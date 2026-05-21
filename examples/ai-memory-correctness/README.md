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

This directory currently implements Task 1 and Task 2 from the RFC.

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

No signal-kernel graph wiring is active yet.

## Run

```sh
pnpm -F @signal-kernel/example-ai-memory-correctness dev
```

The dev server uses port `5178`.

## Typecheck

```sh
pnpm -F @signal-kernel/example-ai-memory-correctness typecheck
```

## Planned Phases

```txt
Task 1: static demo shell and domain model
Task 2: local memory driver and failure injection
Task 3: signal-kernel memory graph
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

V1 should not define:

* a production memory provider
* a vector database integration
* a full AI runtime
* durable replay semantics
* the final `@signal-kernel/snapshot` package format
* a published `@signal-kernel/memory-runtime` package
