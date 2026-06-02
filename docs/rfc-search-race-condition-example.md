# RFC: Search Race Condition Example

Status: accepted

## Problem Statement

Reactive UI examples often show async state as a loading flag plus a result value, but they do not always expose the correctness problem caused by overlapping async work.

A search input is a small, familiar way to demonstrate the issue:

```txt
user types "a"
user types "ab"
user types "abc"
```

If each input starts a Promise request, the requests may resolve in a different order than they started. A slower result for `"a"` can arrive after the faster result for `"abc"` and overwrite the UI with stale data.

React and Vue can render the latest state they are given, but they do not automatically know which Promise result is authoritative. Without explicit cancellation, request identity, or stale-result protection, both framework examples can display outdated data.

This example should demonstrate that async correctness belongs to the runtime graph, while React and Vue remain thin rendering adapters.

---

## Goals

* Demonstrate a real race-condition shape with overlapping Promise requests.
* Show how `@signal-kernel/async-runtime` prevents stale results from overwriting newer results.
* Reuse the same framework-agnostic search graph from React and Vue examples.
* Keep React and Vue code focused on adapter consumption, not async correctness.
* Make latest-wins behavior visible to developers through a simple search UI.
* Explain why rendering frameworks alone do not solve Promise completion ordering.

---

## Non-Goals

* Building a production search experience.
* Calling a real remote API.
* Adding cache, retry, pagination, deduplication, or server-state policy.
* Comparing `signal-kernel` against TanStack Query, SWR, or framework-specific query libraries.
* Moving async correctness into React `useEffect()` or Vue `watch()`.
* Creating framework-specific business logic.
* Demonstrating visual design complexity.

---

## Core Scenario

The example should use a fake search API that returns results with intentionally uneven delays.

Suggested deterministic timings:

```txt
"a"   -> resolves after 3000ms
"ab"  -> resolves after 2000ms
"abc" -> resolves after 1000ms
```

When a user quickly enters:

```txt
a -> ab -> abc
```

the `"abc"` request should resolve first and represent the latest query.

In a naive Promise flow, the `"a"` result may resolve last and overwrite the visible result.

In the `signal-kernel` flow, the resource created from the current query must keep `"abc"` as the authoritative result.

---

## Proposed Example Layout

```txt
examples/
  search-race-condition/
    README.md
    package.json
    vite.config.ts
    src/
      dom/
        escapeHtml.ts
      graph/
        fakeSearchApi.ts
        searchGraph.ts
        searchGraph.test.ts
      naive/
        naivePanel.ts
      react/
        ReactPanel.tsx
      vue/
        VuePanel.ts
      eventLog.ts
      main.tsx
```

The example uses one Vite page so the naive, React, and Vue panels can be compared side by side against the same forced race sequence.

The graph code must remain separate from framework views.

---

## Graph Design

The framework-neutral graph should own:

* the search query signal
* the async resource
* fake API invocation
* visible async status
* latest-wins behavior

Suggested shape:

```ts
const query = signal("");

const searchResource = createResource({
  input: query.get,
  run: (currentQuery, ctx) => fakeSearchApi(currentQuery, ctx),
  keepPreviousValueOnPending: true,
});
```

React and Vue should consume this graph through adapters. They should not create separate async policies.

---

## UI Design

The UI should be intentionally small and comparable across frameworks.

The page should include shared controls:

* a search input
* a button that triggers the known race sequence
* request event log

The page should also include a naive comparison panel.

The naive panel should:

* use ordinary Promise state updates
* intentionally omit cancellation
* intentionally omit request identity checks
* intentionally omit stale-result guards
* make stale overwrite behavior visible when older requests resolve later

This panel exists only as a teaching contrast. It is not a recommended implementation pattern.

The `signal-kernel` panels should include:

* current query display
* resource status display
* visible result list
* stale-result-safe final state

Suggested layout:

```txt
Shared search input + race trigger

Naive Promise panel
  may show stale results

React + signal-kernel panel
  reads the shared graph through @signal-kernel/react

Vue + signal-kernel panel
  reads the shared graph through @signal-kernel/vue

Request log
  shows start and resolve order
```

The naive panel should be labeled as broken or naive behavior, not as a crash. The failure mode is stale data overwrite, not application failure.

---

## React Adapter Boundary

The React view should:

* read the query or resource through `@signal-kernel/react`
* write to the query signal from event handlers
* render resource value and metadata
* avoid implementing request identity checks in React state
* avoid using React `useEffect()` as the async correctness mechanism

React owns rendering. The graph owns the async result authority.

---

## Vue Adapter Boundary

The Vue view should:

* read the query or resource through `@signal-kernel/vue`
* write to the query signal from input handlers or composable actions
* render resource value and metadata through readonly refs
* avoid implementing request identity checks in Vue refs
* avoid using Vue `watch()` as the async correctness mechanism

Vue owns rendering. The graph owns the async result authority.

---

## Expected Behavior

For the known race sequence:

```txt
a -> ab -> abc
```

the `signal-kernel` result must end with:

```txt
query: "abc"
visible result: results for "abc"
status: success
```

Older completions for `"a"` or `"ab"` must not overwrite the current resource value.

If the UI includes a naive comparison, the naive panel may show stale results depending on the forced delay order. That panel exists only to make the race condition visible.

The expected visual contrast is:

```txt
Naive Promise
query: "abc"
visible result: results for "a"

signal-kernel
query: "abc"
visible result: results for "abc"
```

The exact display text can vary, but the stale overwrite bug must be obvious.

---

## Testing Strategy

Tests should prioritize graph behavior over UI implementation details.

Required graph-level tests:

* fast latest request wins when earlier requests resolve later
* stale results do not overwrite current results
* cancellation or stale protection does not surface as a normal error

Framework-level checks should be lighter:

* the example typechecks
* the example builds with both React and Vue mounted on the same page
* React renders resource metadata through the React adapter
* Vue renders resource metadata through the Vue adapter
* neither framework view owns latest-wins logic

Tests should not inspect private async-runtime tokens or internal graph structures.

---

## Documentation Requirements

The example README should explain:

* what race condition the example reproduces
* why React and Vue do not automatically solve Promise ordering
* how `createResource()` provides latest-wins semantics
* why the graph is shared across framework views
* why adapters should remain thin

The README should avoid describing `signal-kernel` as a React or Vue state library.

---

## Open Questions

### Should the event log live in the graph?

The request event log is useful for teaching resolution order.

If it becomes part of the example, it should remain framework-neutral so React and Vue display the same underlying events.

---

## Decision

Build a single-page search race-condition example around a shared framework-neutral graph.

Use React and Vue only as rendering adapters over that graph.

The example should prove that `@signal-kernel/async-runtime` owns stale-result prevention and latest-wins behavior, while framework adapters only expose graph state to UI.

Use Vite aliases for local workspace packages so the example resolves one shared `@signal-kernel/core` module instance during development, tests, and builds.
