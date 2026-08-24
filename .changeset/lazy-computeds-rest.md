---
"@signal-kernel/core": patch
---

Clarify that signal writes propagate invalidation and schedule affected effects,
while stale computed values remain lazy and recompute only when read.
