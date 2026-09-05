---
type: Task
parent: "[[Recover safely from failed writes and stale reads]]"
order: 20
status: Done
horizon: "MVP"
release: "[[MVP]]"
---

# Guard stale editing and retry hydration only

## Evidence

M15 permits inspection but disables geometry, add, delete, and other unsafe writes.

## Why it matters

An edit based on stale geometry can overwrite a successful change the view failed to load.

## Approach

Place one stale-write guard on every mutation entry point, expose its reason, and wire `Try
again` directly to hydration. Test the command boundary, not only disabled button markup.

## Acceptance criteria

- Every unsafe write path is refused while stale.
- Selection and source-note inspection remain available.
- Repeated retries invoke reads and never repeat the mutation.

## Risks

A visually disabled control may leave a shortcut or menu path active.

## Outcome

Stale state remains inspectable without allowing a destructive follow-up.

## Closing evidence

**2026-09-05**, the trust path increment.

Criterion 1 — **every unsafe write path is refused while stale** — is ONE decorator on the one
per-leaf dispatcher rather than a rule spelled at each door: `withStaleGate(dispatcher, isStale)`
sits after the save-state tracker and before `wrapDispatcher`, refuses `run` with a resolved
`ValidationError` carrying `editor.stale-write-refused`, and passes `undo` and `redo` through
untouched. `tests/presentation/editor/tools/withStaleGate.test.ts` drives all four arms, plus the
neutrality of the refusal to the badge (mutation: swap the category to `Persistence` and that case
goes red). `tests/presentation/editor/stalePath.e2e.test.ts`'s third case is its behavioural
instrument, driven at `runtime.createRoom()` with a VALID draft past every `aria-disabled` control
— it is the **only** case in either e2e file the gate-removed mutation reddens.

**The narrowing this criterion needs, because "every" is a category claim.** The gate covers what
dispatches through this leaf's chain. The plugin's own palette commands (`set-plan-background`,
`create-sample-project`) never enter it, and `notifyFault`'s raw ports sit outside the guarded
boundary as CLAUDE.md already records. Design spec §11 names that, and
[[Recover from a stale read]] step 4a is where it is LOOKED AT in a vault rather than assumed —
the step expects the command to work and says so, because a step asserting a refusal would be
asserting a guarantee the code does not make.

Criterion 2 — **selection and source-note inspection remain available** — is two things. A Select
press while blocked still SELECTS and simply starts no gesture, so no ghost is drawn and the
release commits nothing (`tests/presentation/editor/tools/selectTool.test.ts`, three cases, each
guard mutated out and watched red in isolation); and **Open source note** is a new context door,
`PlanEditorContext.openPlanNote()`, partially applied in `PlanEditorView` from a
`PlanEditorDeps.openNote` the composition root binds to the existing `openProjectNote`
(`tests/plugin/planEditorWiring.test.ts`, `tests/presentation/views/planEditorView.test.ts`).

Criterion 3 — **repeated retries invoke reads and never repeat the mutation** — is
`stalePath.e2e.test.ts`'s write count: one `zones.save` and one `zones.delete` across a scenario
containing three retries, one failed retry, one Select drag and every paused click.

**Every surface in design spec §2.9's table pauses with `aria-disabled` and never `:disabled`**, so
a paused control keeps focus and keeps its reason readable — one visually-hidden sentence minted
once per leaf and pointed at by every paused control's `aria-describedby`.
`tests/presentation/editor/pausedSurfaces.test.ts` is the ten-case instrument.

**Two mechanisms, one outcome, and saying so is the honest half.** The handler guards and the gate
are defence in depth: removing EITHER alone leaves the vault-side outcome green, which is why four
of the handler guards needed a spy UPSTREAM of the dispatcher (on `runtime.deleteZone`,
`commitEdit` and `commitField`) before their cases could discriminate at all. Before that they were
green for a reason other than their names — this repository's own recurring lesson, met again — and
two of them were green for a second reason on top: `assignSelected` returned at its own
pre-existing empty-picker guard unless the asset was re-selected first, and `resetCost` took the
"nothing to reset" branch unless a cost override was set. **A third defect surfaced only by running
those mutations**: `commitField` reaches `RequirementRow` as a Vue PROP, so a spy installed after
the render that flips `stale` sits on the runtime object while the mounted row keeps calling the
reference it was handed at the last patch — the spy itself was inert, and the mutation passed. The
two `commitField` spies are installed BEFORE the stale flip for that reason, so the flip's own
re-render carries them into the child's props.
