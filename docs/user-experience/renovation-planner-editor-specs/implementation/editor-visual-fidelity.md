# Editor visual fidelity

This branch implements the production Vue/Pinia/Konva editor against the locked M00–M17 references. The user's expanded completion request includes the documented concept and interactions, beyond the initial presentation pass. It retains Project → Floor ownership, root-owned dialogs, the production command history and Konva layer ordering. A finalization task owns the canonical completion matrix and remaining independent Add/navigation gaps; this document records this branch's concrete changes and evidence.

## Connected editor completion

- M00: `TransformationSummary` derives Existing, Planned, change count, work progress and open findings from the Plan register. Overview is the initial Renovate mode. Continuation opens the first actionable finding or the next empty section, retaining spatial selection. Linked materials, reconciled costs, documents, photos and notes show actual scoped counts.
- M01: planned-change count comes from the register, with unreadable records explicit. Floor cost totals reuse material estimates and cost reconciliation; stale, failed or incomplete inputs suppress the number. Clearing Renovate selection returns to the same Floor summary.
- M07: walls/openings retain their own identity, measurements and room context. Room assignment is explicit for standalone elements. Existing/Planned/Work lists and new-record defaults follow `session.targetId`; an existing wall subject is reused when marking a change. Connected planning lists and shared-record navigation are integrated by the finalization task.
- M11: length joins the existing individual-area sum. Shared Work/Evidence and planned wall modification/removal use one version-checked RenovationCommand after an impact preview. Hosted openings are included in a planned wall removal; current geometry and room outlines remain unchanged. Compatible walls/openings can be deleted together through one Structure command after concrete impact confirmation; linked records refuse deletion. Unsupported/unknown contexts have an explicit reason.

## Shared-record contract

WorkPackage and Evidence accept an optional `links: readonly { roomId, targetId }[]`. The existing `roomId`/`targetId` remain primary ownership; each extra pair is a secondary spatial context of the **same record ID**, not a copied task/document. Existing serialized records without `links` remain valid. Plans with nonempty shared links write **schema version 5**, so older builds refuse them instead of stripping the links and overwriting the register. Unaffected Plans retain feature-dependent v1–v4 writing; the v4→v5 read migration changes metadata only. Additional contexts are validated for nonempty IDs, uniqueness, existing rooms and current/intended targets. DTO parsing preserves them, `sameRenovation` compares them, and deletion referents inspect every context. Ordinary Evidence editing must retain these links; its coordinate pin remains anchored to the primary room. Shared costs/material requirements are not created implicitly or counted more than once in floor totals.

Batch creation/attachment prepares one complete register proposal and routes it through the existing CAS, compensation and conditional undo/redo path. The root-owned form freezes on a refused write and retains the draft for recovery. No vault file is deleted by unlinking evidence. Sharing a new evidence record selects a real existing vault file; new/shared Work may be captured before outcomes are known, which remains visible as a Review finding.

## Screen matrix

All routes below are states of `PlanEditorRoot`, mounted by the existing `?view=plan-editor` harness. Planning journeys use the production application services and repositories over `FakeVault`. The baseline's simple shell fixture deliberately exposes unavailable planning services; the connected journeys exercise the supported implementations.

| Reference | Production surface / capability | Baseline difference → correction | Contract / dependency retained |
| --- | --- | --- | --- |
| M00 selected room | `RoomInspector`, `RenovationEntry`, `TransformationSummary` | Narrow inspector and crowded links → 20px identity, real Existing/Work/Planned summary, progress, three primary destinations, linked counts and continuation | Counts and estimates follow the available projection; persistent navigation retains keyboard focus |
| M01 floor | `ResponsiveEditorShell`, `FloorInspector`, `PropertyLayerPanel` | 192/272px sidebars, dense toolbar → adaptive ~245/360px columns at 1440px, 52px context, measured room areas, quiet structure rows, recorded changes and reconciled estimate | Two-level Project → Floor; unreadable and stale data remain explicit |
| M02 Add | `AddMenu` | Dense small popover → larger scrolling menu, stronger labels, separated descriptions | Existing catalogue groups, keyboard navigation and unavailable reasons |
| M03 room creation | `NewRoomInspector`, `TemporaryToolBanner` | Cramped fields → consistent field/suggestion gaps and input heights | Existing numeric dimensions, draft preview, commit/cancel controls |
| M04 wall creation | `StructureTaskForm` | Numeric controls now occupy the Inspector; a compact canvas taskbar retains Undo, Finish and Cancel | Same per-leaf draft and runtime commands; see [creation refinement](editor-creation-fidelity.md) for pending verification |
| M05 new floor | `FloorStart` | Vertical button stack at desktop → three equal starting choices; vertical at constrained width | Only real Room/reference/empty actions; no decorative floor plans |
| M06 reference setup | `ReferenceSetupForm`, `ReferencePreview` | Small vertically stacked modal → wider preparation/measurement/review dialog with adjacent actual preview on desktop | Accepted modal workflow; real image/PDF, crop, rotation, calibration and consent |
| M07 wall/opening | `StructureInspector`, `StructureList`, `StructureRenovationEntry` | Bulleted raised wall buttons, weak metric alignment → flat identity rows, aligned lengths, explicit owner context and selected-element renovation summary | Wall records follow the selected element across Room contexts; selection stays intact |
| M08 Existing | `SubjectRow` | Uniform text/action emphasis → readable record title, selected inset, compact metadata/action spacing | Real condition, description, source and edit operations |
| M09 Planned | `SubjectRow`, `DecisionList` | Loose paragraphs and competing buttons → shared record rhythm and relationship actions | Existing linked outcomes, sources and decisions; no invented preview assets |
| M10 Work | `WorkRow`, `SharedRecordContexts` | Weak ordering/title hierarchy → stronger ordered title, state/relationship rows and named primary/secondary contexts | One Work identity; unlink and whole-record deletion explain their different impacts |
| M11 multiple selection | `MultiSelectionInspector`, `RenovationBatchForm` | Undifferentiated summary → emphasized membership heading, paired aggregates, full-width member rows and shared-action preview/apply | Atomic Work/Evidence sharing and compatible planned changes; focused member is separate from membership; area is a sum |
| M12 Materials | `MaterialNumbers`, `MaterialRow` | Long provenance competes with numbers → right-aligned quantities, secondary provenance, grouped work and calculation/procurement disclosures | Original units, arithmetic and stale/refused states; exact formatting coordinated with hardening |
| M13 Costs | `CostTotals`, `CostRow` | Flat definition list and long policy → summary blocks, aligned breakdown rows, reconciliation disclosure | All five real totals retained, including open commitments; no mock totals |
| M14 Evidence | `EvidenceInspector`, `EvidencePreview` | Undifferentiated title, thumbnail and actions → titled records, bounded authentic previews, spaced relationship actions | Existing phase select, real file fallback, missing-file state and unlink semantics |
| M15 warnings | `PersistentWarningStrip`, `StatusBar` | Dense status text → padded severity strip, persistent severity edge, wrapping status region | Existing DOM position, save/recovery interfaces and behaviour; retry owned by hardening |
| M16 constrained | `PanelRail`, `InspectorDrawer`, `OverlayPanel` | 17rem drawer and tight chrome → bounded 23rem drawer, readable rail controls, wrapped context/status | Same canvas instance; existing 400/900px breakpoints and unsupported-width notice |
| M17 Review | `ReviewInspector`, `PlanningReview` | Inconsistent row/title density → shared inspector, source row and metadata rhythm | Existing findings, source navigation and generated note; all-clear correctness belongs to #88 |

## Evidence and reproduction

Sources: [`../images/`](../images/). The before/after screenshots, machine-readable browser reports and comparison manifest live under [`evidence/editor-visual-fidelity/`](evidence/editor-visual-fidelity/). `design-qa.md` at the worktree root records visual acceptance and comparison history.

Run from this worktree with the installed Chromium override if the pinned browser is unavailable:

```powershell
$env:RP_CHROMIUM_EXECUTABLE='C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
node scripts/editor-planning-check.mjs
node scripts/editor-renovation-check.mjs
node scripts/editor-reference-check.mjs
node scripts/editor-visual-resilience.mjs
node scripts/editor-visual-overview.mjs
node scripts/editor-visual-fidelity-shots.mjs after
node scripts/editor-visual-comparisons.mjs
```

For the final integrated source, commit the production and harness files and run `node scripts/editor-visual-final-check.mjs`. It runs the sequence above serially, refuses changed source/revisions or missing/stale journey reports, and writes `capture-provenance.json` with the revision, timings and image hashes. Manual inspection of the comparisons remains a separate acceptance step. This runner is not yet reported as passed at the intermediate checkpoint.

The original journey scripts are unchanged. The harness selection knob now finds the already-existing `data-rp-id`; entire-label matching stopped working when real area metadata was added. Browser actions remain ordinary production controls. The screenshot compositor only crops/resizes screenshots for comparison; it never changes what the editor renders.

Reference host title bars, ribbons and external note panes are not reproduced inside the plugin leaf. Comparison cells preserve aspect ratio, expose all crop coordinates and native dimensions in `comparisons/manifest.json`, and use 1× browser captures. The real fixture room, wall loop and test reference scan differ from the illustrated reference floor; no mock floor-plan bitmap or user evidence was manufactured to hide that difference.

## Verification

Initial expanded verification: 40 targeted tests passed across six files, including real repository persistence, batch undo, deletion referents, floor reconciliation, overview continuation, wall-specific drafts and reflow. The final capture pass and universal repository gate remain pending; see the final QA report and PR for completed results.

The first expanded full gate passed build and lint; 537 test files passed and two failed. Both failures were corrected: the new hosted-door fixture now uses the required `opening-` identity prefix, and the reopen test reads the room-name span separately from the newly displayed area. Coverage was below the unchanged thresholds, so additional behavioral cases now exercise restoration of removed openings/boundaries, cross-room wall scope, real overview links and decision continuation, shared-file attachment, incompatible selection, stale/disposed batch reads and financial-stage transitions. Focused reruns passed. A complete rerun is still required; these results do not imply universal acceptance.

2026-09-07 integration checkpoint: `npm run check` passed production build and full lint, then all 544 test files (7,280 passed; 70 skipped). Statements 99.07%, functions 99.05% and lines 99.44% passed their thresholds. Branches 97.83% (9,800/10,017) failed the unchanged 98% threshold; the subsequent analysis command therefore did not run. The checkpoint is intermediate and is not a claim of full verification or design acceptance. Additional lifecycle and shared-context cases are being verified in a follow-up.

Post-gate focus correction keeps one Room navigation component mounted between Overview and Existing/Planned/Work. Keyed buttons retain DOM focus; returning to Overview explicitly focuses the enclosing Details region when its trigger disappears. `VITEST_MAX_WORKERS=1 npx vitest run tests/presentation/editor/renovationOverview.test.ts` passed all six cases after that correction. This has separate attribution because it follows the full-gate source snapshot.

The published checkpoint `0e20d59a` subsequently completed [CI run 34065989604](https://github.com/Luis85/renovation-planner/actions/runs/34065989604) on Ubuntu Node 22/24/26 and Windows Node 22. Every job passed build, lint and all 544 test files (7,282 passed; 69 skipped), including the focus correction. All four stopped at branch coverage 97.82% (9,804/10,022); other thresholds passed. Audit passed. This confirms the remaining coverage gap across platforms, not final acceptance.

Coverage follow-up: all 41 cases across seven focused files passed with the unchanged coverage configuration and JSON output outside the repository. Comparing matching branch locations with the preceding full local report identifies 19 newly covered branches: retired callbacks/rejected reads, shared deletion, all hosted-opening kinds, Room-first changes, missing-context labels, unloaded/material summaries, planned-wall defaults, invalid shared evidence and real Floor change counts. The focused run itself fails global thresholds because it executes only seven files; it is a diagnostic, not a universal pass. `vue-tsc -noEmit`, whole-project oxlint and targeted ESLint for all seven test files passed. The two changed capture scripts passed `node --check`; they are intentionally outside the repository's ESLint scope. The next full CI run remains authoritative for the final global counters.

Focused files: `renovationBatch.test.ts`, `renovationElementScope.test.ts`, `renovationOverview.test.ts`, `sharedEvidenceContexts.test.ts`, `spatialRecords.test.ts`, `renovationRetiredActions.test.ts`, `renovationSummaryLoading.test.ts` (one Vitest worker; JSON coverage written to a temporary directory outside the checkout).

Element scope follows a selected wall/opening across primary and secondary room contexts. Room summaries continue to use room ownership. This applies to observations, outcomes, Work, Decisions and the reconciled cost summary, so selecting an adjacent room context cannot hide the selected wall's records. Stale or unreadable projections suppress linked counts as well as the numeric estimate.

## Parallel integration

Dedicated style partials: `editor-visual-shell.css`, `editor-visual-records.css`, `editor-visual-tasks.css`, `editor-visual-overview.css`; imported after existing functional styles. Common save/recovery files and canonical implementation-status reconciliation retain their agreed owners.

Coordinate interpolation/import changes in `MaterialNumbers`, `CostTotals` and `CostRow`, and state attributes in `MaterialRow`/`EvidenceInspector`, with the hardening branch. Preserve the new `rp-cost-total`/`data-rp-stage` grouping and `rp-material-provenance` span when applying its formatting work. Additional presentation-only classes on `EditorContextBar` and `StructureList` scope flat-button rules to the controls that own them. The reviewed #88 predecessor must be included before this PR is reviewed; the parallel recovery branch must be reconciled separately.

## Limits

These captures validate the production component tree in a Chromium harness. Live Obsidian acceptance is coordinated with finalization and remains separate evidence. Browser host file-open is recorded by the harness. Simulated leaf reflow is not an operating-system text scaling or actual browser zoom test. Custom theme checks cover representative token overrides, not every community theme. Text controls currently follow the repository convention; open visual acceptance items remain in the QA report and are not treated as implicit scope removals.

2026-09-07 follow-up CI at `854bc60e`: the Ubuntu Node 24 job in [run 34067712338](https://github.com/Luis85/renovation-planner/actions/runs/34067712338) passed build, lint and all 546 test files (7,293 tests; 69 skipped). All unchanged coverage thresholds passed: statements 99.11% (14,928/15,062), branches 98.01% (9,823/10,022), functions 99.12% (4,189/4,226), lines 99.44% (12,095/12,162). Analysis then identified six cognitive-complexity findings; this run is not a universal pass.

The next refactor separates batch-form display conditions, Work-record validation and deletion confirmation without changing their user-facing choices or validation order. The deletion proposal preserves the remaining structure fields. Three other findings overlap the element foundation and are assigned to the combined finalization contribution. No analysis limits or coverage exclusions were changed. Targeted verification is pending at this working checkpoint.

Cognitive refactor verification: all 75 tests across `tests/domain/renovation.test.ts`, `renovationBatchForm.test.ts`, `renovationBatchGuards.test.ts`, application `renovationBatch.test.ts` and `structureActions.test.ts` passed, first normally and then with fresh focused JSON coverage outside the checkout. Vue type checking, ESLint for all three changed production files, whole-project oxlint and `git diff --check` passed. Fallow clears the three assigned cognitive findings. The previous full report no longer matches moved source locations, so a second analysis used `--coverage` with the fresh focused report: none of these three files has a complexity/CRAP finding. That focused analysis is not a whole-project pass; it correctly reports untested unrelated files and the three remaining cognitive sites owned by finalization. Batch form coverage is 82/82 statements, 26/26 functions, 73/73 branches; domain Renovation is 97/97 statements, 26/26 functions, 92/93 branches. Global coverage thresholds remain unchanged and intentionally fail for a five-file diagnostic run. Final combined CI remains required.
