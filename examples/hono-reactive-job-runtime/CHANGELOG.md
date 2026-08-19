# @signal-kernel/example-hono-reactive-job-runtime

## 0.0.3

### Patch Changes

- a13ad95: Extend `createStreamResource` with framework-neutral lifecycle controls for push-based streams. `StreamContext` now exposes `signal`, `onCleanup()`, and `fail()`, while `StreamAsyncMeta` provides `dispose()` for permanently stopping reactive observation. Cancelled or replaced runs execute cleanup once and ignore stale callbacks. Existing AsyncIterable and LLM-style stream producers remain compatible.
- Updated dependencies [a13ad95]
  - @signal-kernel/async-runtime@0.4.0

## 0.0.2

### Patch Changes

- Updated dependencies [ec39538]
  - @signal-kernel/core@0.1.4
  - @signal-kernel/async-runtime@0.3.1

## 0.0.1

### Patch Changes

- Updated dependencies [b5e3caa]
  - @signal-kernel/async-runtime@0.3.0
