---
type: PBI
parent: "[[Release hardening]]"
order: 20
status: Done
started: 2026-09-05
finished: 2026-09-05
horizon: "MVP"
release: "[[MVP]]"
dependsOn:
  - "[[Reload the editor without losing room data]]"
  - "[[Error handling and diagnostics]]"
  - "[[Validation and vault health]]"
---

# Recover safely from failed writes and stale reads

## Actor

The private renovator whose edit or follow-up refresh fails while valuable plan content is open.

## Main flow

1. The renovator commits an editor action.
2. The write completes and the editor reads canonical state back.
3. If read-back succeeds, the normal projection replaces the previous one.
4. If read-back fails, the last valid projection remains visible and is marked potentially stale.
5. Unsafe writes are disabled with an explanation.
6. The renovator retries hydration; the original mutation is never replayed.

## Extensions

- **2a** — The write fails before a complete logical mutation exists. Compensation restores the
  prior valid state where possible and the canonical error surface explains the result.
- **2b** — Compensation or recovery cannot finish. The editor reports that manual inspection is
  required and does not claim the vault is safe.
- **6a** — Retry fails again. The retained projection and guard remain; only the accessible
  failure message is updated.
- **6b** — Retry succeeds. Stale labels disappear and write actions become available again.

## Guarantee

A failed read never erases the last valid content or replays a successful write. While the editor
cannot establish current canonical state, no unsafe follow-up write is enabled.

## Acceptance criteria

1. M15 preserves the last valid plan after a post-write read failure.
2. `Try again` performs a read only and cannot dispatch the original command.
3. Geometry, add, delete, and other unsafe mutations are disabled until refresh succeeds.
4. A failed logical write leaves either the prior complete state or an explicit unrecovered
   condition; no partial success is presented as safe.
5. Error copy and diagnostics use the authorities in [[Error handling and diagnostics]] and
   [[Validation and vault health]] rather than a release-specific error vocabulary.

## Assumptions

- Selection and navigation may remain available for inspection while stale.
- “Unsafe” means an action whose correctness depends on the unavailable current projection.
- Backup guidance supports recovery but does not substitute for compensation and guarded writes.

## Sources

[M15 — Stale-Data Warning](../user-experience/renovation-planner-editor-specs/screens/M15-stale-data-warning.md);
VS-10 and Scenario D in the
[editor vertical-slice plan](../user-experience/renovation-planner-editor-specs/Renovation%20Planner%20—%20First%20Vertical%20Slice%20Plan%20and%20Data-Model%20Specification.md);
Phase 12 in the
[editor implementation plan](../user-experience/renovation-planner-editor-specs/implementation/implementation-plan.md).

## Amendments

**2026-09-05** — closed by the trust path increment
(`docs/superpowers/specs/2026-09-04-plan-editor-trust-path-design.md`), the vertical-slice plan's
checkpoint C3. Which test holds each criterion:

1. **The last valid plan survives a post-write read failure.** `ProjectStore.hydrate`'s
   `keepPreviousOnFailure` arm already held `status === 'ready'` and the previous scene; what this
   increment added is that something now READS the `stale` field it sets. The assertion is
   `tests/presentation/editor/stalePath.e2e.test.ts`'s first case, which drives a real create
   through the mounted editor against a query bundle whose second read refuses and asserts the
   canvas still draws the PRE-command scene (one zone, two Konva lines) at `status === 'ready'`
   while the repository holds two. `tests/presentation/stores/projectStore.test.ts` is the store
   half.
2. **`Try again` performs a read only and cannot dispatch the original command.** This is a fact
   about a SIGNATURE before it is an assertion: `refreshProjection` takes no parameters at all, and
   `tests/presentation/editor/type-safety.test-d.ts` holds its parameter list equal to `[]` at
   compile time. That it is the SAME function the post-command path calls is
   `tests/presentation/editor/tools/withEditorStateRefresh.test.ts` plus
   `tests/presentation/editor/runtime.test.ts`'s 'refreshProjection re-reads and never dispatches';
   the vault-side half is the write count in `stalePath.e2e.test.ts` — one `zones.save` and one
   `zones.delete` across a scenario containing three retries.
3. **Unsafe mutations are disabled until refresh succeeds.** Two mechanisms, and the record says
   so rather than implying one: `withStaleGate` refuses `run` at the leaf's one dispatcher
   (`tests/presentation/editor/tools/withStaleGate.test.ts`, and `stalePath.e2e.test.ts`'s third
   case, which is the ONLY case in either e2e file that the gate-removed mutation reddens), and
   every control in design spec §2.9's table carries `aria-disabled` plus the shared reason and an
   early return of its own (`tests/presentation/editor/pausedSurfaces.test.ts`, ten cases;
   `tests/presentation/editor/tools/selectTool.test.ts` for the Select drag that draws no ghost;
   `tests/presentation/editor/layers/layerCatalogue.test.ts` and `shell/layerList.test.ts` for Set
   scale). **NARROWED, and the narrowing is the honest half:** the gate covers what dispatches
   through this leaf's chain — every tool gesture, the Inspector's commits and room creation — and
   not the plugin's own palette commands (`set-plan-background`, `create-sample-project`), which
   never enter it. Design spec §11 records that, and [[Recover from a stale read]] step 4a is where
   it is looked at in a vault rather than assumed.
4. **A failed logical write leaves either the prior complete state or an explicit unrecovered
   condition** (extension 2b). `ObsidianZoneRepository.compensateFailedSidecarWrite` used to say
   "the note was compensated" whether or not the restore succeeded; it now returns
   `zone.sidecar-insert-uncompensated` / `zone.sidecar-update-uncompensated`, stamped with
   `markUncompensated`, when it does not — four cases in
   `tests/infrastructure/obsidian/repositories/errorPaths.test.ts`, two per arm, with the stamp
   itself mutation-checked (unwrap it and both redden at `leftWritesBehind`). The unrecovered row
   is drawn FROM that stamp: `withSaveStateTracking` calls `markUnrecovered` when a refused result
   `leftWritesBehind` (`tests/presentation/editor/saveState/withSaveStateTracking.test.ts`, the
   ORDER asserted through a recording tracker, not just the call), `SaveStateStore.unrecoveredWrite`
   is cleared only by `resolveOk` (`saveStateStore.test.ts`, including the exhaustive transition
   walk, which grew one axis and stayed exhaustive), and the row is first in the strip with **Open
   source note** and no retry (`tests/presentation/editor/shell/warnings.test.ts` and
   `shell.test.ts`'s 'draws the unrecovered row from the save-state store, and a successful refresh
   does not clear it').

   **What the stamp cannot see, stated here because it is where a reader of this PBI stands.** The
   row fires for a refusal that was STAMPED at the site that wrote. CLAUDE.md's own
   `affectsSaveState` account records the residue this inherits: **a post-write refusal raised in a
   pre-write category anywhere else is still under-reported**, and neither a linter nor the suite
   can see one, because the category axis cannot see a write. This increment adds one more stamped
   producer; it does not close the class.
5. **Error copy and diagnostics use the canonical authorities.** Eleven new keys in both locales
   (two `zone.sidecar-*-uncompensated` and `editor.stale-write-refused` reaching the user through
   `toUserMessage`, the other eight through `t()`), across
   `en/editor.ts`, `de/editor.ts`, `en.ts` and `de.ts`; the two uncompensated codes
   are rows in `tests/presentation/i18n/toUserMessage.test.ts`'s MINTED table, copied from the
   repository's own raise sites rather than from `en.ts`; `tests/presentation/i18n/strings.test.ts`
   holds locale completeness, the interpolation-hole rule and the two pinned German terms; and
   `I18N_LITERAL_BAN` / `NOTICE_TEXT_BAN` are unchanged and unbypassed. No release-specific error
   vocabulary was minted: `editor.stale-write-refused` is a `ValidationError` code in the existing
   `AppError` shape, and the diagnostics ledger is untouched.

Extensions: **2a** is criterion 4's compensated arm (`errorPaths.test.ts`, both codes, both
messages, and the note's own bytes read back). **6a** is `retriesFailed` — a failed retry keeps the
row, its DOM node and every paused control and moves only the message to
`editor.refresh-failed.again` (`projectStore.test.ts` for the counter, `shell.test.ts`'s 'keeps the
stale row's DOM node while its message changes after a failed retry', and `stalePath.e2e.test.ts`
for the whole sequence). **6b** is the healing retry clearing the strip, the label, `retriesFailed`
and every paused attribute in one move, in that same e2e case.

Accessibility: `tests/harness/accessibilityTrustPath.test.ts` scans three states with axe — the
stale strip with its two actions, the Room Inspector with every write control paused, and the
constrained drawer in the same state. No violations. It is a NEW file rather than three cases in
`tests/harness/accessibility.test.ts`, which the additions would have pushed past its 450-line cap;
`runOptions` is shared from `./axeOptions` rather than copied.

Narrowings and residues, recorded rather than ticked:

- **The live-vault walk is written and has NOT been run, and this PBI is `Done` anyway — for a
  reason worth stating rather than assuming.** None of the five criteria above is a claim about a
  vault run; every one is a behavioural claim with a named test, which is what a `Done` here
  asserts and the whole of it. The walk is a TASK-level obligation, and its task is
  [[Verify stale recovery in Obsidian]], which stays **Active** for exactly that reason — its whole
  deliverable is the walk, not the procedure. (Contrast [[Reload the editor without losing room
  data]], whose criterion 5 IS a vault run and is therefore recorded there as **outstanding**
  rather than ticked.) [[Recover from a stale read]] is in the smoke census with its fault setup
  documented — including which faults do NOT produce Scenario D and why — and its Runs table
  carries the same sentence. An unrun manual case is a plan to find out, not a finding.
- **The status bar clips its paused hint at a sidebar's width**, found by reading
  `plan-editor-stale-narrow` at 460 px in the pinned Chromium. The strip and the save-state label
  still carry the fact. It belongs to [[Build full and compact editor status bars]] and is step 4b
  of the manual case.
- **`Saved · refresh needed` is DERIVED, not a fifth save state.** `SaveState` still has four
  members; `SaveStateIndicator` reads `ProjectStore.stale` beside the store's own state
  (`saveStateIndicator.test.ts`, with the class built from the template's own expression so a
  stylesheet rule one word off fails there rather than passing quietly).
- **The two application-layer residues are untouched** — a successfully recalculated reassignment
  that cannot be rolled back, and two marker failures reading as an interrupted sequence. Both
  PRE-EXISTING, both named in `docs/superpowers/plans/2026-09-03-the-lock-publish-boundary.md`'s
  "Not in scope" and in CLAUDE.md. This increment surfaces an unrecovered result; it does not
  change what produces one.
