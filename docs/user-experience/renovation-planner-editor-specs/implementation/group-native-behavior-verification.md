# Group native controls and write boundaries — 2026-09-09

The full integrated gate at `b758695c` exposed missing group-control coverage. New cases exercise the rendered Inspector controls over the real runtime, dispatcher, repositories and synthetic vault: signed decimal movement, quarter turns and exact history, hidden members, explicit grouping and repeated enclosure, invalid input, peer edits, pending reads retired by selection/perspective/unmount, and a numeric draft surviving read-only recovery.

The save-state case found that the move fields accepted queued input despite being read-only. They now use the shared guarded text-input boundary and restore their displayed value when a save blocks editing.

Scoped ESLint and `vue-tsc -noEmit` passed. With `VITEST_MAX_WORKERS=1`, `vitest run tests/application/commands/groupWriteBoundaries.test.ts tests/presentation/editor/groupNativeActions.test.ts` passed the initial 19 cases across two files, using unchanged timeouts. The worker limit changes resource concurrency only. Added event-census and Zone receipt cases are recorded separately after verification.

These are component/runtime observations, not browser screenshots or native Obsidian acceptance. The full integrated gate and final visual/native acceptance remain required.
