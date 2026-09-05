# Editor implementation status — 2026-09-05

The implementation plan is a multi-release roadmap. This ledger distinguishes shipped baseline
behavior on `cf536f32` from the current contribution. It does not declare the whole roadmap done.

| Phase | Baseline and current contribution | Remaining work |
|---|---|---|
| 0 | Existing Room/Zone and Floor/Plan ADRs; ADR-0018 records selection, Inspector and refresh ownership | New-domain contracts, perspective implementation and stakeholder acceptance |
| 1 | Responsive shell, context bar, rails and drawers already exist | Perspective controls when their domains are available; full theme/release acceptance |
| 2 | This contribution adds ordered unique multi-selection, independent member focus, badges, overlap cycling, persistent list access and shared-property summary | Wall/Opening/Object hit priority and inspectors when those entities exist |
| 3 | Select/Add, keyboard menu, temporary room tools and room repetition already exist | Additional creation capabilities, including Area, and cross-tool lifecycle coverage |
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
