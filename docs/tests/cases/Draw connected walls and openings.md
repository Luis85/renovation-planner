# Draw connected walls and openings — M04 / spatial M07

Contract: [ADR-0020](../../development/adrs/0020-connected-walls-and-hosted-openings.md), SDD
§25, §29–31, §40–45, §66 and §94. This advances Increment B, Phase 5; it does not accept later
Existing/Planned/Work, material, cost, evidence, structural engineering or BIM features.

## Reproduce

Run `npm ci`, then `npm run harness` and open `?view=plan-editor&reference`. The production
Vue/Pinia/Konva editor uses actual repositories over FakeVault. Configure `scan.png` or
`scan.pdf` from the committed fixtures, then Add → Wall. The browser fixture resets on reload;
fresh repository reconstruction is a separate automated persistence test.

`node scripts/editor-structure-check.mjs` drives actual Tab, arrow keys, Enter, Space,
Control+A, Backspace and Escape through reference setup, a closed wall loop with a Room,
door/window/opening creation, measurements, preview/cancel, deletion and Undo/Redo. It writes
screenshots and a browser-version report to ignored `harness-shots/connected-walls/`.
The runner checks light/dark at 1440 px, custom accent at 1000 px and German at 460 px;
it installs the original host theme tokens before reload and asserts them afterward.
When the pinned browser is unavailable, set `RP_CHROMIUM_EXECUTABLE` to an installed Chromium.
The recorded run used installed Chromium 148.0.7778.96 (also recorded in the generated report), after
both pinned-cache installs failed to renew their download lock. This is browser evidence, not
live Obsidian acceptance.

## Traceability

| Criterion | Automated evidence |
|---|---|
| Pointer/numeric equivalence, metre parsing, exact mm rounding, tolerances and invalid geometry | `tests/presentation/editor/structureDraft.test.ts`, `tests/domain/spatial/structure.test.ts` |
| Temporary connected chain, point undo, closed loop, optional named Room, busy and retained failures | `structureLifecycle.test.ts`, `tests/harness/structureJourney.test.ts` |
| Opening/wall/room hit priority, Alt cycling, end-junction pointer edit, typed selection and list route | `structureSelection.test.ts`, `structureLifecycle.test.ts`; shared selection suites |
| Exact-length/opening form preview, cancellation, containment, focus, native keys and disposal | `structureActions.test.ts`, `structureLifecycle.test.ts`; browser impact captures |
| Host existence, overlap, connected edits, deletion and reversed history | domain geometry suite, `structureCommand.test.ts`, `structureActions.test.ts` |
| Optional Room compensation, recovery failure, conditional history, peer protection and events | `structureCommand.test.ts`, `structureRecovery.test.ts`, `roomBoundaryHistory.test.ts` |
| Room deletion restores associations or compensates safely when its walls are missing | `roomBoundaryHistory.test.ts` through real repositories |
| Pure/idempotent v1→v2 migration, future refusal, legacy IDs/notes preserved, actual fresh reload | `structurePersistence.test.ts`, `structureCommand.test.ts` |
| Populated reference replacement/calibration scales all geometry and retains appearance | `structureRecovery.test.ts`, `referenceWorkflow.e2e.test.ts`; existing reference suites |
| Read/execute/undo exception boundary | `tests/plugin/guardedStructure.test.ts` and command recovery tests |
| Reflow without losing input/focus, translated wrapping, themes and root overflow | four browser scenarios; `structureJourney.test.ts` and existing responsive suites |
| Listener/stage/draft retirement | `structureLifecycle.test.ts`, existing canvas lifecycle suites |
| A chain starting or ending on a wall body cuts the host at the join (endpoint, perpendicular and Shift-ray snaps, two cuts on one wall, opening refusal, auto-finish, numeric 1 mm join, status line and cut marks) | `tests/domain/spatial/wallJoin.test.ts`, `tests/domain/spatial/splitWall.test.ts`, `structureDraft.test.ts`, `tests/presentation/editor/structure/StructureTool.test.ts`, `structureLifecycle.test.ts`, `finalOverviewPresentation.test.ts` |

Unqualified editor test names are under `tests/presentation/editor/`; command names under
`tests/application/commands/`; persistence under `tests/infrastructure/obsidian/repositories/`.
The complete check also runs existing Room/Area creation, renaming, resizing, selection,
calculation, reference rendering and accessibility regression suites.

## Visual inspection and remaining acceptance

Inspect the closed loop, wall Inspector, wall/opening impact, delete confirmation and completed
canvas screenshots in all four scenarios. Check readable labels, visible focus, line patterns,
custom surface/accent colors, scrollable task fields and sticky Finish. Screenshots were actually
opened and inspected; saving PNGs alone is not visual verification. The root has no horizontal
overflow in the recorded scenarios. Axe checks in the mounted journey are semantic DOM evidence.

Live Obsidian split leaves, actual asynchronous MetadataCache timing, workspace persistence and
host restart, screenreader announcements/native picker behavior, physical pointer/touch feel,
very large plans and full product acceptance remain **open**. Application compensation covers
reported failures; abrupt process loss between Room-note and sidecar writes still lacks a durable
crash journal (ADR-0019). Straight end-to-end walls and nonoverlapping horizontal opening intervals
are the supported geometry. Curves, implicit T/crossing splits, door swing direction, opening
dragging along a wall, automatic Room synchronization and later renovation semantics are absent.

For live acceptance: create the same loop over a real calibrated reference; insert all opening
types; shorten below containment and confirm refusal; edit the end junction, cancel then apply;
delete/undo a host and a Room; split the leaf, edit elsewhere, and confirm a stale task cannot
overwrite it; restart Obsidian and verify IDs, names, appearance, measurements and relationships.
Record results separately from this automated/browser evidence.
