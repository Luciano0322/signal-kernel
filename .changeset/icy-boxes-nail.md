---
"@signal-kernel/async-runtime": minor
"@signal-kernel/example-hono-reactive-job-runtime": patch
"@signal-kernel/example-nuxt-job-monitor": patch
"@signal-kernel/react": patch
"@signal-kernel/vue": patch
---

Extend `createStreamResource` with framework-neutral lifecycle controls for push-based streams. `StreamContext` now exposes `signal`, `onCleanup()`, and `fail()`, while `StreamAsyncMeta` provides `dispose()` for permanently stopping reactive observation. Cancelled or replaced runs execute cleanup once and ignore stale callbacks. Existing AsyncIterable and LLM-style stream producers remain compatible.
