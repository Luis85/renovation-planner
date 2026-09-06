# Editor implementation status — 2026-09-06

The implementation plan is a multi-release roadmap. This ledger distinguishes shipped baseline
behavior on `cf536f32` from the current contribution. It does not declare the whole roadmap done.

| Phase | Baseline and current contribution | Remaining work |
|---|---|---|
| 0 | Existing Room/Zone and Floor/Plan ADRs; ADR-0018 records selection, Inspector and refresh ownership | New-domain contracts, perspective implementation and stakeholder acceptance |
| 1 | Responsive shell, context bar, rails and drawers already exist | Perspective controls when their domains are available; full theme/release acceptance |
| 2 | This contribution adds ordered unique multi-selection, independent member focus, badges, overlap cycling, persistent list access and shared-property summary | Wall/Opening/Object hit priority and inspectors when those entities exist |
| 3 | Select/Add and temporary Room tools exist; the Area continuation adds its catalogue path, validated outline, one-shot/repeated completion and keyboard routing; the numeric continuation adds corner placement/correction | Unavailable creation domains, complete cross-tool/non-canvas routes and release acceptance |
| 4 | Rectangular room creation exists; the dimensions continuation adds keyboard resizing of existing axis-aligned four-corner Rooms; the naming continuation adds explicit keyboard renaming for all Room outlines | Broader resizing, room-kind decision and complete M03/live acceptance |
| 5 | Not delivered | Walls, hosted openings, connected creation, exact-length impact and composite undo |
| 6 | Query-derived floor start and compensated prepare/scale/review setup, persistent appearance, exact-version history and contextual revisiting (ADR-0019) | Live Obsidian/screenreader, forced-process recovery and complete M05/M06 acceptance |
| 7 | Not delivered | Separate Existing/Planned state and change relationships |
| 8 | Not delivered | Work dependencies, readiness, Review and vault-backed review notes |
| 9 | Asset requirements and calculations exist | Geometry/work-linked material planning, provenance and shopping list journey |
| 10 | Requirement cost figures and project price overrides exist | Planned/committed/actual cost items and spatial reconciliation |
| 11 | Not delivered | Common evidence links, files, pins and contextual creation |
| 12 | Existing stale-write protection and accessibility/theme harness | Complete end-to-end release, performance, migration/recovery and live Obsidian verification |

## Current selection contribution

- Shift-click adds/removes a room or area; Alt-click cycles overlapping bodies.
- The property panel keeps every readable room/area reachable after selection. Its multiple
  selection checkbox provides an equivalent touch and keyboard route without modifier keys.
- M11 numbers follow the ordered unique selected IDs. A badge, selected body or M11 member row
  focuses a member without changing membership. Removing that member focuses the first survivor.
- All selected outlines remain visible. Only a single selection has editable corner handles.
- Escape also works from the property list and restored panel-rail focus. Add and overlays
  close first; draft/tool cancellation precedes clearing, and held-key repeats do not cascade.
- The Inspector labels mixed types and the sum of individual areas. Overlap is explicitly counted
  separately. No batch deletion, removal marking or shared Work/Evidence action is advertised.
- All added user-facing strings have English and German translations. No vault migration occurs.

## Traceability

| Screen / contract | Automated evidence |
|---|---|
| M00 overlap and safe selection | `tests/presentation/editor/selection/resolveSelectionTarget.test.ts`, `spatialSelection.test.ts`, `tools/selectTool.test.ts` |
| M01 persistent list and single Inspector | `tests/presentation/editor/shell/floorInspector.test.ts`, `roomInspector.test.ts`, `roomSummaryList.test.ts` |
| M11 membership, focus and aggregate | `tests/presentation/editor/selection/spatialSelection.test.ts`, `shell/multiSelectionInspector.test.ts` |
| M16 layout retention | `tests/presentation/editor/shell/multiSelectionInspector.test.ts`, `responsiveShell.test.ts` |
| Harness route at full/constrained widths | `tests/harness/harnessSurfaces.test.ts` |

Harness: `?view=plan-editor&select=harness-terrace,harness-kitchen`, with `&theme=light` and
`&lang=de` as needed. `npm run harness-shot` includes light, dark and German 460 px M11 captures.
These are visual inspection fixtures, not a claim of WCAG or live-vault acceptance.

## Verification of this contribution

`npm run check` passed with `VITEST_MAX_WORKERS=2`: build, lint, 473 test files,
6,577 passing tests (70 skipped), coverage and Fallow. Coverage: statements 99.25%,
branches 98.03%, functions 99.22%, lines 99.58%. The final overlap-badge correction also
passed a subsequent build and targeted lint. The worker limit avoids an existing architecture
test timing out under the default parallel load; no test timeout or coverage threshold changed.

The browser harness was visually inspected with installed Edge 152.0.4191.62: light, dark,
custom accent and German at 460 px. The captured root had no horizontal overflow or page
errors in those four scenarios. Keyboard Space/Enter exercised the multiple-selection
control, member selection, focus without membership loss, and clearing back to Floor.
The pinned Chromium installation was blocked by a shared cache lock; these captures are
therefore Edge evidence. Live Obsidian acceptance and a complete accessibility audit remain open.

PR #74's Escape review added regression cases for the property row, selection checkbox,
Details rail and Layers rail; all four failed before the fix. The five targeted keyboard,
menu, responsive-shell and selection suites pass 85 tests after the correction. Real Edge
keyboard input also confirms property-row focus retention and the two-press Details-close /
selection-clear sequence at 460 px.
The review follow-up also passes `VITEST_MAX_WORKERS=2 npm run check`: 473 test files,
6,584 passing tests (70 skipped), build, lint and Fallow. Coverage is 99.25% statements,
98.04% branches, 99.22% functions and 99.58% lines.

## Delivery sequence

Continue with separately reviewable contributions following increments A–E. The current
selection contribution advances A; it does not close A's still-open domain-dependent criteria
or substitute for B–E. Each PR must record its actual verification and leave unmet criteria open.

## Area continuation on PR #74 — 2026-09-05

Base: remote `codex/editor-implementation` at `f7aa3c5e0876df35c52885c5d75f669d1e7cb3dd`.
PR #74 was open when this worktree was created. Its existing review fix and regression tests
are retained; its CI matrix subsequently passed. The later single-selection Escape finding
is corrected in this continuation without modifying PR #74's branch.

Delivered criteria:

- Area activates once through the existing catalogue and writes no entity until completion.
- First-corner close, Enter and Create area share one geometry-tool completion and dispatcher.
- Valid outlines create a `Custom` Zone through existing commands and Markdown/sidecar ports;
  Room completion still produces `Room`. Zero/unrepresentable area is rejected only at the
  new creation boundary; existing files keep their compatibility contract.
- Success selects the new Area and returns to Select. Explicit repetition clears the outline
  and keeps the tool active; leaving the task resets the checkbox. Busy closes dispatch once.
- Draft/tool cancellation preserves selection. In-flight write responses respect tool generation;
  retries retain the outline, and stale projection blocks further writes.
- Root Escape now also handles empty-selection tasks and idle single list selections; native
  editing fields own their keys. Existing Add, drawer, pan and held-key precedence stays intact.
- English/German homeowner labels, a browser harness outline scenario, real keyboard checks,
  and light/dark/custom-accent/constrained-layout captures accompany the implementation.

Traceability:

| Contract | Evidence |
|---|---|
| Catalogue activation/search and localization | `add/creationCatalogue.test.ts`, `areaCreation.e2e.test.ts` |
| Valid/invalid completion, refusal, busy, repetition, superseded task, Undo/Redo | `areaCreation.e2e.test.ts`, `add/areaOutline.test.ts`, `tools/polygonFinish.test.ts` |
| Zone type, Markdown metadata, sidecar readback and Area projection | `areaPersistence.test.ts` |
| Selection/Escape regression, pan and fields | `shell/multiSelectionInspector.test.ts`, `canvasNavigation.test.ts`, `areaCreation.e2e.test.ts` |
| Harness/ARIA at 1280 and 460 px | `tests/harness/areaCreation.test.ts` |
| Browser keyboard/theme/layout | `scripts/editor-area-check.mjs`; `harness-shots/area-verification/` |

Verification: `VITEST_MAX_WORKERS=2 npm run check` passes build, zero-warning lint, all 478 test
files (6,604 passing tests; 70 skipped), coverage thresholds and Fallow. Coverage: 99.24%
statements (10,521/10,601), 98.03% branches (5,899/6,017), 99.23% functions (2,841/2,863),
99.58% lines (9,143/9,181). The changed-file coverage review found complete coverage of the
Area validator/task/catalogue/banner and polygon completion. It prompted one further assertion
that idle Escape stays unconsumed; the eight Area E2E cases and targeted lint pass after that
test-only addition. No quality threshold was lowered. Real Edge 152.0.4191.62 keyboard and
visual checks pass in all four documented scenarios.

The visual browser fixture remains read-only: it deliberately refuses writes. The E2E suite uses real commands with
in-memory repositories, and the persistence test uses the actual Obsidian repository stack
against a fake vault. Neither is a live Obsidian acceptance run.

Remaining scope after PR #75: Area metadata editing and a numeric route for individual corners, robust
self-intersection/repair rules, the unavailable M02 entries, domain-dependent Phase 2 criteria,
and the remainder of increments B–E. The implementation plan and Increment A remain open.


## Numeric Area continuation on PR #75 — 2026-09-05

Base: remote `codex/editor-area-creation` at `d91431b2ab787e54ad6105bb7fb7ebbdf01e3d19`.
PR #75 and its base #74 were open; all CI checks on both heads passed at inspection.
The #74 history included by #75 is inherited, including `74290e9` and the `f7aa3c5` Escape fix.
#74's later single-selection review finding is already fixed by #75. During this work, #74
advanced to `bb62e2f3db88c35990f34e56dad919fdccce0fd0` with that fix and five new regression
cases; this continuation imports those tests verbatim. Its CI is green. The new native asset
picker Escape review on #74 is already protected by #75's `isEditingField` boundary. #75's outstanding
busy-Enter finding is fixed in this continuation at the shared drawing-tool completion gate,
covering first-corner close as well as Enter and the button. Neither base branch is modified.

Delivered scope:

- Add → Area retains canvas focus; Tab reaches **Enter corner coordinates / Eckpunkte numerisch
  eingeben**. The native disclosure opens with Enter/Space; Tab then reaches x, y, Apply and
  Discard, followed by the ordered corner edit/remove controls and existing Finish/Cancel/repeat.
- Positions are absolute plan coordinates: origin `(0, 0)`, x right, y down. Fields and rows use
  metres, decimal point/comma and the existing length grammar/whole-millimetre rounding. Zero
  and negative coordinates are valid. Room's positive-size and kilometre limits are unchanged;
  absolute positions instead refuse values not representable as safe integer millimetres.
- Apply (or unmodified Enter in a field) adds/changes one corner in `DrawPolygonTool`'s buffer.
  Remove changes that same buffer. Canvas gestures and numeric entry share duplicate checks,
  `RenderState.polygonSketch`, `areaOutline` and the existing completion/command/history path.
  Untouched axes retain the exact mouse coordinate, including sub-millimetre values.
- Raw uncommitted text is per-leaf task state, not a second geometry. It survives disclosure
  folding and is explicitly applied/discarded. Pending text blocks all completion doors and
  switching the edited row; invalid text describes the field and focuses the first invalid one.
- Field Escape and native editing keys do not reach the canvas. Enter applies the pair only;
  chords, composition and held Enter do not apply it. Buttons still bubble to the existing
  Add → overlay → draft → tool → selection Escape route. Cancel/task change resets input even
  when no corner was applied. Submitted-write generation protection remains unchanged.
- Successful completion uses the existing `Custom` Zone, counted localized name and sidecar
  contract. Undo/Redo, one-shot Select return and explicit repeat remain unchanged. Point
  edits before completion are temporary and add no entries to document history.

Evidence: `areaNumeric.e2e.test.ts`, `add/areaCornerInput.test.ts`, the retained Area/Room/tool/
selection suites, `tests/harness/areaCreation.test.ts`, and
`scripts/editor-area-numeric-check.mjs`. `?view=plan-editor&area=numeric` uses real commands
and ephemeral in-memory repositories, and supports successful creation/Undo/Redo in the browser.
Reloading discards this harness workspace. The original `?area` scenario remains read-only.

Browser verification: Edge 152.0.4191.62 passed real keyboard journeys in light/dark, custom
accent and German at 460 px. No page errors or horizontal editor/form overflow; screenshots
were visually inspected. Mouse-based Room drag and Area first-corner completion also passed
in the numeric memory workspace in all four scenarios; the original Area browser script passed too. Pinned Chromium is absent; this is explicitly Edge evidence.

`npm run check` passed with `VITEST_MAX_WORKERS=2`: build, lint, all 480 test files,
6,637 passing tests (70 skipped), coverage and Fallow. Coverage: statements 99.26%,
branches 98.09%, functions 99.23%, lines 99.58%. No thresholds, test timeouts or dependency
versions changed. Fallow registers the new manual browser entry, both browser journeys share
their matrix runner, and a now-stale Room store suppression is removed.

Changed production files, measured hits/total (Istanbul coverage):

| File under `src/presentation/` | Statements | Functions | Branches |
|---|---:|---:|---:|
| `editor/add/areaTask.ts` | 17/17 | 6/6 | 11/11 |
| `editor/add/room-draft-store.ts` | 88/88 | 26/26 | 40/40 |
| `editor/runtime.ts` | 143/143 | 49/49 | 38/39 |
| `editor/shell/TemporaryToolBanner.vue` | 28/28 | 8/8 | 35/35 |
| `editor/shell/formatLength.ts` | 20/20 | 4/4 | 16/16 |
| `editor/tools/draw-polygon-tool.ts` | 89/89 | 17/17 | 56/56 |
| `editor/tools/editor-tool.ts` | 0/0 | 0/0 | 0/0 |
| `editor/tools/registerEditorTools.ts` | 21/22 | 13/14 | 2/2 |
| `editor/tools/tool-manager.ts` | 52/52 | 14/14 | 30/30 |
| `i18n/locales/de/editor.ts` | 1/1 | 0/0 | 0/0 |
| `i18n/locales/en/editor.ts` | 1/1 | 0/0 | 0/0 |
| `editor/add/AreaCornerEditor.vue` | 40/40 | 15/15 | 36/36 |
| `editor/add/areaCornerInput.ts` | 44/44 | 9/9 | 42/42 |

The two inherited gaps remain outside this feature: the failed asset-list query branch in
`runtime.ts` and the calibration command's Undo closure in `registerEditorTools.ts`.
The new form/controller and the changed polygon, coordinate parser and tool-manager paths
are fully covered. The busy-completion regression was also observed failing with its shared
completion guard temporarily removed, then passing after restoration.

Open acceptance: live Obsidian, assistive-technology and full release/theme acceptance.
Area metadata forms, comprehensive self-intersection detection/repair and additional creation
kinds remain separate work. Phase 3, Increment A and the overall implementation plan remain open.


## Existing-room dimensions continuation on PR #76 — 2026-09-06

Base: remote `codex/editor-area-numeric`, `29eb0a07053cbedb4050fa71c922bc41c69da872`.
#76, #75 and #74 remain OPEN. At inspection all CI checks on their current heads passed.
The actual chain includes #75 `d91431b2` and #74's selection work and `f7aa3c5` fix.
#74's later `bb62e2f3` is not an ancestor; its single-selection behavior and five regressions
are already present in #76. #74's unresolved native-picker comment is protected by #75;
#75's unresolved busy-completion comment is protected by #76. #76's unresolved corner-row
Escape focus finding remains a base-PR issue; this contribution does not modify those branches.

This independently deliverable slice fills the existing-room precision gap only. The Inspector
opens an explicit two-field modal form, with preserved selection, a baseline-size summary, numeric
area and the existing dashed canvas preview. The supported shape/anchor/unit rules are in M03.
Arbitrary/rotated outlines are not replaced by bounding boxes. The form uses one versioned baseline,
shared parser, geometry normalization, Inspector dispatch, reversible move adapter, write ledger,
refresh and recalculation. No persisted fields or formats change. Pure layout changes preserve the
root-owned modal; Cancel/Escape discard without writes. The existing dialog owns focus and busy state;
if a layout change replaces the opener, the Inspector action restores focus to the replacement
action or Details rail.

Evidence:

- `tests/presentation/editor/resize/roomDimensions.test.ts`: geometry eligibility, winding/order,
  anchor, rounding, untouched precision, invalid lengths and numeric representability.
- `tests/presentation/editor/roomResize.e2e.test.ts`: real list/canvas selection, preview isolation,
  conditional Apply, Undo/Redo, dependent quantities/costs, conflicts, errors, stale/busy, native
  keys and delayed/retired responses, with actual commands and in-memory repositories.
- `tests/presentation/editor/roomResizePersistence.test.ts`: actual Obsidian repository stack
  over a fake vault, Markdown metadata and sidecar readback, identity and reversible geometry.
- `tests/harness/roomResize.test.ts`: real-command harness, scoped axe at 1280/460 px, and dirty-form
  reflow in both directions with focus recovery.
- `scripts/editor-room-resize-check.mjs`: real Edge keyboard input in light/dark, custom accent
  and German at 460 px; Tab from persistent list through both dimensions, validation, focus trap,
  Escape, Apply, Undo/Redo and dirty-form reflow between full/constrained layouts. Screenshots under `harness-shots/room-resize/` visually inspected;
  no page errors or dialog overflow. These are Edge evidence, not pinned-Chromium or Obsidian runs.

Reproduce: `npm run harness`, then `?view=plan-editor&resize=room`. Select Kitchen from the list
(or canvas), then Change room size; at narrow widths use Layers and Details. This workspace uses
real creation/move commands with ephemeral in-memory repositories and resets on page reload.
`RP_CHROMIUM_EXECUTABLE` can select an installed browser for the verification script.

`npm run check` passed with `VITEST_MAX_WORKERS=2`: build, lint, all 484 test files,
6,681 passing tests (70 skipped), coverage and Fallow. Global coverage: statements 99.24%,
branches 98.03%, functions 99.24%, lines 99.59%. The final three browser scripts each passed
all four scenarios. No quality floors, timeouts, dependency versions or skips were changed.

Changed production files, measured hits/total (Istanbul coverage):

| File under `src/presentation/` | Statements | Functions | Branches |
|---|---:|---:|---:|
| `editor/inspector-wiring.ts` | 23/23 | 13/13 | 11/11 |
| `editor/runtime.ts` | 144/144 | 49/49 | 38/39 |
| `editor/inspector/inspector-store.ts` | 42/42 | 7/7 | 26/26 |
| `editor/resize/RoomDimensionsForm.vue` | 54/55 | 16/16 | 46/47 |
| `editor/resize/RoomSizeAction.vue` | 11/11 | 2/2 | 9/10 |
| `editor/resize/roomDimensions.ts` | 34/35 | 4/4 | 32/33 |
| `editor/resize/roomResizeAction.ts` | 52/53 | 11/11 | 42/45 |
| `editor/selection/normalize-transform.ts` | 6/6 | 2/2 | 0/0 |
| `editor/shell/RoomInspector.vue` | 35/35 | 10/10 | 26/27 |
| `i18n/locales/de/editor.ts` | 1/1 | 0/0 | 0/0 |
| `i18n/locales/en/editor.ts` | 1/1 | 0/0 | 0/0 |

Every function in the new resize files is covered. The six uncovered new branch alternatives
are recorded explicitly: the form's defensive null-preview text, the geometry helper's final
area-representability refusal, the action's last dispatch guard, a current non-Room after conflict,
a rejected baseline read after disposal, and focus fallback to the Inspector when both the action
and Details rail are absent. The ordinary invalid, stale/busy, conflict, disposed-success and
both responsive-focus paths are exercised. The runtime asset-list failure and RoomInspector's
missing-plan summary alternative are inherited gaps. No assertion claims full branch coverage.
Fallow reports zero dead-code issues, duplicate groups and above-threshold complexity findings;
the browser journeys share actual keyboard pair/navigation and Undo/Redo helpers.

The peer-write regression was also exercised with the first-write expectation removed temporarily:
it failed by overwriting the peer geometry, then the expectation was restored. Two collinear-outline
regressions also failed before the alternating-edge check was added, then passed. On conflict, the existing projection refresh reads the latest
size for the form; its baseline and text remain unchanged and Apply is paused until the user
cancels and reopens. No quality floors, test timeouts or dependency versions change.

Live Obsidian, screenreader announcement/focus, host leaf resize/rebind, vault reload/restart and
full theme/release acceptance remain open in `Resize a room.md`. The existing Area corner-row
Escape finding remains open on #76. No claim closes Phase 4, Increment A/B or the full plan.

## Existing-room naming continuation on PR #82 — 2026-09-06

Base: remote `codex/editor-room-dimensions`, `b43e76fe6e9f3676a2dca80d0e3bf6c92880715c`.
#82 remains OPEN and its full CI matrix is green at inspection. Its current head has no review
threads. #76 (`29eb0a07`), #75 (`d91431b2`) and #74's selection work/`f7aa3c5` are ancestors.
#74's later `bb62e2f3` is not an ancestor; its single-selection behavior and regressions are
already inherited through #75/#76. All three base PRs remain OPEN with green CI. Their unresolved
native-picker (#74) and busy-completion (#75) comments are covered by the subsequent branches;
#76's corner-row Escape focus finding is still an inherited open issue, not a naming regression.
No existing PR branch was changed or merged. The continuation uses
`.worktrees/room-naming`, branch `codex/editor-room-naming`, stacked against #82's branch.

The initial gap analysis found `Zone.create`'s trim/non-empty rule and existing versioned
repositories, Inspector dispatch, shared history ledger, modal form/error/busy/focus infrastructure.
It found no `Zone.withName`, naming command or existing-room naming form. This contribution adds
those missing pieces and reuses the persistence/dispatch contracts. It introduces no store, file
rename, link rewrite, schema field/version, Room-kind model or Area metadata form. Naming supports
all Room outlines, independently of the rectangular dimension form. M03 records normalization,
duplicate-name identity, baseline/conflict and filename independence in detail.

The repeated versioned baseline, busy/retirement and conflict-refresh lifecycle was extracted from
the dimensions action into `createRoomEditAction`. Naming and dimensions configure their own form,
edit payload and latest-value text; the geometry eligibility/preview remains specific to dimensions.
Both editor E2E suites and both four-scenario keyboard browser matrices passed after extraction.
Browser list selection and dialog Tab-wrap assertions also share the existing matrix helper.
The naming adapter is recorded in the reversible-write census, with actual forward/Undo/Redo event
assertions in the naming command suite. The German copy follows the existing formal-address rule.

Delivered evidence:

| Contract | Evidence |
|---|---|
| Shared normalization, duplicate names, stable fields, conditional writes, interleaved history and peer protection | `tests/application/commands/renameZone.test.ts` |
| Existing plan subscription refreshes other matching leaves on name changes | `tests/application/events/planChangeSource.test.ts`, naming command suite |
| Canvas/list selection, name projections, explicit Apply/Cancel, no-op, invalid/busy/stale/error/conflict and retired responses | `tests/presentation/editor/roomNaming.e2e.test.ts` |
| Existing note path/body/v1 keys and geometry, fresh repository/index reload, external edit refusal and transaction compensation | `tests/presentation/editor/roomNamingPersistence.test.ts` |
| Real-command harness, scoped axe at 1280/460 px, draft and focus across panel remounts | `tests/harness/roomNaming.test.ts` |
| Actual keyboard navigation/text editing, Apply/Cancel/Undo/Redo, reflow, themes and German | `scripts/editor-room-naming-check.mjs` |

Reproduce with `npm run harness` → `?view=plan-editor&rename=room`. The memory workspace resets on
reload. The keyboard script passed with explicitly selected Edge **152.0.4191.62** in light, dark,
custom accent and German at 460 px. All four screenshots under `harness-shots/room-naming/` were
visually inspected. Dialog client/scroll widths were 446/446 px in the three wider scenarios and
426/426 px in the constrained one; all controls were in view and no page errors were reported.
The browser runner uses real Tab/Enter/Space/Delete/Backspace input, not programmatic field fill.
This is Edge evidence, not pinned-Chromium or Obsidian evidence. The persistence suite exercises
the actual Obsidian repository stack over FakeVault, including a fresh index/echo/store/repository;
it does not claim a real host process restart or MetadataCache timing acceptance.

Live Obsidian, screenreader announcements/focus, actual leaf rebind and restart remain open in
`Rename a room.md`. Phase 4, Increment A/B and the overall plan are not closed. Broader geometry,
room kinds, general Area metadata, Walls/Openings and Reference Plan setup remain separate work.


### Final verification and changed-file coverage

`VITEST_MAX_WORKERS=2 npm run check` passed: production build/type-check, warning-free lint,
488 test files with 6,715 tests passed and 70 inherited skips, coverage thresholds, and Fallow.
Global coverage is 99.25% statements, 98.04% branches, 99.25% functions and 99.59% lines.
The targeted naming/dimensions/harness/i18n/write-census run also passed (7 files, 83 tests).
`npm run audit` found no production vulnerabilities. No thresholds, dependency versions or skips
were changed. The complete check exposed two non-blocking browser-script duplicate groups;
the shared dialog-layout assertion was extracted afterwards. Lint, Fallow and both four-scenario
browser matrices were rerun for that script-only change; Fallow then reported zero dead-code,
duplicate groups and above-threshold health findings. The Area numeric browser matrix also passed
its four scenarios, including the existing mouse creation journeys.

The normalized-no-op guard was temporarily removed as a mutation check. The existing test failed
because the form wrongly submitted/closed on an unchanged name; the guard was restored before
all passing runs. This demonstrates that the no-op behavior is asserted, not only executed.

Counts below are covered/total from the final complete run's Istanbul data. A line with multiple
statements is covered when at least one statement on it runs; statement and branch columns retain
the finer-grained gaps.

| File under `src/` | Statements | Functions | Branches | Lines |
|---|---:|---:|---:|---:|
| `application/commands/zone/RenameZone.ts` | 19/19 | 2/2 | 10/10 | 14/14 |
| `application/commands/zone/reversible-rename-zone-command.ts` | 19/19 | 4/4 | 12/12 | 16/16 |
| `application/events/planChangeSource.ts` | 14/14 | 6/6 | 8/8 | 12/12 |
| `domain/zone/Zone.events.ts` | 4/4 | 4/4 | 0/0 | 4/4 |
| `domain/zone/Zone.ts` | 28/28 | 7/7 | 18/18 | 27/27 |
| `domain/zone/ZoneName.ts` | 2/2 | 1/1 | 2/2 | 2/2 |
| `presentation/editor/inspector-wiring.ts` | 24/24 | 13/13 | 12/12 | 23/23 |
| `presentation/editor/inspector/inspector-store.ts` | 42/42 | 7/7 | 26/26 | 36/36 |
| `presentation/editor/naming/RoomNameAction.vue` | 11/11 | 2/2 | 7/8 | 10/10 |
| `presentation/editor/naming/RoomNameForm.vue` | 32/32 | 9/9 | 31/32 | 23/23 |
| `presentation/editor/naming/roomNamingAction.ts` | 5/5 | 4/4 | 2/2 | 5/5 |
| `presentation/editor/resize/roomResizeAction.ts` | 10/10 | 5/5 | 8/8 | 9/9 |
| `presentation/editor/roomEditAction.ts` | 51/52 | 10/10 | 39/41 | 30/30 |
| `presentation/editor/runtime.ts` | 144/144 | 49/49 | 38/39 | 121/121 |
| `presentation/editor/shell/RoomInspector.vue` | 35/35 | 10/10 | 26/27 | 31/31 |
| `presentation/i18n/locales/de/editor.ts` | 1/1 | 0/0 | 0/0 | 1/1 |
| `presentation/i18n/locales/en/editor.ts` | 1/1 | 0/0 | 0/0 | 1/1 |

Four new defensive branch alternatives remain uncovered: `RoomNameAction.vue:15` falls back to
the Inspector when both the replacement action and Details rail are absent; `RoomNameForm.vue:41`
skips error focus after disposal; `roomEditAction.ts:54` refuses at the last dispatch guard;
`roomEditAction.ts:65` suppresses a failed baseline-read notification after disposal. The dispatch
refusal is also the sole uncovered statement in the new files. All new functions are covered.
Ordinary busy/stale/conflict failures, disposed success, invalid input and responsive focus are
covered. Two existing alternatives remain uncovered: `runtime.ts:257`'s failed asset-list query
and `RoomInspector.vue:112`'s non-Zone DTO alternative. These figures do not claim full branch
coverage or substitute for the open host/screenreader acceptance above.


## Floor/reference continuation on PR #83 — 2026-09-06

Base: `origin/codex/editor-room-naming` at `d3746681980e6f472d1d2e2218ea524b692dd43c`.
Worktree: `D:/Projects/renovation-planner/.worktrees/reference-plan`.
Branch: `codex/reference-plan-workflow`. The main checkout remains clean and unchanged.

Rechecked remote heads, reviews and CI: #83 and #82 are open with all six checks successful and
no review threads; #76 and #75 remain open and their current heads are ancestors. All checks
on #76, #75 and #74 also pass. #74 remains
open; its later `bb62e2f3` head is not an ancestor. The equivalent single-selection Escape change
already exists in the continuation, which additionally preserves native input/select Escape.
No existing PR branch was merged or modified.

Inherited unresolved review threads remain separately recorded:

- [#76 corner-row Escape focus](https://github.com/Luis85/renovation-planner/pull/76#discussion_r3942047113)
  remains outside this reference change.
- [#75 keyboard Area completion busy guard](https://github.com/Luis85/renovation-planner/pull/75#discussion_r3941885495)
  remains an unresolved upstream thread; the continuation's Area tool already has its own busy
  guard. This PR does not change or resolve that thread.
- [#74 native asset-picker Escape](https://github.com/Luis85/renovation-planner/pull/74#discussion_r3941930056)
  remains unresolved upstream; the inherited continuation already exempts native text/select
  controls in `PlanEditorRoot`.

### Delivered behavior and contract

Empty floors offer Add rooms, Upload a floor plan and Start empty, based on actual room/area
query results. Existing geometry without a reference is not obscured by onboarding. Floor and
Layer contexts expose the same root-owned setup. Add rooms uses the existing creation catalogue;
existing floor metadata and contextual Set scale remain available.

Prepare source/page/crop/rotation, set a known distance using pointer or numeric endpoints, then
review scale/opacity/visible/locked before Finish. Setup retains one disposable draft across
layout changes; cancel and rejected writes retain the previous committed reference. Existing
geometry requires explicit scale acknowledgement. All source conversion and calibration use the
existing units and geometry model. ADR-0019 records the new optional v2 appearance metadata,
legacy compatibility, exact-version history, compensation and the forced-process recovery limit.

Traceability and reproduction: [Configure a reference plan](../../../tests/cases/Configure%20a%20reference%20plan.md).
Browser route: `?view=plan-editor&reference`. The harness uses actual repositories over FakeVault
and committed PNG/PDF fixtures. `scripts/editor-reference-check.mjs` passed all four real-keyboard
scenarios in Edge 152.0.4191.62, with zero page errors. All twelve Prepare/Set scale/Review PNGs
were visually inspected for crop/rotation, marker visibility, readable scale, focus, translated
wrapping and theme/accent. Dialog widths matched scroll widths: 446 px in wider layouts and
426 px in the German 460 px case. Both resize directions preserve the raw draft and focused
control; replacement cancellation is checked by reopening the original PNG and rotation.
Each browser scenario then commits a PDF, reopens its persisted page 1, and undoes back to PNG.
The mounted workflow also completes both PNG and PDF with their respective raster densities.
The browser also exercises Add rooms and Start empty and verifies canvas focus after each.
If the source changes during Review, the scale is withdrawn and Finish refuses the invalid preview.
Four additional committed-canvas captures verify that rotated references are fully framed and
readable after Finish/Undo/Redo. The existing fit shortcut includes visible prepared references;
empty floors fit them after decode/measurement while active creation retains its camera.

These are browser and FakeVault results. Live Obsidian, actual restart/MetadataCache timing,
assistive technology, large-document performance and forced-process recovery remain open.
Phase 6, Increment B, Increment A's outstanding criteria and the overall roadmap are not closed.
No Walls/Openings, Existing/Planned, Work, Materials, Costs or Evidence domains were added.


### Final verification (2026-09-06)

`VITEST_MAX_WORKERS=2 npm run check` passed on Windows, Node 24.20.0: production build/typecheck,
Oxlint/ESLint, **494 test files / 6,771 passed tests**, 70 existing skips, and Fallow with no issues
or functions above threshold. The final browser-runner theme fix also passed a separate
`npm run lint`; the complete check's final Fallow analysis includes that fix.

Global V8/Istanbul coverage: **99.22% statements, 99.24% functions, 98.04% branches, 99.59% lines**.
Thresholds remain unchanged (99% statements/functions/lines, 98% branches); no skips were added.
The new configuration command, appearance transforms, migration/mapper, guarded factory,
root actions and prepared-reference framing have every instrumented counter covered.

Targeted checks passed: command/math/workflow suites (48 tests); framing, background, contextual
calibration and empty-state suites (64 tests); final mounted PNG/PDF workflow suite (26 tests).
All of these are included again in the complete check. The real keyboard browser matrix passed
four scenarios, including PDF commit/reopen/Undo, with zero page errors. All 16 final step/canvas
captures were inspected, including the corrected custom accent after preserving tokens across reload.
Actual-repository/FakeVault persistence and fresh-stack reload are separately traced in the test case.

Generated evidence is in `harness-shots/reference-plan/`: `report.json`, the PNGs,
`coverage-review.md` and `logs/`. Reproduction commands and the unperformed live-host acceptance
remain in the linked test case. Coverage below is covered/total for each changed executable source file.

| File under `src/` | Statements | Functions | Branches | Lines |
|---|---:|---:|---:|---:|
| `application/commands/plan/ConfigurePlanReference.ts` | 64/64 | 8/8 | 32/32 | 49/49 |
| `application/commands/plan/ReversibleCalibratePlan.ts` | 58/59 | 10/10 | 31/33 | 56/56 |
| `domain/plan/Plan.ts` | 37/37 | 6/6 | 29/29 | 37/37 |
| `domain/plan/PlanBackgroundRef.ts` | 8/8 | 1/1 | 4/4 | 7/7 |
| `domain/plan/ReferenceAppearance.ts` | 8/8 | 4/4 | 13/13 | 7/7 |
| `infrastructure/obsidian/repositories/ObsidianPlanRepository.ts` | 100/100 | 12/12 | 48/48 | 89/89 |
| `infrastructure/obsidian/repositories/noteIo.ts` | 107/107 | 19/19 | 75/77 | 93/93 |
| `infrastructure/persistence/dto/planFrontmatter.ts` | 11/11 | 2/2 | 2/2 | 10/10 |
| `infrastructure/persistence/mappers/planMapper.ts` | 16/16 | 5/5 | 28/28 | 15/15 |
| `infrastructure/persistence/migration/entities/plan/plan.migrations.ts` | 2/2 | 1/1 | 4/4 | 2/2 |
| `plugin/guardedReferencePlan.ts` | 12/12 | 8/8 | 0/0 | 7/7 |
| `plugin/planEditorDeps.ts` | 5/5 | 3/3 | 6/6 | 5/5 |
| `presentation/editor/PlanCanvas.vue` | 37/37 | 16/16 | 18/18 | 30/30 |
| `presentation/editor/PlanEditorRoot.vue` | 85/85 | 31/31 | 75/75 | 73/73 |
| `presentation/editor/planEditorCommands.ts` | 14/15 | 12/13 | 0/0 | 13/13 |
| `presentation/editor/runtime.ts` | 144/144 | 49/49 | 38/39 | 121/121 |
| `presentation/editor/layers/background/BackgroundLayer.vue` | 32/32 | 8/8 | 25/25 | 26/26 |
| `presentation/editor/layers/background/BackgroundRenderModel.ts` | 22/22 | 5/5 | 10/10 | 22/22 |
| `presentation/editor/layers/background/pdfRaster.ts` | 19/19 | 2/2 | 2/2 | 19/19 |
| `presentation/editor/reference/FloorStart.vue` | 14/14 | 3/3 | 12/12 | 10/10 |
| `presentation/editor/reference/ReferenceAction.vue` | 9/9 | 1/1 | 6/6 | 5/5 |
| `presentation/editor/reference/ReferencePrepare.vue` | 16/16 | 7/7 | 15/15 | 16/16 |
| `presentation/editor/reference/ReferencePreview.vue` | 43/44 | 4/4 | 13/14 | 31/31 |
| `presentation/editor/reference/ReferenceReview.vue` | 15/15 | 6/6 | 19/19 | 13/13 |
| `presentation/editor/reference/ReferenceSetupForm.vue` | 161/165 | 40/41 | 158/162 | 91/92 |
| `presentation/editor/reference/referenceAction.ts` | 38/38 | 10/10 | 27/27 | 22/22 |
| `presentation/editor/reference/referenceSetup.ts` | 19/19 | 7/7 | 9/9 | 12/12 |
| `presentation/editor/shell/FloorInspector.vue` | 16/16 | 3/3 | 12/12 | 12/12 |
| `presentation/editor/shell/PropertyLayerPanel.vue` | 15/15 | 5/5 | 9/9 | 11/11 |
| `presentation/i18n/locales/de/editor.ts` | 1/1 | 0/0 | 0/0 | 1/1 |
| `presentation/i18n/locales/en/editor.ts` | 1/1 | 0/0 | 0/0 | 1/1 |

### Coverage review limits

Counts below describe complete changed source files, not just added lines. Type-only declarations
and CSS have no instrumented executable counters. No threshold, assertion or skip was relaxed.

The remaining uncovered paths were inspected:

- `ReversibleCalibratePlan.ts`: the post-rescale calibration-null branch and final defensive
  calibration validation refusal; the helper always constructs a calibration after the earlier
  finite/degenerate checks. Invalid input and non-finite geometry refusal are exercised.
- `ReferencePreview.vue`: unavailable canvas context early return. Browser captures use a real
  canvas; they do not demonstrate a host unable to create a 2D context.
- `ReferenceSetupForm.vue`: the paused pointer callback (the preview disables picking first),
  redundant null guards inside commit (submit validates first), a thrown dispatch after the
  component is already disposed, and the generated whole-crop v-model replacement callback
  (the child edits crop fields). Successful authorized commit after disposal, active rejection,
  busy control handling and invalid source/scale refusal are exercised separately.
- Existing fallback branches in changed files remain uncovered: `noteIo.ts` missing post-write
  file and metadata-cache entry without frontmatter; `runtime.ts` rejected asset-options refresh;
  `planEditorCommands.ts` unavailable-command EventBus error sink. The changed nested serializer,
  reference wiring, refusing reference ports and guarded production factory are exercised.

Live host timing, screenreader behavior, large PDFs and forced-process termination remain
manual acceptance gaps, independently of these counters.
