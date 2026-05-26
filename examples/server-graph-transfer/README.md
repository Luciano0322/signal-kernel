# Server Graph Transfer Example

This example demonstrates the smallest `@signal-kernel/snapshot` transfer
flow:

```txt
server graph
  -> createSnapshotScope
  -> captureSnapshot
  -> encodeJsonSnapshot
  -> HTML embeds snapshot JSON
  -> client decodeJsonSnapshot
  -> client compatible graph
  -> restoreSnapshot
  -> recomputed computed values
  -> renderer reads graph
```

It is not an SSR framework example, React Server Components example, or
component hydration layer. Components are not snapshotted. The reactive graph is
the transfer boundary.

## Run

```sh
pnpm -F @signal-kernel/example-server-graph-transfer dev
```

The server uses port `5180`.

You can also change server-side graph inputs through query params:

```txt
http://localhost:5180/?userId=luciano&plan=enterprise&usage=1200
```

## Typecheck

```sh
pnpm -F @signal-kernel/example-server-graph-transfer typecheck
```

## Test

```sh
pnpm -F @signal-kernel/example-server-graph-transfer test
```

## Build

```sh
pnpm -F @signal-kernel/example-server-graph-transfer build
```

## Boundary

This example uses the published snapshot document shape:

```txt
signal-kernel.snapshot.v1
```

It validates:

* graph identity
* graph version
* JSON-safe writable signal values
* compatible graph restore
* computed recomputation after restore
* computed nodes as inspection data, not source state
* domain value validation through node serializers

It still does not snapshot components, DOM state, hook state, effects,
promises, or server component data.
