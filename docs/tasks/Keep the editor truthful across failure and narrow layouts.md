---
type: Task
parent: "[[Open a floor plan in the Obsidian editor shell]]"
order: 30
status: Done
horizon: "MVP"
release: "[[MVP]]"
---

# Keep the editor truthful across failure and narrow layouts

## Evidence

[M15](../user-experience/renovation-planner-editor-specs/screens/M15-stale-data-warning.md) keeps last-valid content after read-back failure, while [M16](../user-experience/renovation-planner-editor-specs/screens/M16-constrained-workspace.md) preserves editor state across layout changes.

## Why it matters

Failure and narrow leaves must not turn valid data into an empty screen or reset the user's spatial context.

## Approach

Integrate initial failure, stale projection, retry-only hydration and full/constrained/unsupported-width shell states around the same floor identity.

## Acceptance criteria

- Initial failure, supported empty and stale-after-write render differently.
- Retry after stale state repeats no mutation.
- Constrained reflow preserves viewport and selection.
- Unsupported width offers a non-canvas summary and focus action without horizontal scrolling.

## Risks

Responsive remounts can accidentally retire the store whose state they promise to preserve.

## Outcome

The floor remains honest and recoverable when data or workspace width is imperfect.

## Closing evidence

**2026-09-03**, the plan editor foundation's first increment. Criterion 1 is
`tests/presentation/editor/planEditorFailure.test.ts` (initial failure as an in-place failure
state, stale-after-write as an ADDITIVE strip over content that is still on screen) beside
`tests/presentation/editor/emptyStateOverlay.test.ts` and
`tests/presentation/editor/shell.test.ts` for supported empty; criterion 2 is the same failure
file's retry cases — retry repeats the READ and no mutation. Criterion 3 is
`tests/presentation/editor/shell/responsiveShell.test.ts`'s 'moves from full to constrained
without remounting the canvas' and 'keeps selection and viewport across the change', which assert
element identity rather than a redraw. Criterion 4's first half is that file's 'below the floor
width replaces the canvas with a summary and a Focus this tab action that asks the leaf'.

Criterion 4's 'without horizontal scrolling' half is held by NOTHING, and by no manual step
either: jsdom lays nothing out, the only narrow capture is at 460px (which is `constrained`
rather than `unsupported`), and step 10 of [[Open a floor and select a room]] — which does open
this state — asks the tester to watch `Focus this tab`, never to look for a sideways scrollbar.
An earlier draft of this line named that step as the instrument; it is not one. The unsupported
notice's own body also reads "1 rooms" for a single-room floor — a spec-mandated string, and `tr`
has no plural form.
