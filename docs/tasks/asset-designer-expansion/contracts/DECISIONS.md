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

### AD14-R1 — a durable clearance review flag IS owed. One boolean, schema v4, and a measured clearance stops scaling. (2026-09-17)

C07's resize paragraph ends: *"Default resize policy: do not scale a clearance down silently.
Preserve its absolute geometry and mark it as needing review, or refuse the resize until the user
explicitly chooses a supported clearance action. AD01 chooses the minimal persistent review
representation that fits current storage. Before that representation lands, refusal with a clear
reason is safer than an ephemeral warning that vanishes on reopen."*

**AD01 never chose the representation**, and AD01 §1 S09 named AD12 as the owner of the state — a
card whose lease held no schema, no mapper and no aggregate, so it could not reach it from where it
stood. This ruling chooses the representation and allocates the schema version so that **AD14** can
build it, AD14 being the card that already owns the revision and snapshot question. It APPLIES C07
and revises nothing; `r1` is untouched.

**"Not owed" was considered and is refused, because the gap is live rather than speculative.** A
user traces 600 mm of clearance in front of an oven, types a smaller width into Edit dimensions,
and the boundary they authored becomes a different number with nothing on screen or in the file
saying so. C06 already refuses the same shape one level down — *"locked elements must not move by
implication"* — and a clearance is the most consequential thing in this aggregate to move by
implication, because it is the only figure here a person plans a room around.

#### What is there today, measured in this edit rather than recalled

`scaleDesign` (`src/domain/asset/shapeEdits.ts:238`) scales the clearance about the anchor under no
condition at all: `clearance: shape.clearance === null ? null : about(shape.clearance)`. Its only
`src/` caller is `scaleDesignToDimensions` in the same file, whose only `src/` caller is
`AssetDesignerRoot.vue:277`, behind the Edit dimensions dialog. `grep -rn "scaleDesign" src/` prints
twelve lines and exactly two of them are those calls; the other ten are prose. **So the whole of the
behaviour this ruling changes reaches a user through one gesture**, which is why it can be changed
at the one function rather than guarded at every caller.

#### The decision, in three parts

**1. A measured clearance is PRESERVED through a whole-object scale rather than scaled.** This is
C07's own named default and not a third option invented beside it, and the reason to prefer it over
scale-and-flag is what each leaves on screen. Scale-and-flag fabricates a boundary the user never
authored and then asks them to check a number that looks authored; at 600 mm becoming 500 mm, a
glance accepts it. Preserve-and-flag leaves the authored 600 mm standing beside a smaller object,
where it visibly no longer fits — **the wrongness is the notice**, and the flag is what makes it
survive a reopen. In code this is smaller than the alternative rather than larger: the clearance arm
stops calling `about`.

**A PENDING clearance goes on scaling with everything else, unchanged.** That is `r1` row 2, which
parks exactly this and only this, and its reasoning holds: a pending clearance's coordinates are
background pixels, the whole capture shares one space, and scaling them weakens nothing that is yet
a measurement. The flag is therefore never set on a pending clearance either.

**2. The representation is one boolean, `clearanceNeedsReview`, on `AssetShape`,** beside the three
pending flags it is modelled on. That is the minimal thing that fits current storage, which is what
C07 asked AD01 for. The three alternatives, each refused for a stated reason:

- **Reuse `clearancePending`.** Refused outright. That flag means *these coordinates are background
  pixels*; overloading it would fire the unscaled warning over genuine millimetres and would let a
  calibration clear a review. Two meanings in one field is the second-answer-to-one-question defect
  this repository refuses everywhere it has a name for it.
- **A review revision or timestamp compared against the sidecar's `revision`.** Refused on a
  measurement: that counter bumps on **every** write to the document, so a clearance nobody had
  touched would read as stale the moment an unrelated detail moved. A warning that always fires is
  one nobody reads, which is worse than the gap. It also wants a clock, and nothing in `domain/`
  has one.
- **Keeping the pre-scale clearance so it can be restored.** That is shape history, which `r1` row 3
  refuses outright (*"No shape history, no placement pinning"*), and it would cost the schema a
  second geometry for a state undo already covers.

**3. Schema version 4 is allocated here**, in this edit, as C09 requires (*"New durable
groups/graphic kinds require the next available version. Re-resolve that number at execution"*). v3
is current and shipped at AD04; nothing else in this branch has taken 4. The bump is REQUIRED for
v2's and v3's own stated reason, and the direction matters: a Zod object strips unknown keys, so a
v3-only build reading a v4 file would load it and **erase the flag on its next write, presenting an
unreviewed clearance as reviewed** — silently, which is the one direction of this field that is
unsafe. `z.literal(3)` makes that build refuse the file instead.

`.default(false)` and never `.catch(false)`, which is `footprintPending`'s own rule generalised: an
absent key is an older file and reads as not flagged, correct because a build that could not set the
flag never left one unset by mistake; a **present** malformed value fails the read rather than being
coerced. Defaults are for absent fields, never for malformed present ones.

**No asset-geometry migration table is owed by this.** Every added field has a default meaning *this
document predates the field*, so v4 is additive exactly as v3 was, and the
`2026-09-16-asset-designer-consolidate-design.md` §6 trigger — *the first non-additive
asset-geometry schema change* — still has not fired.

#### Who sets it, who clears it, and what draws it

**Set** in `scaleDesign`, and there alone: when the scale is not the identity, the shape has a
clearance, and that clearance is not pending. Both directions flag, not shrinking only — a clearance
is authored, and a user who typed 600 mm and then resized the object has a boundary they did not
author at either size. One condition, and no *down on one axis and up on the other* question left
for somebody to answer differently later. Rotation, reflection and translation set nothing: they are
isometries and weaken no distance.

**Cleared by any write whose SUBJECT is the clearance itself**, because a gesture aimed at the
clearance IS the review. Stated as a rule and deliberately not as a list — **the list is obtained by
`grep -rn "clearance" src/domain/asset/shapeEdits.ts src/application/commands/asset/` in the
implementing edit and the code is written from what the grep printed**, this package having got a
count wrong four separate times by writing the sentence first. At the time of this ruling that
reaches `mapPartOutline`'s clearance arm, `SetAssetClearance`, the four-side helper's regeneration,
and `removeClearance` — which already writes `clearancePending: false` for precisely this class of
reason and writes the review flag false in the same line.

**Plus an explicit `Reviewed` action in the inspector**, which is what *"mark it as needing review"*
implies a person can answer. **It is drawn only while the flag is set.** A predicate that stops
drawing it, never a `:disabled` — a control that is drawn and can only refuse is the live control
that does nothing, and this expansion has shipped that defect three times in three different cards.

#### Validation, and one guard deliberately NOT added

A shape with no clearance may not carry the flag — the same refusal, the same argument and the same
site as the existing `absent-clearance-cannot-be-pending` in `validatePlacement`: no command can
produce it, so one in a sidecar is a hand edit, and quietly clearing it would report an unreviewed
boundary as reviewed.

**No refusal is added for `clearancePending && clearanceNeedsReview`.** A capture replaces the
clearance and a calibration converts it, so the combination is unreachable, and an unreachable guard
costs a branch it can never pay back. This tree carries roughly nine arms of margin above its branch
floor; that is the budget such a guard would spend to say nothing.

#### Undo needs no mechanism

The flag rides on `AssetShape`, which the reversible design commands snapshot whole, so undoing the
resize restores the unflagged shape for free. **Do not build a second one.**

#### What this discharges, and what it owes in return

**It discharges the integration queue's clearance-under-resize obligation.** AD12 criterion 4 is met
by the preserve-and-flag arm, which is the first of the two C07 offers and the one `r1`'s own
reasoning points at — *a refusal now would block a common gesture to guard a rare one*.

**It owes C03's supersession treatment, because this one genuinely changes shipped behaviour.** C03
names the unconditional clearance scale as *"an existing behavior to supersede deliberately, with a
spec/ADR update and regression fixtures — not an unrecorded implementation mistake to clean up"*.
So: **ADR-0034** carries the decision in the repository's own durable record rather than only in
this package, and the fixtures that pin today's behaviour are AMENDED deliberately and never
deleted — `tests/domain/asset/shapeEdits.test.ts:219` (the clearance's scaled points asserted
literally) and its bounding-box case around `:245`, plus the `scaleDesignToDimensions` line in
`2026-09-16-asset-designer-consolidate-design.md` §7 reading *"every part — clearance and details
included — is scaled about the anchor"*, which stops being true of a measured clearance.

### AD12-R2 — a reference may be DELETED, through the command that already replaces one. (2026-09-17)

AD12's card owes deleting a reference and no door exists: `SetAssetBackgroundInput.path` is a bare
`string`, so replacement is expressible and removal is not.

**The domain already says yes.** `Asset.background` is `AssetBackgroundRef | null`, `withChanges`
resolves `'background' in changes ? (changes.background ?? null) : this.background`, and
`checkBackground(null)` answers `ok(null)` on its first line. `sameBackground` inside the command
already takes two nullable references and compares them. **Nothing needs designing; one input arm
needs admitting.** So this is not its own card — it is a small, well-bounded change to a command
whose every neighbouring behaviour is already specified, and it goes to the queue worker beside
background opacity, the two being one subject.

**Three answers the arm inherits rather than invents, each from the command's own existing account:**

- **The calibration is cleared**, for the reason replacement clears it and more sharply: a scale
  measured off a document that is no longer referenced names nothing at all. Same order — clear the
  sidecar first, then write the note — and the same compensation if the note write then fails, so a
  failed removal cannot destroy a valid calibration for a change that never happened.
- **The pending flags are untouched.** Coordinates captured in background pixels are still in
  background pixels after the picture is taken away; removing a reference does not turn pixels into
  millimetres, and a flag cleared here would present placeholder geometry as measured.
- **The two cheap pre-read refusals do not apply to a removal.** `backgroundKindOf` and
  `files.fileExists` both ask about a path, and a removal names none. Removing a reference to a file
  that has already been deleted must SUCCEED — it is the one gesture that repairs that state — so
  the removal arm sits above both, and a case pins it there.

**The control is drawn only while a reference exists**, the same predicate rule AD14-R1 states for
`Reviewed` and for the same reason.

### AD13-R1 — editing geometry in the designer OWES a usage scope. Undo is a remedy and a scope is a disclosure, and one does not stand in for the other. (2026-09-18)

AD13's acceptance criterion 3 reads *"Editing a shared definition has explicit usage scope; a
duplicate does not change the original."* C11 pairs the two in the same sentence: *"Show impact
scope and provide Duplicate as new asset for intentional divergence."* **The library half shipped
and the designer half did not**, and the asymmetry is the wrong way round.

#### What each surface does today, measured in this edit rather than recalled

`AssetUsageScope.vue` is drawn inside `AssetUsageDuplicate`, which `AssetInspector` draws on a
`ready` entry — so the scope stands in front of **Duplicate**. `DuplicateAssetCommand` writes a new
definition and touches no plan; the panel's own copy says so (*"Plans that place this asset keep the
original"*). That disclosure is true, and it precedes the one gesture on this aggregate that
provably changes nothing downstream.

The designer is where a shared definition is actually EDITED, and it discloses nothing:
`grep -rn "listPlansUsingAsset\|UsageScope\|used-in" src/presentation/designer/` prints **no lines**
at this commit. `DesignerInspector.vue`'s asset block is the name, the dimensions, the unscaled
note, three flat buttons, `DesignerUsePlan`, and then the AD12 and AD14 blocks. Every geometry
command dispatched from this surface rewrites the definition every one of those plans draws.

So C11's *"show impact scope"* is satisfied for the harmless gesture and unsatisfied for the harmful
one. **That is an accident of which card reached which file, not a decision anybody took** — which
is precisely why it is ruled here rather than inherited.

#### The arm REFUSED: "a geometry edit needs no scope because undo covers it"

Refused, and the reason is a category difference rather than a judgement about how good undo is.

- **Undo is per-leaf and in-session.** It is `CommandHistory` on the designer runtime; closing the
  leaf ends it. Nothing in the vault records that an edit widened past what its author expected.
- **Undo is reachable only by someone who already knows.** The whole content of an impact scope is
  telling a person the blast radius BEFORE they act. A user who does not know eleven plans place
  this object never reaches for undo, because nothing looked wrong.
- **"They saw the scope in the library on the way in" is not true by construction.** The designer is
  reached from a plan through `EditorNavigation.asset` — composed in `planEditorDeps.ts`, drawn at
  two predicated sites, and labelled **"Open in designer"** (`editor.asset.open-designer`). The
  first version of this ruling called it *"Edit shared asset"*, a label `grep` finds nowhere in
  `src/`: it was carried over from the ICR 2 withdrawal note in `INTEGRATION-QUEUE.md`, which
  described the door that was PROPOSED rather than the one that shipped. Corrected against the
  locale module, and left visible here because a ruling quoting a control that does not exist is
  the failure this package keeps paying for. Obsidian also restores a designer leaf from
  its own workspace layout with no library visit at all. A guarantee held by a route the user need
  not take is not a guarantee.

#### The decision, in three parts

1. **A usage scope is OWED in the designer, and criterion 3 is NOT met until it lands.** It must not
   be ticked on the library half alone.
2. **It is a passive STATEMENT, not a confirmation.** No dialog in front of a gesture, no
   are-you-sure before a drag. C12 makes selection the resting mode and this repository has refused
   a control that can only interrupt more than once; a scope that has to be dismissed would be read,
   ignored, then unread. It states which plans place this object, standing while the user works, in
   the designer inspector's own asset block.
3. **It is a SECOND CONSUMER of `ListPlansUsingAsset`, never a second query.** One question gets one
   answer here, exactly as `overlaps` and `listFacts` are one instrument each across two surfaces.
   The four drawn states are `AssetUsageScope`'s own — loading, refused, ready, and ready with
   `unreadable > 0` — because a designer that invented a fifth spelling of *some plans could not be
   read* would be the second answer this part exists to prevent.

#### Where the code goes, and the one thing to measure before writing it

`ListPlansUsingAsset` is constructed and guarded exactly once, inside `guardAssetDuplication`
(`src/plugin/guardedAssetLibrary.ts`), whose only caller is `assetLibraryDeps.ts`. The designer
cannot call that function without also building a `DuplicateAssetCommand` nothing dispatches — a
dead door composed to reach a live one. **Extract `guardAssetUsage(ports, logger, map)`** — the
`ListPlansUsingAsset` construction plus its `guardQuery` under the existing
`query.listPlansUsingAsset.failed` event name — and let `guardAssetDuplication` and
`assetDesignerDeps.ts` both call it. Spelling the two lines a second time in the designer's
composition was the cheaper edit and is refused for the reason part 3 gives.

The read is **gated on `indexScanCompleted()`**, which `AssetDesignerDeps` already carries for its
own hydration. `AssetUsageScope.vue`'s header states why: both repositories the query walks
enumerate through `index.getIdsByType` and answer `ok` over an empty index, so before the initial
scan the honest answer is *unknown* and the ungated one is *no plan places this asset* — at the one
surface whose entire job is to state a blast radius. That header also names the exposure this
ruling creates: *"the next caller of this query reintroduces the defect silently"*. This is that
caller.

`unavailableAssetDesignerQueries()` gains a refusing arm in the same edit, for the reason that
function already states — a bundle that refuses totally, never a nullable member with a branch in
every consumer.

#### What this owes in return

C09 is untouched: no durable field, no schema version, no migration. Nothing in `r1` changes and no
ADR is owed — this APPLIES C11 rather than superseding anything.

**The trigger for revisiting is a second editor of shared definitions**, not a widening of this one.
If a future surface can rewrite an `Asset`'s geometry without being the designer, it owes the same
disclosure in the same change, and the extracted `guardAssetUsage` is what makes that a one-line
composition rather than a third construction of the query.

### AD18-R1 — the header OWNS the asset's name; the Inspector drops its copy. (2026-09-20)

**Taken by the user**, asked directly, before the header was built.

AD06 item 1 asks for *"a restrained header with asset name, library return, actual save state, and
contextual Use in plan action"*. The Inspector already draws that name as
`.rp-designer-asset-name`, added in AD13 because nothing on the surface answered *"which asset is
this"* — its own comment records that `getDisplayText` titles every designer leaf identically and
that changing it alone would make this surface and the Plan Editor disagree.

So building the header creates a second answer to one question, which is the shape this repository
refuses everywhere it has a name for it. **The header takes it and the Inspector drops it.** The
Inspector keeps the usage scope, the fields and the actions; the name moves up.

**What the losing option was, because it is not obviously wrong.** Keeping both reads as "identity
at a glance, plus the anchor the usage-scope block sits under" — `AssetUsageScope` is drawn beneath
that name deliberately, so that an impact disclosure sits above the controls that rewrite the
thing. Whoever moves the name must check that block still reads as being about the asset without
the name directly above it, and say so in the card. If it does not, the answer is a heading for the
scope block, NOT a second copy of the name.

**This ruling changes no contract text.** C12's *"No account, logo, compass or marketing header"*
bans marketing chrome and is not a ban on a header; AD06's own item 1 excludes the same chrome in
its own words. The `state.json` blocker that read *"No header chrome, per C12"* generalised the one
into the other, and is corrected with AD06's re-opening.

### AD18-R2 — the Inspector is tabbed `Object | Reference`, two tabs, and neither board is copied. (2026-09-20)

**Taken by the user**, asked directly, because the concept boards CONTRADICT each other and neither
can be cited as the target: `01-overall-look-and-feel.png` draws three tabs, `Object | Style |
Reference`; `02-interaction-concepts.png` draws two, `Object | Properties`. A ruling is owed
precisely where §4's correction table is silent and the images disagree.

**Two tabs, `Object` and `Reference`**, chosen against what the surface actually has rather than
against either picture. The object, its placement and its clearance are one subject; the reference
sheet and its calibration are another, and are the half a user is not looking at while drawing.
**There is no `Style` tab**, because the designer has no styling controls — board 01 draws a tab
that would ship near-empty, and an empty tab is a promise the surface does not keep.

The problem it solves is measured rather than asserted: with one part selected the Inspector is
**887 px of content in a 625 px column**, 42 % below the fold before any clearance or review block
appears, in a 224 px rail. Placement, Reference, Clearance and the clearance-review answer are all
under it.

**Three things the implementing card must not get wrong.** The clearance-review notice is a
`role="status"` live region and step 29 of *Calibrate a sheet and reserve space* records a user
reading it as belonging to the Clearance block above it — a tab that separates the two would
destroy the one judgement this package has an answer for. The Parts panel's roving tabindex and the
Inspector's own `tabindex="-1"` are an existing keyboard model that a tab control has to join
rather than compete with. And `DesignerInspector` is drawn only when `design !== null`, which is
what keeps `.rp-designer-inspector` an empty REGION for a loading or failed leaf; a tab control
must not move that gate.

### AD18-R3 — the Basic-shape buttons MOVE into the `Add` rail; they are not duplicated there. (2026-09-20)

**Taken by the user**, asked directly at the start of session eight, before either card was
dispatched — because it decides the SCOPE of the icon-toolbar card rather than only the rail's.

AD18's sequencing table records that item 5 (the `Add` rail) *"needs a decision taken before code"*,
and names it exactly: *"a decision about what happens to the toolbar's shape buttons"*. §4 row 1 is
an ADOPT row — *"Large central canvas, Add/Parts on the left, contextual properties on the right"* —
and the complaint item 3 records is that the novice's two entry paths, "start from a preset" and
"draw a shape", are two unrelated mechanisms in two unrelated places. Leaving the shapes in the
toolbar answers the icon complaint and leaves that one standing.

**The losing option, because it is not obviously wrong.** Keeping the shapes in the toolbar as icons
costs less and keeps the two cards nearly disjoint, and a drawing tool is arguably a TOOL rather
than a thing to add. It is refused because it would leave §4 row 1 half-adopted after the very wave
whose subject is that row, and because a rail that offers presets but not shapes teaches a user that
"Add" means "preset".

**Duplicating them in both places is refused outright** and needs no measurement: two answers to one
question is the shape this repository refuses everywhere it has a name for it, and it is the same
refusal AD18-R1 already made about the asset's name.

**What this rules OUT of wave 10, which is a sequencing consequence rather than a narrowing.** Item 5
and item 3 now both edit `DesignerToolbar.vue`, so they cannot hold disjoint leases in one wave.
Item 3 ships first with all fourteen buttons iconified, including the shapes; item 5 lifts that group
out in wave 11 and inherits its locale keys, which is why W10-A's keys are named for the SHAPE rather
than for the toolbar. The intermediate state — iconified shapes still in the toolbar — is a shipped
state, not a broken one.

### AD18-R4 — `Add details` ticks, but never becomes the CURRENT step. (2026-09-20)

**Taken by the user**, asked directly during W10-B's fix round, against a rendered description rather
than a rendered picture — which the next reader should know, because nobody had drawn the checklist
when this was decided.

W10-B's trace checklist marks "the first step not done" as current. Four of its five steps are things
an asset must have; **`Add details` is optional in reality**, so on an otherwise finished asset the
pointer sits on it forever, with `Verify the dimensions` already struck through ABOVE it. The state
the card exists to fix reads worse: a typed-from-dimensions asset draws `Choose a sheet [current] /
Calibrate the scale / ~~Trace the footprint~~ / Add details / ~~Verify the dimensions~~`.

**The ruling: optionality is a property of the STEP.** `Add details` still ticks when detail graphics
exist, and is skipped when choosing which step is current. A sheet-traced asset with no details
therefore marks NO current step — which is the rule the component already states for the all-done
case, *"a finished sequence has no next thing to do"*, reaching the case it had missed.

**Both losing options, because neither is silly.** Leaving it is defensible if the pointer means
"the next thing you COULD do" rather than "the next thing owed" — it was already built, tested and
green, and this ruling costs a re-grade of a passing case. It loses because a finished asset reads as
unfinished and the pointer lands on the step a user deliberately skipped. Completing the sequence at
`Verify the dimensions` reads simplest, and loses because it lets a struck row sit below an unstruck
optional one with nothing marked at all.

**One implementation constraint, because it is the failure this component already guards against.**
Optionality goes in the same pair the key and the condition already live in. That component's own
comment explains why the steps are built as pairs rather than as a key list beside a boolean list —
a label and its condition drifting apart by one index is the failure a parallel-array spelling makes
silent — and a separate "optional" list would reintroduce exactly it.

### AD18-R5 — the left rail STACKS `Add` above `Parts`; it is not a tab pair. (2026-09-20)

**Taken by the user**, asked at the start of session nine, before W11-A was dispatched — because it
decides the rail's structure and therefore what the card builds.

AD18 item 5 records the gap partly as a count: *"there is no Add panel, no tab control
(`[role="tab"]` count in the rendered shell: 0)"*, and board 01 draws `Add` and `Parts` as a tab
pair. **That count stays 0 under this ruling, deliberately, and the sentence in AD18 is a
description of the board rather than a requirement this ruling fails to meet.** §4 row 1 — one of
only two ADOPT rows — asks to *"adopt the composition and adapt it to actual Obsidian leaf
dimensions"*, and at the 123–176 px this rail measures across 560–1280 (W10-A's `min(11rem, 22cqi)`
cap), that adaptation is exactly the question this ruling answers.

**Why stacked wins, and the reason is a gate rather than a taste.** `AssetDesignerRoot.vue` draws
`.rp-designer-parts` under `v-if="design !== null"`, so the region survives as an EMPTY one for a
loading leaf and for a hard failure — `assetDesignStore.fail` blanks `design` for both — rather than
drawing a list of parts nobody has read. AD18-R2 named that same hazard for the Inspector in its own
words: *"a tab control must not move that gate"*. A tab pair here would have to answer what the
`Parts` tab shows while `design` is `null`, and the cheapest answers all move the gate. An `Add`
section is unconditional — the shape buttons activate tools, which exist whether or not a design
has been read — so stacking puts a condition on one child and none on the other, which is what the
file already does.

**The second reason is AD08-R1.** That ruling blesses the Parts panel as C05's overlap alternative
*"reachable without a modifier"*, and refuses building a chooser partly because it would be a second
selection surface. Putting the panel behind a tab does not make it unreachable, but it does put a
press between a user and the thing that is currently the only way to select a part lying under
another. A ruling that costs another ruling's guarantee something should say so; this one declines
to spend it.

**The losing side, because it is not silly.** Tabs are what board 01 draws, they make the tab count
non-zero, and they give the rail one panel's height instead of two — which matters below 35 rem,
where `designer-narrow.css` already stacks the rail ABOVE the canvas at `flex: 1 1 0` and a taller
rail takes its share out of the drawing. That is a real cost of this ruling and it is not measured:
nothing in this repository lays out, so what the `Add` section costs the stacked rail at a 460 px
leaf is a RENDERED measurement the card cannot take and the integrator owes.

### AD18-R6 — the `Add` section carries the preset door, and the Inspector drops its copy. (2026-09-20)

**Taken by the user**, asked in the same question as AD18-R5 and before dispatch.

`startFromPreset` REPLACES the whole design — it dispatches `runtime.applyShape` and passes
`replaces: Boolean(design.value?.shape)` so the form can warn — which is the fact that decides this.
Board 02 draws the preset gallery inline in the left rail; **that arm is refused on semantics before
any measurement**, because a panel labelled `Add` whose gallery wipes the user's drawing is a false
label, and no rail width would make it true.

**What ships instead**: the `Add` section carries a door calling the same `startFromPreset`, and
`DesignerInspector.vue`'s `.rp-designer-start-preset` button is DELETED rather than left beside it.
That is AD18-R1's refusal applied to a second thing — the header owns the asset's name and the
Inspector dropped its copy; the rail owns the way into a preset and the Inspector drops its copy —
and it is the same refusal AD18-R3 made about the shape buttons. **The presets stay a modal**, so
AD18 item 5's complaint that *"presets are a modal behind an inspector button"* is answered in its
second half only, and this ruling does not pretend otherwise.

**`DesignerEntryPaths`'s copy of the same gesture STAYS, and the distinction is what makes this a
rule rather than a preference.** That component draws inside the empty-state overlay: it is a RANKED
FIRST-RUN action offered where there is no design yet, and its own docblock records that each path
*"calls the very function that path's ranked caller calls, so the two spellings of one gesture
cannot drift"*. What AD18-R1 and AD18-R3 refuse is two STANDING controls answering one question at
the same time; an empty state and a standing control are never both on screen for the same asset in
the same state.

**The losing side.** Keeping the Inspector's button costs nothing to build and is defensible on
`DesignerEntryPaths`'s own precedent — two callers of one function already ship. It loses because
those two are an empty state and a panel, where these two would both be standing rails visible at
once, which is the shape this repository refuses everywhere it has a name for it.

### AD18-R7 — the `(s)` plural spelling STAYS; AD18's bullet calling it a defect is withdrawn. (2026-09-21)

**Taken by the user**, asked before any code was written, after the integrator read the locale file
the bullet was about and found it already argues the opposite.

AD18's *"Two smaller things found in the same pass"* names *"the untranslated plural spelling
`placement(s)`"*. `src/presentation/i18n/locales/en/assetDuplicate.ts`'s own header answers it
directly: *"**The `(s)` plural is the house convention here**, copied from
`view.asset-library.used-in.project` rather than invented: there is no plural mechanism in `t`, and
inventing one for two strings would put a second answer to pluralisation in the tree."* The cited
precedent is real — `en-assetLibrary.ts` spells `requirement(s)` and `de-assetLibrary.ts` spells
`Anforderung(en)`.

**The bullet is wrong twice, and both halves are measured rather than argued.**

- It says *untranslated*. German IS translated: `de/assetDuplicate.ts` spells `Platzierung(en)`.
  The word it wanted is *unpluralised*, which is a different complaint and a much smaller one.
- It names one member of a convention as though it stood alone. The convention is **three keys and
  six strings**, reached from **five call sites across four files** — the commands that print those
  figures are in wave 12's lease table and in the report, rather than the figures being restated
  here, because a figure in prose is a figure nothing re-runs.

So fixing `placement(s)` alone would leave `requirement(s)` and `note(s)` spelled the old way, two
lines apart in the same file, converting a consistent convention into an inconsistent one and
falsifying the header that sits above them. **That is a card asking for the wrong thing, and a card
asking for the wrong thing cannot be closed by testing harder.**

**What ships: nothing in `src/`.** The AD18 bullet is amended to state what is true, and this ruling
is the authority the next reader reaches before re-finding it.

**The losing side, which is real and worth writing down.** `{count} placement(s)` genuinely reads
worse than `1 placement` in the one case a user meets most often, and English and German would both
be honest under two keys and a `count === 1` branch — no `Intl.PluralRules`, no new mechanism, just
twelve strings where there are six. It loses on scope rather than on merit: it is a wider change
than AD18 asked for, it overturns an argument written down in the code rather than an oversight, and
what it buys is cosmetic on a surface whose job is to state a blast radius accurately, which the
current spelling already does. **If it is ever taken, it must take all three keys**, and this
paragraph is what it has to answer.

### AD15-R1 — three matrix rows are regraded rather than given tests. (2026-09-21)

**Taken by the user**, asked before wave 14 was dispatched, after the integrator split AD15's
partial rows into those needing a vault and those needing only a test and found three of the ten
proposed were neither.

**T20 — `groups reject dangling/duplicate/NESTED` — is STRUCTURAL and gets no test.**
`validateMembers` in `AssetShape.ts` checks each member against `known`, the set of GRAPHIC ids. A
group id is not in that set, so a group naming another group is already refused as
`dangling-group-member` — by the case that exists (`groupEdits.test.ts` *"refuses a graphic the
design has not got"*). `AssetShape.ts` says *"One shallow group. `members` are detail ids"*, and C06
asks for shallow groups. Nesting is therefore neither separately expressible nor separately
refusable. **The losing side**: a case passing a group id as a member would document the mechanism
where a reader is standing. It loses because it drives an already-covered path under a misleading
name, and because asserting the absence of a state the types cannot express is the unreachable
guard CLAUDE.md warns costs a branch it can never pay back.

**T13 — `NoteVersion never used as GeometryVersion` — keeps its `partial` and the SENTENCE is
narrowed.** `AssetRepository` and `AssetGeometrySidecar` both import the same `EntityVersion` from
`./versioning`, so the two versions are one type and the compiler cannot refuse the swap. The hazard
IS pinned by cases — `reversibleAssetDesign.test.ts` *"undoes a geometry edit beneath a height edit,
rather than presenting the note version to the sidecar"*. The row asks for a guarantee this codebase
does not have, and the honest grade says so rather than reading as an oversight. **The losing side**:
branding the two types would make the compiler refuse it, which is real safety for a hazard a test
can only catch where somebody thought to look. It loses on scope — a `src/` change across two ports
and every call site, in a tree where `tests/**` is type-checked too, so the blast radius reaches the
suite. If it is ever taken it is a wave of its own, not a card.

**T01 — `L-resize keeps topology; Replace explicit` — is regraded `passed`, and the gap the row
names DOES NOT EXIST.** The row reads as though footprint replacement lacks the warning presets and
clearance have. Measured instead: `AssetDesignerRoot`'s `editDimensions` branches on
`unscaled || !current?.shape`. Only that branch reaches `setFootprintFromDimensions`, which builds a
fresh centred rectangle through `footprintFromDimensions` — and it is exactly the branch that shows
`designer.dimensions.unscaled` as the dialog's `warning`, or where there is no shape to lose. Every
other footprint goes to `scaleDesignToDimensions`, which SCALES: a traced L-shape keeps its corners
and its anchor keeps the relationship the user gave it.

**So a measured footprint is never silently replaced, because it is never replaced.** The
explicitness the row asks for is delivered by a BRANCH rather than by a warning, and both arms are
already asserted — `assetDimensions.test.ts` *"scales a calibrated L-shaped footprint instead of
squaring it off"* for the scale arm, and *"offers no default and says why, for a footprint whose
numbers are not measurements yet"* for the warned arm. **The losing side**: adding a replacement
warning anyway would be a second answer to a question the code already answers, which is the shape
this repository refuses everywhere it has a name for it.

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
