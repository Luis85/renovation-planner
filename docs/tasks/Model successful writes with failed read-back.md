---
type: Task
parent: "[[Recover safely from failed writes and stale reads]]"
order: 10
status: Done
horizon: "MVP"
release: "[[MVP]]"
---

# Model successful writes with failed read-back

## Evidence

M15 distinguishes a successful mutation from the failed hydration that follows it.

## Why it matters

One generic failure state cannot truthfully say both whether data was saved and whether the view
is current.

## Approach

Represent write outcome, last valid projection, stale state, recoverable error, source target,
and retry progress independently. Keep canonical error routing outside this state model.

## Acceptance criteria

- A post-write read failure retains the previous projection.
- Save state reads `Saved · refresh needed`.
- Retry state cannot contain a command to replay.

## Risks

Coupling stale state to a view mode could replace valid content with a failure page.

## Outcome

The editor can represent saved data and stale presentation at the same time.

## Closing evidence

**2026-09-05**, the trust path increment.

Criterion 1 — **a post-write read failure retains the previous projection** — needed no new state:
`ProjectStore.stale` already meant exactly this and its docblock records three review rounds spent
getting the lifetime right. `tests/presentation/editor/stalePath.e2e.test.ts`'s first case is the
assertion, over the wired editor.

Criterion 2 — **`Saved · refresh needed`** — is DERIVED and not a fifth `SaveState`.
`SaveStateIndicator` reads `ProjectStore.stale` beside the store's own state;
`tests/presentation/editor/saveState/saveStateIndicator.test.ts` holds both arms (saved + stale
reads the derived label; a save error + stale still reads *Save error*) and builds the expected
class from the template's own expression, so a stylesheet rule one word off fails there rather
than passing quietly.

Criterion 3 — **retry state cannot contain a command to replay** — is a fact about a signature:
`refreshProjection` takes no parameters, held by `tests/presentation/editor/type-safety.test-d.ts`
at compile time rather than by a sentence.

Three fields were added and one deliberately was not. `ProjectStore` gained `refreshing` and
`retriesFailed`; `SaveStateStore` gained `unrecoveredWrite`; the status union did NOT grow, because
`keepPreviousOnFailure` holds `status === 'ready'` on purpose and a fifth status would reopen every
`=== 'ready'` gate in the tree.

**One measurement is worth carrying past this task.** The plan's `done()` helper carried an
internal `if (!superseded())` guard, and the mutation the plan itself named for it — make `done()`
unconditional — reddened nothing. Measured rather than argued: a coverage run over 115 tests
reported that branch as `[113, 0]`, the false arm never taken by anything, because every `done()`
call site sits immediately after its own `if (superseded()) return;` with no `await` between them,
so the value cannot change. The guard was removed as an unreachable arm this repository's floors
cannot afford. **The load-bearing invariant is the opposite one** — that the three bare superseded
returns must NOT call `done()` — and it is mutation-verified at
`tests/presentation/stores/projectStore.test.ts`'s 'stays refreshing while a LATER read is still
open'. All six `done()` sites plus `reset()` have their own `refreshing` assertion, each watched
red by deleting that one call.
