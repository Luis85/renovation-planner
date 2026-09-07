# Native recovery boundaries and browser resize synchronization

Date: 2026-09-07. Contribution on `codex/native-recovery-boundaries`, based on
`a7d61da1`. The four native cases and the first browser resize correction are verified;
the German recovery journey remains incomplete at a later Material-pan boundary.

## Native cases

Two new test files exercise four paths through the mounted Vue/Pinia/Konva editor:

- Planning and spatial refreshes read opposite sides of an independent geometry write.
  Both responses are actual repository results. Native Add Cost must refuse the mismatched
  projection, hydrate and permit a fresh draft on another explicit activation without writing.
- Full-record Unlink names both secondary contexts of shared Evidence. Native Cancel keeps
  persisted bytes; Confirm removes the named metadata, preserves the other evidence record
  and source file, and Undo restores the complete owner/link relationship.
- Schedule opened from the Work collection carries its actual Room origin without inventing
  a focused Work or Cost identity. The editor, stage, selection and bytes remain intact.
- Native batch Delete names a Wall and its selected Opening. Cancel preserves bytes;
  Confirm removes the wall/hosted opening once, and Undo restores the exact geometry.

No production behavior or coverage threshold is changed in this checkpoint. These tests use public navigation,
native controls and actual repository/command compositions. Unreachable synchronous guards
and missing-service composition invariants are not exercised through private handlers or
constructed service responses.

## Observed browser-driver failure

The original integrated runner stopped in `zoomReflow` at `editor-recovery-check.mjs:123`.
The German scenario had just changed its viewport from 460 to 920 pixels. The shared
`panel` helper observed the still-present constrained Details rail before ResizeObserver
and Vue completed the new layout, then tabbed toward a control that the full layout removed.

The preserved UI artifact shows a 920 × 900 viewport, both full-width side panels, no rail
targets, focus on the German material Edit button, and no page errors. The stack places the
failure before applying 200% CSS zoom. This is evidence of driver/layout synchronization;
it does not establish a production focus defect.

The driver now waits for the rendered shell's `data-layout="full"` state after that viewport
change and before choosing its keyboard target. All native keyboard, retained draft/focus,
write-count and overflow assertions and their existing timeout limits remain unchanged.

Original evidence is preserved in the UI worktree under
`harness-shots/planning-recovery/german-constrained-failed.png`, `-failed.txt`,
`-failed-focus.json`, `-failed-errors.json` and
`harness-shots/final-editor-dc563c77-resumed.log`.

## Verification and remaining browser failure

All 23 tests passed across five files in 15.15 seconds: the two new files plus
`downstreamActions.test.ts`, `sharedEvidenceContexts.test.ts` and `structureActions.test.ts`.
The initial run passed 22/23. Its shared Evidence fixture omitted the required `pin: null`
field, so read-back refused the saved Plan before Unlink was reached. Adding that field was
the only native-test correction. Explicit read-back assertions now verify the fixture too.
The real mixed-snapshot Add Cost case passed immediately. No production defect was found
by these four cases. Type checking, whole-tree Oxlint, scoped ESLint for both new test files,
`node --check` for the driver and diff checks passed. The repository excludes `.mjs` scripts
from ESLint; including the driver in the initial lint command produced only an ignored-file
warning, then the corrected two-test-file lint command passed with zero warnings. No
additional coverage run or full-gate pass is claimed.

The focused browser probe ran the actual German journey under installed headless Microsoft
Edge 152.0.4191.62 on Windows with Node 24.20.0. Temporary copies preserve all original
journey assertions and timeout limits; only the common matrix's scenario list is filtered
to German and artifact directories are separated. The before copy uses the original
`HEAD` driver; the after copy adds only the full-layout wait. Production source is the
unchanged `a7d61da1` tree. An initial launch without the executable override stopped before
opening a browser because the Playwright cache was absent; the installed Edge binary was
then selected explicitly, with no download.

The before probe reproduced the same Details-rail failure at `zoomReflow` after 460 → 920.
Its viewport/focus/error evidence matches the original failure: full layout, focus on the
German Edit button and no page errors. The after probe passed that boundary and all 200%
CSS zoom assertions, retaining `13,5`, native input focus, keyboard Cancel and write counts.
The resulting German zoom/reflow screenshot was captured and visually inspected.

**The after journey still failed later.** During `largeFloor`, after opening Materials from
the overview link, the Inspector remained open at 460 pixels after Escape and covered the
canvas. The actual camera-change assertion in `materialPan` timed out. The failure screenshot
and focus dump show `aria-expanded="true"` on Details and a material disclosure focused.
The linked overview button disappears when changing modes without an explicit focus
successor; this separate focus-continuity finding requires its own native reproduction and
production correction. This checkpoint does not mask it with extra Escape or rail actions.

The probe therefore produced no complete performance report. Usable/selection/Inspector
timings and pan/material-pan median/p95 and cleanup totals cannot be claimed from this run.
The script records latency targets but does not assert those budgets, so even a future
successful process must have its raw measurements reviewed separately. No final matrix,
full-gate, live Obsidian or manual screen-reader acceptance is claimed.

Machine reports remain at `%TEMP%/rp-e-native-boundaries-first.json`,
`rp-e-native-boundaries-diagnostic.json` and `rp-e-native-boundaries-final.json`.
Browser probes and logs are preserved in this worktree under `harness-shots/e-resize-probe`,
`harness-shots/e-resize-before`, `harness-shots/e-resize-after`, `e-resize-before.log` and
`e-resize-after.log`. These bounded diagnostic captures do not replace the shared final
recovery/performance report and screenshots.
