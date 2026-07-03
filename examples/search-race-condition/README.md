# Search Race Condition Example

This example demonstrates how `@signal-kernel/async-runtime` prevents stale async results from overwriting newer state.

It uses a search input with forced request delays:

```txt
a   -> 3000ms
ab  -> 2000ms
abc -> 1000ms
```

When the race sequence runs quickly, the request for `abc` resolves first even though it starts last.

## What This Proves

The page renders three panels:

* **Naive Promise** intentionally omits cancellation, request identity, and stale guards. It can show stale results.
* **React + signal-kernel** reads the shared graph through `@signal-kernel/react`.
* **Vue + signal-kernel** reads the same shared graph through `@signal-kernel/vue`.

React and Vue own rendering. The shared signal-kernel graph owns async correctness.
Both framework panels read the query through `useKernelValue()` and consume the
latest-wins async result through `useResource()`.

## Run

```sh
pnpm -F @signal-kernel/example-search-race-condition dev
```

Then click **Run race**.

## Build

```sh
pnpm -F @signal-kernel/example-search-race-condition build
```

## Test

```sh
pnpm -F @signal-kernel/example-search-race-condition test
```

The test verifies graph-level latest-wins behavior. It does not test private runtime tokens or framework internals.

## Structure

```txt
src/
  graph/
    fakeSearchApi.ts
    searchGraph.ts
  naive/
    naivePanel.ts
  react/
    ReactPanel.tsx
  vue/
    VuePanel.ts
```

The React and Vue panels consume the same graph. The naive panel exists only as a teaching contrast.

`vite.config.ts` aliases local workspace packages to source files so the example uses one shared `@signal-kernel/core` module instance across the graph, async runtime, and adapters.
