# Modal controls and recovery boundaries

## Scope — 2026-09-07

Verified as a follow-up to integrated source `24ee3177fa3d088cd52b05430ae33a972428494d`
for PR #91. This checkpoint is separate from the final combined gate and capture matrix.

Planning and renovation form controls now use focusable `aria-disabled` states for pending
writes and conflicts. Capture handlers refuse native select/checkbox changes before Vue's
model listener and restore the displayed draft value. Busy buttons and the evidence file
chooser refuse activation without removing the focused node from keyboard navigation.
Read-back recovery still leaves safe draft text and choices editable; Apply and file writes
remain blocked by their existing prerequisites.

The parent forms and planned geometry forwarding components pass their draft objects directly.
Their children mutate nested properties and never replace the whole model object, so the
removed replacement listeners represented no production edit path. The child model props and
shared reactivity remain intact.

New repository-backed regressions cover current/intended generic material targets, a completed
planning read that disagrees with the displayed geometry, and an authorized save completing
after leaf disposal without publishing into the retired view or stealing focus. Native-control
regressions exercise scalar selects, boolean checkboxes, Work outcome arrays, duplicate Apply,
and cost-fact actions during a held dispatch, then persist the retained values through the
normal application commands.

The browser-only recovery probe can hold repository writes pending and release them explicitly.
`node scripts/editor-modal-busy-check.mjs` checks native keyboard focus, refused select changes,
the dialog's pending-write Escape/Tab behavior and eventual save completion in light, dark,
custom-accent and constrained German layouts. Browser results remain separate from live
Obsidian and manual assistive-technology acceptance.

## Executed checks

- The native-control regressions failed against the previous implementation at five
  `disabled`/focus assertions. The production change restored those paths.
- Eight focused test files passed: 72 tests, 44.02 seconds, two workers. They cover planning
  forms/workflows/recovery, renovation workflows/failures/batch forms, pending controls and
  target/projection boundaries. A first green run had one incorrect fixture comparison:
  a canonical material transaction advances the geometry revision while preserving the
  document. The corrected assertion checks the document, not the revision.
- `vue-tsc -noEmit`, whole-repository Oxlint, ESLint over every changed/new TypeScript and Vue
  file, browser-driver syntax and `git diff --check` passed. Vue attribute-order warnings
  from the initial static pass were fixed before this result.
- Fallow dead-code and duplication checks passed with no findings. Full combined coverage
  and coverage-weighted health remain owned by the finalization gate; no floor, exclusion,
  suppression or complexity budget changed.
- A separate focused V8 run over `modalInoperativeControls.test.ts` passed all four tests
  and covered the new native event helper at 100%: 11/11 statements, 8/8 branches,
  2/2 functions and 6/6 lines. This is a per-file measurement, not whole-project coverage.
- Native Edge `152.0.4191.62` passed four scenarios: light/dark at 1440×900,
  custom accent at 1000×900 and German at 460×900. Both Existing and Materials retained
  Apply focus during an actual held repository save, restored refused native select changes,
  kept Escape from closing the pending dialog, contained Tab and completed after release.
  Each case finished with zero waiting writes and zero page errors.

The browser journey uses the existing 80-Room/240-material reference fixture and real
application repositories over FakeVault. Its report records two Plan writes and one material
write across the two operations; this is not a lifecycle or performance run.

## Captures and limits

[Machine-readable browser report](evidence/modal-busy/report.json),
[light Materials](evidence/modal-busy/light-planning-pending.png),
[German Materials](evidence/modal-busy/german-constrained-planning-pending.png) and
[dark Existing](evidence/modal-busy/dark-renovation-pending.png) were inspected.
The tall Materials dialog is scrolled to its actions in the captures; the screenshot does
not show all fields at once. The harness badge remains visible outside the dialog.
This run adds no new axe or screen-reader claim. The complete final source still needs its
shared browser matrix; live Obsidian, manual assistive technology and physical-device
acceptance remain separate.
