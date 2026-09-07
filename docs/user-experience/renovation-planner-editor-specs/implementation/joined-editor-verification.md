# Joined editor verification — 2026-09-07

This checkpoint joins UI `443d721d` (Object `aa9896db`), recovery `2c353329`, persistent focus `cad06deb` and recovery probe preparation `d9a1334e` on the finalization branch. The root followup adds linked-document context/reveal, native paused Area controls and shared form/migration/navigation helpers.

## Focused verification

Vue type checking and changed-file ESLint pass. The joined 18-file run passed 139/141 tests; both failures were new fixtures that set nested material source targets instead of the top-level draft target used by the production adapter. After correcting the fixtures, both affected files pass 13/13 tests (16.87s). The other 16 files remain passing from the joined run (86.41s). No production behavior or assertion was relaxed to clear these fixture errors.

The run covers recordNavigation, planningMarkers, spatialBatchRemoval, areaDetails, roomNaming, outlineEdit, renovationBatchForm/Guards, elements, linearElements, elementRecovery, planningWorkflow/Recovery, objectCreation, restoreInspectorActionFocus, both naming/resize harness suites and legacy migration fixtures. It verifies repeated marker Details/focus, cross-target linked documents, shared Room context, material/Work deletion refusal, peer geometry refresh, native form identity and paused-select refusal through real production components and repositories over FakeVault.

Separate joined-tree Fallow diagnostics report zero clone groups and zero dead-code issues, including private type leaks. The existing ignored clone remains unchanged; no exclusions or thresholds were relaxed. Full coverage-weighted health is still pending the complete coverage run.

## Full and external acceptance

The full unchanged `npm run check` gate is pending. The last pushed integration `88b9ee3d` failed CI; its result is not replaced by these focused checks. Final M00–M17 visuals, performance/cleanup captures and H1–H6 host/device/screen-reader acceptance remain separately open.
