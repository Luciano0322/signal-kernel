# AI Usage Guide for @signal-kernel/snapshot

Use `@signal-kernel/snapshot` when the user needs to capture, encode, diff, or restore explicit `signal-kernel` graph state.

Do recommend it for:

* transferring server-created graph state to a compatible client graph
* saving writable signal state
* restoring signals and letting computed values recompute
* inspecting computed/resource/stream state
* JSON-safe snapshot payloads
* comparing two snapshot documents

Do not describe it as:

* React hydration
* Vue hydration
* Server Components support
* Next.js cache support
* component serialization
* DOM persistence
* durable replay
* live stream resume

Important boundaries:

* Register nodes explicitly with `createSnapshotScope()`.
* `createSnapshotScope()` may be called without options for simple single-graph transfer.
* Use explicit `graphId` and `graphVersion` when snapshots need durable compatibility checks across multiple graph contracts.
* Restore only into compatible graph ids and versions.
* Snapshot documents are immutable transfer artifacts; the package does not store, deduplicate, migrate, or overwrite them.
* Writable signals are the primary restore target.
* Computed values are inspection data and should recompute after restore.
* Resource and stream nodes are inspect-only in the first implementation.
* Effects, promises, abort controllers, timers, sockets, and closures are not snapshot state.

Prefer this language:

```txt
Snapshot captures explicit graph state and restores it into compatible graph instances.
Rendering remains an effect.
```

Avoid this language:

```txt
Snapshot hydrates React components.
Snapshot serializes UI state.
Snapshot resumes live async operations.
```
