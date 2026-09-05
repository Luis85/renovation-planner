---
type: Task
parent: "[[Undo and redo]]"
order: 30
status: Done
horizon: "MVP"
release: "[[MVP]]"
---

# Refresh history results without replaying writes

## Evidence

[M15](../user-experience/renovation-planner-editor-specs/screens/M15-stale-data-warning.md) requires last-valid content and hydration-only retry after a successful write whose read-back fails.

## Why it matters

Repeating Undo or Redo to repair a failed read can apply the mutation twice.

## Approach

Refresh stores after history dispatch, retain last-valid projection on failure, mark `Saved · refresh needed`, disable unsafe edits and bind retry to hydration only.

## Acceptance criteria

- Successful Undo/Redo refreshes through queries.
- Failed read-back leaves the last valid projection visible and marked stale.
- Retry invokes no command or history transition.
- Context-bar actions expose correct disabled/busy states and keyboard paths.
- Successful retry clears stale state.

## Risks

UI handlers that discard promises can turn technical faults into silent failures.

## Outcome

History actions remain trustworthy even when the view cannot immediately reread their result.

## Closing evidence

**2026-09-05**, the trust path increment.

Criterion 1 — **successful Undo and Redo refresh through queries** — is the post-command refresh
the history's own decorator already ran, now a NAMED function: `createProjectionRefresh(deps)` was
split out of `withEditorStateRefresh`'s anonymous closure, and `runtime.ts` hands the same one out
as `refreshProjection`.

Criterion 2 — **a failed read-back leaves the last valid projection visible and marked stale** —
and criterion 5 — **a successful retry clears stale state** — are the two halves of
`tests/presentation/editor/stalePath.e2e.test.ts`'s first case: the canvas keeps the pre-command
scene at `status === 'ready'` with the strip, the `Saved · refresh needed` label and every paused
control; and the healing retry clears the strip, the label, `retriesFailed` and every paused
attribute in one move. `history.e2e.test.ts`'s fifth case is the same shape reached through an
UNDO (4b): the inverse WROTE and the read-back did not.

Criterion 3 — **retry invokes no command or history transition** — is held twice. The signature
carries it (`refreshProjection` takes no parameters —
`tests/presentation/editor/type-safety.test-d.ts`), and the vault agrees: one `zones.save` and one
`zones.delete` across a scenario containing three retries. That Try again and the post-command path
are the SAME function is `tests/presentation/editor/tools/withEditorStateRefresh.test.ts` plus
`runtime.test.ts`'s 'refreshProjection re-reads and never dispatches'; the mutation that made it
load-bearing swapped the strip's `retry` closure for a raw dispatch and watched the read count go
to zero.

Criterion 4 — **the context-bar actions expose correct disabled and busy states and keyboard
paths** — is `refreshing`: one flag, true from a hydrate's first line until the read holding the
LATEST ticket settles, so a superseded read never clears it. The strip's stale row carries
`aria-busy` and its buttons `aria-disabled` while it holds, the click handler withholds `run()`
while busy (mutation-checked by removing the guard), and a failed retry keeps the row's DOM NODE
while moving only its message to `editor.refresh-failed.again` — asserted as node identity in
`tests/presentation/editor/shell.test.ts`, which is what stops the live region re-announcing a row
that never left. **Keyboard reach here is the two context-bar buttons and the strip's two action
buttons, and no hotkey** — design spec §14 puts hotkeys out of scope, and every one of the four is
an ordinary focusable control.

**The promise-discarding risk this task's own Risks paragraph names was traced rather than
assumed.** `PlanEditorRoot`'s `retry` and `openSourceNote` closures both `void` their promise;
`createProjectionRefresh` and `openProjectNote` resolve on every arm — the opener maps and reports
its own fault internally and answers `'failed'` — so neither is a detached rejection. If either
ever starts throwing past its own boundary, both call sites owe the `runDetached` handling
CLAUDE.md's rule asks for.

Focus recovery when the stale row unmounts under a focused button is `onBeforeUpdate` /
`onUpdated` rather than `onBeforeUnmount`, because the rows are `v-for` children of ONE component
and only that pair brackets its re-render; the hook reads `document.activeElement === document.body`
(the removal fallback) and moves focus to the strip container, which carries `tabindex="-1"`.
Watched failing first by commenting the `.focus()` call out, which also confirms the jsdom fallback
the case depends on is real rather than the assertion passing vacuously.
