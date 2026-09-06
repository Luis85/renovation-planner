# Configure a reference plan — M05/M06

Contract: [ADR-0019](../../development/adrs/0019-floor-reference-configuration.md), SDD §25,
§29–31, §38, §42, §44–45, §66 and §98. This complements the existing contextual gesture in
[Calibrate a Plan](Calibrate%20a%20Plan.md).

## Reproduce

Run `npm ci`, then `npm run harness` and open `?view=plan-editor&reference`. This mounts the
production editor and command dispatcher with actual repositories over FakeVault. PNG and PDF
bytes come from committed fixtures; the browser workspace resets on page reload. This is not
production seed data or a persistence substitute in the plugin.

For the real keyboard matrix, run `node scripts/editor-reference-check.mjs`. Set
`RP_CHROMIUM_EXECUTABLE` to a browser executable when the pinned Chromium is unavailable. The
2026-09-06 run used Edge 152.0.4191.62. It passed light/dark at 1440 px, custom accent at 1000 px
and German at 460 px. It uses Tab, Enter, Space, arrow keys, Control+A, Backspace and Escape;
no programmatic field fill or focus shortcuts. Report, twelve step screenshots and four committed-canvas captures are written
to `harness-shots/reference-plan/`. These generated artifacts are intentionally ignored.

## Traceability and acceptance

| Criterion | Demonstrated evidence |
|---|---|
| Empty floor from queries; Add rooms, Upload, Start empty; hide during tasks | `referenceWorkflow.e2e.test.ts`, updated `emptyStateOverlay.test.ts`; browser activates all three choices and checks canvas focus |
| Prepare PNG/PDF, page, crop, rotation in one draft | Mounted workflow suite; browser real PNG/PDF decode, missing page 99, page 1 retry, final PDF commit/reopen and Undo back to PNG |
| Replacement cancellation preserves prior reference | Command/workflow suites; browser reopens PNG with original rotation after cancelling a PDF replacement |
| Pointer or keyboard endpoints; known length; another distance retains source | `referenceSetup.test.ts`, workflow pointer/numeric cases; native keyboard browser journey |
| Deterministic source/crop/rotation/world conversion and repeated calibration | `referenceSetup.test.ts` with image and PDF densities, inverse fit, comma decimals and invalid measurements |
| Existing geometry explicitly acknowledged before scale change | Workflow and actual-stack command suites assert all coordinates rescaled; exact snapshot Undo restores originals |
| Review scale, opacity, visible and lock; new defaults visible/locked | Mounted workflow plus light/dark/custom/German browser review captures |
| No mutation before Finish; one history item; exact Undo/Redo | `configurePlanReference.test.ts`, mounted dispatcher and browser Undo/Redo |
| Busy and duplicate submission, stale and peer conflicts | Command and workflow suites; failed/conflicted draft retained, no peer overwrite |
| Missing/unreadable source, changed-source invalidation and retry | Workflow suite; browser actual PDF page failure/retry; existing background decoder tests |
| Rejected/thrown sidecar write compensates; recovery failure warns | Actual-stack command tests and save-state workflow test; new guarded factory tests |
| Legacy compatibility, v2 validation, no read rewrite, fresh stack reload | `referencePlanMigration.test.ts` and actual repository/index/cache/echo/geometry stack reconstruction in command suite |
| Disposal, late loads, retired baseline reads, authorized write after disposal | Mounted workflow suite, listener counts and no retired dialog resurrection |
| Semantic accessibility, native key ownership, reflow and focus return | Axe on all steps at 1280/460 px; browser draft/focus checks across both layout directions |
| Committed rotated reference fits the empty floor; Fit all includes visible reference; active creation camera retained | `backgroundInEditor.test.ts` and four committed-canvas browser captures |
| Rendering resource cleanup | Existing image/PDF loading tests and rejected PDF task cleanup; source changes/disposal release listeners and discard stale decoded results |

Test paths above are under `tests/presentation/editor/` unless explicitly named as command
(`tests/application/commands/plan/`), migration (`tests/infrastructure/persistence/`) or guarded
factory (`tests/plugin/`). Existing Room/Area/naming/resizing tests remain in the complete check.

## Visual inspection

Inspect each Prepare, Set scale and Review screenshot, not merely the runner's pass output.
Check fit, crop/rotation, visible measurement markers, readable instructions and scale, focus
ring, button placement, translated wrapping and custom accent. Browser metrics must show no
horizontal dialog overflow. The runner preserves host theme tokens across its floor-start reload
and asserts the custom accent is `#7c246b`; visual captures verify the warm custom backgrounds
and matching opacity/checkbox accent. The report records browser version and zero page errors separately
from visual judgement. Screenreader and real host behavior cannot be inferred from axe or Edge.

## Still open

- Live Obsidian source suggestions, actual PDF version/worker, split leaves, MetadataCache timing,
  plugin unload/reload and host restart acceptance.
- Screenreader step/error announcements, native datalist interaction and focus restoration.
- Abrupt process termination between the two persistent writes; application compensation does
  not supply a durable cross-file crash journal (ADR-0019).
- Very large/raster-heavy PDF performance and exotic codec acceptance in the actual host.
- Full Phase 6 visual/product acceptance and the remaining Increment B/editor roadmap.
