# Task report — AD12

Outcome: **partially implemented** — four of the card's six work items landed, one is a
recorded finding that nothing is owed, and one is a read-only investigation returned as context.
Four of six acceptance criteria are met by code and tests, one is met by construction (nothing
built), one is met only in part.

Owner / worktree / branch: AD12 worker ·
`D:\Projects\renovation-planner\.claude\worktrees\renovation-planner-asset-designer-bc5539\.worktrees\ad12` ·
`ad12-reference`

Base commit / candidate commit: `c5436082d` / **the single commit on `ad12-reference`,
`c5436082d..ad12-reference`** — its SHA is deliberately not written here, because this report is
INSIDE that commit and a hash cannot name the object that contains it. `git rev-parse ad12-reference`
is the candidate; the worker's handoff message carries the value it had at handoff.

Accepted contract revision: **`r1`**

Allowed scope and shared-file leases: the designer's clearance/anchor/background layers, the
set-anchor and set-facing tools, `CalibrateAsset.ts` and the asset background/calibration
commands, `DesignerInspector.vue` plus NEW `DesignerReference*` / `DesignerClearance*`
components in that directory, `assetBackgroundPicker.ts`, `{en,de}/assetReference.ts`,
`styles/designer-selection.css`, and any NEW file under `tests/`. **One edit fell outside the
literal lease and is disclosed below**: `tests/presentation/designer/designerInspector.test.ts`,
the existing test for a component that IS in the lease.

## Changed files and reason

| File | Purpose | Within lease? |
|---|---|---|
| `src/presentation/designer/inspector/DesignerReferenceFrame.ts` | NEW. The pure facing frame: `facingQuarter`, `anchorPresetPoint`, `currentAnchorPreset`, `rectangularFootprint`, `clearanceRectangle`. Imports only `core/geometry` | Yes — new `DesignerReference*` module in the leased directory |
| `src/presentation/designer/inspector/DesignerReferenceStatus.vue` | NEW. Read-only reference status: sheet, scale, one line per pending coordinate group | Yes |
| `src/presentation/designer/inspector/DesignerReferencePlacement.vue` | NEW. Placement point (centre / back centre / custom readout) and the front direction in words | Yes |
| `src/presentation/designer/inspector/DesignerClearanceHelper.vue` | NEW. Four-side helper that GENERATES a boundary, withheld for unsupported geometry | Yes |
| `src/presentation/designer/inspector/DesignerInspector.vue` | Mounts the three blocks after the height field, with a comment on the ordering | Yes — explicitly leased |
| `src/presentation/i18n/locales/en/assetReference.ts` | 33 new keys (counted, not remembered: `grep -c "^	'designer\."`). Was an empty scaffold | Yes |
| `src/presentation/i18n/locales/de/assetReference.ts` | The same 33 keys in German, the count checked against English by the same grep and by the `Record<keyof …>` type | Yes |
| `styles/designer-selection.css` | `.rp-designer-reference`, `.rp-designer-placement`, `.rp-designer-clearance` (one grouped rule) and `.rp-designer-reference-fields` + its `dt`/`dd`. 181 lines, under the 400 cap | Yes |
| `tests/presentation/designer/designerReferenceFrame.test.ts` | NEW, node. 33 cases over the pure frame, including the anchor/facing fixtures at 0/90/180/270 and under mirroring | Yes |
| `tests/presentation/designer/designerReferencePanels.test.ts` | NEW, jsdom. 33 cases over the three components bare, the last through the real `DesignerInspector` | Yes |
| `tests/application/commands/asset/assetReferenceReplacement.test.ts` | NEW. Pending flags and coordinates survive a background replacement | Yes |
| `tests/presentation/designer/designerInspector.test.ts` | **Outside the literal lease.** One assertion narrowed — see below | **No** — disclosed as an integration change |

### The one out-of-lease edit, in full

`designerInspector.test.ts`'s case *"heads the asset's own block, after the selected part's
section when there is one"* asserted `findAll('h3')` equalled exactly `['Asset']`. That is an
enumeration of the inspector's SIBLINGS, not of the ordering the case exists to hold, so three new
sections below the asset block turned it red while its subject was untouched. It is now
`headings(null)[0]` and `headings({kind:'footprint'}).slice(0, 2)`, with a docblock recording the
narrowing and why. Nothing else in the file changed.

The second failure that surfaced was closed inside the lease instead: the case *"draws no
dimensions block at all for a shapeless asset"* asserts no `.rp-designer-inspector-fields` exists,
and the new readouts had reused that class. They carry `.rp-designer-reference-fields` now — a
different subject (a reference readout is not the asset's derived dimensions), so the existing
assertion is left exactly as it was.

## Acceptance coverage

| Criterion/test ID | Result | Exact evidence | Remaining issue |
|---|---|---|---|
| Asset calibration does not modify any plan calibration or already measured coordinate group | **Met, pre-existing** | `tests/application/commands/asset/calibrateAsset.test.ts` — *"touches no plan and no other asset"*, *"converts a pending clearance and leaves a typed footprint alone"*, *"clears each flag it converts, and only those"*, *"rescales nothing on a second calibration"*. `CalibrateAsset.rescaled` gates every group on its own stored flag. Nothing in this change touches that path | None. No new test was added because the criterion was already covered at four points; adding a fifth would be a second answer |
| Back centre is actually opposite the displayed front, including after rotation/mirroring | **Met** | `designerReferenceFrame.test.ts`: back centre at all four quarters against exact expected points; *"keeps back centre opposite the drawn front at %s"* over six facings, asserted as a NEGATIVE dot product against `anchorLayer.facingTip` — the point the arrow really reaches — not against a re-derived angle; *"sets back centre half the facing-frame span back"*; *"mirrors back centre when the outline and the front are mirrored"*. Component level: `designerReferencePanels.test.ts` *"moves the anchor to the back of the facing frame, and changes nothing else"* | None |
| Replacing/deleting a reference does not silently mark measured geometry unscaled or erase pending warnings | **Met for REPLACING. Deleting has no code path to test** | NEW `assetReferenceReplacement.test.ts`: *"leaves every pending flag exactly as it was"* (all four flags, graphics included) and *"moves no coordinate, while dropping the scale measured off the document being replaced"*. The opposite direction was already held by `setAssetBackground.test.ts`'s *"does NOT re-flag an already-measured outline"*. The warning is now VISIBLE for all four groups, not just the footprint (`DesignerReferenceStatus`) | `SetAssetBackgroundInput.path` is a `string` with no null arm, so a reference can be swapped and never removed. The criterion's "deleting" half describes a door that does not exist. Recorded as a card/scope gap, not built — a removal door is a new command surface with its own calibration and pending-flag decisions |
| Resize never weakens a clearance silently; a required review survives reopening | **Partially met, and the unmet half is PARKED by r1** | `scaleDesign` (`domain/asset/shapeEdits.ts`) scales the clearance about the anchor with every other outline, so a resize preserves the boundary proportionally rather than dropping it — held by `tests/domain/asset/shapeEdits.ts`'s existing scaling cases. A clearance GENERATED here inherits `footprintPending`, so it cannot be presented as measured when it is not | "A required review survives reopening" needs a persisted review state. **See the finding below: none is owed at r1.** DECISIONS.md r1 row 2 parks C07's refusal arm with its own trigger, and states that trigger is not this increment |
| No green "fits well" or compliance claim is produced from a visual preview | **Met by not building one** | AD01 §3 defers the green fit badge and the north compass permanently. `en/assetReference.ts` declares no key containing "fits", "compliant", "verified" or "approved"; the helper's own hint reads *"They are your own allowances, not a standard."* and C07's *"authored planning boundary, not a regulatory approval"* is quoted in that module's docblock | None |
| Height remains descriptive; no vertical clash calculation is introduced | **Met by not building one** | The height field in `DesignerInspector.vue` is untouched. `grep -n 'height\|Height'` across the four new source files prints **nothing at all** — no new module reads `design.height` or computes anything from it. The inspector's own comment above the three blocks states that the ordering is not the start of a clash check | None |

### Card items

1. **Guided reference sequence** — *partially*. The sequence's STATE is now legible
   (`DesignerReferenceStatus`: sheet, scale, which groups are still sheet pixels, and the hint
   naming calibration as the step that converts them). The steps themselves already had exactly
   one door each (`assetBackgroundPicker.ts`, the Calibrate tool, the drawing tools), and adding a
   second activation beside any of them would break CLAUDE.md's "one action, every input" rule.
   **"Lock reference" and background opacity are NOT built** — see the integration request below.
2. **Placement point and Front direction labels** — *done*. Centre / back centre / custom, mapped
   through the shipped facing convention.
3. **Footprint, graphics and clearance displayed distinctly** — *already true, nothing built*.
   `footprintLayer.ts` draws the footprint solid, `clearanceLayer.ts` draws the clearance dashed
   with its own argument for the pairing, `detailsLayer.ts` draws the graphics. Arbitrary traced
   clearance polygons are preserved: the helper generates and never reads back, pinned by *"never
   turns an existing boundary into four numbers"* and *"leaves the traced boundary alone until the
   button is pressed"*.
4. **Rectangular-clearance helper** — *done*, generating only, withheld for unsupported geometry,
   with the "these are your own allowances, not a standard" hint.
5. **Persisted review state** — *not built; see the finding*.
6. **Plan-placement transform behaviour** — *investigated, nothing changed; see the context
   returned below*.

## The finding: no persisted review state is owed at r1

**Conclusion: AD01 does not require one, so not building one is the correct outcome rather than a
shortfall.** The citations, in the order they settle it:

- **AD01 §1, row S09** reads: *"exists. `clearanceLayer.ts`, `anchorLayer.ts`, set-anchor and
  set-facing tools, height in the inspector. **No numeric four-side clearance helper, no explicit
  review state**"* — in the **Today** column, whose own header says *"Every 'today' column below is
  read off the code at that baseline"*. That is a statement of FACT about the baseline, not a
  requirement. AD01 nowhere else names a review state, and §3's board rulings do not mention one.
- **C07** says *"AD01 chooses the minimal persistent review representation that fits current
  storage"*. AD01 did not choose one. A contract clause delegating a choice to a document that did
  not make it leaves nothing for this card to implement.
- **DECISIONS.md r1, row 2** then parks the whole question: *"Scaling a pending clearance with
  everything else stays as it is, parked with its trigger. The trigger is the increment that
  decides whether a pending group is exempt from every scale."* The dispatch brief states that
  increment is not this one.
- The lease makes it unbuildable anyway, and correctly so: a durable review flag is a new
  `AssetShape` field, which needs `domain/asset/AssetShape.ts`, the DTO schemas, the sidecar
  mappers and the **schema-version literal** — all four explicitly outside AD12, and C09 requires
  the next version number for any new durable field.

What AD12 ships INSTEAD, and it is not a hedged review state: the pending flags that already exist
are now all four VISIBLE and survive a background replacement (tested). That is the honest,
already-persisted answer to "these numbers are not millimetres yet".

## Executed checks

Environment for every row: Windows 11, Node from the worktree's own `node_modules`, `TEMP`/`TMP`
redirected to `D:/tmp-claude` (the C: volume has no free space), tree at `e03b5e39c` unless the row
says otherwise, **another worker active on the same box throughout**.

| Command or manual action | Commit / environment | Exit code or observed result | Evidence |
|---|---|---|---|
| `npx vue-tsc -noEmit` | candidate tree | **0** | Whole program, `src/**` + `tests/**` |
| `npx eslint <all 12 changed files> --max-warnings 0` | candidate | **0** | Includes the Vue ruleset, the layer bans, `I18N_LITERAL_BAN`, `NOTICE_TEXT_BAN` |
| `npx oxlint src tests styles --deny-warnings` | candidate | **0** | — |
| `npx vitest run tests/presentation/designer tests/application/commands/asset` | candidate | **0** | **72 files, 1019 tests passed**, 174.80s |
| `npx vitest run tests/harness tests/application/commands/asset` | pre-final tree, same source | **0** | **48 files, 574 tests passed**. Covers `tests/harness/accessibility*.test.ts` (axe-core over the real mounted designer) |
| `npx vitest run tests/build/{libraryComponentStyles,localeModuleSentenceCase,styles,prototype-styles}.test.ts` | pre-final tree | **0** for all four | Class declaration, English sentence case, stylesheet assembly + 400-line cap + colour check |
| `npx vitest run tests/build/i18n-literal-boundary.test.ts` | pre-final tree | **1 (twice), then 0** | `beforeAll` timed out at 60000ms under default parallelism, **twice**, including on its own. Passed in **46.06s** under `VITEST_MAX_WORKERS=1`. This is the load artifact CLAUDE.md documents; **no budget was raised** |
| Mutation: `anchorPresetPoint`'s back edge `box.min.x` → `box.max.x` | candidate source | **12 cases red** | See "watched failing" below |
| Mutation: `DesignerClearanceHelper`'s `supported` → `true` | candidate source | **2 cases red** | See below |
| Mutation: `SetAssetBackground` clears every pending flag on the swap | temporary, reverted | **1 case red** | See below |

### Cases watched failing, and what each red said

- **`anchorPresetPoint` returning the facing frame's `max.x` instead of `min.x`** (back centre
  becomes front centre): 12 red. *"puts back centre on the far side of the box at facing 0 / 1.5707… / 3.1415… / 4.7123…"*
  (four, each `expected 1000 to be close to 0` and the like), *"keeps back centre opposite the
  drawn front"* at all six facings (`expected 44000 to be less than 0` — the projection against
  `facingTip` came back positive), *"mirrors back centre …"*, and *"names the preset an anchor is
  sitting on"*. Restored and re-run: **33/33 green**.
- **`DesignerClearanceHelper.supported` forced to `true`** (the helper offered for geometry it
  cannot handle — the "live control that can only refuse" defect): 2 red, *"withholds every field
  for a curved outline and says what it needs"* and *"withholds every field while the front points
  between two axes"*. Restored: 25 of 27 green became 27 of 27 at that point; the file holds 33 cases now.
- **`SetAssetBackground` clearing every pending flag alongside the calibration**: 1 red, *"leaves
  every pending flag exactly as it was, so no warning is erased"* —
  `expected { …(10) } to match object { footprintPending: true, …(2) }`. The command file was
  copied out, mutated, and restored; `git diff --quiet` confirmed the restore before the commit.
- **Three cases were watched failing as they were WRITTEN**, each on a real fact the first draft
  had wrong, and each comment in the file records it: (a) `validateAssetShape` refuses a TYPED
  footprint that claims to be pending, so two fixtures asserting a derived flag read the fixture's
  own untouched `false` until they said `footprintOrigin: 'traced'`; (b) pulling a rectangle's two
  sides in by MORE than half its depth does not collapse it — it turns it inside out and the result
  still encloses an area, so the refusal case landed both edges exactly on y = 0 instead; (c) the
  two `designerInspector.test.ts` failures described above.

### Arms read for, and the case covering each

Coverage could not be run (see below), so every branch in the new code was read and named:

- `facingQuarter`: the fold arm (*"reads a facing just under a full turn as quarter 0"*), the
  no-fold arm (the four cardinal cases), the `null` arm (*"answers null for a front pointing
  between two axes"*).
- `facingBox`'s `boundingBoxOf` refusal: *"answers null for a footprint with nothing to measure"*,
  driven from a bare `{ points: [] }` polygon — the function's own contract, and a state a
  validated `AssetShape` cannot reach.
- `rectangularFootprint`: all five refusals have a case, **including both axes of the
  zero-extent guard** — the `y` half had no case until this was read for, and it now has one.
- `clearanceRectangle`: all four expansion branches are hit by the single facing-0 case; a second
  case at quarter 1 proves the frame turns.
- `DesignerReferencePlacement`: **three separate `shape === null` guards were collapsed into ONE
  `view` computed** during this read, because a `computed` is lazy and a null branch behind a
  `v-if` that never renders is a branch no test can enter — two of the three were unreachable by
  construction. The remaining one is covered by *"draws nothing for an asset with no shape to
  place"*. The `point === null` arm in `choose` has *"writes nothing for a footprint with no
  coordinates to measure"*; both operands of the no-op condition have a case, the second being
  *"writes when only the pending flag is wrong"*.
- `DesignerClearanceHelper`: the re-derivation guard inside the step (`current === null || turn === null`)
  is reached by *"writes nothing when a peer leaf made the outline unsupported since the fields were
  drawn"*, driven through an `advance` on the fake chain.
- `DesignerReferenceStatus`: `relevant`'s third operand has its own case (*"draws while a group is
  pending even with no sheet and no scale recorded"*), and the `shape === null` arm has
  *"names the sheet for an asset with nothing traced on it yet"*.

## Verification not performed

- **`npm run check`, `npm run test:coverage`, `npm run analyze` and `npm run build`** — the
  dispatch brief forbids running the full gate or any heavy leg on this box while a second worker
  is active. So: **the coverage floors (99/99/99/98) have not been measured against this change**,
  and **fallow has not been run** — which means no `unused-exports`, no clone-family report, and
  crucially **no template cognitive-complexity measurement on the three new SFCs**. Each template
  was deliberately kept shallow (one `v-if` at section level, one `v-for`, no nested conditionals
  inside the loops) and the pure logic was pushed into `DesignerReferenceFrame.ts` for exactly this
  reason, but that is an argument, not a measurement. **CI must run all four.**
- **The rest of the suite.** `tests/presentation/designer`, `tests/application/commands/asset`,
  `tests/harness` and four `tests/build` files were run. `tests/domain`, `tests/core`,
  `tests/infrastructure`, `tests/plugin`, `tests/release` and the remaining `tests/build` files
  were not. This change adds no domain, infrastructure or plugin code, and the one existing test
  file it edits is a designer one — but that is reasoning, not a run.
- **`tests/build/i18n-literal-boundary.test.ts` passed only under `VITEST_MAX_WORKERS=1`.** Its two
  default-parallelism runs timed out in `beforeAll`. Read that as a load result on a contended box,
  the way CLAUDE.md instructs; no budget was changed.
- **No real Obsidian.** `npm run test-build` was not run and no vault walkthrough happened.
  Appearance, theme behaviour in a themed vault, and how the three new blocks sit in a real
  inspector at a real leaf width are all **unverified**.
- **No browser harness and no screenshots.** `npm run harness`, `npm run harness-shot` and
  `npm run concept-shots` were not run; no pinned Chromium is available here and the brief forbids
  installing one. **So there is no picture of any of this**, and no measurement of spacing,
  wrapping, overflow, contrast or hit size in the three new blocks — the exact class of defect the
  captures exist to catch, and the one gate that has caught ten this repository's other four could
  not. A narrow-leaf capture (`-- --width=460`) is the specific one to take: the clearance helper
  adds four number fields to a column that already carries several.
- **Anchor and facing correctness after rotation and mirroring is NOT something a screenshot could
  have settled**, and is not left to one. It is a fixture exercise —
  `designerReferenceFrame.test.ts` asserts the back centre against `anchorLayer.facingTip`, the
  function that positions the arrow a person would look at, at four exact quarters, at two
  off-axis facings, and across a mirrored outline with a mirrored front. A picture shows one
  arrangement; the fixtures show the rule.
- **No migration, performance or multi-leaf host test.** No schema field was added, so there is
  nothing to migrate; two leaves editing one asset is already covered by the existing
  `designerCrossLeaf.test.ts`, which this change does not touch and which was run green as part of
  `tests/presentation/designer`.

## Data and integration implications

**Schema/migration change:** **none.** No new durable field, no schema-version change, no
migration. Everything written goes through `AssetShape` fields that already exist
(`anchor`, `anchorPending`, `clearance`, `clearancePending`), through `editShape` → the existing
`SetAssetShape` path.

**Relevant renderer/export/revision consumers:** per r1 row 4 the consumers are the authoring
canvas, the library mark and plan placement. This change writes an anchor and a clearance that
those three already read; it introduces no new geometry kind and no new coordinate meaning. The
generated clearance is an ordinary four-point `CurvedPolygon` with no bulges.

**Undo/no-op/conflict/failure coverage:** every gesture is one `editShape` call → one
`SetAssetShape` conditional on the version the step read → one history entry, on the leaf's single
write chain. A gesture that would change nothing answers `editShape`'s `null`, dispatches nothing
and pushes no undo entry (C05) — two cases assert the write COUNT, not the call count. A refusal
is shown in a `role="alert"` beside the controls and never swallowed. Version conflicts and
cross-leaf sequencing are the existing chain's, unchanged and untested by this card beyond what
`designerWriteChain.test.ts` and `designerCrossLeaf.test.ts` already hold.

**Identity/unit/quantity/calibration invariants:** the one new invariant is that a coordinate
DERIVED from the footprint inherits the footprint's coordinate space — `anchorPending` and
`clearancePending` are written as `footprintPending`, never left alone. That is C07's *"composite
transforms must not silently combine incompatible coordinate spaces"* at the two new derivations,
and each has its own case. Nothing here touches a calibration, a plan, another asset, or any
already-measured group. Millimetres remain canonical; the helper's four inputs are millimetres and
stay raw text until the button commits them (C03).

**Shared root/runtime/locales wiring still required:** **none for what shipped.** The three
components take only `design` and `editShape`, both already props of `DesignerInspector`, so no
change to `AssetDesignerRoot.vue`, `runtime.ts`, `ports.ts` or the store is needed. The locale
partials were already spread into `{en,de}/editor.ts`, so those two files need no edit.

**Rollback/recovery considerations:** reverting the commit removes three UI blocks and writes no
data anybody has to undo — any anchor or clearance authored through them is an ordinary anchor or
clearance. No forward-only step exists.

## Integration change requests

1. **`tests/presentation/designer/designerInspector.test.ts` — already applied, needs review.**
   One assertion narrowed from "the asset heading is the only `h3`" to "it is the first", with the
   reason in a docblock above the case. Applied rather than requested because leaving the branch
   red at handoff seemed worse, and because the component that file tests is in AD12's lease.
   Revert-and-re-request if the integrator disagrees; the case's subject is unchanged either way.
2. **Move `DesignerReferenceFrame.ts` into `domain/asset/`.** It is pure, imports only
   `core/geometry`, and is the kind of placement rule that belongs beside `shapeEdits.ts` — where
   `AssetPlacementTool` and the library mark could also reach it. It lives under
   `presentation/designer/inspector/` only because AD12's lease excludes every existing
   `domain/asset/` module and grants no new file there. Its own docblock says so. The move is a
   rename plus three import paths; nothing about it is Vue-aware.
3. **Background lock and opacity are NOT built** (AD01 §1 S04 names them absent and owes them to
   AD07 and AD12 jointly). They are unbuildable within this lease: opacity is view state that has
   to live in the runtime or the store (`runtime.ts`, `stores/assetDesignStore.ts`), the control
   belongs beside the other view controls (`DesignerViewMenu.vue`, AD06's), and the value has to
   reach `backgroundLayer.ts` through `DesignerCanvas.vue` — four files, none of them AD12's.
   Recommend assigning the pair to whichever owner holds the runtime and the canvas, as one item.
4. **"Lock reference" (card item 1) has no owner and no definition.** If it means "stop the sheet
   moving under a pan/zoom", that is a canvas concern; if it means "freeze the calibration against
   accidental recalibration", that is a command concern and a new refusal. Needs a ruling before
   anyone builds it.
5. **There is no door to REMOVE a reference**, only to replace one — `SetAssetBackgroundInput.path`
   is a bare `string`. AD12's third acceptance criterion names deleting. If that is wanted, it is a
   new command arm with its own answers about the calibration and the pending flags, and it should
   be scoped deliberately rather than inferred from the criterion's wording.

## Card item 6 — plan-placement transform context, returned rather than changed

Read and not modified, because nothing in it needed a change and `domain/spatial/assetPlacement.ts`
belongs to AD05:

- **The designer's facing convention and the plan's are the same number.** `AssetShape.facing` is
  radians anticlockwise from +x, normalised to `[0, 2π)` by `validateAssetShape`;
  `set-facing-tool.ts` writes `Math.atan2(dy, dx)` straight from a drag and
  `anchorLayer.facingArrow` draws `(cos, sin)` from the anchor with the y term ADDED. The
  designer's camera never flips y (`Viewport.sceneConfig` sets a positive `scaleY`), so +y is the
  bottom of the sheet on both surfaces.
- **That is the basis of the left/right derivation** the four-side helper needs, which neither
  shipped tool states: an object whose arrow points along +x has its own left toward −y, the top of
  the sheet — `facing − π/2`. It is written into `DesignerReferenceFrame.ts`'s header and pinned by
  a fixture against `facingTip` rather than asserted in prose.
- **The anchor is the placement point and also the scaling pivot.** `scaleDesign` scales every
  outline about `shape.anchor`, so moving the anchor with a preset changes what a later whole-object
  resize pivots around. That is correct and worth an integrator knowing: the two gestures are
  ordered, and doing them the other way round gives a different drawing.
- **r1 row 1 stands:** the designer keeps circular bulges and solves the typed extent numerically
  while the plan flattens arcs and stretches per axis. Nothing here changes either. The clearance
  helper only ever emits straight edges, so it adds no new arc to that divergence.

## Reviewer and integrator acceptance

Reviewer outcome and findings:

Integrated commit:

Post-integration checks/evidence:

Final status: integrated / verified / blocked

*Not filled by the worker. This report does not claim verification.*
