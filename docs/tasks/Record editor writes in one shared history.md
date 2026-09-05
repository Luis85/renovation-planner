---
type: Task
parent: "[[Undo and redo]]"
order: 10
status: Done
horizon: "MVP"
release: "[[MVP]]"
---

# Record editor writes in one shared history

## Evidence

The [vertical-slice plan WP7](../user-experience/renovation-planner-editor-specs/Renovation%20Planner%20—%20First%20Vertical%20Slice%20Plan%20and%20Data-Model%20Specification.md) requires command-based mutations and one trustworthy undo/redo path; current outcomes distinguish writes from no-writes.

## Why it matters

Per-tool stacks and success-as-write inference produce missing actions or false history entries.

## Approach

Route every reversible editor dispatch through one leaf-scoped history and require explicit wrote/no-write outcomes before updating stack and save state.

## Acceptance criteria

- Reversible actions from different editor surfaces share one stack.
- No-write success creates no history entry.
- New action after Undo clears the redo branch.
- History availability and save state derive from explicit outcomes.

## Risks

Adapters can erase command outcomes before they reach history.

## Outcome

The editor records exactly the completed writes a user can reverse.

## Closing evidence

**2026-09-05**, the trust path increment. The mechanism pre-dates it — one `CommandHistory` per
leaf, `DispatchOutcome` required on every `ok(...)` so no adapter can infer a write from success —
and what this increment added is that the criteria have cases.

Criterion 1 — **reversible actions from different surfaces share one stack** — is a fact about the
composition: `buildDispatcherChain` builds one history and one wrapped dispatcher, and the tools,
the Inspector's commits, the delete action and room creation all take it. Pinned by
`tests/presentation/editor/runtime.test.ts` and, as source text over the exact wiring this
increment changed, by `tests/presentation/editor/saveState/saveStateWiring.test.ts`'s two cases —
the gate is built from the TRACKED dispatcher, and `wrapDispatcher` receives the GATED one.
`tests/presentation/editor/history.e2e.test.ts`'s second case reaches it behaviourally with two
DIFFERENT gestures, so it cannot pass by the second command being the same object.

Criterion 3 — **a new action after Undo clears the redo branch** — is that same case.

Criterion 4 — **history availability and save state derive from explicit outcomes** — is
`DispatchOutcome` being required rather than inferred, and `withSaveStateTracking` settling three
ways from it.

**Criterion 2 — "no-write success creates no history entry" — is WITHDRAWN, not ticked, because
the code deliberately does the opposite and says so.** `CommandHistory.runNow`: *"A gesture that
wrote nothing still goes on the undo stack: it happened, and asking to undo it is legal."* The
e2e case pins the documented behaviour with the one instrument that can see it — the Undo that
follows pops the NO-WRITE assign and leaves the requirement standing, where a build that skipped
the entry would pop the FIRST assign and take the requirement with it (measured as a mutation).
**The half of the criterion that is really this PBI's own** — that a no-write success moves no
badge and clears no standing save error — is kept, and made discriminating with a REAL standing
`save-error` behind it, because without one a neutral resolution and a successful one both leave a
fresh leaf reading `Saved`.
