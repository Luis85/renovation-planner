# Release selection and persistence work package

Owner: selection/persistence subagent, `codex/editor-release-selection`. Initial evidence:
`7d4bc381` (2026-09-08). Parent revalidated origin/main and PR #93 (`c1362732`, open,
docs-only); files owned by #93 are excluded from this branch. Rotation and integration are
separate dependent work packages. Full checks, screenshots and host evidence belong to the parent.

| Requirement and source entry | Initial classification and evidence | Remaining action and acceptance |
| --- | --- | --- |
| Shared hover/click order: SDD §20, implementation-plan Phase 2, Resolve overlapping selection targets deterministically | Defective: `resolveSelectionTarget` ranks Opening/Wall above Object at baseline. Existing `structureSelection.test.ts` only overlaps Opening/Wall/Room. | Rank Object before Opening before Wall before Room; verify cross-kind order independent of paint order, stable within-kind stacking, selected handles/badges, Alt cycling and list/multi-selection identity. |
| Exact Room size input: M03 precision continuation, ADR-0018 | Suspected defect confirmed by inspection: `dimensionProposal` treats text matching rounded initial display as untouched, so 1234.4 mm displayed/retyped as 1.234 m remains 1234.4. | Reproduce in modal and inline form tests; track explicitly edited axes, parse retyped values to whole mm, preserve untouched coordinates, anchor and winding; no writes/history for actual geometric no-ops. |
| Opening reload and reversibility: M08, ADR-0020, Verify opening reversibility reload and non-canvas paths | Implemented but fresh-runtime reload unverified: existing structure tests read the writing stack, while Room reload evidence reconstructs a stack. | Write an opening-bearing fixture through real persistence, reconstruct repositories/index/runtime from persisted bytes, verify ID/kind/host/offset/width/height/sill, then edit and Undo/Redo; verify invalid host changes and deletion guards. Fix production only if this evidence establishes a defect. |
| No orphan openings, no write replay after failed readback: ADR-0020 and SDD §42 | Existing command/recovery coverage; not yet checked on the new fresh-stack fixture. | Retain existing focused recovery cases and exercise stale refresh/no duplicate write where the new fixture permits. |
| Host/process durability | Explicitly accepted boundary: ADR-0020 retains ADR-0019's lack of durable crash journal. | Do not infer native Obsidian or crash durability from fake-vault or browser evidence. Parent records outstanding host acceptance. |

Implementation sequence: add discriminating regressions; correct the resolver and edited-axis
contract; add fresh persisted-opening fixture/runtime evidence; run targeted `check:fast` and
reconcile this record with measured outcomes. No schema, entity ownership or history architecture changes.

## Measured implementation outcome — 2026-09-08

The regression run against the baseline implementation observed the wrong Opening target over
an Object, and both Room input routes retaining a right edge of `2734.65` rather than `2734.25`
after explicitly retyping the displayed `1.234`. Opening fixture setup initially attempted a
legacy plan without a sidecar; the fixture now creates its Project/Plan through real repositories
before seeding the structure. Those setup and UI-selector adjustments are test corrections,
not evidence of an opening persistence defect.

- **Selection: implemented and verified by focused tests.** The shared resolver ranks Object
  ahead of Opening/Wall and retains the existing relative priority of other elements and Rooms.
  `resolveSelectionTarget.test.ts` overlaps all four kinds, reverses paint order, cycles every
  overlap, and checks within-kind order and decorations. `structureSelection.test.ts` verifies
  hover/click agreement, Alt cycling and ordered Shift/non-canvas ID selection without dispatch.
- **Room exact input: implemented and verified by focused tests.** Both modal and inline forms
  record input events per axis; explicitly retyped display text is parsed to whole millimetres.
  Untouched axes and an already exact extent retain their original coordinates. Pure dimension
  tests exercise both axes; `roomResize.e2e.test.ts` and `roomDimensionInline.test.ts` verify
  preview, committed coordinates, exact Undo/Redo and no history for true no-ops.
- **Opening fresh reload: implemented and verified at the disk-backed test-host boundary.**
  `openingFreshPersistence.test.ts` persists Door/Window/Opening records with differing dimensions
  and a fractional offset, reconstructs index/echo/store/repositories and mounts a fresh real
  editor. It checks sidecar bytes, all opening fields, read-only reload, empty new-leaf history,
  list selection, reviewed numeric edit, exact Undo/Redo, missing/shortened host refusal,
  cancellation and confirmed cascading host deletion/restoration. A confirmed write remains
  single through failed readback, two failed read-only refreshes and successful refresh.
  No opening production change was needed.

Validation on the worktree based on `7d4bc381`: `npm run check:fast --
tests/presentation/editor/selection tests/presentation/editor/structureSelection.test.ts
tests/presentation/editor/roomResize.e2e.test.ts tests/presentation/editor/roomDimensionInline.test.ts
tests/presentation/editor/resize/roomDimensions.test.ts tests/presentation/editor/openingFreshPersistence.test.ts
tests/presentation/editor/multiSelectionInspector.test.ts --maxWorkers=2` passed oxlint, TypeScript,
and **8 files / 85 tests** (126.25 s). The final `multiSelectionInspector.test.ts` path in that
invocation did not match a file; the actual existing suite is under `shell/` and belongs to the
parent's integrated gate. The eight matching suites and their results are the evidence here.
`git diff --check` passed. The unchanged full gate, final captures and native Obsidian acceptance
remain parent-owned; these tests do not claim browser, screen-reader or native-host acceptance.
