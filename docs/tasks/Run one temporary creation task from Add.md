---
type: Task
parent: "[[Start one creation task from Add]]"
order: 30
status: Active
horizon: "MVP"
release: "[[MVP]]"
---

# Run one temporary creation task from Add

## Evidence

The [component library creation contract](../user-experience/renovation-planner-editor-specs/components/component-library.md) and M02 require one activation path, temporary task state and return to Select by default.

## Why it matters

Parallel activation paths create duplicate writes and leave the editor stuck in a creation mode.

## Approach

Bind each enabled catalogue entry to one task-manager activation, pass selected context once, centralize finish/cancel precedence and retire task state after one completion.

## Acceptance criteria

- One menu activation starts exactly one task.
- Current context is passed without creating a second command path.
- Cancel writes nothing and returns to Select.
- Success returns to Select unless repeat was explicitly chosen.
- Refusal retires unsafe draft state and preserves the last valid projection.

## Risks

Repeated pointer or keyboard activation can race before the menu closes.

## Outcome

Add hands control to one bounded creation task and reliably returns the editor to safety.

## Amendments

**2026-09-03** — criterion 1 is
`tests/presentation/editor/add/addMenu.test.ts`'s 'ArrowDown moves focus through enabled and
disabled items alike; Enter on Room starts exactly one tool and closes'.

**2026-09-04** — criterion 1's evidence is the COUNTING case instead: 'Enter on Room starts
exactly one tool and emits exactly one close' asserts `toHaveBeenCalledTimes(1)` on a spied
`setTool` and one `close` emission, where the cited case above proved only the settled end state
and would pass just as well on a duplicate activation. Criterion 3 is
`tests/presentation/editor/shell/temporaryToolBanner.test.ts`'s 'Cancel returns to Select whether
or not a draft exists, and a drafted room is discarded with it' beside
`tests/presentation/editor/escapeRouting.test.ts` — the banner's Cancel LEAVES the task and Escape
steps back one interaction — two questions, ruled apart on 2026-09-04 (R7). The RETURN half of
criterion 4 is
`tests/presentation/editor/tools/drawPolygonTool.test.ts`'s `DrawPolygonTool.onCompleted` cases,
bound to `returnToSelect` in `src/presentation/editor/runtime.ts`. Criterion 5 is
`tests/presentation/editor/toolRefusalSurfaces.test.ts`.

Criterion 2 is vacuous: Room carries no context, so there is no second command path to avoid.
Criterion 4's 'unless repeat was explicitly chosen' has no subject — repeated creation is not
built, the banner carries no toggle for it, and spec §7.3 and §12 record that as a decision
rather than an omission.

**2026-09-04**, the Add Room increment — criterion 4's repeat clause has a subject at last, and
this task stays Active for the one criterion that is still VACUOUS rather than met.

Criterion 4's *"unless repeat was explicitly chosen"* is `keepAdding` on the room draft: off by
default, reset by `beginTask`, one checkbox on the New room form, and one branch in
`createRoomFromDraft` driven both ways —
`tests/presentation/editor/add/roomCreation.test.ts`'s 'a valid draft dispatches exactly one
command, selects the new id, and returns to Select' against 'keepAdding: the room is selected,
the draft restarts with the next default name, Select is not returned to', with the end-to-end
half in `tests/presentation/editor/roomCreation.e2e.test.ts`'s 'Keep adding rooms restarts the
task on the created room and re-counts the default name'. That case pins the ORDERING this task's
own Risks section names — *"starting the next draft before commit settles can duplicate
activation or hide failure"* — by asserting the next default name reads **Room 3**, which is only
true once the post-command refresh has re-read the plan.

Criterion 1 gains a second door rather than a second path: the no-rooms empty state's action and
the Add menu's Enter, Space and click all reach `activateCreationEntry('room', runtime)`, and
`tests/presentation/editor/add/creationCatalogue.test.ts`'s two source-text cases are what hold
that — one of the two was calling the entry directly until a review round found it.

**Still Active for criterion 2**, which is vacuous rather than met: Room carries no selected
context, so *"current context is passed without creating a second command path"* has nothing to
pass and nothing to test. Recorded rather than ticked, under this Feature's own rule that a
criterion whose subject does not exist is an amendment and not a tick.
