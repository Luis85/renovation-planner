# Editor implementation status — 2026-09-05

The implementation plan is a multi-release roadmap. This ledger distinguishes shipped baseline
behavior on `cf536f32` from the current contribution. It does not declare the whole roadmap done.

| Phase | Baseline and current contribution | Remaining work |
|---|---|---|
| 0 | Existing Room/Zone and Floor/Plan ADRs; ADR-0018 records selection, Inspector and refresh ownership | New-domain contracts, perspective implementation and stakeholder acceptance |
| 1 | Responsive shell, context bar, rails and drawers already exist | Perspective controls when their domains are available; full theme/release acceptance |
| 2 | This contribution adds ordered unique multi-selection, independent member focus, badges, overlap cycling, persistent list access and shared-property summary | Wall/Opening/Object hit priority and inspectors when those entities exist |
| 3 | Select/Add and temporary Room tools exist; the Area continuation adds its catalogue path, validated outline, one-shot/repeated completion and keyboard routing | Unavailable creation domains, complete cross-tool/non-canvas routes and release acceptance |
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

Remaining scope: Area metadata editing and a numeric route for individual corners, robust
self-intersection/repair rules, the unavailable M02 entries, domain-dependent Phase 2 criteria,
and the remainder of increments B–E. The implementation plan and Increment A remain open.
