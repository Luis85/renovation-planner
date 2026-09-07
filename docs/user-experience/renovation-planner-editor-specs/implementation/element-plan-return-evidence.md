# Element return to Plan — native RED and pending correction verification

The full 73b0 coverage report did not execute the native ElementInspector action
that returns from Renovate to Plan geometry editing. The new cases in
`tests/presentation/editor/elementInteractionGuards.test.ts` use an actual saved
path and the mounted editor at 1100 and 460 pixels. They focus and activate that
button, require a visible keyboard successor (Edit or the Details rail), preserve
selection/viewport/vault bytes, and open/cancel the normal geometry form.

The UI owner ran the joined native batch on `ee1e20ab`: 309 passed, three failed
across 21 files (160.78 seconds). Both new cases reached the actual Plan action and
failed because `document.activeElement` became `document.body` after it unmounted.
The third failure belongs to an unrelated UI Review fixture. The preserved RED log
is `harness-shots/ui-wip-validation/native-joined.log` on the UI worktree.

Root now routes the action through the existing `runInspectorAction`, restoring
Edit or the Details rail after the perspective change. Selection, camera and vault
assertions remain unchanged. This correction is **WIP pending the native rerun**.
The separate new-test type mistake (`get(...).exists()`) is corrected to
`find(...).exists()`; CI run 34134004116 stopped at that type error on all four legs,
so no full coverage was produced. UI will apply the pushed correction after its
terminal run and execute the focused rerun alongside the new downstream cases.

If the new case fails, first inspect whether the native action was reachable and
which visible node retained focus. Preserve the same selection, viewport and
no-write assertions. Do not call private Vue handlers or weaken the assertion to
accept document.body. Record RED/GREEN evidence here and in [RESUME.md](RESUME.md).
