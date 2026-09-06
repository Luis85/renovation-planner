# Connected planning: evidence and acceptance boundary

Continuation of open [PR #87](https://github.com/Luis85/renovation-planner/pull/87), head
`8ba7e2902a6d5d2054488e51cd8b9fc682b8c12c`, base `codex/renovation-workflow`.
Worktree: `D:\Projects\renovation-planner\.worktrees\materials-costs-evidence`;
branch `codex/materials-costs-evidence`. The continuation incorporates the advanced lower stack
through `origin/codex/reference-plan-workflow` at `abea1b18`, including main `44234f77`.
Earlier PR branches are not changed. PR #87's four verify jobs, audit and GitGuardian were green
when rechecked. [ADR-0022](../../../development/adrs/0022-material-quantities-cost-facts-and-vault-evidence.md)
and SDD §102 define the new contracts.

## Demonstrated behavior

An ordinary Room leads through Planned/Work into Asset-backed material Requirements, independent
allocations, cost obligations, supporting evidence and actionable Review. Source rules explain
current/intended geometry, manual quantity, coverage, waste, packaging and price. Overrides remain
independent through recalculation. One material estimate is counted once; commitments and actuals
belong to the same obligation, and a partial payment reduces only its linked open commitment.
Documents, Photos and Notes share a shell and file adapter, phases, optional pins, readable record
choices and source navigation. Shopping/review notes are guarded projections with stable ownership.

Deletion/reassignment guards preserve linked records. Drafts use explicit Apply/Cancel, retain text
and focus across reflow, and refuse stale baselines. Commands and inverses use the existing shared
history ledger, conditional repositories, events and save-state projection. No direct vault writes
occur in Vue. Existing composite compensation remains conditional on receipts from the operation.

## Requirement/test traceability

| Requirement / contract | Automated evidence |
|---|---|
| M12 current/intended Room/wall/opening/count/manual rules, mm/mm2 conversion, waste, coverage, lot/minimum and dimension refusal | `tests/domain/planningDepth.test.ts`; `tests/application/commands/planningWorkflow.test.ts`; `tests/presentation/editor/planningForms.test.ts` |
| Independent manual overrides; geometry recalculation, stale-first events, project currency and existing pricing precedence | `planningWorkflow.test.ts` (application); `planningFaults.test.ts`; inherited `assetPriceOverrideCascade.test.ts`, `overrides.test.ts`, `reversibleOverrides.test.ts` |
| Needed/purchased/reserved/outstanding, one allocation per Requirement, outstanding-only source-linked shopping | `planningDepth.test.ts`; application and editor `planningWorkflow.test.ts`; `planningFiles.test.ts` |
| M13 partial/excess settlements, unlinked actuals, cancelled facts, no double counting, negative Remaining and currency refusal | `planningDepth.test.ts`; `planningFaults.test.ts`; `planningForms.test.ts`; application/editor `planningWorkflow.test.ts` |
| M14 canonical/relative links, aliases, subpaths, duplicate basenames, Unicode/spaces, reserved import names, note creation and bytes | `tests/infrastructure/obsidian/repositories/planningFiles.test.ts` |
| File/folder rename with conditional Plan write, unlink preserves bytes, generated owner move/collision/human edit safety | `planningFiles.test.ts`; `tests/plugin/planningEditorServices.test.ts`; inherited `renovationReviewNotes.test.ts` |
| Root Materials/Costs/Evidence routes, selection retention, phase/type filtering, list/pin route, fallback and missing-file Review | `tests/presentation/editor/planningWorkflow.test.ts`; browser matrix below |
| Explicit preview/Apply, invalid inputs, cancellation/reflow, duplicate submission, delayed disposal, failed writes and retry | `planningForms.test.ts`; editor `planningWorkflow.test.ts`; `planningFaults.test.ts`; inherited `renovationFailures.test.ts` |
| Fresh baselines paired with stale displayed projection, peer edits and history gaps | application `planningWorkflow.test.ts`; inherited `renovationFailures.test.ts`, `renovationMixedHistory.test.ts`, `structureMixedHistory.test.ts` |
| Referential geometry/material deletion, Work/outcome links, procurement units and record ownership | application `planningWorkflow.test.ts`; `planningFaults.test.ts`; inherited `renovationGeometryGuard.test.ts`, `renovationCommand.test.ts` |
| Existing composite failure, operation-owned compensation, compensation failure and mixed Undo/Redo | `tests/application/commands/renovationCommand.test.ts`; `renovationMixedHistory.test.ts`; application `planningWorkflow.test.ts` |
| Actual repositories, unchanged human YAML/body, Plan v4/Requirement v2, pure migrations, future refusal and fresh root reload | `planningFiles.test.ts`; application `planningWorkflow.test.ts`; `planningEditorServices.test.ts`; `referencePlanMigration.test.ts`; `persistence-wiring.test.ts` |
| Lifecycle/effective-cost events, guarded composition and listener cleanup | `planningFaults.test.ts`; `planningEditorServices.test.ts`; `reversibleWritePathDiscovery.test.ts`; existing root/background listener suites |
| Inherited #87 unsaved geometry preview keeps its kind editable | `tests/presentation/editor/renovationDraft.test.ts` |
| Inherited #87 Review marker offsets restart inside each Room | `tests/presentation/editor/renovationRoutes.test.ts` |
| Existing reference, Room/Area, structure, pricing and error-taxonomy regressions | Complete `npm run check`, including unchanged coverage floors |

Unqualified filenames refer to the unique test basename, except the explicitly distinguished
application/editor planning workflow pair. Domain tests are pure calculations. Repository and
production-root tests use actual application/infrastructure code over FakeVault and typed host
ports. The fake binary creation stand-in stores every byte, including zero/255; it is not a live
Obsidian filesystem or workspace. Browser file open is recorded by the harness host port.

## Browser evidence

```powershell
$env:RP_CHROMIUM_EXECUTABLE='C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
node scripts/editor-planning-check.mjs
```

The installed Edge Chromium engine **152.0.4191.62** is an explicit substitute for Playwright's
pinned browser. All four journeys passed with zero page errors: light 1440px, dark 1440px,
custom accent 1000px and German constrained 460px. The fixture prepares/calibrates a reference,
creates a closed wall loop and ordinary Room, records Existing/Planned/Work, material packaging,
purchased/reserved quantities, shopping, commitment 500/actual 200 settlement, invoice, contextual
note/pin, photo and Review. Actual Tab/Shift-Tab, native select arrows, typing, Enter, Space and
Escape drive controls; there are no programmatic fill/focus substitutes. Evidence undo/redo and
cancelled draft writes are checked. Draft focus/text survive full↔constrained reflow. Custom host
accent/background tokens are asserted across fixture reloads.

Representative saved screenshots were visually inspected for totals, evidence, long filenames,
focus, wrapping and constrained drawer layout. Full-size images/report are under
`implementation/evidence/materials-costs-evidence/`; the reproducible run also emits all steps to
ignored `harness-shots/materials-costs-evidence/`. The inherited seven-layer Konva warning remains;
pins reuse the existing annotation layer. No extra canvas/runtime is introduced.

## Verification results

Final check counts and changed-file coverage are recorded in
[the coverage ledger](connected-planning-coverage.md). Production dependency audit reports zero
vulnerabilities. The complete check is run with `VITEST_MAX_WORKERS=2`; thresholds, complexity
budgets and existing exclusions are unchanged. Initial diagnostics exposed old schema-version
assertions, event census ownership, legacy listener fixture counts and locale error entries.
Assertions were updated to the new explicit schema/lifecycle contracts; legacy harness fixtures
remain opted out of planning unless their test requests it. No blanket skips were added.

## Inherited findings and remaining acceptance

#87's two P2 review findings are corrected in this continuation: preview no longer assigns an ID
to the unsaved draft, and marker rank is local to each Room. Their original review threads remain
on #87; this feature does not push to that earlier branch. The advanced lower stack contributes
current main fixes; the Area corner Escape contract now restores Apply focus and a second Escape
returns to Select, covered by the updated integration assertion.

This is not complete Increment D/M12–M17 acceptance or release readiness. Live Obsidian desktop/
mobile, actual workspace navigation/rename timing, physical pointer/touch, screenreader and
assistive-technology acceptance remain unperformed. There is no camera/capture, full PDF preview,
quote comparison, supplier/PO workflow, shared inventory, payments/OCR, scheduling, collaboration
or engineering validation. Evidence presence is optional and never changes Work readiness.

Pins are Room-bounding-box fractions, not surveyed wall coordinates. A refused rename repair may
leave a visibly missing link requiring explicit repair. Generated notes whose owner header was
removed cannot be discovered by that identity after a move. Removing a Requirement uses existing
host trash semantics: inverse creation restores canonical metadata while the old user-authored
note remains recoverable in trash. Multi-file compensation is tested, but no durable journal or
new crash recovery is claimed. Exact uncovered counters are listed separately and are not treated
as accepted behavior.
