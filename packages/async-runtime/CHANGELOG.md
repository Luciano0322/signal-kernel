# @signal-kernel/async-runtime

## 0.4.0

### Minor Changes

- Extend `createStreamResource()` for finite and long-lived push producers without adding transport-specific primitives.
- Add `StreamContext.signal`, `StreamContext.onCleanup()`, and `StreamContext.fail()` for abort propagation, subscription teardown, and callback-driven terminal failure.
- Add `StreamAsyncMeta.dispose()` to permanently stop the active producer and reactive observation.
- Make completion, failure, cancellation, supersession, reload, and disposal close each run before cleanup, preventing stale callbacks from mutating current state.
- Preserve object-form descriptors, finite stream behavior, stable-value semantics, and the v0.x positional compatibility shorthand.

## 0.3.1

### Patch Changes

- Updated dependencies [ec39538]
  - @signal-kernel/core@0.1.4

## 0.3.0

### Minor Changes

- b5e3caa: Changes the existing async-runtime API surface

## 0.2.4

### Patch Changes

- 79441c8: Refine React adapter snapshot tracking semantics.

## 0.2.3

### Patch Changes

- a136d96: Adjust readme content
- Updated dependencies [a136d96]
  - @signal-kernel/core@0.1.2

## 0.2.2

### Patch Changes

- 293af0f: Add the initial React adapter package and fix async-runtime build output.

## 0.2.1

### Patch Changes

- 312e50c: Exclude test artifacts from the published package output.

## 0.2.0

### Minor Changes

- dd69abd: Add `createStreamResource` as the streaming sibling primitive of `createResource`, with support for progressive visible state, stable committed value, and interruption policies for cancellation and errors.
