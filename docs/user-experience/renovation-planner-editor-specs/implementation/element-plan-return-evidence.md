# Element return to Plan — pending native verification

The full 73b0 coverage report did not execute the native ElementInspector action
that returns from Renovate to Plan geometry editing. The new cases in
`tests/presentation/editor/elementInteractionGuards.test.ts` use an actual saved
path and the mounted editor at 1100 and 460 pixels. They focus and activate that
button, require a visible keyboard successor (Edit or the Details rail), preserve
selection/viewport/vault bytes, and open/cancel the normal geometry form.

This is a **test-only WIP**. No production defect or pass is claimed before execution.
Diff checks pass; native/type/lint checks are pending the UI owner's existing heavy
slot. Root owns any resulting ElementInspector correction. UI has been asked to
include this existing test file in its next native batch after merging the pushed
checkpoint, so no overlapping heavy process is needed.

If the new case fails, first inspect whether the native action was reachable and
which visible node retained focus. Preserve the same selection, viewport and
no-write assertions. Do not call private Vue handlers or weaken the assertion to
accept document.body. Record RED/GREEN evidence here and in [RESUME.md](RESUME.md).
