# Native editor release acceptance — 2026-09-08

## Environment and preflight

Only `C:/Users/lum/.codex/tmp/renovation-planner-finalization-vault` is in scope. The ordinary
`renovation-planner` vault window is not used for acceptance. Windows Computer Use identified
the isolated vault window in Obsidian 1.13.7; its Renovation project view and existing synthetic
Project/Plan are visible with the plugin enabled. No trust or security setting was changed.

The installed preliminary bundle still hashes to
`8258d6b2482c85bc04b1596e9cf0993fd2df8f45571dc84c6235e77106c972d2`.
This is preflight only, not acceptance of the new release. Before the final build is installed,
the Project, Plan and sidecar bytes were hashed in ignored `harness-shots/release-host/before-files.json`.
The Plan and sidecar both remain schema 1/revision 1, with no geometry. Existing test PNG/PDF
fixtures are available in `References/`.

## Execution checklist

The final source revision and bundle/styles/manifest hashes must be recorded before testing.
The existing [host walkthrough](native-host-walkthrough.md), [host criteria](e-host-ci-audit.md)
and current editor suite supply the full actions. Prioritize the changed interactions and
their dependencies, and mark each unperformed observation separately.

| Criterion | Planned current-build observation | Current evidence |
|---|---|---|
| H1 | Read legacy files byte-identically; PNG/PDF reference Cancel/Save; save Object and reopen exact points; evidence file/cache rename or move | Preflight only; final build pending |
| H2 | Native Room/Object creation; rotation degree and quarter-turn controls, cancellation, Undo/Redo; retyped Room dimensions; keyboard/list focus and constrained draft reflow; eleven Add cancel routes; connected Inspector walkthrough | Final build pending |
| H3 | Light/dark/custom accent and German constrained host controls; actual host zoom and supported-width refusal | Browser matrix and native host observations must be recorded separately |
| H4 | Final representative browser performance/cleanup plus native injected mouse/wheel checks | Physical touch, pen and trackpad pinch require a named device and observer; injected input is insufficient |
| H5 | Named screen reader/version, audible validation/status and focus-return review | Unperformed; UIA attributes and axe do not establish audible announcements |
| H6 | Same synthetic source peer conflict; missing/restored linked file; read-only Retry | Deterministic successful-write/failed-readback counts belong to fault-injected runtime tests; no native fault seam established yet |

No host criterion is passed by this preparation. Unperformed hardware or screen-reader checks
do not stop independent implementation, gate, browser or applicable host verification.
