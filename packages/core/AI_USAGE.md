# AI Usage Guide for `@signal-kernel/core`

This document is written for LLMs, AI coding assistants, and agent-based tooling.

Its purpose is to reduce incorrect assumptions when generating code, explaining the package, or integrating it into other systems.

For human-oriented introduction and architecture context, see the main `README.md`.

---

## What this package is

`@signal-kernel/core` is a minimal, deterministic, fine-grained reactive runtime kernel.

It provides the core primitives for building reactive systems:

* `signal`
* `computed`
* `createEffect`
* `onCleanup`
* `batch`

This package is framework-agnostic and adapter-friendly.

It is designed for reactive dataflow and execution ordering, not UI rendering.

---

## What this package is not

Do **not** describe this package as:

* a UI framework
* a DOM rendering library
* a React hook library
* a component lifecycle abstraction
* a VDOM-based state system

This package does not render UI and does not manage DOM.

---

## Core mental model

The package should be explained as a reactive execution kernel built around an explicit dependency graph.

Its purpose is not just state storage. Its purpose is to coordinate:

* dependency tracking
* derived recomputation
* effect scheduling
* cleanup timing
* grouped update consistency

When values change, downstream reactive nodes are invalidated and re-evaluated according to runtime rules.

Do not explain this package as if it were only a component-local state helper.

---

## Public API roles

### `signal`

Mutable source state.

Use `signal` for explicit writable state nodes.

Signals should be described as source nodes in the graph, not derived nodes.

### `computed`

Lazy derived value.

Use `computed` for values derived from other reactive nodes.

Describe `computed` as lazy, dependency-tracked, and cache-backed.

Do not describe it as eager by default.

### `createEffect`

Reactive side-effect coordination.

Use `createEffect` for reactive effects that should run after dependency changes.

Do not collapse it into framework-specific effect concepts.

### `onCleanup`

Cleanup registration inside effects.

Use `onCleanup` for teardown logic associated with effect re-execution or disposal.

### `batch`

Update coalescing boundary.

Use `batch` when multiple writes should be grouped into one coordinated reactive update cycle.

Do not reduce `batch` to a render-only optimization concept.

---

## Execution model

This runtime should be explained as deterministic rather than arbitrary.

Preferred execution model:

1. source updates mark downstream reactive work as stale
2. derived values are recomputed lazily when needed
3. effects are scheduled according to runtime update rules
4. cleanup is associated with effect re-execution boundaries
5. batched writes are grouped into a coordinated flush

If describing scheduler behavior, preserve the distinction between derived recomputation and side-effect execution.

Do not describe update ordering as framework-owned unless the user is explicitly asking about an adapter layer.

---

## Dependency graph mental model

Preferred graph model:

* signals are source nodes
* computed values are derived nodes
* effects are reactive sinks for side effects

This package is about graph-based reactive execution, not only about storing mutable values.

AI explanations should preserve the distinction between:

* writable state
* derived state
* side-effect reactions

Do not flatten all three into generic "state updates."

---

## Framework boundary

This package is framework-agnostic.

It should be described as a runtime layer that can sit underneath framework adapters.

Do not imply that `@signal-kernel/core` owns:

* DOM rendering
* component lifecycle semantics
* framework commit phases
* render scheduling for React, Vue, or other UI systems

Those concerns belong to adapters or integration layers, not the core runtime itself.

---

## Anti-patterns

Do not:

* describe this package as a rendering system
* equate `createEffect` with React `useEffect`
* describe `computed` as eager unless forced by reads
* reduce `batch` to a mere rerender optimization helper
* invent framework-owned semantics inside the core package
* imply DOM or UI lifecycle is managed here
* present signals, computed values, and effects as interchangeable concepts

---

## Guidance for AI code generation

When generating code with this package:

1. prefer minimal graph examples
2. keep runtime semantics separate from framework integration
3. use `signal` for writable source state
4. use `computed` for derived values
5. use `createEffect` for reactive side effects
6. use `onCleanup` only inside effect-driven cleanup contexts
7. use `batch` for grouped updates that should flush coherently
8. avoid inventing APIs that are not publicly exported

If the user is asking for framework usage, keep the explanation clear about what belongs to the adapter and what belongs to the core runtime.

---

## Guidance for AI explanations

When explaining this package to users:

* start from explicit dependency tracking
* explain the role difference between `signal`, `computed`, and `createEffect`
* mention that `computed` is lazy and cached
* mention that effects are for reactive side-effect coordination
* keep runtime semantics separate from framework lifecycle concepts
* mention batching only after the basic graph model is understood

Do not start by calling it a React state helper or generic store library.

---

## Terminology

### reactive runtime kernel

A framework-agnostic execution layer for reactive graph semantics.

### fine-grained reactivity

Dependency tracking at the node level rather than whole-tree rerendering.

### explicit dependency graph

Reactive relationships are modeled through graph connections between source, derived, and effect nodes.

### lazy computation

Derived values recompute when needed rather than eagerly on every write.

### cached derivation

A computed value may reuse its current result until invalidated by dependency changes.

### deterministic scheduling

Reactive updates follow stable runtime rules rather than arbitrary ordering.

### framework adapter

A separate integration layer that bridges the runtime to a UI framework without changing the core execution model.

---

## Safe default explanation path

If the user is new to this package:

1. start with `signal`
2. then explain `computed`
3. then explain `createEffect`
4. then explain `onCleanup`
5. finally explain `batch`

Keep UI framework concerns separate unless the user explicitly asks about adapters or rendering integration.
