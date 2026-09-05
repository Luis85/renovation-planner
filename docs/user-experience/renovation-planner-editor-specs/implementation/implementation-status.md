# Editor implementation status — 2026-09-05

The implementation plan is a multi-release roadmap. This ledger distinguishes shipped baseline
behavior on `cf536f32` from the current contribution. It does not declare the whole roadmap done.

| Phase | Baseline and current contribution | Remaining work |
|---|---|---|
| 0 | Existing Room/Zone and Floor/Plan ADRs; ADR-0018 records selection, Inspector and refresh ownership | New-domain contracts, perspective implementation and stakeholder acceptance |
| 1 | Responsive shell, context bar, rails and drawers already exist | Perspective controls when their domains are available; full theme/release acceptance |
| 2 | This contribution adds ordered unique multi-selection, independent member focus, badges, overlap cycling, persistent list access and shared-property summary | Wall/Opening/Object hit priority and inspectors when those entities exist |
| 3 | Select/Add and temporary Room tools exist; the Area continuation adds its catalogue path, validated outline, one-shot/repeated completion and keyboard routing; the numeric continuation adds corner placement/correction | Unavailable creation domains, complete cross-tool/non-canvas routes and release acceptance |
| 4 | Rectangular room drag/numeric creation and reversible command already exist | Existing-room naming/resizing refinements, room-kind decision and complete M03 acceptance |
| 5 | Not delivered | Walls, hosted openings, connected creation, exact-length impact and composite undo |
| 6 | Background display and calibration exist | Transactional prepare/scale/review setup, persistent appearance and transforms |
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
