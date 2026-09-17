# Asset Designer — implementation contracts

Status: **accepted, revision `r1`, 2026-09-16**, against baseline
`f3a8864a9e9e14c3e39c9adf6c06bdf0f2fa6a52`. The sections below are the proposed execution
defaults as written; **[Revision r1](#revision-r1--what-ad01-reconciled) amends four of them and
overrides the prose where the two disagree.** Read r1 first. These are behavior/data obligations,
not permission to paste new types into the repository without checking existing ones.

## Revision r1 — what AD01 reconciled

AD00 found that this package was written against `d77e7c5e…`, that HEAD is fourteen commits
newer, and that the repository had already taken three of the decisions these contracts propose —
in the opposite direction, deliberately, with the reasoning written down. r1 follows the
repository. **Nothing in r1 changes accepted repository behaviour**, so no ADR and no spec
amendment is owed by AD01; each ruling below is a correction to THIS package.

| # | Contract | Package default | Accepted in r1 | Why |
|---|---|---|---|---|
| 1 | **C04** — circular arcs under scale | Lock proportional scaling whenever geometry contains a circular arc | **Nonuniform scaling stays allowed.** The designer keeps each bulge and solves the typed extent numerically (`domain/asset/scaleSolve.ts`, `scaleDesignToDimensions`); the plan flattens arcs then stretches per axis (`domain/spatial/assetPlacement.ts`). The numbers are the guarantee; the silhouette is the stated approximation | The repository shipped this on 2026-09-16 (`docs/superpowers/specs/2026-09-16-asset-designer-consolidate-design.md` §4, §5) and wrote the divergence, its reason and its trigger — native ellipse or path geometry in `CurvedPolygon` — into `assetPlacement.ts`'s header. Adopting the lock would withdraw a shipped capability and cost the placement size fields their exactness |
| 2 | **C07** — clearance on resize | Refuse a resize rather than scale a clearance, until a persistent review flag exists | **Scaling a pending clearance with everything else stays as it is, parked with its trigger.** The trigger is the increment that decides whether a pending group is exempt from every scale | That is `scaleDesign`'s pre-existing behaviour, and the state needs three deliberate steps to reach (calibrate, swap in an uncalibrated background, trace a clearance). The repository found it in review and parked it on purpose (`e87a08827`, spec §6), because the question belongs to calibration rather than to resize. A refusal now would block a common gesture to guard a rare one, and pre-empt a decision somebody wanted to take deliberately |
| 3 | **C11** — historical output | AD14 must establish tested historical preservation or explicit capability gating | **Explicit capability gating only.** No shape history, no placement pinning | Nothing in the product can be approved — `Plan revisions` is a requirement note, not code — so no approved drawing can be silently redrawn. On 2026-09-16 the repository decided that an approved revision **snapshots** every shape it references, taken at approval, and moved the obligation beneath `docs/requirements/Plan revisions.md`. A snapshot at approval needs no earlier state; retained history would contradict it and cost a schema change |
| 4 | **C10** — "every current export path" | Exhaustive geometry handling across authoring canvas, thumbnails, placement **and every current export path** | **There is no export subsystem.** The consumers are exactly: the authoring canvas, the library mark (`ListAssetOutlines` → `AssetMark.vue`, footprint only, arcs flattened at 1 mm), and plan placement (`placedOutline` → `AssetLayer.vue` / `AssetShapes.vue` / `elementFootprint.ts` / `transformBox.ts` / `select-tool.ts`) | Measured: `src/` contains no PDF, print or render-to-file path. C10's sentence promised more than the code has. AD05 and AD14 are rescoped to those three consumers |

Three further reconciliations r1 records, which change no contract text but do change task scope:

- **C09's schema number.** No v3 is allocated in this checkout: the sidecar reads v1 and v2, emits
  v2, and refuses v3 (`tests/infrastructure/persistence/dto/assetGeometry.test.ts`). AD04 takes 3.
  There is no asset-geometry migration table and the repository records why, with its trigger being
  the open geometry AD11 wants (spec §6).
- **C03's resize/replace split is already built.** `editDimensions` scales a measured footprint and
  writes a rectangle only where there is nothing to scale — no shape, or a footprint still in
  placeholder pixels. AD02 keeps only the residual policy items; the explicit "Replace with a
  rectangle" action is recorded out of scope with its own trigger (spec §6).
- **C12's platform gate is real and stays.** `Platform.isMobile` refuses both the designer command
  and the view (`plugin/assetDesignerCommands.ts`, `presentation/designer/AssetDesignerView.ts`).

**Anything not listed above is accepted as written.**

## Rulings that APPLY an accepted contract (no revision)

`r1` is settled and closed. The rulings below decide how an already-accepted sentence is
satisfied; none of them changes a contract's text, so none of them is a revision and none is
re-litigable as one. Each was taken before the code it governs was written, which is the only
time such a ruling is worth anything.

### AD08-R1 — the Parts panel IS C05's overlap alternative. No chooser is built. (2026-09-17)

C05 reads: *"Default hit behavior: select the visually topmost eligible part; expose an overlap
chooser/Parts alternative."* That is a DISJUNCTION, and AD09 shipped the second arm. Measured
rather than assumed — `src/presentation/designer/parts/DesignerPartsPanel.vue` lists every part
of the shape including ones lying under others, a row press calls the same `select` a canvas
press calls (one selection model, C05's own first requirement), and the list is a single tab stop
with Up/Down/Home/End, so the route is keyboard- and touch-reachable without a modifier. AD08's
own criterion — *deterministic overlapping-object selection with an accessible alternative* — is
met by the pair: `hitDesign`'s `findLast` is the determinism, the panel is the alternative.

**What building a chooser as well would cost, which is why it is refused rather than deferred.**
A popup listing the parts under the cursor is a SECOND selection surface: its own hit rule (which
parts count as "under"), its own keyboard model, its own dismissal and focus-return behaviour, and
its own answer to what happens when the shape changes while it is open. Two surfaces that both
answer "which part did you mean" are two places for that answer to differ — the shape this
repository refuses everywhere else it has a name for it. The panel already answers it once.

**The trigger, so this is a decision and not a dead end.** Build a chooser when the Parts panel is
not on screen and cannot be — a leaf too narrow to show it, or a future surface that draws the
canvas without the panel. Until then the honest fix for "I cannot click the part I want" is the
panel, and AD08's remainder owes the one gesture that is genuinely missing instead: marquee
selection.

### AD10-R1 — a spatial composition REFUSES a selection mixing pending and measured graphics. Grouping does not. (2026-09-17)

AD10 asked whether its five spatial operations — align, distribute, repeat, the block reorder and
the group transform — should refuse a selection holding both a `pending` graphic and a measured
one. **C07 already answers it, in one sentence, and this ruling only records which half applies to
what:** *"Metadata grouping may be allowed, while incompatible spatial operations are refused with
an explanation."*

So: **group and ungroup stay allowed on a mixed selection**, because a group carries no coordinates
— `AssetShape.groups` is editing metadata and `validateGroups` never looks at a point. **Every
operation that MOVES something refuses one, with a coded refusal the inspector can show**, because
a `pending` graphic's numbers are background pixels and a measured one's are millimetres, and an
alignment computed across the two would place a part using a distance that means two different
things at its two ends. That is C07's *"composite transforms must not silently combine incompatible
coordinate spaces"* — silently being the operative word, which is why a refusal with a reason is
the required shape and dropping the pending members quietly is not.

**This is not a new decision and it is not a revision.** It is the same rule
`fitFootprintToDetails` already enforces one layer down, refusing under `details-await-scale` when
any graphic is still in background pixels rather than laundering pixels into millimetres. A second
answer to the same question in the same aggregate would be the defect.

**What it does NOT cover, deliberately:** a selection whose members are ALL pending. Those share
one coordinate space, incompatible with nothing, so aligning them is coherent and stays allowed —
the refusal is about MIXING, never about being unscaled. The unscaled warning the inspector already
draws is what tells the user those numbers are not millimetres yet.

**Amended the same day, because the first version of this ruling named five operations and one of
them does not belong.** It listed *"align, distribute, repeat, the block reorder and the group
transform"*. AD10's reviewer pushed back on the block reorder and is right: `moveGroupToEnd` takes a
GROUP ID rather than a selection, so it cannot see a mix in the first place, and it writes no
coordinates at all — it reorders the `details` array. C07's rationale is about combining two
coordinate spaces in one arithmetic, and there is no arithmetic here. **So the ruling binds four
operations, not five:** align, distribute, repeat and the group transform. Bringing a group to the
front of the drawing order stays allowed on a mixed selection, for the same reason grouping does.

**A second correction, about WHERE the check goes, and it is the more dangerous of the two.** The
obvious site is `resolveParticipants` in `detailEdits.ts`, which is what AD10's own handoff proposed
and what a reader of the first version of this ruling would reach for. **That site is wrong and
would break the other half of the ruling**: `groupEdits.groupDetails` shares that function, so a
refusal there would refuse grouping a mixed selection — which this ruling explicitly permits. The
check belongs in `participants` in `arrangeDetails.ts`, which `groupEdits` does not call. And
`moveDetails` currently bypasses `participants` and calls `resolveParticipants` directly because it
needs no boxes, so it must be routed through `participants` too or the move-by fields go on
accepting a mix through the back door. One funnel, or the rule holds in four places out of five.

Recorded at this length because the shape of the mistake is the point: a ruling that names a
BEHAVIOUR is not finished until somebody has found the one function every affected path actually
goes through, and the first plausible function was shared with a path the ruling exempts.

### AD12-R1 — "lock reference" is already true by construction. No control is owed. Opacity is a real gap and is a different item. (2026-09-17)

AD12's card item 1 asks for a guided sequence ending *"calibrate known length, lock reference,
trace"*, and AD01 §1 S04 lists *"background lock/opacity: absent"*. The worker asked what locking
would even mean here. **Measured rather than argued:** every designer layer is built by
`designerLayerConfig` with `listening: false` — its own docblock states that for SDD §62 — and no
tool in `src/presentation/designer/tools/` moves, scales or nudges the background. There is no
gesture anywhere in this surface that can disturb a reference once it is set.

So the property "lock reference" names **already holds**, and a lock control would be a switch whose
off position is unreachable — the live control that does nothing this repository refuses, in its
purest form. Nothing is owed and nothing is built. AD01 §1 S04's "lock" half is satisfied; its
wording should be read as describing the concept board rather than a gap in the code.

**The trigger is precise:** an increment that makes the background draggable or independently
scalable — a "nudge the reference into place" gesture, most likely — creates the state a lock would
protect, and owes the lock in the same change.

**Opacity is NOT covered by this and is a genuine gap.** Fading a reference to trace over it is a
real need, its off state is reachable, and it is absent. It is not AD12's to build: it needs
`runtime.ts`, `DesignerCanvas.vue` and `DesignerViewMenu.vue`, none of which are in that card's
lease, and it is a leaf-local view preference of exactly the kind `PartView` already holds. It sits
in the integration queue as one item for the runtime's owner.

## C01 — Boundaries and source of truth

Keep the current Asset aggregate, catalogue scope and per-asset geometry sidecar. The library manages reusable definitions; the designer authors one definition; the plan places instances. Graphic groups are not assemblies, purchases, requirements, rooms or work packages. No Plan/Renovate mode is introduced in the designer.

Keep TypeScript, Vue 3, Pinia, Konva/vue-konva, Vite, Vitest and the existing validation/persistence infrastructure. The vault remains authoritative. Domain/Core must not import Vue, Pinia, Konva, Obsidian or browser DOM APIs. Do not persist Konva scene JSON. Runtime canvas objects are projections of validated domain state. [R02, R03, W01]

Retain a Vue app/runtime per Obsidian view, subject identity in the host's view state, and existing resource lifecycles. Do not add an account, remote API, telemetry dependency, alternative editor framework or monolithic universal Plan/Asset editor.

## C02 — Identity, geometry and units

Canonical measured coordinates are millimetres. Display units and zoom do not alter stored coordinates. Width/depth are derived from the physical footprint; height remains independent descriptive metadata. Decorative bounds serve visual fit/hit-testing, never physical measurements. [R04, R10, R11]

Retain stable asset IDs and graphic element IDs. The current detail `name` is a semantic key: add a separate optional user label rather than silently repurposing it. Display an appropriate fallback when no user label exists. Preserve legacy user data and array order. [R07]

Proposed graphic union: a closed curved outline or an open polyline. A straight line is an open polyline with two endpoints, not a separate drawing/document system. Closed physical footprints and clearances still have area requirements. Open graphics use length/finite-coordinate/point-count rules, not area rules. Do not require both axis extents to be positive for a horizontal or vertical line.

Do not add arbitrary SVG path strings, embedded HTML, ellipses, compound holes or recursive symbol instances to this first model expansion.

## C03 — Four different editing operations

| Operation | Required behavior |
|---|---|
| Create from dimensions | Create a valid measured rectangle for a new/shapeless asset. |
| Resize whole object | Transform the intended physical/graphic geometry about the declared anchor, preserving identity/topology and obeying curve/clearance rules. |
| Resize selected graphic part(s) | Change only those parts; never infer a new physical footprint, height or facing. |
| Replace footprint | Explicitly replace the physical boundary, preview consequences and confirm destructive replacement; do not disguise this as ordinary resizing. |

Typing the current value, Escape and cancelling a dialog create no command/history entry. Numeric drafts stay raw text until committed, preserving invalid/incomplete input for correction. Do not quantize canonical values merely because the inspector displays rounded measurements.

A footprint replacement must explicitly preserve, transform or remove dependent graphics/clearance/placement controls according to the accepted command. Default: preserve them only where their coordinate space remains compatible, require review and offer a clear undo; do not silently discard them.

The existing whole-object scaling code also scales clearance and retains circular bulges under nonuniform scaling. These are existing behaviors to supersede deliberately, with a spec/ADR update and regression fixtures—not unrecorded implementation mistakes to “clean up.” [R05, R06]

## C04 — Circular arcs and transformations

Translation, rotation and positive uniform scaling preserve circular-arc representation. Reflection must transform coordinates, orientation and arc signs coherently. A general unequal X/Y scale of a circular arc yields an elliptical arc; keeping a circular bulge is a different operation.

Default for this release: lock proportional scaling for custom geometry containing circular arcs. Explain the restriction next to numeric/handle controls. Allow nonuniform scaling of straight-only shapes where validation permits. Parameterized preset creation may regenerate intended geometry explicitly, with a warning before replacing manual edits.

Do not rewrite existing curved geometry during migration, and do not claim it now represents an ellipse. A future ellipse/path representation or tolerance-controlled flattening needs its own contract, tests and rendering/export coverage.

Whole-object translation/rotation/reflection must transform all relevant geometry and placement semantics consistently. The exact math-to-screen mapping must be read from current adapters. UI direction labels must agree with actual placement; “up/down = 0 degrees” is not copied from a mockup.

## C05 — Selection and gesture state

Keep ephemeral selection distinct from persisted data. The contract has a selected graphic ID set plus a primary/focused ID. Footprint, clearance, anchor and facing remain explicit special selections. Bulk graphic grouping does not absorb those special attributes. “Select whole object” is a separate deliberate action.

Selection changes are not document edits. Rehydration prunes removed IDs but does not retarget a queued command to a new selection. Capture subject ID and selection intent before enqueueing; reconcile the version at the documented command boundary.

Default hit behavior: select the visually topmost eligible part; expose an overlap chooser/Parts alternative. Marquee inclusion policy must be one documented rule, not an accidental dependency on drag direction. Start with intersection-based selection and show the count. Adding/removing members has a visible keyboard/touch-accessible control, not only a modifier.

Pointer lifecycle: idle → pressed → previewing → committing → settled, with cancellation from pressed/previewing. A drag threshold prevents a click from becoming an unintended move. Pointer capture/release, pointercancel, Escape, focus loss and view teardown have explicit outcomes. Final pointer-up suppresses the synthetic click that would otherwise clear the selection.

A preview is not a vault write. A successful completed gesture is one history entry. A cancelled/refused/no-op gesture is none. Intermediate pointer moves do not become separate commands.

## C06 — Grouping and order

Start with shallow groups of graphic elements. A member belongs to at most one group; a group cannot contain another group, footprint, clearance, placement control or reference image. Reject dangling, duplicated or cyclic membership rather than repairing it silently.

Grouping/ungrouping preserves existing coordinates and canonical element array order. Group membership is editing metadata, not a new scene layer or a second z-order authority.

Interleaved group members remain visually interleaved until the user explicitly changes order. Bring group to front/back moves the members as a stable block while preserving internal order. Keep ambiguous step-forward/back for noncontiguous groups unavailable until its precise semantics are specified. Individual parts retain their supported ordering actions.

Duplicate/repeat assigns fresh IDs once and remaps group membership consistently. Redo reuses the command's IDs subject to conflict rules; it does not generate a different identity graph on every execution. Repeat specifies whether spacing is an edge gap or centre distance and validates count/size limits.

Alignment defaults to selection bounds; a key-object option explicitly identifies the fixed reference. Distribution specifies centres versus edge gaps, retains its endpoints and refuses undefined or unsupported cases. Locked elements must not move by implication.

## C07 — Scale, references and clearance

Preserve the existing pending flags per captured coordinate group. Calibration changes exactly the groups it owns. An asset's reference calibration never changes a plan's calibration or already measured groups. Replacing a background does not itself change known millimetres. [R04, R10, R11]

Measured and pending geometry may coexist in storage, but composite transforms must not silently combine incompatible coordinate spaces. Require compatible measured inputs for whole-object precision transforms; keep reference-space editing separate. Metadata grouping may be allowed, while incompatible spatial operations are refused with an explanation.

A draft can be saved while unscaled. It must not be presented as dimensionally verified or as a reliable fit check. Preserve any existing allowed approximate-placement behavior with explicit warning; do not invent physical dimensions from placeholder pixels. A new precise-placement path may offer “Set measurements” or “Calibrate” instead of a misleading success state.

Clearance is an authored planning boundary, not a regulatory approval. Keep arbitrary traced boundaries. A four-side numeric helper is valid only for supported rectangular geometry and must say it is generating a boundary; do not infer four setbacks from an arbitrary curved polygon.

Default resize policy: do not scale a clearance down silently. Preserve its absolute geometry and mark it as needing review, or refuse the resize until the user explicitly chooses a supported clearance action. AD01 chooses the minimal persistent review representation that fits current storage. Before that representation lands, refusal with a clear reason is safer than an ephemeral warning that vanishes on reopen.

A “reviewed” interaction never certifies code compliance. No supplied sample clearance dimensions are requirements for real construction. Height remains stored/shown/exported but is not an input to vertical clash checks. [R03]

## C08 — Persistence, history and failures

Use the current reversible-command pathway, expected versions and repository ports. Keep noteVersion and geometryVersion separate. One logical action may span resources, but the current whole-shape document write is not proof that Markdown and sidecar writes form a database transaction. [R09, R10, R11]

All mutating doors obey the same per-leaf sequencing and refresh policy, including undo/redo barriers, preset/dimension replacement and background updates. Do not recursively enqueue from a step that is already executing inside the queue. Separate queued entry points from internal unqueued primitives.

A write is complete only according to a defined outcome: written and refreshed, written but stale, refused/conflicted, or failed. Saved must not imply that a stale canvas is current. A failed read is not “asset missing”; a missing sidecar is not a corrupt sidecar. A retry after an uncertain write must reconcile before repeating it. [R09, R11, R12]

External edits, moved/deleted notes, plugin unload and two leaves editing one asset must not cause silent overwrite. Preserve original versions/intent, report conflicts and refresh or recover explicitly. Do not blindly restore old snapshots over a newer external edit during undo.

For creation/duplication/import involving multiple files, use a documented staged/recovery protocol. Compensating cleanup must verify that it only touches files created by that operation and has not overwritten later user edits. Never delete arbitrary files to make a test pass.

## C09 — Schema evolution and compatibility

At the reviewed commit, the asset sidecar schema reads v1 and v2 and emits v2. New durable groups/graphic kinds require the next available version. Re-resolve that number at execution; another branch may already have allocated v3. [R08]

Migrate semantically, not by trusting a raster preview. Preserve identities, line behavior, order, bulges, pending flags, measured coordinates and all placement attributes. Default only absent compatible fields; reject malformed present values. Unsupported newer versions must be refused before any write so old code cannot strip unfamiliar fields.

Do not mutate a real vault in migration tests. Keep fixtures immutable and use temporary copies. Explain that code rollback alone is insufficient after writing a new schema: recovery may require restoring a verified backup or using an explicit compatible downgrade path. No downgrade is assumed lossless.

## C10 — Rendering and export

Maintain one canonical geometry interpretation across authoring canvas, library thumbnails, plan placement and every current export path. A reusable render projection is acceptable; a new parallel authoritative geometry store is not.

Handle all geometry kinds exhaustively in bounds, hit-testing, snapping, projection and export. Closed solid/dashed semantics survive the upgrade; open paths remain strokes. Guides, handles, temporary isolation and reference sheets are editing aids, not default output.

Viewport scale is not physical scale. A Konva Transformer, if retained/adopted, changes node scale properties and needs explicit normalized commits through domain rules; attaching multiple nodes is not an implementation of transactional grouping. [W02, W03]

## C11 — Shared definitions and historical output

Working plans continue to reference shared definitions. Show impact scope and provide Duplicate as new asset for intentional divergence. Do not add draft/publish versions simply because the generated board contains a Save button. [R03]

Frozen/issued consumers must retain all render-relevant referenced asset state through the existing revision mechanism. If no such capability is implemented, do not label a live preview as frozen or approved. AD14 is mandatory to establish either tested historical preservation for existing claims or explicit capability gating for unavailable claims. A thumbnail is not a sufficient historical record.

## C12 — UX, themes and evidence

Use English source/product copy through existing localization mechanisms and retain existing supported locales. No account, logo, compass or marketing header. Match the current Plan Editor's interaction conventions but keep separate contexts.

Selection is the resting mode. Show advanced geometry only when relevant. Use host theme variables; validate both light and dark, not just the white concept boards. Responsive layout reacts to leaf width. Compact desktop support is not proof of phone editor support; preserve the actual platform gate until a separate mobile decision is accepted.

Every enabled control must be reachable and functional. Tests must exercise actual command wiring, not only component existence. A browser harness result is not a real Obsidian navigation test. A screenshot is not proof of correct dimensions. Report evidence with the commit and test layer.

Source references are resolved in [SOURCES.md](../references/SOURCES.md).
