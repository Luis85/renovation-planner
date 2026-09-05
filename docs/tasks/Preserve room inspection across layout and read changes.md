---
type: Task
parent: "[[Inspect a selected room]]"
order: 30
status: Active
horizon: "MVP"
release: "[[MVP]]"
---

# Preserve room inspection across layout and read changes

## Evidence

[M16](../user-experience/renovation-planner-editor-specs/screens/M16-constrained-workspace.md) reuses Inspector content in a drawer, and [M15](../user-experience/renovation-planner-editor-specs/screens/M15-stale-data-warning.md) keeps last-valid content visible after refresh failure.

## Why it matters

Resize or transient read failure should not silently switch the room being discussed or fabricate current data.

## Approach

Share Inspector content across persistent/drawer containers, preserve stable selection and viewport, restore focus, and integrate gone/stale/failed room states.

## Acceptance criteria

- Full and constrained Inspectors render the same selected ID.
- Resizing preserves selection and viewport.
- Drawer close restores focus meaningfully.
- Stale content is labeled and unsafe actions are disabled.
- A gone room retires its selection without choosing another.

## Risks

Responsive remounting can race hydration and overwrite newer selection state.

## Outcome

Room inspection remains coherent as workspace and vault conditions change.

## Amendments

**2026-09-03** — criteria 1, 2 and 5 landed. `tests/harness/accessibility.test.ts` mounts the
constrained Inspector drawer with a room selected and the full Room Inspector with the same one,
and both draw the same id, because the drawer is a container around the SAME body rather than a
second rendering of it; `tests/presentation/editor/shell/responsiveShell.test.ts`'s 'keeps
selection and viewport across the change' is criterion 2, and it asserts the canvas ELEMENT is the
same one, so the viewport survives by construction rather than by being restored; criterion 5 is
`tests/presentation/editor/runtime.test.ts`'s 'a selected zone that disappears from the next
hydrate is retired, not rebound'.

Criterion 3 holds for the Escape close and not for the resize-driven one, the same residue
[[Keep layer controls usable in constrained leaves]] records. Criterion 4 is HALF met: stale
content is labelled, by the additive warning strip, and nothing is disabled while stale —
`stale` reaches exactly one computed in `PlanEditorRoot.vue` and feeds the strip alone, so Delete
stays live over data the last read-back could not confirm.

**2026-09-05** — the trust path increment closes criterion 4's second half. **Writes are paused,
and every one of them says why.** `runtime.writesBlocked` is a computed over the same `stale`
field, `withStaleGate` refuses `run` at the leaf's one dispatcher, and every surface in that
increment's design spec §2.9 table carries `aria-disabled` plus an `aria-describedby` naming one
visually-hidden reason sentence minted once per leaf — the Room Inspector's **Delete** and
**Assign**, both override fields and their Reset buttons, the Add menu's entries, the no-rooms
empty-state action, New room's **Create** and the task banner's **Finish**, and the Layers panel's
**Set scale**. `tests/presentation/editor/pausedSurfaces.test.ts` is the ten-case instrument, and
`tests/harness/accessibilityTrustPath.test.ts` scans the paused Room Inspector and the constrained
drawer in the same state with axe.

**`aria-disabled` and never `:disabled`**, which is what keeps this criterion's own subject intact:
a paused control stays focusable, so the room being discussed can still be inspected and its reason
still read. The Inspector is not replaced, disabled or emptied while stale — it is the ONE surface
this increment deliberately leaves fully readable.

Criterion 3's resize-driven half is unchanged and still open. **Narrowed where it matters:** the
pause covers what dispatches through this leaf's chain and not the plugin's own palette commands,
which never enter it — that increment's design spec §11 records it, and
[[Recover from a stale read]] step 4a is where it is looked at in a vault.
