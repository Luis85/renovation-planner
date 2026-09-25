# First beta — Q1 stamp census

Measured 2026-09-25 at revision `d54e95931`, from `src/` and a scratch run of the suite. This is
the measurement the owner authorised for Q1 on 2026-09-25 ("Measure first", `05-owner-decisions.md` §3).
It lists every place the "partly failed write" stamp (`markUncompensated`) is raised, which of
those places reach no recorder, and whether any of them can raise the stamp on a healthy vault.
**It changes no behaviour and chooses no option.** Nothing here ran in Obsidian.

## 1. Result in one paragraph

`markUncompensated` is called at **23 sites** in 17 files. **17 sites** reach a recorder on every
path. **4 sites** reach no recorder on any path. **2 sites** reach one on some paths and not on
others. So **6 sites** have at least one unrecorded path. 5 of those 6 raise the stamp only when
two writes are refused: the write the site guards, and the write that should have undone it.
**The sixth raises it on a healthy vault.** That site is the Asset designer's background undo,
`ReversibleAssetBackgroundEdit.undo`. It raises the stamp after one refused write, and a peer
write that lands during the undo is enough. On an asset with no calibration, the vault after that
stamp holds its pre-gesture note and calibration. The ordinary cycle within one leaf's history
(run, undo, redo, on a healthy vault) raised no stamp at any of the 6 sites.

## 2. Instruments, and what each cannot see

All four scripts are outside the repository, in `D:/tmp-rp/s21-q1/`. Each was run against a
planted fixture before its answer over `src/` was trusted.

| Instrument | What it gave | Planted-fixture test | What it cannot see |
|---|---|---|---|
| `census.mjs`: a TypeScript type-checker program over every `.ts` in `src/`, plus every `.vue` file's `<script>` blocks through `@vue/compiler-sfc`. For every identifier it resolves the symbol through aliases (`getAliasedSymbol`) and compares it with `markUncompensated`'s declaration. It also finds every property named `uncompensatedWrite`, and every call whose target resolves to `WriteIncidentRegistry.record` | 1 definition, 17 imports, **23 calls**, **0 re-exports**, **0 references that escape as a value**. One `uncompensatedWrite` property, the definition's own body (`DispatchOutcome.ts:307`). **Two recorders**: `guardAgainstThrowing.ts › guardCommand` and `evidenceRename.ts › evidenceRenamed` | `fixture/` has a renamed re-export, a namespace call, a renamed import, a `.vue` caller, a function held in a variable, a hand-built stamp, a `record` call on the registry and one on an unrelated object, and a comment and a string that spell the call. It reported 4 calls (re-export, namespace, rename, `.vue`), the held function as a value escape, the hand-built stamp, and exactly one `record`. It reported nothing for the comment or the string | Calls made through a variable (flagged as a value escape and then read by hand; there are none in `src/`). A stamp built with a computed key. Anything outside `src/`. A `.vue` template expression, which is not a script block. `.vue` line numbers are relative to the script block |
| `refs.mjs`: the TypeScript language service's `findReferences`, over the same `src/` program | Every constructor call and factory call of each class and function on a raise path (§3) | Checked live, and it found its own limit: on `ObsidianPlanRepository.delete` it returned only the definition, because that class does not declare `implements PlanRepository` | A class that satisfies a port structurally, without declaring it. `decls.mjs` covers that case |
| `decls.mjs`: for each member name, every declaration that a call `x.save(…)`, `x.delete(…)` or `x.insert(…)` in `src/` resolves to | Every call to a stamping repository method resolves to a PORT interface. The only callers: `ZoneRepository.save` from `CreateZone`, `EditZoneDetails`, `RenameZone`, `MoveSpatialObject` and `restore-zone`. `ZoneRepository.delete` from `DeleteZone` and `ReversibleDeleteZoneCommand.removeAgain`. `PlanRepository.save` with `'absent'` from `CreatePlan` only. `PlanRepository.delete` from `DeletePlan`. `AssetRepository.delete` from `DeleteAsset`. **0 unresolved calls** | `fixture2/` has an interface call, a type-literal call, a class call, a destructured method, an element access, an `any` receiver and a comment. It saw the first three, reported the `any` call as unresolved, and did not see the destructured method, the element access or the comment | A destructured method and an element access. So `git grep` was run for `['save']`, `['delete']`, `{ save } =`, `{ delete } =` and for `.save`/`.delete` passed as a value, over `src/`. It found nothing |
| Reading each hop from a raise site to a door, cited below by file and symbol. Hops that reading could not settle were driven in the suite (§4) | The path column in §3 | — | Dispatch through a runtime-built object that none of the three scripts sees. The composition in `src/plugin/` was read for each door instead |

**What this census cannot see at all.** Code outside `src/`, which includes the owner's
`tests/e2e/`. A raise path reached only in Obsidian. Whether Obsidian can actually produce the
concurrent sequence §4.6 names. `markUncompensated` has 23 calls and no alias, so the site count
is a census and not a sample. The path column is a reading, and 7 of its hops were driven (§4).

## 3. The census

"Recorded" means the error that carries the stamp returns to one of the two recorders without
being rebuilt. "Guarded door" means a `guardCommand` product built in `src/plugin/`. "History"
means `CommandHistory`, dispatched by the Plan editor's or Asset designer's runtime. Neither
history nor `withSaveStateTracking` nor `withIncidentGate` records anything.

| # | File › symbol | Raised when | Path to a door | Recorder |
|---|---|---|---|---|
| 1 | `reference/deleteResolution.ts` › `requirementResolutionSteps.markStalePersisted` | The stale-marker write landed and the re-read failed (one failure) | `runDeleteResolution` ← `DeleteZoneCommand` / `DeleteAssetCommand` ← guarded `deleteZone` (`guardedServices.ts › guardedEditorServices`) / guarded `deleteAsset` (`guardCatalogueRequirements`). Also reached through `ReversibleDeleteZoneCommand.execute`, which calls the guarded `deleteZone` | `guardCommand` |
| 2 | `reference/deleteResolution.ts` › `compensate` | A resolution step or the entity delete was refused, and a compensation was refused too | Same as #1 | `guardCommand` |
| 3 | `commands/asset/SetAssetBackground.ts` › `SetAssetBackgroundCommand.write` | The note save was refused after the calibration clear landed, and the sidecar restore was refused too | `guardAssetDesign › setBackground` (both doors), which the designer's `ReversibleAssetBackgroundEdit.execute` calls | `guardCommand` |
| 4 | `commands/plan/ConfigurePlanReference.ts` › `ConfigurePlanReference.write` | The geometry write failed after the plan save landed, and the plan restore failed too | `guardedReferencePlan` (both doors), wired at `planEditorDeps.ts`. `unavailablePlanEditorCommands` builds one over ports that refuse every call, so its first read refuses and it cannot reach the stamp | `guardCommand` |
| 5 | `commands/renovation/RenovationCommand.ts` › `refusal` | The command was retired by #6 and is called again | `guardedRenovation` (both doors), wired at `planningEditorServices.ts` | `guardCommand` |
| 6 | `commands/renovation/RenovationCommand.ts` › `write` | The geometry write failed after the plan save landed, and the plan restore failed too | Same as #5 | `guardCommand` |
| 7 | `commands/renovation/MaterialCommand.ts` › `run` | The command was retired by #8 and is called again | `planning.material` (both doors are guarded in `planningEditorServices.ts`), or inside #9/#10's command, which `guardedRenovation` wraps | `guardCommand` |
| 8 | `commands/renovation/MaterialCommand.ts` › `confirmGeometry` | The geometry confirm failed, and the requirement put-back failed too | Same as #7 | `guardCommand` |
| 9 | `commands/renovation/ConstructionMaterialCommand.ts` › `refusal` | The command was retired and is undone again | `constructionAwareRenovation` inside `guardedRenovation` | `guardCommand` |
| 10 | `commands/renovation/ConstructionMaterialCommand.ts` › `putBack` | A step failed, and a put-back failed too | Same as #9. `putBack` returns `err(error)` with the stamp intact (ADR-0034, correction of 2026-09-19) | `guardCommand` |
| 11 | `commands/spatial/composedSteps.ts` › `restoreSteps` | A composed step failed, and a compensating step failed too | `DeleteSelectionCommand` (built in `presentation/editor/elements/spatialRemoval.ts › remove`) and `PasteCommand` (`presentation/editor/clipboard/clipboardActions.ts › paste`) → `runtime.dispatcher.run` → history. On the first run, and on undo and redo through `walkSteps` | **none** |
| 12 | `commands/spatial/runSpatialCommand.ts` › `runSpatialCommand` | The command was retired by #13 or #14 and is called again | `guardedStructure` / `guardedGroups` (both doors), wired at `planEditorDeps.ts` | `guardCommand` |
| 13 | `commands/spatial/GroupGeometryCommand.ts` › `write` | An event publish threw after the geometry write landed. This cannot happen with the real bus, because `createEventBus().publish` catches every handler failure and never rejects (read) | `guardedGroups` | `guardCommand` |
| 14 | `commands/spatial/StructureCommand.ts` › `recovery` | Room restore failed after a failed write; room undo failed and the re-write failed; or the re-read after a room undo did not match the baseline | `guardedStructure` | `guardCommand` |
| 15 | `reference/undoDeleteResolution.ts` › `rollBack` | A requirement restore was refused, and a compensation (`removeAgain`, or an earlier requirement put-back) was refused too | Only caller: `undoDeleteResolution` ← `ReversibleDeleteZoneCommand.undo` (built by `presentation/editor/add/createZoneHistory.ts › deleteZoneHistory` from `inspector-wiring.ts` and `spatialRemoval.ts`) → history | **none** |
| 16 | `commands/zone/reversible-delete-zone-command.ts` › `undo › restoreEntity` | The boundary restore was refused, and the zone re-delete (`removeAgain`) was refused too | Same as #15 | **none** |
| 17 | `editor/asset/ReversibleAssetDesignCommands.ts` › `ReversibleAssetBackgroundEdit.undo` | **One refusal**: the sidecar restore was refused after the note restore landed | `ReversibleAssetDesignCommands` ← `presentation/designer/designerCommands.ts › createAssetDesignerCommands` over the raw `persistence.assetGeometry` / `persistence.assets` ports (`assetDesignerDeps.ts`) → the designer's history | **none** |
| 18 | `infrastructure/.../noteEntityWrite.ts` › `trashNoteBackedEntity` | The second-file delete was refused after the note was trashed, and the note restore was refused too. Only the asset caller supplies `alsoRemove`, so only it can reach this | `AssetRepository.delete` ← `DeleteAssetCommand` only (`decls.mjs`) ← guarded `deleteAsset` | `guardCommand` |
| 19 | `infrastructure/.../ObsidianPlanRepository.ts` › `insertNew` | The note create failed after the sidecar was created, and the sidecar delete failed too | `PlanRepository.save(…, 'absent')` ← `CreatePlan` only. Every other caller passes a version, and `checkExpectedVersion` refuses a missing note under a version ← guarded `createPlan` | `guardCommand` |
| 20 | `infrastructure/.../ObsidianPlanRepository.ts` › `delete` | The sidecar delete failed after the note was trashed, and the note restore failed too | `DeletePlan` only ← guarded `deletePlan` | `guardCommand` |
| 21 | `infrastructure/.../ObsidianZoneRepository.ts` › `compensateFailedSidecarWrite` | The sidecar mutate failed after the note write landed, and the note restore (update) or note delete (insert) failed too | **Recorded** through the guarded `CreateZone`, `EditZoneDetails` / `ReversibleRenameZoneCommand` (`guardZoneEdit`, both doors) and `MoveSpatialObject`. **Unrecorded** through `restore-zone.ts › restoreZone`: when `ReversibleDeleteZoneCommand.undo › restoreEntity` restores the zone, and on the REDO of a drawn Room (`ReversibleCreateZoneCommand.execute`'s second branch) or a pasted Room, all dispatched by history. **Recorded again** when that `ReversibleCreateZoneCommand` is the `room` inside a `StructureCommand`, which `guardedStructure` wraps | **mixed** |
| 22 | `infrastructure/.../ObsidianZoneRepository.ts` › `delete` | The sidecar remove failed after the note was trashed, and the note restore failed too | **Recorded** through the guarded `DeleteZone`. **Unrecorded** through `ReversibleDeleteZoneCommand.removeAgain`, which is reached only as the compensation inside #15 or #16. Both of those raise their own stamp over it, so this stamp never leaves by itself | **mixed** |
| 23 | `infrastructure/.../relocateEvidence.ts` › `abort` | **Any refusal after one or more plans were saved** (one failure) | `evidenceRename.ts › evidenceRenamed`, called by `RenovationPlannerPlugin`'s `vault.on('rename')` listener for every rename in the vault | `evidenceRenamed`'s own recorder |

**The records' named sites are confirmed**: `undoDeleteResolution.rollBack` (#15), `restoreSteps`
(#11), `ReversibleDeleteZoneCommand.undo › restoreEntity` (#16), and the fourth site, which no list
named: `ReversibleAssetBackgroundEdit.undo` (#17). **Two more sites have unrecorded paths and are on
no list**: #21 through `restoreZone`, and #22 through `removeAgain`, which is always under #15 or
#16. The owner document says "undo is where this lives". That is narrower than the code: #11 is
reached on the FIRST run of a multi-element delete or a paste as well as on undo and redo, and #21
is reached on a redo.

## 4. Phase 2 — can each unrecorded site fire on a healthy vault?

Probes: `tests/plugin/undoStampOnHealthyVault.test.ts` and
`tests/plugin/designerUndoStampOnHealthyVault.test.ts` are committed. The fuller scratch versions,
which also assert what stays unrecorded and drive the concurrent case, are in
`D:/tmp-rp/s21-q1/probes/`. Their run is in `D:/tmp-rp/s21-q1/probes/run-full.txt`, where
18 of 18 pass.

The rig is composed the way `planEditorDeps.ts` and `assetDesignerDeps.ts` compose it: the real
repositories over the fake vault, guarded inner doors (`guardCommand`, `guardedStructure`,
`guardedRenovation`, `guardedGroups`, `guardAssetDesign`), raw zone and asset ports, one
`CommandHistory`, and a real `WriteIncidentRegistry` installed. The fake vault resolves
synchronously, faster than Obsidian's, so every "clean on the healthy door" result below covers
one serialised leaf and cannot produce a natural interleaving on its own. **The healthy door**
runs each gesture five times through the history (run, undo, redo, undo, redo) and asserts three
things: all five dispatches answered `wrote`, none was refused, and the registry has nothing
open. **The positive recorder control** sends the same repository stamp (#22) through the GUARDED forward
delete and asserts that the registry records it, which shows the registry check can see a
recording. Each fault case also asserts which entities the stamp names, so each stamp is tied to
the site that raised it. For example, #15 names no entities, and #16 names the zone and the plan.

**The axis the Classification column states.** "Only on a genuinely half-written vault" names an
axis — **a stamp over a coherent vault** versus **a truthful stamp** — not a claim that these five
sites were driven under a peer write landing mid-gesture. They were not: each of #11, #15, #16,
#21 and #22 was driven only with an injected PORT failure, never with a second leaf or an external
writer in the mix. The one peer-interleaving drive on this axis is for #11, fault-free, from the
S21 review round (`e5f649398`): one peer plan-geometry write inside a multi-element delete's undo
compensates cleanly with no stamp, and two peer writes produce a stamp over a genuinely
half-written vault (the walls are back and the Room is absent) — so for #11, that drive found the
stamp truthful when it fires.

| Site | Healthy door (a) | Fault injected (b) | Recorded? (driven) | Classification |
|---|---|---|---|---|
| #11 `restoreSteps` | No stamp across 4 gestures: delete a Room plus 2 walls; delete two grouped Rooms; paste two Rooms plus walls plus a group; and a Room with a boundary, a group and a requirement. Each was run, undone, redone, undone and redone. The existing `deleteSelectionCommand.test.ts` and `pasteCommand.test.ts` also drive benign first-step refusals, with no stamp | Undo of the multi-element delete: the Room restore (`zones.save`) is refused and the walls re-delete (`plans.save`) is refused → stamped, no entities named | **No**: the registry stays empty | Only on a genuinely half-written vault (two writes must fail) |
| #15 `rollBack` | No stamp: delete a bounded, grouped Room with one requirement (`remove-references`), and cycle it | Requirement restore refused + `zones.delete` refused → stamped, no entities named. With the requirement restore refused alone, the undo compensates and raises no stamp | **No** | Only on a genuinely half-written vault |
| #16 `restoreEntity` | Same healthy run as #15 | `RoomBoundaryHistory.restore` refused + `zones.delete` refused → stamped, naming the zone and the plan | **No** | Only on a genuinely half-written vault. The first refusal can be a logic refusal from the boundary restore (`boundary-missing`, `group-restore-conflict`). The second has to be a refused zone delete |
| #17 `ReversibleAssetBackgroundEdit.undo` | No stamp, with a calibration and without one | `sidecar.write` refused → stamped, naming the asset | **No** | **Also on a healthy vault** (§4.6) |
| #21 via `restoreZone` | No stamp: delete undo (above), and drawing a Room then undoing and redoing it | Fake-vault `modify:<sidecar>` + `delete:<note>` → `zone.sidecar-insert-uncompensated`, naming the zone and the plan, on a delete UNDO and on a draw REDO | **No** on both paths | Only on a genuinely half-written vault (two vault operations must fail) |
| #22 via `removeAgain` | Same healthy run as #15 | Not driven by itself. Its only unrecorded path is the compensation inside #15 and #16, which were driven with `zones.delete` refused at the port. The repository's own two-failure arm was driven through the guarded door, where it IS recorded | Read | Only on a genuinely half-written vault (read). It is always wrapped by #15 or #16 |

### 4.6 The finding: #17 stamps on a healthy vault

No fault is injected. A peer leaf's ordinary guarded gesture (`setFacing`) lands between the
undo's pre-flight `sidecar.read` and its restoring `sidecar.write`. The same interleaving is
already driven by `tests/application/editor/reversibleAssetDesign.test.ts` › "reports an
uncompensated background undo when a peer writes the sidecar…". The restore is refused as
`asset-geometry.revision-conflict`, and #17 stamps. Measured state after the stamp, compared with
before the gesture:

| Asset before the gesture | After the stamped undo | Is the vault half-written? |
|---|---|---|
| No calibration | Note background `null` = before. Calibration `null` = before. The only change is the peer's own facing write | **No.** The stamp is raised over a vault that holds its pre-gesture state |
| Calibrated | Note background restored. **Calibration lost** | Yes. The stamp is true |

The calibrated row's stamp is truthful, but the vault it leaves is still a LEGAL one — an
uncalibrated asset over its old background, not a corrupt one — so under option 2 a lost
calibration would pause every write in the vault until a reload, the same as the false stamp does,
for a loss that is real but narrow.

Why it can happen: #17 is the only unrecorded site whose condition is ONE refused write. The
other five each need a second refused write. The site stamps whenever the sidecar restore is
refused after the note landed, and it does not ask whether that restore would have changed
anything the note depends on. What reaches it, by a single user, inside one undo's read-to-write
window (that window spans the note save):

- **Driven**, in the S21 review round (`e5f649398`): a **second designer leaf of the same asset**
  — a split pane — running its own guarded gesture (`setFacing`) on that leaf's own history; the
  **asset deleted** while the window is open, which stamps naming the deleted asset; and a
  **byte-only rewrite of the `.rpgeo` sidecar** (a reformatting sync, semantically identical JSON),
  which stamps as `asset-geometry.external-modification`.
- **Established by reading only**, not driven: the **Asset library's own**
  `setAssetFootprintFromDimensions` (`assetLibraryDeps.ts`), which writes the same sidecar through
  the same guarded command family as the peer writes above.

So this is not a second-device or sync-only case: one user, with a split designer pane or the
Asset library open beside the designer, can reach it. **Not reached within one leaf's history**
— `CommandHistory` serialises run, undo and redo through one queue, and the designer's tools and
`editShape` go through that history — where all the healthy cycles were clean (again, only for
that one serialised leaf: the fake vault is synchronous, so it forces every interleaving rather
than letting one arise). Whether Obsidian can produce any of these interleavings in practice is
not checkable here.

Under option 2 (record inside `markUncompensated`), this stamp would become a vault-wide write
block, and the only way to clear one is a reload (D-06).

## 5. The unasked check: a RECORDED site already pauses a coherent vault

`relocateEvidence` (#23) stamps on ONE refusal after any plan was saved. Every plan is read,
before its evidence is even checked (`relocateEvidence.ts`, the loop's first two lines), and
`evidenceRenamed` records the stamp. Driven in scratch
(`D:/tmp-rp/s21-q1/probes/q1StampProbeDesigner.test.ts`, last case). The vault has plan A, which
carries evidence `Evidence/one.pdf`, and plan B, which carries none. Plan B's note is hand-edited
to `schema-version: not-a-number`, and plan listings skip that as note-local
(`SKIPPABLE_PLAN_CODES`). Renaming the folder `Evidence` → `Archive` moves A's evidence correctly,
then B's read refuses. **A vault-wide incident opens**: `plan.schema-version-malformed`, naming
plan A, which was the plan correctly updated. The vault's data is coherent, and every guarded
write is paused until a reload. This happens today, with no option taken. It is the same risk
option 2 carries, and it needs only a hand-edited plan that comes later in index order than a
plan citing the renamed path. If the unreadable plan comes first, the loop stops before writing,
no stamp is raised, and the plans after it are never updated.

**It is broader than one hand-edited plan.** Three codes open the same vault-wide incident on any
rename, all treated as ordinary and skippable by `listByProject`
(`ObsidianPlanRepository.ts:72-81`), and all driven in the S21 review round (`e5f649398`):

- `plan.schema-version-malformed` — plan B's hand-edited, non-numeric `schema-version`, the case
  reproduced above.
- `plan.sidecar-unreadable` — plan B's geometry sidecar missing. That is a **sync-lag** route: a
  sync that delivered the note before its sidecar, or a sidecar the user deleted.
- `plan.schema-version-unsupported`, in the `Migration` category — a plan note written by a
  **newer** version of the plugin. That is a **version-skew** route: a second device ahead on
  version.

So the trigger is not only a hand edit: ordinary sync lag and ordinary version skew reach the same
incident, through the same door (`RenovationPlannerPlugin.ts:990-993`, which calls
`evidenceRenamed` on EVERY rename in the vault).

**Since `9ba3432a2` (owner ruling 14),** a rename skips a plan any of these three codes refuses and records it in the diagnostics ledger, so none of them opens an incident or raises a failure notice. `plan.migration-failed` is the one read refusal the skip does not cover: a plan answering it still stops every rename at that plan with a failure notice, as before. It fails closed on purpose, and the ruling does not reach it.

## 6. What this does not decide

- The owner chooses among `05-owner-decisions.md` §3's options. This document ranks none of them.
- Nothing here ran in Obsidian. Whether the §4.6 interleaving happens in a real vault, and how
  often, is not established here.
- §4's classifications for the five two-failure sites come from the drives in §4 and a reading
  of each branch. They do not prove that no healthy sequence exists. A compensating step's own
  refusals (`undo.superseded`, the incident gate's `writes-paused`, a boundary logic refusal) are
  the places a benign second refusal would come from. None of those was observed on the driven
  gestures.
- The committed probes pin what a fix has to keep: a healthy undo raises no stamp and records
  nothing. Beyond that, the two probe files pin two different shapes. The five two-failure sites'
  positive controls (`undoStampOnHealthyVault.test.ts`) still raise their stamp when both refusals
  named in §4's table are injected. The designer's positive control
  (`designerUndoStampOnHealthyVault.test.ts`) is a ONE-refusal control, because #17's own condition
  is one refused write — it pins the CURRENT mechanism, not a requirement, and a correct #17 fix
  (restoring the sidecar first, say) may legitimately remove that stamp arm. They deliberately do
  NOT pin that these stamps stay unrecorded, or #17's concurrent stamp. Both are true today, and
  both are what the owner's choice may change.
