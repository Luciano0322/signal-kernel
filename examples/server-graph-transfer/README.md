# Server Graph Transfer Example

This example proves the smallest snapshot-shaped flow before
`@signal-kernel/snapshot` exists:

```txt
server graph
  -> JSON-safe graph payload
  -> client compatible graph
  -> restored writable signals
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

This example owns an intentionally local payload shape:

```txt
signal-kernel.example.server-graph-transfer.v0
```

That payload is not the final snapshot package API. It only validates:

* graph identity
* graph version
* JSON-safe writable signal values
* compatible graph restore
* computed recomputation after restore

Future work should replace the local helpers with `@signal-kernel/snapshot`
once that package exists.
