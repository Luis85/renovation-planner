# Task report — AD15

Outcome: **blocked**, with its recordable half executed and its matrix walked honestly
Owner / worktree / branch: integrator · `renovation-planner-asset-designer-bc5539` · same
Base commit / candidate commit: see the Executed checks section — this report is written across
several integration SHAs and names each where it matters
Accepted contract revision: `r1`
Allowed scope and shared-file leases: integrator-owned documentation only; this report changes no
source file

## Why this is `blocked` and stays `blocked`

AD15's four implementation items are end-to-end validation against a real vault. **There is no
Obsidian in this environment and no pinned Chromium**, so `npm run test-build` cannot be run, no
manual case under `docs/tests/` can be walked, and `npm run harness-shot` cannot capture anything.
Runbook §10 is explicit about what that means: hand over implemented work and the exact remaining
verification steps, and **do not label the beta ready**. This report does not.

What it DOES do is the half that needs no host: run the gates and the audit, and walk
`ACCEPTANCE-AND-QA.md` end to end recording every row as **passed**, **partial**, **structural**,
**none** or **not-run with the reason**. A matrix of honest not-run rows is the deliverable. A
matrix of optimistic rows is the failure this step exists to prevent.

**Every row's evidence was read rather than inferred from a file name.** Two claims from the
survey that produced this table were WRONG and are corrected below rather than carried — see
*Two survey findings disproved*.

## The grades, and what each one does not claim

| Grade | Means |
|---|---|
| **passed** | A test asserts the row's claim at or above the layer the row names. |
| **partial** | A test asserts something NARROWER than the row — a lower layer, or one half of a two-part claim. The gap is named in the row. This is the most common grade and the most useful one. |
| **structural** | The property holds by construction: the type or the pipeline carries nothing that could violate it. No case exists and adding one would assert the absence of something already impossible. |
| **none** | No instrument at all. |
| **not-run** | An instrument would need a host, a browser, a benchmark or a person, and this environment has none of them. |

**`passed` says a test exists and asserts the claim. It does not say the code is correct in
Obsidian** — nothing in this table was observed running in the host, and CLAUDE.md's own record is
that this repository's sharpest defects were fakes accepting what Obsidian refuses, with all gates
green.

## 1. Fixture catalogue F01–F12

**The named, immutable catalogue AD15 assumes does not exist**, and that is a finding rather than a
failure. The suite builds shapes in code through `tests/helpers/assetShapes.ts`,
`tests/helpers/arrangeShapes.ts` and `tests/helpers/assetDesign.ts`, and the only checked-in asset
geometry file in the tree is `tests/vault/valid-project/Library/Geometry/asset-designed.rpgeo`.

| ID | State | Evidence |
|---|---|---|
| F01 measured rectangle | **passed** (as a builder) | `tests/helpers/assetShapes.ts`; exercised throughout `tests/domain/asset/` |
| F02 composed vanity | **not-run** | A whole-workflow fixture is a vault scenario, not a unit fixture |
| F03 straight L-shape | **passed** (as a builder) | `assetDimensions.test.ts` "scales a calibrated L-shaped footprint instead of squaring it off" |
| F04 curved with off-centre anchor | **passed** (as a builder) | `shapeEdits.test.ts`, `scaleSolve.test.ts`, `partExtent.test.ts` |
| F05 measured + pending | **passed** (as a builder) | `arrangeDetails.test.ts`'s two-space cases |
| F06 open paths | **passed** (as a builder) | `openGraphicEdits.test.ts`, `designerDrawOpenLines.test.ts` |
| F07 interleaved groups | **passed** (as a builder) | `groupEdits.test.ts` "leaves interleaved members interleaved" |
| F08 legacy v1/v2 files | **passed — wave 14** | The v1 and v2 documents exist only as LITERALS inside `dto/assetGeometry.test.ts` and `assetGeometrySidecarDetails.test.ts`. **CORRECTED 2026-09-21 (wave 14): this sentence was FALSE.** `tests/vault/valid-project/Library/Geometry/asset-designed.rpgeo` is `"schemaVersion": 1`, so a checked-in legacy file did exist. The true gap was narrower and is what wave 14 closed: **the legacy file that existed was not read AS a legacy file** — the case reading it asserts points and revision and nothing about the raise, so tidying it to v4 would leave that case green. Three fixtures now exist, one per version `raiseLegacyVersions` names, each asserted whole with `toEqual`. The original sentence read — `tests/vault/legacy-schema/` holds `Plans/` and `Zones/` only, and `migration/legacyFixture.test.ts` is about notes rather than asset geometry. A literal cannot catch a byte-level read defect the way a file can |
| F09 malformed / future schema | **passed** | `assetGeometrySidecar.test.ts` "refuses a sidecar written by a newer build…", "refuses to overwrite a sidecar it cannot read" |
| F10 one definition in two projects, one frozen revision | **partial** | The two-project half is reachable (`ListPlansUsingAsset`); **the frozen half cannot exist** — `r1` row 3 settles that nothing in this product can be frozen or approved |
| F11 missing/moved resources | **passed** | `assetSidecarMapping.test.ts` "follows a source note that has been renamed and moved"; `removeAssetBackground.test.ts` |
| F12 25/250/1000 parts | **none** | No performance fixture exists at any size. §6's every target rests on this and none is measurable here |

## 2. Integrated user scenarios U01–U06

**Every one is not-run**, and none can be run from here: each is a walk through a real vault with a
real Plan Editor beside the designer.

| ID | State | Reason, and where the steps now live |
|---|---|---|
| U01 create and place without a drawing | **not-run** | Needs a host. Steps: `docs/tests/cases/Design an Asset.md` and `Take an asset from the library into a plan.md` |
| U02 compose a bathroom vanity | **not-run** | Needs a host. Steps: `Compose an asset from parts.md` and the duplicate half of `Take an asset…` |
| U03 repeated bench detail | **not-run** | Needs a host. Steps: the Repeat section of `Compose an asset from parts.md` |
| U04 trace and calibrate deliberately | **partial — upgraded from `not-run` on 2026-09-21** | Needs a host, and a PDF page rendering is the one thing no fake here stands in for — production asks Obsidian for its own pdf.js and the suite runs a different copy. Steps: `Calibrate a sheet and reserve space.md`. **WALKED 2026-09-21** in a live vault by the repository owner on the `test-build` of `c69ec364d`, against a per-step checklist carrying each expected result: **seven of the eight `obsidian` steps confirmed** (3, 7, 9, 12, 13, 14, 34), including step 3 — the PDF page rendered by Obsidian's own pdf.js, which is the row's whole reason for needing a host. **Not `passed`, for two reasons that are not the same.** Step 32 is NOT-RUN: it needs a screen reader the walker did not have, and it is the only instrument for the clearance-review block's live region and button name. And the case's **seven `browser` steps stay undischarged** because `tests/harness/assetDesigner.ts` sets `background: null` deliberately, so the harness cannot give an asset a sheet — the first time that fixture's posture has a measured cost in this matrix rather than a theoretical one |
| U05 recover rather than lose work | **not-run** | Needs a host and two real leaves |
| U06 preserve an issued view | **REFUSED as written, not merely unrun** | There is no freeze/issue workflow to exercise. `r1` row 3 rules explicit capability gating only, and the gate exists (T39). U06's own last sentence anticipates this: *"If no such workflow exists, test the explicit absence/gate and do not claim U06's frozen-state outcome has passed."* That is what happened |

## 3. Behaviour and regression matrix T01–T42

| ID | Grade | Evidence, and the gap where there is one |
|---|---|---|
| T01 L-resize keeps topology; Replace explicit | **passed — regraded 2026-09-21 under AD15-R1** | Scaling asserted at both layers (`assetDimensions.test.ts` "scales a calibrated L-shaped footprint instead of squaring it off"; `shapeEdits.test.ts`; `scaleSolve.test.ts`). **The EXPLICITNESS of replacement is unasserted** — presets warn ("warns that the current design will be replaced when there is one") and the clearance warns, and footprint replacement has no equivalent case. **REGRADED 2026-09-21 (AD15-R1): there is no equivalent case because there is no unwarned replacement to warn about.** `AssetDesignerRoot`'s `editDimensions` branches on `unscaled || !current?.shape`; only that branch reaches `setFootprintFromDimensions`, which builds a fresh centred rectangle — and it is exactly the branch that shows `designer.dimensions.unscaled` as the dialog's `warning`, or where there is no shape to lose. Every other footprint goes to `scaleDesignToDimensions` and KEEPS its corners and anchor. The explicitness this row asks for is delivered by a BRANCH, and both arms are asserted |
| T02 no-op/cancel/invalid write nothing | **passed** | `assetDimensions.test.ts` "writes nothing and pushes no undo entry when the offered dimensions are typed back"; `setAssetFootprint.test.ts` "reports no-write when the rectangle asked for is the one already stored"; `reversibleAssetDesign.test.ts` "captures nothing when the forward command refuses" |
| T03 nonuniform arc policy | **passed** | `stretchParity.test.ts` IS the policy — "measures the same on both", "draws a different silhouette, which is the tolerated approximation"; plus `shapeEdits.test.ts`, `partExtent.test.ts` |
| T04 anchor fixed; height/calibration independent | **passed** | `shapeEdits.test.ts` "scales every part about the anchor, which does not move"; `calibrateAsset.test.ts` "touches no plan and no other asset" |
| T05 canonical values survive unit change and fractional editing | **partial** | The mm-canonical and fractional-input halves are asserted (`dto/assetGeometry.test.ts` "refuses a unit that is not mm", "keeps three decimals, which is what catches a YAML float coercion"; `decimalInput.test.ts`). **The display-unit half is unasserted because there is no display-unit feature** — `worldUnit.test.ts` states only that one world unit is one millimetre. The row assumes a capability the product does not have |
| T06 pending flags survive non-calibration edits | **passed** | `setAssetAttributes.test.ts` "sets only its own pending flag"; `assetReferenceReplacement.test.ts` "leaves every pending flag exactly as it was, so no warning is erased"; `calibrateAsset.test.ts` "clears each flag it converts, and only those" |
| T07 mixed-space composition refused | **passed — wave 14** | Domain asserted exhaustively (`arrangeDetails.test.ts` `it.each(spatial)` "refuses %s across the two spaces, rather than laundering pixels into millimetres", and the all-pending and grouping arms). **The GESTURE half is missing** — the row asks for domain + gesture, and `designerArrangePanel.test.ts`'s "refuses the arrangement and writes nothing" is the LOCKED-participant refusal, read at its `describe`, not the mixed-space one. Nothing drives a mixed selection through the panel |
| T08 undo/redo cannot overtake write/read-back | **partial** | Asserted densely (`designerWriteChain.test.ts` "undo clicked while a second drag is still being written undoes THAT drag, not the one before it"; `editShape.test.ts`; `reversibleAssetDesignWindows.test.ts`). **Narrower in LAYER**: the row says session/fault injection and the faults are injected at fake ports rather than at a session boundary |
| T09 queue cannot deadlock by self-join | **passed** | `referenceLocks.test.ts` "two multi-lock commands with opposite lock sets both complete — the deadlock test"; `subscriberLockBoundary.test.ts` "no module registering a subscriber names a reference lock" — a static guard at the forbidden thing rather than a list of paths |
| T10 write ok, refresh failed shows stale | **passed** | `designerRefresh.test.ts` "keeps the previous design when the read-back fails, and marks it stale"; `assetDesignerRoot.test.ts` "draws an additive stale strip rather than replacing the design it cannot re-read" |
| T11 retry does not duplicate an uncertain write | **passed** | `assetInspectorFields.test.ts` "reports the write outcome as unknown when the command itself throws", "blocks retry of a mapped technical fault with unknown write outcome"; `newAssetForm.test.ts` "does not create a second asset when the footprint write fails and the user retries" |
| T12 two leaves, expected-version conflict | **partial** | Conflict behaviour asserted (`setAssetFootprint.test.ts` "refuses the second of two writes built from the same revision, rather than losing one"; `designerCrossLeaf.test.ts`). **The row demands a real host and there is no real-host test anywhere in `tests/`** — every leaf here is a `FakeLeaf` that records asks rather than behaving |
| T13 NoteVersion never used as GeometryVersion | **partial** | The hazard itself is pinned (`reversibleAssetDesign.test.ts` "undoes a geometry edit beneath a height edit, rather than presenting the note version to the sidecar"; `assetGeometryWiring.test.ts` reads each port's own version). **No type-level guard**: the two versions are structurally identical, so the confusion is refused by cases and not by the compiler. **SENTENCE NARROWED 2026-09-21 (AD15-R1) rather than the row being closed**: `AssetRepository` and `AssetGeometrySidecar` both import the SAME `EntityVersion` from `./versioning`, so this row asks for a guarantee this codebase does not have. That is the honest gap, not an oversight. Branding the two types is a wave of its own — a `src/` change across two ports and every call site, in a tree where `tests/**` is type-checked too |
| T14 multi-part op is one aggregate change | **passed** | `arrangeDetails.test.ts` "leaves every graphic it was not given exactly where it was"; `designerArrangePanel.test.ts` "writes one group over the selected graphics in canonical order, with one dispatch", "writes once for two presses of the same alignment" |
| T15 all doors use the sequencing policy | **passed** | `reversibleWritePathCensus.test.ts` enumerates the asset design edits, and `reversibleWritePathDiscovery.test.ts` asserts "the discovered key set and the DISPOSITIONS key set are exactly equal" — the completeness check that makes the census a category claim rather than a list |
| T16 legacy fixtures migrate with semantic equality | **passed — wave 14** | Raising is asserted (`dto/assetGeometry.test.ts` "raises a version 1 document to version 4, with no details, no groups and no review flag"; "raises a version 2 document to version 4, defaulting each graphic to closed"). **The fixtures are literals and not files** — see F08. The survey also flagged that `assetGeometrySidecarDetails.test.ts` says "writes version 3 back" while the DTO raises to 4; that sentence is about a narrower schema in that file's own fixture rather than a disagreement, but it is worth a reader's eye |
| T17 future/corrupt sidecars not overwritten or shown empty | **passed** | `assetGeometrySidecar.test.ts` "refuses to overwrite a sidecar it cannot read"; `dto/assetGeometry.test.ts` "is refused by a version-3-only schema, which would otherwise strip the review flag on its next write"; `assetDesignerRoot.test.ts` "draws a failure and no empty state when the read refuses" |
| T18 labels do not replace names; ids/order persist | **passed** | `assetDetail.test.ts` "carries a user label beside the stable semantic name, and leaves the name alone"; `partNames.test.ts`; round-tripped in `assetGeometrySidecarDetails.test.ts` |
| T19 open lines stay open and valid at zero extent | **passed** | `assetDetail.test.ts` "accepts a two-point open graphic, which a closed one could never be"; `arrangeDetails.test.ts` "aligns an OPEN graphic of zero extent by the one coordinate it has"; `hitTest.test.ts` "does not take a press inside the area its points would enclose if it closed" |
| T20 groups reject dangling/duplicate/nested | **structural — regraded 2026-09-21 under AD15-R1** | Dangling and duplicate asserted (`groupEdits.test.ts` "refuses a graphic the design has not got", "refuses the same graphic named twice"). **NESTED is asserted only as flat exclusivity** — "refuses a graphic that is already in another group". Nothing refuses a group naming another GROUP, and the schema may not express one; C06 asks for shallow groups, so this is likely structural, but it is unasserted either way. **CONFIRMED STRUCTURAL 2026-09-21 (AD15-R1)**: `validateMembers` checks each member against `known`, the set of GRAPHIC ids, so a group naming another group is already refused as `dangling-group-member` by the case that exists. `AssetShape.ts` says *"One shallow group. `members` are detail ids"*. Nesting is neither separately expressible nor separately refusable, and a dedicated case would drive the dangling path under a misleading name |
| T21 group/ungroup does not move or reorder | **structural — wave 14** | Domain asserted (`groupEdits.test.ts` "changes no coordinate, no order and none of the shape's other parts", "moves a noncontiguous group to the front as a block, keeping its internal order"). **The RENDERING half is missing**: `partRows.test.ts` is the Parts list read-model, and `layers.test.ts` has no group case, so nothing asserts the drawn z-order is unchanged by grouping |
| T22 duplicate/repeat identities, deterministic redo | **passed** | `arrangeDetails.test.ts` "assigns ids above the highest suffix, never reusing one a delete freed"; `reversibleAssetDesign.test.ts` "restores ids, membership, order and geometry together, and redoes the very ids it minted" |
| T23 align/distribute honours reference, gap, endpoints | **passed** | `arrangeDetails.test.ts` "evens the GAPS and leaves both endpoints untouched", "answers a different arrangement for the two modes, so naming one is not decoration"; `designerArrangePanel.test.ts` "holds the chosen key object still when the reference is switched to it" |
| T24 one selection model; deleted selections prune | **passed** | `assetDesignStoreSelection.test.ts` "drops only the member whose part is gone", "empties when its last member is removed, leaving no phantom primary"; `designerPartsPanel.test.ts` "selects the part its row names" |
| T25 Escape, pointercancel, blur, outside release are safe | **partial, narrowed by wave 7 (T25)** | `designerCanvasGestureOwnership.test.ts` now fires REAL DOM events at the designer’s own mounted `EditorSurface`: a `pointercancel` on the canvas, a `blur` on the canvas, and a `blur` on the owner window — three independent doors, since `blur` does not bubble and the container handler and the `listenOnOwner` registration are reached separately. Each asserts the band is gone, the cleared selection is RESTORED, and the sidecar is unchanged; all three were watched red against the handler that carries them. A fourth case covers what the other three cannot: `cancelInterruptedGesture` is the only thing that clears `#gestureInFlight`, and `EditorSurface` early-returns on it, so an unheard cancellation locks the camera out indefinitely — the case asserts the wheel is refused DURING the sweep and zooms after it, and went red at `expected 0.1 not to be 0.1` with the camera stuck at `DEFAULT_ZOOM`. **Two reasons this is not `passed`.** The `keyDoors.ts` arm of `gestureInFlight()` is not driven — only the wheel door is. And *a release outside the leaf* turns out not to be an interruption at all: `onPointerDown` calls `setPointerCapture` on both arms, so that release is delivered back to the captured container and the gesture COMMITS. Nothing asserts that commit, and this row’s own wording assumed a door that cannot exist while capture is held — `dropMarquee`’s docblock made the same assumption and is corrected on the integration SHA. **This row’s opening sentence was also false when written**: `designerEscapeRouting.test.ts` already reached `cancel` through a real `keydown` at the canvas, so Escape was never the gap |
| T26 click-after-drag does not clear or retarget | **partial** | Behaviour asserted (`designerSelectMarquee.test.ts` "keeps the whole set rather than collapsing it to the part pressed"; `designerSelectTool.test.ts` "writes nothing, and previews nothing, for a press that never travels past the click epsilon"). **Narrower in LAYER**: the row says browser and every case is jsdom |
| T27 form/note keystrokes not eaten by shortcuts | **partial** | The designer's own boundary is asserted (`designerKeyboard.test.ts` "deletes nothing for a Backspace typed in the inspector, a sibling of the canvas region"; `designerKeys.test.ts`'s HANDLED/IGNORED pair). **The NOTE EDITOR half is unasserted for the designer** — the native-field sweeps that exist are plan-editor's, and no test anywhere puts a Markdown or CodeMirror editor beside this surface |
| T28 locks/isolation do not change output or quantity inputs | **structural — wave 14** | Designer-local behaviour asserted richly (`designerPartsPanel.test.ts` "hides a graphic without writing anything or changing the shape"; `partView.test.ts` "leaves locks alone when everything is shown again"). **The OUTPUT half is missing**: nothing asserts that a graphic hidden or locked in the designer still renders in the plan symbol. `assetShapeConfig.test.ts` has no hidden or locked case |
| T29 each new tool registered, visible, functional, undoable | **passed** | `designerToolbar.test.ts` `it.each(TOOLS)` "activates %s when its button is pressed" and the ordering case; per-tool undo in `designerDrawDetails.test.ts` and `designerDrawOpenLines.test.ts` ("is one undo entry"); `regionsReachable.test.ts` for the shell |
| T30 every renderer understands each geometry kind | **passed — wave 14, on evidence that PREDATES it** | The three real consumers are asserted (`layers.test.ts` "draws unclosed, unfilled, and keeps its last point"; `assetMark.test.ts`; `listAssetOutlines.test.ts` "hands the mark a curved footprint flattened into its arcs"). Two things the row cannot have: **there is no exporter** (`r1` row 4 measured it), and `assetShapeConfig.test.ts` has **no OPEN-graphic case**, so the plan renderer's handling of an open polyline is unasserted |
| T31 authoring overlays do not leak into the final symbol | **structural** | The survey reported NONE FOUND and that is right about tests and wrong about exposure. Measured here: `ListAssetOutlines`'s `AssetOutline` carries `points` and `extent` and nothing else, and neither `assetShapeConfig.ts` nor `assetPlacement.ts` names `background` at all. **Neither non-designer consumer can reach a reference sheet, a grid or a handle** — the property is held by the DTO's shape. A case asserting the absence of a node the type cannot carry would be the unreachable guard CLAUDE.md warns costs a branch it can never pay back |
| T32 theme change preserves visibility, no geometry change | **partial** | Each half separately (`designerTheme.test.ts` "re-resolves the drawn stroke when Obsidian reports a css-change"; `layers.test.ts` "takes every colour from the theme, never from a literal" and the restroke rule). **Not together**: nothing flips light↔dark and re-asserts the geometry is unchanged, and jsdom could assert the coordinates but never the visibility the row is about |
| T33 thumbnail and plan views refresh after a change | **passed** | `assetMarkWiring.test.ts` "redraws a row whose mark an AssetDesignChanged invalidated", "keeps the fresher outline when a slower earlier read lands last"; `assetShapeLoader.test.ts` "re-reads a placed asset's shape when its design changes" |
| T34 Use in plan places the real definition, returns context | **partial** | Asserted end to end at the seam (`assetDesignerUsePlan.test.ts` "carries the asset into the Plan Editor it continues into"; `editorArrivalAssetHandoff.test.ts` "arms the placement tool with the asset the origin names"; `assetPlacementInspector.test.ts` for canonical size). **The row says browser + real host and no case is either** |
| T35 duplicate independent; references stable after rename/move | **passed** | `duplicateAsset.test.ts` "copies metadata and geometry to a new identity and leaves the original untouched", "follows a source note that has been renamed and moved"; `assetSidecarMapping.test.ts` |
| T36 partial create/duplicate failure leaves no half-object | **passed** | `duplicateAsset.test.ts` "deletes the note it created when the sidecar write fails, leaving no orphan", "refuses the cleanup rather than trashing a note a peer edited in between"; `assetGeometrySidecar.test.ts` "restores the note when the sidecar refuses to go" |
| T37 placement point and front after rotate and mirror | **structural — wave 14** | Rotation asserted across surfaces and at six angles (`referenceFrame.test.ts` `it.each([0, QUARTER, Math.PI, 3*QUARTER, 0.7, 2.9])` "keeps back centre opposite the drawn front at %s"). **MIRROR is one domain case and nothing else** — "mirrors back centre when the outline and the front are mirrored". No designer mirror gesture test, no designer→plan mirror parity |
| T38 clearance review survives reopen; no false green | **passed** | `assetClearanceReview.test.ts` "comes down even when the boundary is re-traced at the identical coordinates"; `shapeEdits.test.ts` "flags a measured clearance when the object GROWS as well as when it shrinks"; `dto/assetGeometry.test.ts` "is refused by a version-3-only schema, which would otherwise strip the review flag on its next write" is the survives-reopen half |
| T39 frozen consumers preserve state, or the gate is explicit | **passed, as the GATE arm** | The survey reported NONE FOUND; that is wrong and was disproved by reading. `tests/presentation/i18n/assetCapabilityClaims.test.ts` — `describe('the asset surfaces promise no frozen or approved handover (C11, revision r1 row 3)')`, four cases across both locales, including its own finds-something case ("reads a non-empty set of keys and really refuses the strings it is about", with three planted English and three planted German claims). It was missed because the word "frozen" is in the `describe` and the filename says "CapabilityClaims". **The preservation arm is correctly absent**: `r1` row 3 rules explicit gating only |
| T40 graphic editing does not change cost/quantity/work | **passed, by wave 7 (T40)** | `designerWriteIsolation.test.ts` takes five writes — footprint, detail, group, repeat and calibration — and asserts the asset’s `unitCost`, `wasteFactorDefault`, `unit` and note revision are untouched, that the Requirement’s revision, quantity and estimated cost are untouched, and that the published events are exactly `[‘AssetDesignChanged’]` (a whitelist, so a third event nobody anticipated is caught too). **Five rows rather than four because four kinds are not four paths, measured**: `grep -rn "SetAssetShapeCommand" src/` prints five lines, and detail, group and repeat are three INPUTS to one command reached through `createEditShape`; footprint and calibration are genuinely different writers. Each row also asserts the write LANDED, re-read from the sidecar, which is what distinguishes *changed nothing else* from *nothing happened* — the negative probe that first carried this passed on a vanished shape and was replaced by a positive one after review, with both spellings run against the same mutation. **One disclosed weakness, in the file rather than only here**: `onAssetUpdated` filters through `assetMatchesCalculatedFrom`, which compares `unitCost` and `unit` only, so a stray `AssetUpdated` from a graphic write would leave all three requirement assertions green — that regression is caught by the event whitelist instead, and `after.version.revision` is the load-bearing requirement assertion while quantity and cost are a narrower net |
| T41 repeated mount/unmount releases resources | **passed — wave 14** | Single-cycle release asserted (`designerCrossLeaf.test.ts` "leaves nothing subscribed once every leaf is closed"; `assetDesignerView.test.ts` "draws nothing when a CLOSED leaf is rebound, rather than resurrecting its tree"). **§6 asks for 50 cycles and monotonic growth and nothing runs more than one.** No observer-disconnect case for the designer either; the one that exists is the plan editor's `responsiveShell.test.ts` |
| T42 compact panes keep actions and errors reachable | **partial — the DOM and focus half closed by wave 7 (T42), the appearance half open** | `designerResponsiveShell.test.ts` renders the real designer at 520, 900 and 1400 and asserts a primary action, a refused read’s failure headline and its retry, and the additive `role="status"` notice are each present, enabled, accessibly named and focusable — plus one mounted tree walked 520 → 900 → 1400 → 520 with the set of enabled named buttons identical at every step. Width reaches it through the plan editor’s own `clientWidthFor` and `resizeTo`, and both channels were watched red through a temporary width-driven `v-if`. **What reframes this row**: the designer reads NO width in JavaScript. Established by an import walk from `AssetDesignerView.ts` over 435 files with 0 unresolved, not by the directory-scoped grep — that walk finds `EditorSurface.vue`’s `ResizeObserver` (sizing the Konva stage, deciding no region) and `followPixelRatio.ts`’s `matchMedia`, which is a device-pixel-ratio query. So the honest guarantee is INVARIANCE, and in jsdom the three widths produce an identical tree; the file says so. **It must never be graded `passed`.** jsdom applies no container query, so `styles/designer-narrow.css`’s `@container rp-designer (width < 35rem)` block has zero effect in every case, and nothing here sees the compact LAYOUT. `npm run harness-shot -- --width=460` is the only instrument that could, and there is no pinned Chromium on this machine. One thing measured in review makes the file stronger than it claims: that narrow block declares only `flex-direction`, `flex`, `width` and border swaps and no `display`/`visibility` at all, so it hides nothing and the invariance would hold in a real browser too |

**Counted down the Grade column after the table was finished, not before it: 21 passed, 20 partial,
1 structural, 0 none — 42.** **Re-counted 2026-09-19 after wave 7 re-graded three rows: 22 passed,
19 partial, 1 structural, 0 none — 42.** Only T40 moved to `passed`; T25 and T42 were NARROWED and
stay `partial`, and T42’s own cell says why it may never be graded otherwise from this environment. The first version of this sentence read "18 passed, 22 partial, 1
structural, 1 none", written from an impression before the tally and wrong in every figure, which
is this repository's own recorded failure mode reproduced inside the report about checking things.
It is corrected here rather than silently, because the correction is the more useful sentence.

The partial count is the number worth carrying forward. It is not 20 failures — it is 20 places
where the instrument is narrower than the row that asks for it, each with its gap named. **T25,
T40 and T42 were the three to close first**: a gesture surface whose DOM-level cancellation was
asserted only through another surface's fixture, a quantity-isolation claim resting on a note edit,
and a compact-pane claim resting on stylesheet text.

**Wave 7 took all three, on 2026-09-19, one card each with an independent reviewer per card.** Read
the three cells above rather than this paragraph for what each now holds. Two things generalise
beyond them. **Each card’s reviewer found something the card’s own author had measured and then
written the opposite of** — T25’s header claimed a mis-bind would leave both surfaces green while
its own evidence table disproved it, T40’s docblock asserted a cascade would move a Requirement
that its own mutation 7 showed it does not, and T42’s docblock said it asserted every entry path
above a check that passed with one of two deleted. All three were green and lint-clean at the time.
**And two of the three rows were partly wrong about the CODE rather than about the tests**: T25’s
"outside release" is not an interruption, and T42’s premise of width-driven reflow is not a
mechanism this surface has. A row that asks for the wrong thing cannot be closed by testing harder,
and noticing that is what the reviews bought.

## Two survey findings disproved

Both were produced by an independent read-only survey of `tests/`, and both were checked before
being written into the table above. A worker's finding is a hypothesis exactly as a static
analyser's is.

1. **T39 "NONE FOUND"** — wrong. The gate exists and is good. The survey grepped `it`/`test` titles
   and the claim lives in a `describe`.
2. **T31 "NONE FOUND"** — right about tests, wrong about exposure. There is nothing to leak: the
   consumer DTO carries no field that could carry an overlay. Graded **structural** rather than
   **none**, which is a different instruction to the next reader.

## 4. Gherkin criteria

All five scenarios are **not-run**: each is a vault walk. The fifth (a frozen revision independent
of a live definition) is **refused as written** for U06's reason, and section 4's own closing
sentence says to test capability gating separately instead — which T39 does.

## 5. Environment and visual coverage

**Not-run, in full.** No Windows/Obsidian version can be recorded because the plugin was never
loaded; no leaf width was tested because no leaf existed; no light/dark comparison was made; no
S00–S11 state was inspected; and no screenshot exists to label. `npm run harness-shot` cannot run —
`scripts/chromium.mjs` refuses to hunt an unpinned browser on disk, deliberately, and the remedy it
names (`npx playwright install chromium`) is forbidden in this environment.

**The single sharpest unlooked-at thing**, measured rather than asserted:
`DesignerClearanceReview.vue` draws `<section class="rp-designer-clearance">` directly beneath
`DesignerClearanceHelper.vue`'s section of the **same class**, and that class carries
`border-top: 1px solid var(--background-modifier-border)` in `styles/designer-selection.css`. Two
bordered blocks stack and the lower one has **no heading of its own**, carrying the longest
sentence in the designer Inspector. And `grep -rn clearanceNeedsReview tests/harness/` prints
**nothing** — it draws only when the flag is set and no harness fixture sets it, so its
`role="status"` live region and its button's accessible name have been graded by no scan at all.
A live-vault pass and a 460 px capture should start there.

## 6. Performance and usability gates

**Every row is not-run**, and none of them is close to runnable here.

| Metric | State | Why |
|---|---|---|
| Selection response p95 ≤ 100 ms | **not-run** | Needs F12's 250-part fixture, which does not exist, and a warmed renderer in a host |
| Drag frame time p95 ≤ 33 ms | **not-run** | Same, plus a real compositor. jsdom draws nothing |
| Warm asset opening ≤ 1 s | **not-run** | Needs a host and a disk |
| Stress at 1000 parts | **not-run** | No fixture at any size |
| Lifecycle, 50 open/close cycles | **not-run** | T41 runs one cycle. `npm run perf` is deliberately absent from this repository and CLAUDE.md names its trigger: a render cost somebody can argue about |
| Preset creation, 4 of 5 novices | **not-run** | Needs people. Not fakeable and not faked |
| Group/align comprehension, 4 of 5 | **not-run** | Same |

**No performance number is recorded anywhere in this package**, and none should be invented. AD16's
acceptance criterion that figures name their hardware, viewport, fixture size and method is
unmeetable until a figure exists.

## 7. Release gate

`templates/RELEASE-CHECKLIST.md`, filled, is in `AD16-release-preparation.md`. Its decision is
**blocked**.

## Executed checks

| Command or manual action | Commit / environment | Exit code or observed result | Evidence |
|---|---|---|---|
| `npm audit` | this worktree, 2026-09-18 | 2 high severity | `fast-uri` (4 advisories) and `js-yaml` (1), both reached only through `eslint-plugin-obsidianmd` |
| `npm audit --omit=dev` | same | **0 vulnerabilities** | This is the disposition: nothing in the shipped bundle is affected. Measured with `npm ls fast-uri js-yaml`, which prints one path each and both under `eslint-plugin-obsidianmd@0.4.2` |
| `npm audit fix --dry-run` | same | both fixable | Deferred out of this wave deliberately: three worktrees share this branch and a lockfile change mid-wave is a merge hazard, and production is already clean |
| The six gates | see `AD16-release-preparation.md` | recorded there | Run on the final integration SHA rather than here, so one report carries them |

## Verification not performed

- **Every manual case under `docs/tests/`**, including the three written for this expansion. No
  Obsidian.
- **Every capture.** No pinned Chromium, and `npx playwright install chromium` is forbidden here —
  it emptied `node_modules` once.
- **`npm run test-build`.** Needs a vault and a host.
- **Every §6 performance and usability target.** No fixture, no host, no participants.
- **Every U01–U06 scenario.**
- **Anything about appearance, contrast, hit size, focus visibility in a real host, or keyboard
  behaviour beside a note editor.**

## Data and integration implications

Schema/migration change: none in this report.
Relevant renderer/export/revision consumers: three, and there is no export subsystem (`r1` row 4).
Undo/no-op/conflict/failure coverage: T02, T08, T10, T11, T12, T36 above.
Identity/unit/quantity/calibration invariants: T04, T05, T06, T13, T18, T35, T40 above — **T40 is
the thin one**.
Shared root/runtime/locales wiring still required: none for this report.
Rollback/recovery considerations: schema 4 is refused by older builds by design; restoring a
verified backup is the only recovery, and `docs/using-asset-designer.md` says so to the user.

## Reviewer and integrator acceptance

Reviewer outcome and findings: this report is the integrator's own and was not independently
reviewed. Two of the three findings it rests on were disproved by measurement before being written
down, which is the substitute and not an equal one.
Integrated commit: this report is documentation and lands with the wave-6 integration.
Post-integration checks/evidence: in `AD16-release-preparation.md`.
Final status: **blocked**. AD15's four implementation items need a host this environment does not
have, and runbook §10 forbids labelling the beta ready from here.
