# Editor implementation status — 2026-09-07

Operational continuation: [RESUME.md](RESUME.md) is the central handoff for a later session or usage-limit interruption. It distinguishes pushed code, unverified WIPs, current processes and remaining acceptance.

Latest full CI on Root465ffe42 is complete but failing: Linux24 reports **8104 tests passed,10 failed,69 skipped**. Branches12540/12821 leave25arms to98% at this denominator; statements/functions/lines meet their floors. Tested merge23669557888f836846f8d71048fa17db5a2a9d87 and Root share tree8b6a153e52c8bea61c6325dff6da2d2498c8f814. The ten failures are the known warning-text and focus-gate regressions, not new owner-test failures. [Run34152586317](https://github.com/Luis85/renovation-planner/actions/runs/34152586317).

Root57144c81 integrates UI throughf576d13c; Root465ffe42 adds the eleven verified Review/Outline/Command cases. Requirement date preservation is also integrated. Original571 health found ReviewSummary template cognitive17>15. UI has corrected the warning separator (32/32 unchanged cases), extracted ReviewRoomDetails (static complexity clear), and confined editor button reset rules to local classes (96/96 unchanged focus cases plus54/54 native neighbors). UI376fe371 is integrated in this checkpoint; older coverage cannot prove current counters for moved/new functions. The archive manifest hashes were checked after the conflict-free merge.

The extended browser run on UIdf7100b4 passes all four scenarios, including real caption/control/pin pan, inline/clamping, two native Decisions and Review marker/issue/Back behavior. Original full9journeys/18references and live-host H1–H6 remain open. RESUME records the exact next owner handoff and pending integration.

Fresh review sweep across #74–#91 found no new outstanding Root code defect. Predecessor threads remain open where fixes live in the integration continuations rather than the unchanged older branches; no thread is falsely resolved. [Review audit](review-audit.md).

Historical previous full measurement:

Latest completed full CI on `73b0c205`: all four Linux/Windows verify jobs report 8053 passed tests, three failures in two test files, and unchanged coverage floors missed: statements 98.96% (17842/18028), branches 97.51% (12371/12686); functions 99.08% and lines 99.47% pass. Audit passes. [CI run](https://github.com/Luis85/renovation-planner/actions/runs/34126554088). Local full coverage matches; it additionally encountered one 5-second temporaryToolBanner timeout. Fresh full Fallow reports three template complexity findings: QuoteComparisonState 18, ProjectWorkState 19, EvidenceInspector 16 (limit 15), with zero dead-code issues and zero clones.

Current checkpoint corrects the stale schema-7 migration expectations for schema 8 and selects the Related-record action by label after the independent Work link was added. All route/deletion assertions remain. Targeted rerun passed 49 tests in five files (86.04 seconds), including the unchanged timeout case, date and Work-link regressions. Full follow-up gates, coverage closure, owner UI WIP verification and final visual/host acceptance remain open. See RESUME.md for current owners and saved full diagnostics.

The current integrated continuation builds on c1091086 with hardening 89f498f9 (integrated as 0d115e38), UI 51aaac72 (integrated as 9acb6e29), and root saved-source/Retry recovery. Earlier root correction 80437fa0, UI through b5c57a68 and hardening Reference correction 00852947 (integrated as 66438ff3) remain included. Native Reference focus across reflow and the protected Node query boundary pass. Final acceptance is still open.

The following earlier checkpoint measurements remain historical evidence.

Historical cd362dd0: The joined full run failed with five reproducible contract/behavior failures, two additional local lint-test timeouts, and coverage below the unchanged floors; separate Fallow also failed. Root corrections restore editable read-paused element drafts, fix missing translations and contract expectations, refresh Quote catalogue/Room context, and simplify downstream rendering. Explicit browser environments restore the prior Vue coverage transform, but the historical 9e2b89f8 CI run exposed a protected application test in the wrong environment; its plugin integration and pure Node query cases are now separated and the unchanged guard passes. All four Linux/Windows CI legs on that checkpoint passed 7,946 tests with that one failure; statement/function/branch coverage still fails. The final browser capture also stopped at Reference focus after reflow. See [current correction evidence](downstream-planning-evidence.md); no final gate or host acceptance is claimed.

The pre-downstream finalization checkpoint is `2c2c1d71e0147819c6c597172b0b5f57f0f5b918`, incorporating UI `6654cfbf7d023199af49c6aaec50a770e44f1578` and hardening `0673226c86e8cdb7f514e4fd7c9f567faa839ed7` over PR #88 `3c1c737a`. All eleven Add routes, generic spatial objects, Room/Area precision, contextual planning, guarded drafts and conditional history are integrated. M00/M07 include native Room dimensions, direct Room/wall controls, host icons, centered Room labels, quieter Room fills and the documented View controls. CI on that checkpoint passed all 605 files/7,631 tests (69 skipped); branch coverage 97.70% remains below 98%. Final matching-state acceptance remains open.

Historical exact source `63173897d97567542761926c4fc56540b4b54ec2`, Node 24.20.0, VITEST_MAX_WORKERS=2: production build/types and complete Oxlint/ESLint pass. All 594 test files pass: 7,562 passed, 70 skipped, 975.45 s. Coverage is 99.05% statements (16413/16569), 97.54% branches (11176/11457), 99.15% functions (4677/4717), and 99.50% lines (13024/13089). Only the unchanged 98% branch floor fails, so npm run check exits 1 before analysis. A separate fresh complete Fallow run against that full coverage exits 0: zero dead-code issues, zero clone groups, zero health findings (including cognitive complexity and CRAP). The full JSON/lcov artifacts are preserved before scoped runs. No gates, exclusions or thresholds changed. Owner and preliminary browser evidence remains historical/partial; final joined M00/M07 and all-18 acceptance are pending.

M10 Trade assignment/manual dates/Project Work and M13 Supplier/Quote persistence, comparison and contextual return now have production source in the finalization worktree. ADR-0024 records their canonical entity and authority boundaries. Targeted verification passed 134 cases; the broader shared-repository/native run passed 980 with two missing contract-census failures, then the corrected contract/element files passed all 76 cases. See [downstream-planning-evidence.md](downstream-planning-evidence.md) for the actual defects, corrections and limits. Production build/types and static checks passed; the final combined gate remains open. Automatic calendars, inferred scope/tax/unit normalization and quote selection remain outside this route contract.

The isolated Obsidian test vault is accessible with a preliminary build; the earlier plugin-trust blocker is cleared. Final integrated build installation and acceptance are still pending. H1–H6 remain explicitly open where browser/FakeVault evidence cannot establish actual host, device or screen-reader behavior.

Use the [completion matrix](completion-matrix.md) for current requirement ownership and open work, and the [integration map](integration-map.md) for exact ancestry. Finalization adds canonical Project/Asset Library navigation, contextual planning drafts and sidecar receipts for mixed Room history. Targeted evidence exists. The initial full gate passed build/lint, then was stopped after test failures under excessive worker contention; it did not pass coverage or analysis. Repeated verification uses supported worker limits without changing thresholds or timeouts.

The current finalization changes also add Area name/type editing and explicit numeric corner editing for existing Room/Area outlines (17 focused tests passed), plus an Add → Room → free-shape route with a native name field and shared numeric corner controls. Add → Note reuses the existing Room Notes form and passes three production-path tests for context availability, ordinary-file creation/link history and cancellation. Combined visual, accessibility, coverage and host acceptance remain open.

## Historical phase snapshot (before the connected planning continuation)

The following table records the earlier `cf536f32` contribution; its “not delivered” entries are historical, not the current implementation status.

| Phase | Baseline and current contribution | Remaining work |
|---|---|---|
| 0 | Existing Room/Zone and Floor/Plan ADRs; ADR-0018 records selection, Inspector and refresh ownership | New-domain contracts, perspective implementation and stakeholder acceptance |
| 1 | Responsive shell, context bar, rails and drawers already exist | Perspective controls when their domains are available; full theme/release acceptance |
| 2 | Ordered unique multi-selection, independent member focus, badges, overlap cycling, persistent list access; Phase 5 adds Wall/Opening hit priority and Inspectors | Object selection and remaining release acceptance |
| 3 | Select/Add and temporary Room tools exist; the Area continuation adds its catalogue path, validated outline, one-shot/repeated completion and keyboard routing; the numeric continuation adds corner placement/correction | Unavailable creation domains, complete cross-tool/non-canvas routes and release acceptance |
| 4 | Rectangular room creation exists; the dimensions continuation adds keyboard resizing of existing axis-aligned four-corner Rooms; the naming continuation adds explicit keyboard renaming for all Room outlines | Broader resizing, room-kind decision and complete M03/live acceptance |
| 5 | Connected walls, hosted openings, optional Room transaction, measurements, exact-length impact, confirmed deletion and conditional history (ADR-0020) | Live Obsidian/screenreader and complete M04/product acceptance; M07 renovation semantics await later phases |
| 6 | Query-derived floor start and compensated prepare/scale/review setup, persistent appearance, exact-version history and contextual revisiting (ADR-0019) | Live Obsidian/screenreader, forced-process recovery and complete M05/M06 acceptance |
| 7 | Connected Existing/Planned facts, classification, straight-wall/opening proposals and Decisions (ADR-0021) | Evidence/material integration and complete live acceptance |
| 8 | Work/outcome links, ordering/progress/responsibility, dependencies and scoped Review with generated note (ADR-0021) | Cross-floor dependencies, Trade catalogue, later-domain readiness and live acceptance |
| 9 | Asset requirements and calculations exist | Geometry/work-linked material planning, provenance and shopping list journey |
| 10 | Requirement cost figures and project price overrides exist | Planned/committed/actual cost items and spatial reconciliation |
| 11 | Not delivered | Common evidence links, files, pins and contextual creation |
| 12 | Existing stale-write protection and accessibility/theme harness | Complete end-to-end release, performance, migration/recovery and live Obsidian verification |

## Historical selection contribution (before connected batch actions)

- Shift-click adds/removes a room or area; Alt-click cycles overlapping bodies.
- The property panel keeps every readable room/area reachable after selection. Its multiple
  selection checkbox provides an equivalent touch and keyboard route without modifier keys.
- M11 numbers follow the ordered unique selected IDs. A badge, selected body or M11 member row
  focuses a member without changing membership. Removing that member focuses the first survivor.
- All selected outlines remain visible. Only a single selection has editable corner handles.
- Escape works for single and multiple selections from the property list, Inspector and restored panel-rail focus. Add and overlays
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

## Verification of the historical selection contribution

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

The subsequent single-selection review extends the same Escape route to every nonempty
selection. Five added single-selection cases fail before the correction and pass after it;
all six targeted suites pass 99 tests. Edge keyboard verification also confirms clearing a
single selection from its property row while retaining row focus.
The first full follow-up run passed 6,588 tests but timed out in the unchanged
`tests/build/test-environments.test.ts` (120-second limit). That test passed in isolation
in about 65 seconds; no timeout, exclusion or quality threshold was changed.
The complete retry with `VITEST_MAX_WORKERS=1 npm run test:coverage` passes all 473 files,
6,589 tests (70 skipped) and the unchanged coverage thresholds (99.25% statements, 98.04%
branches, 99.22% functions, 99.58% lines). Build and lint passed in the initial run;
`npm run analyze` also passes after the successful coverage retry.

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

## Connected-wall and opening continuation — 2026-09-06

Phase 5's M04 and **spatial subset** of M07 are implemented. Increment B and full M07 acceptance
remain open. Existing/New, change classification, Work, Materials, Costs and Evidence belong to
later phases and have no partial controls here. ADR-0020 resolves the first non-polygon spatial
object contract: straight centre-line walls, hosted door/window/opening intervals and Room-boundary
provenance in `.rpgeo` v2. Existing Room/Area polygons and Markdown ownership remain intact.

### Demonstrated journey

- Add → Wall starts a temporary connected chain. Pointer endpoint/axis snapping and first-point
  plus segment length/angle keyboard entry share validation. Live measurements, point Undo,
  explicit loop closing, Finish and Cancel remain available in the responsive shell. A closed
  loop can create a named Room using the existing compensated Zone command in one history item.
- Architecture renders real walls and opening patterns. Shared selection prioritizes openings,
  walls, then polygons; Alt cycles overlaps. The persistent list supports keyboard selection and
  mixed selection. The wall Inspector shows length, height, thickness and associated Room names.
  Numeric length and endpoint gestures use the same connected-junction edit and impact dialog.
- Doors, windows and openings have explicit host IDs and offset/width/height/sill measurements.
  Placement, editing, preview/cancel, confirmed deletion and reversed history preserve containment
  and refuse overlap. Shortening a host never clamps or detaches its openings. Deleting a host
  removes its openings and association records while retaining Rooms. Room deletion Undo restores
  associations or compensates the restored Room when referential integrity cannot be maintained.
- Failures retain the active draft, busy guards prevent duplicate submissions, stale/conflicting
  observations refuse writes, and disposed leaves ignore late UI responses. The command compensates
  reported multi-write failures, conditionally restores snapshots and announces committed changes.
  Activation compares the displayed structure and calibration with its freshly read baseline;
  a mismatch pauses and refreshes before accepting points. Two regressions reproduced the stale
  display/fresh-baseline race and pass after the fix, alongside the mounted keyboard journey.

Room boundary records describe creation provenance/adjacency, not a second outline. Wall edits
preview affected Rooms but leave their manually maintained outlines unchanged. Exact endpoint
connectivity, supported junction edits, numeric bounds and refusal rules are explicit in ADR-0020.

### Geometry-consumer audit

| Consumer | Result |
|---|---|
| Sidecar DTO/migration/store/adapters | Pure idempotent v1→v2 read; v2 writes with structure, legacy-compatible v1 without it; future versions and invalid relationships refused. Fresh repositories retain IDs, values and legacy notes. |
| Zone repository mutation/deletion | Polygon updates preserve structure; deleting a Room removes boundary references; reversible deletion restores validated associations through the sidecar port. |
| Calibration/reference setup | Every endpoint and Wall/Opening dimension scales about origin with polygons; populated consent includes all entity types; appearance metadata survives. |
| Query/store hydration and events | Structure uses the existing ticketed projection, stale state and retirement; committed structure events refresh the plan. |
| Enumeration, hit testing, framing and selection | Explicit typed line candidates participate beside Room/Area polygons, including mixed outlines and opening-first priority. No fake persisted Zones. |
| Inspector and calculations | Wall/Opening measurements use dedicated records; existing Room/Area area and material calculations remain based on their polygons. M07 renovation calculations are deferred. |
| History and save state | Existing dispatcher and guarded factories; conditional complete-sidecar commands, Room composition, compensated failures and recovery warning. |

### Branch and inherited review state

Fetched/pruned and rechecked the stack on 2026-09-06. All six PRs remain open, with no head changes:

| PR | Head | Base |
|---|---|---|
| #85 | `e53bf9ac62ff2cfad924efb768bd9e3d3a159001` | `codex/editor-room-naming` |
| #83 | `d3746681980e6f472d1d2e2218ea524b692dd43c` | `codex/editor-room-dimensions` |
| #82 | `b43e76fe6e9f3676a2dca80d0e3bf6c92880715c` | `codex/editor-area-numeric` |
| #76 | `29eb0a07053cbedb4050fa71c922bc41c69da872` | `codex/editor-area-creation` |
| #75 | `d91431b2ab787e54ad6105bb7fb7ebbdf01e3d19` | `codex/editor-implementation` |
| #74 | `bb62e2f3db88c35990f34e56dad919fdccce0fd0` | `main` |

Continuation: `codex/connected-walls`, based on #85 at the head above, in
`D:/Projects/renovation-planner/.worktrees/connected-walls`. Main remains clean on the integration
branch. No existing PR branch is modified or merged. All six stack PRs' four Linux/Windows verify
matrix legs, audit and GitGuardian were successful at recheck; ancestry was confirmed locally.
This continuation's CI is reported on its PR.

Inherited findings are distinct from this feature's regressions:

- [#74 native asset-picker Escape](https://github.com/Luis85/renovation-planner/pull/74#discussion_r3941930056)
  remains unresolved on GitHub, but the inherited root handler already excludes native selects.
- [#75 busy Area completion](https://github.com/Luis85/renovation-planner/pull/75#discussion_r3941885495)
  remains unresolved on GitHub, but inherited tool registration already supplies `canFinishArea`.
- [#76 Escape after clearing corner rows](https://github.com/Luis85/renovation-planner/pull/76#discussion_r3942047113)
  remains open: clearing an Area draft from a removed row can still lose focus. This inherited
  Area-specific acceptance gap is not marked fixed by the new wall workflow.
- Three #85 findings were reproduced and corrected **in this continuation**:
  [appearance observation tokens](https://github.com/Luis85/renovation-planner/pull/85#discussion_r3943671961),
  [mixed calibration baseline](https://github.com/Luis85/renovation-planner/pull/85#discussion_r3943671962) and
  [canonical source paths](https://github.com/Luis85/renovation-planner/pull/85#discussion_r3943671966).
  Regression tests failed on the inherited code, then the 275-test reference/digest run passed.
  Their original GitHub threads remain unresolved; no claim is made about review approval.

### Evidence and open acceptance

Reproduction and requirement-to-test mapping:
[Draw connected walls and openings](../../../tests/cases/Draw%20connected%20walls%20and%20openings.md).
`scripts/editor-structure-check.mjs` performs actual browser keyboard journeys in English light/dark
at 1440 px, custom accent at 1000 px and German dark at 460 px. It preserves and asserts custom theme
tokens across fixture reload, checks input focus through reflow and records zero page errors in all
four scenarios. Populated-floor recalibration requires consent, scales the structure and supports Undo.
The report and 28 PNGs are under ignored `harness-shots/connected-walls/`; representative screenshots
were opened and visually inspected, including constrained forms, impact previews and recalibration.
The installed Chromium used was 148.0.7778.96; pinned-browser downloads twice failed to renew their
download lock. This rendering evidence therefore uses the documented executable override.

FakeVault tests exercise actual repositories and fresh-stack reload. Mounted DOM/axe tests cover
semantic accessibility; browser keyboard screenshots cover the harness, not live Obsidian. Live
split leaves, real MetadataCache timing, screenreaders, restart acceptance, physical pointer/touch,
large-plan performance and complete M04/M07 product acceptance remain open. Reported transaction
failures are compensated; abrupt process loss between files still has no durable crash journal.
Conservative whole-sidecar history can refuse after other geometry writers have advanced its
observation. Curves, automatic crossing/T-junction splitting, opening dragging, door swing and
automatic Room-outline synchronization are outside the documented minimal contract.

### Final verification and changed-file coverage

On 2026-09-06 the complete `VITEST_MAX_WORKERS=2 npm run check` exited 0 on the final source tree:
build/type-check, zero-warning lint, 505 passing files / 6,891 passing tests (70 pre-existing skips),
all coverage gates, and Fallow with no dead-code, duplication or above-threshold health findings.
Global coverage: statements **99.23% (12,185/12,279)**, functions **99.28% (3,324/3,348)**,
branches **98.01% (7,274/7,421)**, lines **99.59% (10,242/10,284)**. No threshold, dependency,
assertion, blanket skip or test configuration was relaxed. The expected version-bump refusal
printed by a negative build-script test is not a failing check.

The final four-scenario browser matrix also passed with zero page errors and 28 screenshots.
Representative final PNGs were opened and inspected, including the corrected deletion count,
German connected-wall impact, custom accent canvas, closed-loop form and populated recalibration.
The screenshots are rendering/keyboard evidence using real repositories over FakeVault; they do
not replace live Obsidian or screenreader acceptance. Browser reproduction uses the executable
override documented above.

These are **complete changed-source-file** counters, including inherited lines. Aggregate changed
coverage: statements **99.29% (2,549/2,567)**, functions **99.30% (712/717)**, branches **97.81%
(1,660/1,697)** and lines **99.74% (1,940/1,945)**. The global gate and changed-file branch aggregate
are different measures; the latter is not represented as meeting a separate 98% gate. New domain
geometry and the structure/Room-boundary application commands have complete executable coverage.
Type-only files have 0/0 counters; CSS and the browser runner are verified by their own gates and
browser evidence rather than included in these source counters.

| Changed source file (under `src/`) | Statements | Functions | Branches | Lines |
|---|---:|---:|---:|---:|
| `application/commands/plan/ReversibleCalibratePlan.ts` | 63/64 | 11/11 | 37/39 | 59/59 |
| `application/commands/spatial/RoomBoundaryHistory.ts` | 26/26 | 5/5 | 12/12 | 19/19 |
| `application/commands/spatial/StructureCommand.ts` | 114/114 | 30/30 | 60/60 | 80/80 |
| `application/commands/spatial/sameGeometryDocument.ts` | 10/10 | 7/7 | 4/4 | 8/8 |
| `application/commands/zone/reversible-delete-zone-command.ts` | 53/53 | 7/7 | 26/28 | 46/46 |
| `application/events/planChangeSource.ts` | 14/14 | 6/6 | 8/8 | 12/12 |
| `application/ports/PlanGeometrySidecar.ts` | 0/0 | 0/0 | 0/0 | 0/0 |
| `domain/spatial/Structure.ts` | 10/10 | 5/5 | 4/4 | 7/7 |
| `domain/spatial/structureGeometry.ts` | 73/73 | 30/30 | 83/83 | 41/41 |
| `infrastructure/obsidian/repositories/ObsidianPlanGeometrySidecar.ts` | 19/19 | 12/12 | 12/12 | 18/18 |
| `infrastructure/obsidian/repositories/ObsidianZoneRepository.ts` | 133/134 | 25/25 | 66/68 | 119/119 |
| `infrastructure/obsidian/repositories/PlanGeometryStore.ts` | 89/89 | 17/17 | 46/47 | 77/77 |
| `infrastructure/obsidian/repositories/digest.ts` | 23/23 | 7/7 | 8/8 | 22/22 |
| `infrastructure/persistence/dto/planFrontmatter.ts` | 11/11 | 2/2 | 2/2 | 10/10 |
| `infrastructure/persistence/dto/planGeometry.ts` | 6/6 | 0/0 | 0/0 | 6/6 |
| `infrastructure/persistence/migration/geometry/plan/plan-geometry.migrations.ts` | 2/2 | 1/1 | 4/4 | 2/2 |
| `plugin/composition-root.ts` | 34/34 | 8/8 | 19/19 | 34/34 |
| `plugin/guardedStructure.ts` | 13/13 | 9/9 | 0/0 | 8/8 |
| `plugin/planEditorDeps.ts` | 5/5 | 3/3 | 6/6 | 5/5 |
| `presentation/editor/PlanCanvas.vue` | 37/37 | 16/16 | 19/19 | 30/30 |
| `presentation/editor/add/AddMenu.vue` | 127/127 | 39/39 | 75/75 | 102/102 |
| `presentation/editor/add/createZoneHistory.ts` | 2/2 | 1/1 | 0/0 | 2/2 |
| `presentation/editor/add/creationCatalogue.ts` | 21/21 | 13/13 | 2/2 | 18/18 |
| `presentation/editor/forms/nativeSubmitKey.ts` | 2/2 | 1/1 | 9/9 | 1/1 |
| `presentation/editor/inspector-wiring.ts` | 24/24 | 13/13 | 12/12 | 23/23 |
| `presentation/editor/layers/InteractionLayer.vue` | 59/59 | 23/23 | 43/44 | 46/46 |
| `presentation/editor/naming/RoomNameForm.vue` | 31/31 | 9/9 | 26/27 | 23/23 |
| `presentation/editor/planEditorCommands.ts` | 14/15 | 12/13 | 0/0 | 13/13 |
| `presentation/editor/reference/ReferenceSetupForm.vue` | 163/167 | 41/42 | 154/158 | 93/94 |
| `presentation/editor/resize/RoomDimensionsForm.vue` | 53/54 | 16/16 | 41/42 | 37/37 |
| `presentation/editor/runtime.ts` | 149/150 | 50/51 | 42/43 | 123/123 |
| `presentation/editor/selection/resolveSelectionTarget.ts` | 47/47 | 10/10 | 39/40 | 32/32 |
| `presentation/editor/selection/spatialSelection.ts` | 12/12 | 6/6 | 14/14 | 10/10 |
| `presentation/editor/shell/EntityInspector.vue` | 12/12 | 5/5 | 11/12 | 8/8 |
| `presentation/editor/shell/PropertyLayerPanel.vue` | 15/15 | 5/5 | 9/9 | 11/11 |
| `presentation/editor/shell/TemporaryToolBanner.vue` | 35/35 | 11/11 | 40/41 | 24/24 |
| `presentation/editor/shell/zoneTypeLabel.ts` | 2/2 | 1/1 | 2/2 | 2/2 |
| `presentation/editor/structure/StructureEditForm.vue` | 86/86 | 21/21 | 72/73 | 49/49 |
| `presentation/editor/structure/StructureInspector.vue` | 31/31 | 14/14 | 25/26 | 19/19 |
| `presentation/editor/structure/StructureLayer.vue` | 32/32 | 17/17 | 19/19 | 20/20 |
| `presentation/editor/structure/StructureList.vue` | 12/12 | 8/8 | 2/2 | 10/10 |
| `presentation/editor/structure/StructureTaskForm.vue` | 47/47 | 24/24 | 61/61 | 32/32 |
| `presentation/editor/structure/StructureTool.ts` | 33/33 | 11/11 | 25/25 | 17/17 |
| `presentation/editor/structure/spatialMessage.ts` | 4/4 | 2/2 | 2/2 | 3/3 |
| `presentation/editor/structure/structureActions.ts` | 71/71 | 17/17 | 54/56 | 41/41 |
| `presentation/editor/structure/structureCandidates.ts` | 3/3 | 3/3 | 0/0 | 3/3 |
| `presentation/editor/structure/structureDraft.ts` | 89/89 | 22/22 | 97/97 | 54/54 |
| `presentation/editor/structure/structureRecords.ts` | 3/3 | 3/3 | 0/0 | 3/3 |
| `presentation/editor/structure/structureTask.ts` | 102/102 | 20/20 | 67/68 | 53/53 |
| `presentation/editor/surface/EditorSurface.vue` | 238/243 | 33/34 | 167/177 | 207/210 |
| `presentation/editor/tools/editor-tool.ts` | 0/0 | 0/0 | 0/0 | 0/0 |
| `presentation/editor/tools/historyActions.ts` | 4/4 | 3/3 | 0/0 | 4/4 |
| `presentation/editor/tools/registerEditorTools.ts` | 21/22 | 13/14 | 4/4 | 20/21 |
| `presentation/editor/tools/select-tool.ts` | 117/119 | 14/14 | 70/72 | 100/100 |
| `presentation/i18n/locales/de/editor.ts` | 1/1 | 0/0 | 0/0 | 1/1 |
| `presentation/i18n/locales/de/structure.ts` | 1/1 | 0/0 | 0/0 | 1/1 |
| `presentation/i18n/locales/en/editor.ts` | 1/1 | 0/0 | 0/0 | 1/1 |
| `presentation/i18n/locales/en/structure.ts` | 1/1 | 0/0 | 0/0 | 1/1 |
| `presentation/read-models/planEditorQueries.ts` | 38/39 | 12/12 | 26/28 | 29/29 |
| `presentation/read-models/spatialRecords.ts` | 12/12 | 7/7 | 6/6 | 9/9 |
| `presentation/stores/ProjectStore.ts` | 99/99 | 11/11 | 28/28 | 92/92 |

### Remaining measured coverage gaps

The remaining counters were inspected; they do not imply acceptance of the unperformed routes:

- Spatial forms/actions: missing-Room-name fallbacks, the impact count's defensive null-proposal
  fallback, unavailable structure services after an otherwise mounted task, and calling a captured
  edit dispatch callback after its leaf has already gone. Actual pending read/write rejection after
  disposal, command failure/retry, version conflicts and both stale-projection activation cases pass.
- Surface integration: canvas Backspace for walls and canvas Enter's wall/opening arms are not hit
  by the instrumented suite; point Undo and completion through native buttons/forms are covered,
  including the actual browser keyboard journey. The direct-drag runtime adapter is also uncovered
  as an integration callback: SelectTool's endpoint dispatch and the same impact form/command with
  a proposed endpoint are exercised separately. Physical pointer/touch acceptance remains open.
- Shared editor fallbacks: no canvas element/bounds during pointer/size calculation, overlay pointer
  cancellation, an empty multi-selection outline, absent badge tolerance, an empty Inspector target,
  attempts to cancel a saving wall from the banner, and SelectTool's missing target/context guards.
  The inherited free-polygon creation adapter's Undo callback and asset-refresh rejection in runtime
  also remain uncovered. Existing domain/command history suites still run in the complete check.
- Reference/Room forms: defensive null calibration/proposal guards, paused preview callback,
  redundant null source/scale checks after submit validation, a thrown reference dispatch after
  disposal, generated crop replacement callback, and the disposed Room-name submit response.
  The reference appearance token, canonical path and mixed-baseline regressions are covered.
- Repository/query fallbacks: nonnumeric revision after a validated snapshot, vanished Zone during
  enumeration or note cleanup, refused query results and the geometry-absent optional query path.
  Reversible Room deletion's relationship-restore compensation failure arm and impossible empty
  successful restore box are not directly hit. Other structure compensation-failure paths, refused
  conditional restoration, missing-wall rollback, future schema refusal and fresh reload are covered.
- The unavailable command EventBus error sink remains the inherited uncalled function.

The new coverage review is recorded separately from the previous Phase 6 counters above. It makes
no claim that branch coverage or harness screenshots constitute complete M04/M07 host acceptance.

## Connected renovation workflow continuation — 2026-09-06

Built on PR #86 at `866ccc38`, still open against `codex/reference-plan-workflow`; the new
continuation targets `codex/connected-walls`. Its ancestry includes #85, #83, #82, #76, #75 and
#74. The latest check of #86 found its head unchanged and all CI jobs green.

M08–M10 now provide a connected Room workflow. Existing observations remain independently
readable after Planned edits. Work links stable spatial targets and subject outcomes. Decisions
can be created/resolved and inspected in the owning Plan note. Review explains only the four
implemented checks, routes to source records and generates a conditional vault note. Geometry
proposals use separate current/intended facts, one spatial ID per subject, host validation,
labels/patterns and explicit Apply/Cancel. Materials, costs, evidence and scheduling remain open.

See [connected workflow evidence and traceability](connected-renovation-evidence.md) for the
reproducible commands, test mapping, coverage review and acceptance boundaries. This is not
full M08–M17 acceptance.

Inherited corrections: the optional Room uses the shared history ledger; Room writes report
sidecar receipts so reversed sibling edits do not falsely supersede structure undo; wall draft
validation uses baseline sidecar object IDs, including an unreadable Room note’s polygon.
The Area Escape-row focus regression is fixed. Canvas Backspace/Enter and the direct wall-drag
runtime handoff now have repository-backed integration coverage. Review comments on #86 are
not resolved in that earlier branch; this continuation carries the corrections.

During final verification, #74 advanced to `2f1fce9b` while #86 stayed unchanged. This continuation
also carries #74’s `48febd87` Alt-hover refresh and `381bcdc4` per-leaf multi-selection mode
fixes, with their upstream regression tests. The base remains #86; `origin/main`’s concurrent
#84 polish merge is recorded separately in the evidence and is not folded into this feature.


## Materials → Costs → Evidence continuation — 2026-09-06

Bounded M12–M14 and M17 criteria are implemented in the continuation of open PR #87:
contextual Asset-backed Requirement quantities and overrides, exclusive purchased/reserved
allocations, outstanding shopping, obligations with separate commitment/actual facts, partial
settlement and Remaining, ordinary vault evidence with phases/pins and source-linked Review.
This supersedes earlier statements that all materials/costs/evidence remain unbuilt; scheduling,
suppliers, shared inventory, full quote comparison and live acceptance remain open.

See [connected planning evidence and traceability](connected-planning-evidence.md),
[changed-file coverage](connected-planning-coverage.md) and ADR-0022. Only that demonstrated
subset is complete. Global Increment D and full M12–M17 acceptance are not complete.

The four remaining Add routes—generic Object, Path, Fence and Measurement—remain in the full-plan scope. Finalization owns shared sidecar/domain/selection support and linear routes; the existing UI task owns Object creation/presentation after its current verified checkpoint. This records implementation ownership, not completion or an accepted deferral.

Finalization checkpoint verification (2026-09-07): `npx oxlint --deny-warnings`, `npx vue-tsc -noEmit`, full `npx eslint . --max-warnings 0`, and `git diff --check` passed after the Room/free-shape/Area/Note/navigation/history changes. The earlier full coverage run was aborted and is not a passing gate; final combined coverage/build/analyze remain required. The synthetic host vault was moved outside the worktree to `C:/Users/lum/.codex/tmp/renovation-planner-finalization-vault` so its generated plugin does not enter source checks. It must receive the final build before host acceptance.
## Increment E recovery and connected hardening — 2026-09-07

The continuation of #88 implements retained planning read-back, read-only retry, unsafe-history
gating, recoverable modal drafts, locale-safe planning numbers, filtered/coalesced invalidation
and resource lifecycle checks. It also closes the original #88 Review/source measurement/event
findings and subsequent generated-note/evidence recovery defects. The exact automated and browser
scope is recorded in [recovery evidence](planning-recovery-evidence.md) and its
[coverage ledger](planning-recovery-coverage.md). This is a bounded Phase 12 slice; it does not
close global M00–M17 acceptance, live assistive technology or release readiness.

The persistent-shell follow-up corrects visible focus return from Room naming, dimensions,
outline and Area details dialogs after reflow hides their mounted opener. Native-control,
draft and focus evidence is tracked in [persistent shell evidence](persistent-shell-evidence.md#modal-focus-follow-up);
its focused verification does not replace the final combined gate.
