# Group native controls and write boundaries — 2026-09-09

The full integrated gate at `b758695c` exposed missing group-control coverage. New cases exercise the rendered Inspector controls over the real runtime, dispatcher, repositories and synthetic vault: signed decimal movement, quarter turns and exact history, hidden members, explicit grouping and repeated enclosure, invalid input, peer edits, pending reads retired by selection/perspective/unmount, and a numeric draft surviving read-only recovery.

The save-state case found that the move fields accepted queued input despite being read-only. They now use the shared guarded text-input boundary and restore their displayed value when a save blocks editing.

Scoped ESLint and `vue-tsc -noEmit` passed. With `VITEST_MAX_WORKERS=1`, `vitest run tests/application/commands/groupWriteBoundaries.test.ts tests/presentation/editor/groupNativeActions.test.ts` passed the initial 19 cases across two files, using unchanged timeouts. The worker limit changes resource concurrency only. Added event-census and Zone receipt cases are recorded separately after verification.

These are component/runtime observations, not browser screenshots or native Obsidian acceptance. The full integrated gate and final visual/native acceptance remain required.

## Combined focused batch preparation

The initial five command-boundary cases are retained in `groupWriteBoundaries.test.ts`; three new cases cover missing, wrong-floor and invalid Zone version receipts before the write. `groupWriteEvents.test.ts` drives execute, undo, redo, no-op and refusal while observing persisted state from event subscribers, backing the exact new GroupGeometryCommand census disposition. `groupPointerRotation.test.ts` drives the rendered edge arrow through native canvas pointer events and verifies preview, release/history and Escape. These additional eight cases are committed as source-ready and unverified for the parent's combined focused batch. Their presence is not a passing result.
