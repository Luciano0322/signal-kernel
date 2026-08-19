# @signal-kernel/vue

## 0.2.2

### Patch Changes

- a13ad95: Extend `createStreamResource` with framework-neutral lifecycle controls for push-based streams. `StreamContext` now exposes `signal`, `onCleanup()`, and `fail()`, while `StreamAsyncMeta` provides `dispose()` for permanently stopping reactive observation. Cancelled or replaced runs execute cleanup once and ignore stale callbacks. Existing AsyncIterable and LLM-style stream producers remain compatible.
- Updated dependencies [a13ad95]
  - @signal-kernel/async-runtime@0.4.0

## 0.2.1

### Patch Changes

- Updated dependencies [ec39538]
  - @signal-kernel/core@0.1.4
  - @signal-kernel/async-runtime@0.3.1

## 0.2.0

### Minor Changes

- b04b3b6: adapter API naming refinement

## 0.1.2

### Patch Changes

- b5e3caa: Changes the existing async-runtime API surface
- Updated dependencies [b5e3caa]
  - @signal-kernel/async-runtime@0.3.0

## 0.1.1

### Patch Changes

- Updated dependencies [79441c8]
  - @signal-kernel/async-runtime@0.2.4

## 0.1.0

### Minor Changes

- ea530b7: Add the initial Vue adapter package

### Patch Changes

- Updated dependencies [ea530b7]
  - @signal-kernel/core@0.1.3

## 0.1.0

### Minor Changes

- Add the initial Vue adapter package.
