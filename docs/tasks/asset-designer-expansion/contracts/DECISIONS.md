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

### AD15-R2 — six of AD15's remaining rows are ruled rather than tested, and two were never open. (2026-09-22)

**Taken by the user**, asked before wave 16 was dispatched, after the integrator read all eleven of
AD15's remaining agent-reachable rows AT SOURCE against the tree. Three carry a half a jsdom test
can honestly close and became wave 16's cards (F10, F12, T32). The other eight are this ruling.

**The title says "six" and "two" rather than "eight" deliberately, and the distinction is the point
of the entry.** Six rows are DECISIONS — the user chose a regrade over a test, and each carries the
side that lost. **Two rows were never open at all**: T25 was closed nine days before the triage read
it, and T34 had already been assigned to the deferred manual pass. Recording those two as decisions
would credit this session with settling questions that were already settled, which is the shape
AD15-R1's own preamble warns about from the other direction.

**AD15-R1 is the precedent and this follows its format**, including its most useful habit: every
decision names **the losing side**, because a ruling that only argues for itself reads as settled
when it was a judgement.

---

#### The two that were never open

**T25 — `Escape, pointercancel, blur and outside release are safe` — the ROW was stale, and this is
a correction rather than a decision.** The row's text names two reasons it is not `passed`: that
*"the `keyDoors.ts` arm of `gestureInFlight()` is not driven — only the wheel door is"*, and that a
release outside the leaf commits while *"nothing asserts that commit"*. **Both were false when the
triage read them.** Commit `ef1ba2dff` (2026-09-19), whose message is *"Share the designer sweep
vocabulary, and close T25's two residual gaps"*, added exactly those two cases to
`tests/presentation/designer/designerCanvasGestureOwnership.test.ts`: *"lets the keyboard go again:
the zoom key zooms once the gesture has been abandoned"*, which drives the key door and asserts
refused-then-free in that order so that a surface never gating the keyboard would fail; and a
`describe('a sweep released outside the leaf')` whose case is *"commits the selection rather than
abandoning it"*.

**The matrix was edited three times after that commit — `896a5f6a9`, `8deda6182`, `4bc2ba5b7`, all
on 2026-09-21 — and none of them regraded T25.** That is the failure worth recording: a row is
re-read by whoever is editing the rows beside it, and nobody was editing this one.

**The row stays `partial`, for a DIFFERENT reason, and the new reason is narrower and mechanical.**
The outside-release case does not observe what a browser would: `jsdom` implements no pointer
capture at all — `setPointerCapture` is `undefined` on an element there, which is why
`EditorSurface` spells the call `?.()` — so the case drives the SHAPE capture produces (a release
dispatched at the container carrying coordinates outside its own bounding rect) and its own docblock
says it claims no more. The remaining gap is the browser, not the suite.

**T34 — `Use in plan places the real definition, returns context` — is not a triage row.** It is
already assigned to the deferred manual pass: `reports/MANUAL-PASS.md`'s table reads *"Take an asset
from the library into a plan — 19 human steps — discharges **U01, T34**"*. It was carried into this
session's triage set by mistake and is recorded here so the next reader does not carry it again. No
work is owed and no grade changes.

---

#### The six decisions

**T27 — `keyboard input in forms/notes is not consumed by designer shortcuts` — the NOTE-EDITOR half
is STRUCTURAL and gets no test.** Measured in this edit rather than recalled: `src/presentation/
designer/` registers **nine** key doors, every one a template binding on an element inside the
designer's own tree (`DesignerInspector.vue` three, `AssetDesignerRoot.vue` two, and one each in
`AssetPresetGallery.vue`, `DesignerPartsPanel.vue`, `DesignerViewMenu.vue` and `AssetPresetForm.vue`
through an `:on-keydown` prop). Nothing the designer mounts registers a key listener above its own
subtree: the only `listenOnOwner` call in anything it composes is `EditorSurface.vue`'s `'window'`,
`'blur'`, and the three other `listenOnOwner` calls in `src/` are `'document'`/`'pointerdown'` — a
disclosure dismissal and two Plan Editor menus. The two bare `addEventListener('keydown', …)` calls
in `src/` are both a Plan Editor component binding its own root.

**So a keystroke in a Markdown or CodeMirror editor cannot reach a designer handler, because a note
editor is a different leaf and there is nothing above the designer's subtree to reach.** §6's own
preamble in `ACCEPTANCE-AND-QA.md` agrees from the requirement side: *"Only the latter validates
host back/forward, per-leaf subject restoration, plugin remount/unload and interaction with a note
editor."* The designer's own boundary stays asserted by the cases the row already cites.

**The losing side, and it is the strongest of the six.** A CATEGORY check — a source scan asserting
that nothing under `src/presentation/designer/` registers an owner-level key listener — would hold
for code not yet written, which is exactly the form CLAUDE.md prefers over driving the paths
somebody thought of, and the instruments for it already exist (`tests/helpers/parsedSource.ts`,
`tests/helpers/importGraph.ts`). It loses **only on scope**, not on merit: the row's stated layer is
*Browser + real host*, so even a perfect structural check leaves the row `partial`, and this session
was scoped to closing rows rather than to adding guards. **It is a live candidate for a later wave
and should not be read as refused.**

**T05 — `canonical values survive unit change and fractional editing` — the DISPLAY-UNIT half
assumes a NAMED FUTURE increment, and the setting that looks like that feature is INERT.** The
mm-canonical and fractional-input halves stay asserted by the cases the row already cites. The
display-unit half was measured three ways and all three agree: `\.units\b` over `src/` reaches only
`src/plugin/settings/` and the two locale tables that label the row; a destructured `{ units } =`
has **zero** hits; and the `Units` type is declared in `settings.ts`, named in one **comment** in
`ProjectIndex.ts`, and referenced nowhere else. Every test that names it sits under `tests/plugin/`.
The display path is hard-coded in the other direction: `formatLength.ts` and `formatArea.ts` each
build an `Intl.NumberFormat('en-US', …)`, and both docblocks name *"the per-plan units PBI"* as the
increment that would make that locale a variable.

**A finding falls out of this that is larger than the row, and it is recorded rather than acted
on.** `settings.units` binds a control in the settings pane and persists through `saveSettings`, and
**nothing reads it**. AD16's release checklist ticks *"No unfinished or nonfunctional controls
advertised"*. That box is at least arguable while this row exists. It is **out of this package's
scope** — the setting is plugin-wide and predates the expansion — and it is written here because it
was measured here, so a later session finds it from the decisions side rather than rediscovering it.

**The losing side**: none worth taking. A test for the display-unit half would have to invent the
feature first, and a row cannot be closed by building what it assumes.

**T26 — `click-after-drag does not clear or retarget` — the sentence is NARROWED to the mechanical
reason.** The row previously read *"Narrower in LAYER: the row says browser and every case is
jsdom"*, which reads as a scope complaint and invites the next reader to try harder in jsdom. The
real reason is mechanical and settles it: **jsdom implements no pointer capture**, measured —
`setPointerCapture` is `undefined` on an element there — so the browser semantics that
click-after-drag depends on cannot be produced in this suite under any amount of effort. The
behaviour stays asserted at the layer that is reachable.

**The losing side**: the in-app browser driving `npm run harness` could demonstrate it, and one
session's demonstration produces no repeatable gate. A picture nobody re-runs is not evidence a
later session can rely on, which is the same argument this repository already makes about an unrun
manual case.

**T08 — `undo/redo cannot overtake write/read-back` — the guarantee is at the PORT layer and the
sentence now says so.** The row asks for session/fault injection; the faults are injected at fake
ports, because there is no session boundary in this environment to inject at. The behaviour is
asserted densely by the three files the row already cites. **The losing side**: none available
without a host — which is the honest form of this row rather than a defect in it.

**T42 — `compact panes keep actions and errors reachable` — the refusal already written INTO the row
is promoted here, unchanged, so it is findable from the decisions side.** It **must never be graded
`passed`** from an environment with no pinned Chromium, and there is none on this machine;
`npx playwright install chromium` is forbidden here because it emptied `node_modules` once. jsdom
applies no container query, so `styles/designer-narrow.css`'s `@container rp-designer (width <
35rem)` block has zero effect in every case and nothing in the suite sees the compact layout.

**What the row already carries and this ruling keeps**: that narrow block declares only
`flex-direction`, `flex`, `width` and border swaps and **no `display`/`visibility` at all**, so it
hides nothing and the invariance the file does assert would hold in a real browser too. That is a
reason to believe the row will grade well, and it is not evidence that it does. **The losing side**:
capturing with `RP_CHROMIUM_EXECUTABLE` pointed at some other browser on disk would produce a
picture, and this repository's own rule is that a capture taken with an unannounced substitute is
one somebody then reasons about as if it were the pinned browser's.

**F02 — `composed vanity` — regraded to point at the whole-workflow instrument that already
exists.** Measured: the string `vanity` appears nowhere in `src/`, `tests/` or `docs/tests/`. The
whole-workflow instrument F02 asks for is `docs/tests/cases/Compose an asset from parts.md`, which
is written and unwalked, so the row takes the grade U05 took for the identical reason: **`not-run` —
a written case exists**.

**The losing side**: a composed-vanity BUILDER is trivially writable and would sit naturally beside
`toiletShape()` in `tests/helpers/assetShapes.ts`. It loses **twice**. With no consumer it is a dead
export and `npm run analyze` fails on one — that gate currently reports zero. With a consumer, that
consumer re-drives paths `arrangeDetails.test.ts` and `groupEdits.test.ts` already cover, under a
themed name that makes the coverage look wider than it is — which is AD15-R1's T20 losing side
verbatim, one ruling later.

### AD18-R8 — the vanity ships as a PRESET, and the preset IS §4 row 2's fixture. (2026-09-22)

**Taken by the user, asked before any code was written**, in these words: *"add the vanity preset and
canvas rulers and also close existing gaps."* A preset is wider than §4 row 2 asks for, so this
ruling exists to record the widening as authorized rather than leaving a later session to "correct"
it back to fixture-only.

**§4 row 2 says fixture, and every summary of it says vanity.** Read at source it is: *"Vanity as an
integrated example | Adopt as a test fixture; dimensions are illustrative, not construction
recommendations."* The user has authorized a preset in addition. That is added scope, taken
deliberately.

**The important half is that this does not overturn AD15-R2 — it removes the premise AD15-R2 rested
on.** That ruling refused a composed-vanity BUILDER, and named exactly two reasons, both about a
`tests/helpers/assetShapes.ts` export: with no consumer it is a dead export and `npm run analyze`
fails on one, and with a consumer that consumer re-drives `arrangeDetails.test.ts` and
`groupEdits.test.ts` under a themed name. **A preset answers both.** It lives in
`src/domain/asset/presets/sanitary.ts`, and `ASSET_PRESETS`, `AssetPresetForm.vue` and
`presetThumbnail` are real product consumers, so it is not a dead export; and the test that drives it
is `presets.test.ts`'s existing `describe.each`, which is the preset contract rather than a themed
re-drive of the arrange and group suites. **So F02's fixture is the preset**, reached as
`ASSET_PRESETS.find((p) => p.id === 'vanity')`, and no `tests/helpers/` builder is written. AD15-R2's
losing side stands unchanged for the builder it was actually about.

**The `Include basin` toggle is DROPPED.** Board 01 draws one and it has nowhere to live:
`PresetFieldKey` is a closed union of ten keys and `PresetField.kind` is exactly
`'length' | 'count' | 'angle'`, so there is no boolean and no `height`. Three arms were put to the
user and the toggle lost on semantics before it lost on cost — **a vanity without a basin is a
cabinet**, and `washbasin` already ships as its own preset for the basin-only case, so the control
would have an off position that duplicates a neighbouring preset. This is AD18's *"a board element
that is absent is not automatically a defect"* rule applied to a control rather than to a picture.

**The losing side:** modelling it as a `count` of 0/1 needed no domain change and would have kept the
board's control. It loses because it renders as a number field where the board draws a switch, and
because it ships a preset that can build a basin-less slab nobody asked for. If a vanity ever needs a
genuine option, the honest form is the boolean kind, not a count wearing one.

**Dimensions: 800 × 450 mm default, with a range that spans 1,000 × 500.** The two recorded figures
disagree and both are in this package: board 01 draws 800 × 450 under Bathroom, while
`references/previous-expansion-concept.md` §11's end-to-end scenario says *"creates a 1,000 × 500 mm
vanity"*. The board wins the DEFAULT because it is the artefact the user was looking at when they
said the surface *"does not look like the design-concepts"*; the range carries the scenario so that
walk stays reachable by typing rather than being contradicted. §4 row 2's own sentence governs both:
*dimensions are illustrative, not construction recommendations.*

**Wood-grain artwork stays absent** under §4 row 12; the preset ships as wireframe, and its thumbnail
is derived by `presetThumbnail` from the built shape, so no artwork is authored at all.

### AD18-R9 — canvas rulers are the approved spec's increment 3, built in full, as a DOM overlay. (2026-09-22)

**Taken by the user**, who asked for canvas rulers directly. The session brief that proposed them
said rulers were *"on no list at all"* and that there was *"NO ruler anywhere and no precedent to
copy"*. **Both are false, and finding that out changed the job before a line was written.**

**Rulers are governed.** `docs/superpowers/specs/2026-09-15-asset-designer-snapping-and-guides-design.md`
§0 — approved section by section in brainstorming on 2026-09-15 — splits that iteration into three
increments and names the third: *"Rulers — top and left millimetre rulers following the camera, with
the selection's extent marked, on this document's step function."* `reports/AD00-baseline.md` item 4
records the same thing from the other side: *"The repository's own owed increments — dimensions on
canvas and rulers — are in no AD card and belong in the wave plan."* So this is an owed increment
being delivered, not a board element being adopted, and **§4 governs none of it** — a grep of §4's
twelve correction rows and of every ruling in this document returns nothing about rulers.

**The mechanism was already decided and is not reopened here.** That spec's own decision table, under
*"Decisions already taken for the whole iteration, so increments 2 and 3 do not reopen them"*, reads:
*"Canvas annotations (dimensions, rulers) | DOM overlay in `EditorSurface`'s overlay slot, positioned
by `worldToScreen` — the plan editor's `RoomDimensionLabels` pattern. Konva labels were refused."*
The two refusals it records are a clickable Konva node fighting a hit test where every designer layer
is `listening: false`, and a hybrid whose two render cadences visibly lag each other during a drag.
**A Konva ruler layer is therefore already refused**, which is worth stating because the obvious
reading of the designer's `layers/` directory is that a ruler belongs in it.

**Measured rather than assumed, the mechanism is available today.** `EditorSurface.vue` exposes the
named `overlay` slot; `DesignerCanvas.vue` forwards its own default slot into it
(`<template #overlay><slot /></template>`); and `AssetDesignerRoot.vue` already passes a child
through that path, its own comment saying so. `RoomDimensionLabels.vue` is the shipped pattern,
positioned by `worldToScreen(point, editor.viewport, STAGE_PIXELS)` and styled `position: absolute;
inset: 0; pointer-events: none`. **That last property is load-bearing rather than cosmetic**: the
overlay wrapper carries `@pointerdown.stop`, `@pointerup.stop`, `@pointercancel.stop` and
`@wheel.stop`, so a ruler that accepted pointer events would silently eat gestures the canvas needs.

**The step function is `designerGrid`, and there is no second one.**
`src/presentation/designer/grid/designerGrid.ts` answers `{ step, origin }` over the series
`[1, 5, 10, 50, 100, 500, 1000, 5000]` mm at `MIN_STEP_PX = 12`, counted from the committed
footprint's box minimum. Its own docblock says *"ONE function for the drawn grid, the snapped grid
and the status readout, so the three cannot disagree"* — **a ruler is its fourth consumer, and that
sentence is updated in the same edit**, which is this repository's rule about a count stated in a
comment.

**`src/presentation/editor/layers/rulerGeometry.ts` is NOT the precedent, and the name is a trap.**
It is the calibration segment's marks — a spine, two end bars and ticks along one arbitrary segment —
and its own header states that its spacing is *"screen pixels, and deliberately not world
millimetres"* because the gesture runs before the plan has a scale, so *"these ticks are a visual
metaphor ... never a scale to count off"*. Its only nontrivial part, `affordableSpacing`, decimates by
doubling until 48 ticks fit; a canvas-edge millimetre ruler needs the opposite — a world-anchored
origin and a round-number step, which is `designerGrid`. Two further greps mislead in the same
direction and are named here so the next reader does not re-find them: `CanvasGrid.vue` calls the
GRID *"the Plan Editor's visual ruler"* in prose, and `creationCatalogue.ts`'s `'ruler'` is a lucide
icon name for the measurement tool.

**Scope: the full increment 3, including the selection's extent.** Put to the user as three arms —
rulers alone with the extent deferred, the full increment, or increment 2 first — and the user chose
the full increment. **The losing side is real**: the extent marking couples the card to the selection
store, where rulers alone need only the camera and the step function, and that seam would have made a
smaller and more obviously correct card. It loses because the spec defines increment 3 as both halves
and a half-delivered increment is one a later reader has to re-derive the boundary of.

**Increment 2 (dimensions on canvas) is NOT a prerequisite and REMAINS OWED.** Rulers need the camera
and `designerGrid`, both shipped with increment 1; nothing in them reads a dimension annotation.
Delivering 3 before 2 is a deliberate reordering of an approved spec and is recorded as such here, so
that a later reader does not take the presence of rulers as evidence that increment 2 landed. It has
neither a spec nor a plan document written.

### AD18-R10 — a 50% canvas share SATISFIES §4 row 1 at narrow widths, and the ruler is bound to it. (2026-09-22)

**Taken by the user.** AD18 item 6 recorded the canvas at 68.8% of the shell at 1280, 47.4% at 760
and 31.0% at 580, against §4 row 1's ADOPT of a *"large central canvas"*. Re-measured in a browser on
2026-09-22 after the rail work: **68.8% at 1280, 50.0% at 760, 50.0% at 580** — the rails shrink now
and the canvas no longer absorbs the whole loss. **Whether 50% satisfies that row was a decision
nobody had taken**, and item 6 had been sitting as an open defect on the strength of figures its own
fix had superseded.

**It is ruled satisfied.** The board implies roughly 65 to 70%, which §4 row 1 itself qualifies —
*"adopt the composition and adapt it to actual Obsidian leaf dimensions"* — and at a 580 px leaf a
two-rail composition that leaves the drawing half the shell is the adaptation that row asks for
rather than a failure of it.

**The ruler is bound to that number, and that binding is the half worth keeping.** A top and left
ruler takes canvas away on both axes, at exactly the widths where there is least of it, so the ruler
card **must measure its own cost in a real browser and report the figure**, and **must not take the
canvas below 50% at 580**. Without that binding this ruling would quietly license the regression it
was taken to prevent. No gate in this repository can check it: jsdom computes no layout, so this is a
rendered measurement or it is nothing.

**The losing side:** leaving item 6 open would have kept pressure on the rails and might have bought
the board's 65 to 70% back. It loses because the remaining rail width is `designer-narrow.css`'s
shared lease, and because the measured gain from 31.0% to 50.0% already answers the complaint the
item was written about; reopening it now would spend a wave on a proportion the user has looked at
and accepted.

#### AMENDED the same day: the binding is the canvas COLUMN's share, and the drawing figure is disclosed beside it

**The ruling as first written had two readings, and W17-B's independent review found them.** Measured
in a browser on the ruler candidate at a 580 px leaf: the canvas COLUMN is **290.02 px, 50.0%**, and
the ruler moves it **not at all** — before and after agree to the hundredth of a pixel, because the
overlay draws inside the canvas rather than displacing it. But the ruler occupies **18 px per axis**,
so the DRAWING area is 272.02 × 794 of 290.02 × 812, and 272.02 of 580 is **46.9%** — under the
floor. The sentence *"must not take the canvas below 50% at 580"* does not say which of the two it
means, and the clause above it — *"a top and left ruler takes canvas away on both axes"* — reads like
the second.

**Taken by the user: the COLUMN's share binds.** The decisive argument is that the other reading is
**unsatisfiable rather than strict**: the column sits at exactly 50.0%, so *any* ruler of any size at
580 falls below it, and AD18-R10 read that way would forbid precisely what AD18-R9 authorizes. A
binding that cannot be met by the thing it governs is a drafting fault, not a high standard.

**So the ruler ships at every width, and the 46.9% is DISCLOSED rather than dissolved.** It is a real
cost to a real user at a sidebar leaf, and it is written here, in the ruler's own report and in the
component, so that nobody re-derives it later as a discovery. What the binding still did is the work
it was taken for: it forced a rendered measurement that no gate in this repository can perform, and
that measurement is what turned an assumption into two numbers.

**The losing side, which is not hypothetical.** Hiding the rulers below `designer-narrow.css`'s 35 rem
breakpoint would have kept the full 290 px of drawing at the width where there is least of it, for a
container-query rule and a test. It loses because the surface where a millimetre reference helps most
is the cramped one, and because 18 px of a 290 px canvas is 6.2% spent on the only scale reference the
designer has — the grid still defaults off, by §2.6. **If the narrow case is ever reported as too
tight, that is the change to make and it is cheap**; this paragraph is what it has to answer.

**One thing this amendment does NOT settle**, and the review was right to keep it separate: at 580 the
left ruler's topmost labels sit under the opaque top strip, which is an occlusion defect of the same
family as the `25(` clipping the candidate found and fixed, and is invisible to jsdom for the same
reason. That is the card's to close, not this ruling's.

### Two rows that were NEVER OPEN, recorded as corrections rather than as decisions

Both entered this session's proposed gap set as live candidates and neither was work. They are
written here for AD15-R2's reason: **recording a correction as a decision credits a session with
settling what was already settled.**

- **`Show grid` defaults off is CORRECT, and the designer's slot is NOT shared.** The inherited claim
  was *"one shared `WorkspaceStore.gridVisible` ... flipping the designer flips the Plan Editor"*, and
  it is false in both halves. The default is the approved spec's own §2.6 — *"Defaults as the plan
  editor's: Grid off, Snap on"* — so it is a decision, not a defect. And the surfaces do not share a
  value: each view calls `app.use(createPinia())`, `WorkspaceStore`'s header ends *"Each leaf has its
  own Pinia scope"*, and the per-device slots are different keys — `assetDesignerDeviceSlots`'
  `${pluginId}:designer-view` against `planEditorDeviceSlots`' `${pluginId}:editor-view`. §2.6's
  *"their own slot, separate from the plan editor's"* is already satisfied. **The source of the false
  claim is one parenthetical**, `DesignerCanvas.vue`'s *"(its `gridVisible` is shared)"*, which is
  about layer visibility being a Plan Editor concern and reads as though it were about the value.
  What IS owed is small, and is a card rather than a ruling: `assetDesignerDeviceSlots`' docblock
  asserts the separation in prose and **no test pins that the two keys differ**.
- **`reversibleAssetDesignWindows.test.ts` is NOT unclaimed by the matrix.** `RESUME.md` called it
  *"the strongest two-leaf evidence in the repository, claimed by NO matrix row"* and proposed a row
  for it. `grep -n reversibleAssetDesignWindows` over `reports/AD15-validation-matrix.md` prints one
  hit, in row **T08**, which already cites it beside `designerWriteChain.test.ts` and
  `editShape.test.ts`. No row is owed. **This is the T25 shape exactly, one session later**: a claim
  in a hand-off that nobody re-ran against the document it was about.

### AD18-R11 — increment 2 ships IN FULL as a DOM overlay, and the premise that the overlay slot forbids interactivity is FALSE. (2026-09-22)

**Taken by the user**, who chose the full increment over two narrower arms. This is the approved
2026-09-15 spec's **increment 2**, the last one owed of three; AD18-R9 delivered increment 3 before
it, deliberately, and recorded that so nobody read rulers' presence as evidence 2 had landed.

**§0 specifies it verbatim** and this ruling reopens none of it: *"Dimensions on canvas — overall
width × depth along the footprint, the selected part's size and its offsets to the footprint edges,
each value a button opening an inline field, updated live from the drag preview, an 'All dimensions'
view toggle, and no numbers on an unscaled part."* The decision table above it fixes the mechanism
for the whole iteration — **DOM overlay in `EditorSurface`'s overlay slot, positioned by
`worldToScreen`**, the `RoomDimensionLabels` pattern, with Konva labels and a hybrid both refused.

**The session brief called the pointer-events question "the single biggest unknown ... it deserves a
decision put to the user if it forces a mechanism change". It forces nothing, because the premise
was false.** Measured rather than reasoned:

- `.rp-plan-overlay` declares **no `pointer-events` at all**. Its whole rule is `display: contents`
  (`styles/editor.css:189-191`). A grep of `styles/` for that class returns that rule and one prose
  mention.
- The four `.stop` modifiers on the wrapper (`EditorSurface.vue:1151-1157`) are **bubble-phase**.
  A child's own handler runs first, in the target phase, untouched; the modifiers only keep the
  event from reaching `.rp-plan-canvas`'s camera handlers. They are a shield FOR the canvas, not a
  shield AGAINST the overlay. `EditorSurface.vue`'s own comment already said so.
- **`RoomDimensionLabels` — the precedent the spec names — is this feature, already shipped and
  fully interactive.** `RoomDimensionButton.vue` is a real `<button>`; `InlineRoomDimension.vue` is
  a real `<form>` with a focused `<input inputmode="decimal">`; `RoomDimensionControls.vue` swaps
  them on `draft?.axis === axis`; and focus returns to the button on close.
- The pattern is `pointer-events: none` on the CONTAINER so the children can set `auto`
  (`styles/editor-direct-actions.css:2` and `:8`). Interactive DOM already lives in the designer's
  own overlay slot today — `DesignerEntryPaths`' three `.rp-empty-state__action` buttons.

**So the cost of interactive labels is one CSS line plus `@keydown.stop` on the inline form root**,
the keyboard twin `AddMenu` already carries for the same reason.

**A sentence this ruling REFUSES to let a third file inherit.** `DesignerRulers.vue`'s header and
`styles/designer-rulers.css` both justify their `pointer-events: none` by claiming that, because the
wrapper carries `@pointerdown.stop`, *"a ruler accepting a press would silently eat the gesture the
canvas needs"*. That is a non-sequitur: the `.stop` handlers do not make an accepting child eat
anything. The correct reason to put `none` on a container is so its children may opt back in — which
is what `.rp-dimension-labels` does two files away, the same declaration with the opposite
conclusion. **The dimensions card corrects both sentences in the same edit**, because a sibling
partial is exactly how this would reach a third file.

**Scope: the full increment, including the inline editing.** Put to the user as three arms — the
full increment, read-only annotations with editing as a second card, or overall-plus-part-size with
the offsets deferred — and the user chose the full increment. **The losing side is real and is the
same one AD18-R9 weighed**: this is the largest single card this package has run, and the two
narrower arms would each have been smaller and more obviously correct. It loses for AD18-R9's
reason — a half-delivered increment is one whose boundary a later reader has to re-derive — and
because the half that looks riskiest, the inline field, is the half with a complete shipped
precedent.

**What is NOT reusable, and the card must not try.** `InlineRoomDimension`'s props take a
`RoomDimensionDraft` carrying `submit()`, `error`, `form.values`, `blocked` and a `controls` triple —
a Plan Editor task object with no designer equivalent, whose edits go through `editShape`/`ShapeEdit`.
**Take the pattern, not the components.**

**Two bindings this ruling carries forward from AD18-R9 and R10, because they are about the same
overlay:** every measured number reads the PREVIEW (`preview.value ?? design.value?.shape`), never
the committed shape — the ruler card was sent back for exactly that, and the spec's own words are
*"updated live from the drag preview"*; and only the grid step and origin read the committed shape,
so a drag does not slide the grid under itself. **`designerGrid`'s docblock names FOUR consumers and
there are four.** A fifth call updates that sentence in the same edit.

**No gate here can see any of this.** jsdom lays nothing out, so the positioning, the occlusion and
whether a label is legible at a 460 px leaf are a rendered measurement or they are nothing.

### AD18-R12 — the `All dimensions` toggle is LEAF-LOCAL and is not persisted. (2026-09-22)

**Taken by the user.** It becomes `DesignerViewMenu`'s fourth row; there are three today — Grid,
Snap to objects, Reference opacity — counted from `data-rp-view` rather than remembered.

**It is the Reference-opacity kind of row, not the Grid kind.** A plain `ref` on
`useDesignerRuntime()`, destructured in setup so `v-model` unwraps it. The menu's own header already
blesses two kinds of row and this is the second.

**The losing side, which the user accepted:** the toggle forgets across sessions and across the
`rebind` that a settings save performs, so a user who wants all dimensions shown re-ticks it every
time they open the designer.

**Why the persisted arm lost, and it is a layering argument rather than a cost one.** Grid and Snap
persist through `EditorViewPreferences` in `PlanEditorContext.ts`, whose `read()` and `write()`
signatures name `gridVisible` and `snappingEnabled` literally, plus `useViewPreferences.ts`. That
type is consumed by the **Plan Editor**. Persisting a designer-only view toggle would widen a shared
Plan Editor contract to carry a field the Plan Editor has no use for — which is the wrong direction
for a decision about one surface. If the toggle is ever reported as wanting memory, that is the
change to make and this paragraph is what it has to answer.

### AD18-R13 — the designer owes a RETRY, not a write block and not the pause disclosure. (2026-09-22)

**Taken by the user**, on a question W18-C opened rather than answered and which this package had
been carrying as three questions rather than one: whether a designer write should be blocked while
the canvas is stale, whether the surface owes a retry action, and whether it owes the hidden pause
disclosure the Plan Editor's strip carries.

**The fact that decides it was measured, and it is not the one the framing implied.**
`assetDesignStore`'s `stale` is set at exactly ONE place — a re-read that FAILED on a
non-authoritative error while real content is already on screen. **It is never set by a failed
write.** So the in-memory design a stale canvas is showing is still exactly what the user drew; what
has gone wrong is the vault-side read, not the drawing. And `stale` is cleared by ANY successful
hydration — *"the ONE event that retires a stale-data warning"*, in the store's own words.

**Therefore a `Try again` that re-hydrates IS C08's reconcile.** C08 requires that *"a retry after an
uncertain write must reconcile before repeating it"*, and a hydrate is precisely a reconcile: it
re-reads the vault and, on success, retires the warning. The designer gets that door, on the stale
notice, which is today a bare `<p class="rp-designer-notice" role="status">` with no children.

**`writesBlocked: () => false` is UNCHANGED and is now a ruling rather than an accident.** The
Plan-Editor-matching arm was refused for a reason that is not about cost: because `stale` comes from
a READ failure, blocking writes would freeze a surface whose in-memory design is perfectly valid on
account of a vault hiccup, taking a gesture away from a user mid-drawing — and the designer has no
undo-safe recovery path to give it back. A gate that punishes the user for the vault's failure is
the wrong gate.

**The pause disclosure is refused WITH the block, and deliberately as one decision.** The Plan
Editor's hidden `pausedReason` sentence exists so that every paused control's `aria-describedby` has
something to name; with nothing paused here, that sentence would describe a state this surface does
not enter, and a reference naming an id no element carries is what axe reports as
`aria-valid-attr-value`. The two travel together or neither does.

**The losing side, stated plainly:** a user can still go on editing a canvas the vault has moved
past. The retry is a door OUT, not a stop. What makes that acceptable rather than merely cheap is
that the write path already refuses rather than overwrites — `AssetGeometryStore.write` opens by
reading the file — so the failure mode is a refused write and a toast, not a silent clobber, which
is the outcome C08 actually protects.

**This changes a manual-pass step and the change is owed in the same session.**
`docs/tests/cases/Recover an asset design rather than lose it.md` step 10 reads *"Look for a **Try
again** button ... There are none"*, and that expectation becomes false the moment this ships. A
walker following the old text would report a pass as a failure — the same hazard session thirteen
had to repair across five steps of that very case.

### AD18-R14 — `All dimensions` owes collision avoidance, and the defect was found by LOOKING. (2026-09-22)

**Taken by the user**, on a finding no gate in this repository can produce and that the card which
built the feature explicitly could not check: it had no browser, and it named label collision on a
small part as the likeliest real defect in its own work.

**Measured against the running harness at the wave-19 integration sha**, `?view=asset-designer`, the
vanity shape, a 1280 leaf, at the camera `DesignerCanvas` fits on mount:

| State | Labels | Overlapping pairs |
| --- | --- | --- |
| Resting (selection-driven) | 2 | **0** |
| `All dimensions` on | 26 | **31** |

Three labels coincide **exactly** — `detail-detail-1-width`, `clearance-width` and `overall-width`
share one 33.4 × 30 px box. `dimensionFigures` appends the overall pair LAST and every
`.rp-designer-dimension` wrapper is `z-index: auto`, so paint and hit order is DOM order: the
overall label is always on top and always takes the click, and **the two beneath it cannot be
reached at all**. The independent review predicted exactly this mechanism from the code and was
explicit that whether it was visible remained a rendered measurement. It is visible.

**Three things narrow it, and the ruling is written from them rather than around them.** The
RESTING state is clean, so the feature's default costs nothing. The crowding is OPT-IN, behind a
toggle a user turns on. And it is CAMERA-DEPENDENT rather than structural — zooming in separates
the labels, measured at 31 → 24 → 22 → 13 over three wheel steps, so a user who does not know why
two labels are missing can still get at them by accident. **That series describes the state BEFORE the fix and is not advice for the state after it** — the re-capture below measures the shipped rule at 0 → 1 → 0 unclickable over the same gesture, so zoom changes which labels crowd rather than relieving the crowding, and the manual pass says so.

**It is fixed anyway.** The deciding argument is that the unreachable pair is a control that does
nothing, which this repository refuses everywhere else — the same standard `AssetDesignerRoot`'s
empty state and `DesignerFieldRow` are held to — and a measuring surface whose measurements hide
each other is failing at the one job the whole iteration was chosen for. *"Precision and measuring"*
is §0's own framing.

**The losing side, which is not small.** Collision avoidance has NO precedent in this tree, so it is
a design problem solved from scratch; it widens increment 2 past what §0 specified, which named a
toggle and not a layout engine; and **no gate here can check the result**, so whatever ships needs
another browser pass to verify and is otherwise unfalsifiable. The arm that loses is recording the
measurement and letting a vault walk decide whether it bothers a real user — genuinely defensible,
and refused because an unreachable control is a defect by this repository's own standing rule
rather than a matter of taste.

**Scope is the overlay's own geometry and nothing else.** `writesBlocked`, the tool gate, the C03
no-op comparison and the signed-gap convention are all settled and are not reopened. The resting
state must stay at zero overlaps — that is a floor the fix may not trade away to improve the
toggle's case.

#### The re-capture, RUN — and it took THREE rounds to satisfy this ruling

**Round 2 did not meet the charter and the browser is what said so.** Drawn at the merged sha, a
1280 leaf, the vanity, at the fit camera: overlapping pairs fell 31 → 14 and exact coincidences fell
3 → 0, exactly as that round predicted. But a reachability sweep — sampling a grid across every
label's box with `elementFromPoint` — found **two labels of 26 with no clickable point at all**,
which is what this ruling forbids in as many words.

**The mechanism was the one the review had predicted and said nothing here would catch.** Measured:
`detail-detail-1-offset-top` is 20.5 px wide at y 127, and three later, wider labels sit at
dy **+10.5, −8.1 and −19.1**. Every one is outside the pairwise same-row threshold of 8, so the rule
correctly saw no collision with any of them — and together they blanketed its full 30 px height.
**A union is not a pair, and no pairwise rule can reach it.**

**Round 3 closed it, and its prediction was TESTED rather than trusted.** The card stated, before the
capture: *"Unclickable: 0. Any non-zero is a failure of this round. Overlapping pairs: 16. I'm wrong
if it's outside 14–18."* Measured: **0 unclickable, 15 pairs**, resting unchanged. Both inside the
stated bound.

| At the fit camera, 1280 leaf, 26 labels | Before | Round 2 | **Round 3** |
| --- | --- | --- | --- |
| Overlapping pairs | 31 | 14 | **15** |
| Exact coincidences | 3 | 0 | **0** |
| **Labels with no clickable point** | — | **2** | **0** |
| Resting state (2 labels) | 0 pairs | 0 pairs | **0 pairs, 0 unclickable** |

**A RESIDUAL REMAINS AT INTERMEDIATE ZOOMS AND IS NOT DISSOLVED.** One wheel step in from fit, **one**
label of the 14 still inside the canvas had no clickable point (`detail-detail-1-offset-right`); at
two steps, none of the 2 remaining did. So the charter is met **at the camera the designer opens
with**, which is the state every user meets, and a mid-zoom state can still hide one. Smaller than
what it replaced, and not nothing. This paragraph exists so nobody reads "0 unclickable" as
unconditional.

**Two instrument lessons, pointing opposite ways.** A first reachability sweep reported that zooming
made things WORSE — 2, then 13, 23, 24 — which was `elementFromPoint` returning null for labels
pushed outside the viewport, so CLIPPING was being scored as COLLISION. Restricted to labels whose
box lies inside `.rp-plan-canvas`, the honest series is 0 → 1 → 0. And an earlier probe, which set an
inline width on a flex child whose track overrode it, returned a perfectly clean "one line at every
width" for a measurement it never performed. **An instrument that over-reports and one that reaches
nothing are the same defect**, and both appeared within an hour.

### AD18-R15 — the stale retry is CONSTRAINED, and the defect was found by injecting a probe. (2026-09-22)

**Taken by the user**, on a rendered measurement taken AFTER W20-A had merged and passed review.
The control is correct and does what AD18-R13 rules; it LOOKS wrong, and no gate in this repository
can see that.

**Measured against the running harness at the W20-A integration sha**, `?view=asset-designer`, a
1024 px leaf:

| | |
| --- | --- |
| Leaf | 1024 px |
| Notice | 1024 × 24.6, its own `background-secondary` and a 1 px `border-top` |
| Button | **1024 × 30, `left: 0`** — the full width of the leaf |
| Where it sits | BELOW the notice's tinted strip, on the plain background |

**The cause is one declaration and it is not the card's.** `.renovation-asset-designer` is
`display: flex; flex-direction: column` with `align-items: normal`, which resolves to `stretch`, so
an unclassed `<button>` that is a direct child takes the whole leaf. W20-A's own report declined
every appearance claim and said so plainly; the review then derived the stretch from the stylesheet
without a browser. **Both were right and neither could see the picture**, which is the whole reason
this step exists.

**How it was seen at all, and the limit of that.** `tests/harness/page.ts` passes `stale` to the
PLAN EDITOR branch only — `mountAssetDesignerHarness` takes `select`, `mode`, `draw`, `camera`,
`pending`, `grid` and `viewMenu`, and no stale knob — so **no fixture can put the designer into this
state and no capture can photograph it.** The measurement was taken by injecting the real markup
from `AssetDesignerRoot.vue`'s `v-if` block into the rendered tree, the same way AD18's header
finding was taken. **That is a PROBE and not a fixture**: it proves what the layout does with those
two elements present and it does not make them present in any capture. A harness knob is the
separate change that would, and it is not ruled here.

**The losing side, which is real.** The control WORKS: it retries, it keeps the canvas, it swaps its
sentence on a second failure, and it is reachable and labelled. Recording the measurement and
letting the vault walk judge it was the other arm, and it is defensible — nobody has complained,
and this session is long. It loses because the stale notice is the designer's entire recovery story
and the first thing a user meets when a read fails is a full-width bar that reads as chrome rather
than as an action.

**Scope: the button's own presentation and nothing else.** AD18-R13's behaviour is settled and is
not reopened — not `writesBlocked`, not the sibling placement (which four test files require), not
the failure sentence, not the in-flight guard. `styles/designer.css` is at **399 of its 400-line
cap**, so this needs a new partial and the one `@import` beside it; those two cannot be leased
apart.

**It owes a re-capture.** The fix is unfalsifiable by every gate here, so the integrator draws it
again through the same probe and reports the number, or the card has not been checked.

#### The re-capture, RUN — all six checks met

Drawn at the merged sha through the same injected probe, at a **1280** leaf, against the six checks
the card named:

| Check | Before | After |
| --- | --- | --- |
| Button width | **the full leaf** | **75.5 px**, intrinsic |
| Button left | 0 | **8 px** |
| Button height | 30 | 30 |
| Notice still full width, with its tint | yes | yes |
| Gap | — | **4 px below**, 0 above, so it sits against the strip |
| Reads as an action | **no** — a bar across the leaf | **yes** |

**The alignment intent is verified rather than asserted**: the button's box left is 8 px and the
notice's `padding-left` is 8 px, so its edge sits under the first character of the sentence, which is
what the partial says it is for. `align-self` computes to `flex-start`.

**The judgement half stays a judgement.** It reads as an action to the integrator's eye in the
harness, which declares none of a themed vault's colours; the manual pass carries it as a `judgement`
step for a person in a vault, which is the only instrument that can settle it.

### Three AD18 gaps were CLOSED BEFORE THIS SESSION, and are recorded as corrections rather than as decisions

**Written this way for AD15-R2's reason: recording a correction as a decision credits a session with
settling what was already settled.** All three were proposed to this session as outstanding work, by
`RESUME.md` and by the session brief, and none of them was work. Read at the tree:

- **"The `Add` half of the Add/Parts rail does not exist"** — `DesignerAddPanel.vue` exists, is
  imported by `AssetDesignerRoot.vue` and is mounted above `DesignerPartsPanel` in the same region.
  The rail's `role="tab"` count stays 0 **by AD18-R5**, the presets stay a modal **by AD18-R6**, and
  the shape buttons MOVED rather than duplicated **by AD18-R3**. Every element the gap named as
  missing is present or explicitly ruled out.
- **"A wrapping text toolbar"** — the gap section nominated its own instrument,
  `grep -rn "HostIcon" src/presentation/designer/`, and recorded it returning **0**. It returns
  **3**. The shape buttons are filtered out of `DesignerToolbar`, and `styles/designer-toolbar.css`
  carries the post-change rendered measurement the gap section said was owed.
- **"Reference tracing is guided once, in prose, then not at all"** — `DesignerTraceChecklist.vue`
  exists, draws five steps with `aria-current="step"`, and is mounted OUTSIDE
  `DesignerReferenceStatus`'s `v-if` on purpose, so it is no longer an empty state only.

**`AD18-concept-fidelity.md` was behind the tree on all three and `RESUME.md` inherited it.**
That document records gap 4 as CLOSED and gap 8 as AMENDED inline; gaps 3 and 7 carry no such line
at all, and gap 5's amendment ends by saying the repair is still owed. The amendment lines are added
in the same session as this ruling. **The instrument that settles a gap is the tree, and a gap list
is a document about the tree rather than the tree itself.**

**One residue is carried rather than closed, and it is a LOOK rather than a gap**: the `Add` rail's
height cost at a 460 px leaf, what takes the second visual toolbar row at 460 px, and whether the
trace checklist's current row reads as a highlight at all. Each was named by the card that created
it. None is checkable by any gate here.

### The three `src/` findings: B is taken, A and C stay record-only (2026-09-22)

**Taken by the user, re-asked because the scope had changed again.**

**B is in scope** — `PlanAssetUsage.projectId`. Re-verified, and it is NARROWER and worse than the
inherited wording: the field reaches no consumer at all. `PlanAssetUsage` is imported by **no file**;
the five importers of the `AssetPlanUsage` envelope name `projectId` **nowhere**. So two plans both
named `Kitchen` in different projects draw as two rows of identical visible text, while the sibling
`AssetInspectorUsedIn.vue` keys on `projectId` *precisely because* a display name is not unique —
the same hazard with opposite answers in one directory. **Closing it is bigger than recorded**: the
field is an ID, and no view can draw an id, so the query must also carry a project NAME.

**A stays record-only** — `unrecoveredWrite`. The designer sets it, provably (its dispatcher wraps
the save-state tracker, and `SetAssetBackground` can return an uncompensated error), and
`grep -rn "unrecoveredWrite" src/presentation/designer/` returns **zero**. **The inherited phrase
"drawn nowhere" is false and is not repeated here**: it has nine consumer files, every one of them
Plan Editor or Project Work. It stays record-only this session because closing it needs a row in
`AssetDesignerRoot.vue`, which is the dimensions card's lease, and a NEW locale key —
`editor.unrecovered` reads *"Inspect the floor's note"* and is not reusable by an asset designer.
Manual-pass steps **B19, B20** continue to observe it.

**C stays out of this package** — `settings.units`. Nothing outside `src/plugin/settings/` reads it;
both formatters hard-code `'en-US'` and `m²` and both docblocks defer to *"the per-plan units PBI"*.
**That is a PER-PLAN fact, which this global setting cannot satisfy even if a reader existed**, so
the honest fix is that PBI rather than a patch here. It bears on AD16's ticked *"No unfinished or
nonfunctional controls advertised"* and is recorded so it is not rediscovered.

### AD18-R16 — twelve further board gaps are CLOSED as a parity round, and each is outside every earlier ruling. (2026-09-22)

**Taken by the user**, asked directly in session fifteen after a fresh audit of the running harness
against both concept boards, in three batched questions of four gaps each. **All twelve were
approved.** None is in AD18's *Deliberately absent* table, and none contradicts AD18-R1…R15:

| Gap | Board | Shipped before |
|---|---|---|
| Toolbar zoom cluster (− / % / + / fit); the readout MOVES out of the status region | 01, 02 | status-region readout, no controls |
| Labelled Basic-shape tiles in the Add rail | 01 | four unlabelled icons |
| Canvas legend (clearance, footprint, details, placement point, front direction), View toggle, leaf-local | 01 | none |
| Back-to-library arrow in the header | 02 | text `Open library` |
| Compact field rows, short label + unit suffix, full label kept as accessible name | 01, 02 | label stacked above input |
| Arrange set-transform and Repeat folded into closed disclosures | 01 | always open |
| Height grouped with Dimensions; `Select multiple parts` moves to the Parts panel | 01 | split by an unrelated checkbox |
| Placement point as a segmented `Back centre | Centre | Custom` control | 01 | text row and two buttons |
| Asset thumbnail and category chip atop the Object tab — no name, per AD18-R1 | 02 | none |
| Align and distribute as icon buttons | 01, 02 | ten text buttons |
| Right-click menu (Group, Ungroup, Duplicate, Delete) plus Ctrl+G / Ctrl+Shift+G | 02 | Delete and Ctrl+D keys only |
| Corner radius for rounded rectangles, ONLY if read back from geometry with no schema change | 02 | fixed quarter-short-side radius |

**The user also approved downloading the pinned Lucide SVGs** (revision `2bfb9bb1`) the new icons
need as harness fixtures. Nothing downloaded ships in the plugin.

**What this does NOT reopen.** The *Deliberately absent* rows stand; Board 01's third `Style` tab
stays refused (AD18-R2); the presets stay a modal (AD18-R6); the rail stays stacked (AD18-R5). The
corner-radius item carries its own stop condition — AD11 item 2's *"store parameter intent only if
subsequent edits can maintain it"* — so a card that finds it needs a schema change returns to the
user rather than taking one.

The work plan is [`reports/AD18-parity-round-plan.md`](../reports/AD18-parity-round-plan.md).

### AD18-R17 — a second parity round: fifteen board gaps approved, one declined. (2026-09-23)

**Taken by the user**, in session sixteen, after a fresh audit of the running harness against both
concept boards at 1280 and 460 px in both schemes. The gaps were put as four batched multi-select
questions, and **fifteen of sixteen were approved**. Each is outside AD18's *Deliberately absent*
table and does not contradict AD18-R1…R16:

| Gap | Board | Shipped before |
|---|---|---|
| Icon-only toolbar tools at every width, with the label kept as accessible name and tooltip | 01, 02 | labels shown at wide widths; with a part selected the toolbar wraps to 2 rows at 1280 (71 px) and 3 at 460 |
| Magnifier zoom icons (`zoom-out` / `zoom-in`) | 01 | `circle-minus` / `circle-plus` |
| Scale bar (`0 250 500 mm`), stepped by `designerGrid` | 02 | none |
| Dimension lines with arrows and extension lines, value with unit | 01 | a boxed number |
| Corner radius SURVIVES a Width/Depth edit: a detected rounded rectangle is rebuilt through `roundedRect` with its radius clamped | 02 | radius field vanishes because the corners stop being circular |
| Corner radius as a slider beside its number field | 02 | number field only |
| Position X \| Y and Size W \| D paired on one row each; `Appearance` and `Order` folds | 01 | one field per row, always open |
| Front direction as a picker with a mini preview, through the existing facing edit | 01 | a sentence plus the Set-facing tool |
| Clearance: `Show clearance` view toggle, a link/uniform control, the four fields folded under `Advanced` | 01 | four fields and Generate, always open |
| Legend detail: `Clearance (300 mm)` only when all four sides are equal; `Placement point (back centre)` | 01 | bare labels |
| Context menu with ONE separator; Group/Ungroup/Duplicate/Delete keys also bound on Parts rows | 02 | two separators; keys bound on the canvas element only |
| Relative save time (`Saved just now`) — see AD18-R19 | 02 | `Saved` |
| Harness `&stale` knob for the designer, with a capture of the Try-again retry | — | none; AD18-R15 measured it only through an injected probe |
| `Source & scale` block: Source and `Dimensions set`, READ-ONLY and derived | 01 | none |
| Asset Library tile grid — see AD18-R18 | 01 | shelves of price rows |

**Declined: `Preview in plan`** (boards 01 and 02). It would be a new read-only surface. The use-in-plan
door already ships, and §4 row 6's refusal of the green *"fits well"* card would leave the preview
nothing to say about fit.

**Three board elements are carved OUT of approved rows, because each needs a stored field and this
ruling authorizes no schema change** (C09; AD18-R16's own stop condition):
- board 01 panel 4's `Shape` dropdown, because changing a part's kind REPLACES its geometry, which C03
  refuses to disguise as an edit;
- board 02's `Show direction in plan`, a per-asset render flag;
- board 01's `Mark as needs verification`, a durable review state beside AD14-R1's one boolean.

A card that finds any approved row needs a stored field returns to the user rather than taking one.

**Two bindings that come from the contract rather than from the boards:**
- **The Front direction picker shows no degree figure copied from the board.** Board 01 reads
  `Top (0°)` and C04 says *"'up/down = 0 degrees' is not copied from a mockup"*. `facing` is radians
  anticlockwise from +x, so the picker names drawing-relative directions (up, right, down, left of the
  drawing), plus `Custom` for any other angle. The labels follow the existing sentence's convention.
- **`Clearance (300 mm)` is stated only when the four sides agree.** A clearance is an arbitrary traced
  boundary (C07), and a single figure over an asymmetric one would be a false measurement. §4 row 7's
  fixed values stay refused; the figure is the user's own.

**Corner radius survives a resize under AD11 item 2's own condition.** That item says *"store parameter
intent only if subsequent edits can maintain it"*, and this row is the subsequent edit maintaining it.
Nothing is stored: the radius is read back by `cornerRadiusOf`, as AD18-R16 shipped it.

**Three defects in AD18-R16's own work were found by the same audit and are fixed without a ruling**,
because each breaks a ruling that already stands. They are recorded here so nobody credits this round
with deciding them:
- the Placement segment's `Custom` label breaks mid-word (`Custo`/`m`) at a 1280 leaf, a 35 px label
  in a 61 px button;
- the asset card's thumbnail is invisible: `stroke-width: 1.5` in an 880-unit `viewBox` drawn at 40 px
  renders a **0.07 px** stroke;
- at a 460 px leaf the RESTING dimension labels overlap in **5 pairs** (`360/126`, `360/800`,
  `270/220`, `220/450`, `126/800`), against AD18-R14's floor that the resting state stays at zero.
  That floor was only ever measured at 1280.

The work plan is [`reports/AD18-parity-round-2-plan.md`](../reports/AD18-parity-round-2-plan.md).

**Delivered 2026-09-24.** All eleven tasks shipped, each independently reviewed, followed by a whole-round
review (verdict: ready for the manual pass after one fix wave). CI green on `16c00093a`, run `35936599580`,
read by run id. The manual pass grew from 145 to 182 steps across seven cases, re-derived by the integrator.
**One item stays open by this ruling's own scope:** a canvas HANDLE resize of a rounded rectangle still
drops its radius, because the handle previews a non-uniform scale; only typed Width/Depth edits keep it.

### AD18-R18 — the Asset Library gains a GRID view beside its list; the list is not replaced. (2026-09-23)

**Taken by the user**, asked separately because the library has its own authority,
`docs/user-experience/archive/asset-library-overview-DESIGN-SPEC.md`, and board 01's right-hand
column contradicts it. That spec draws shelves of rows carrying unit cost, waste and supplier, and its
§10 refuses a sort control (*"the shelves are the only other axis"*).

**A Grid | List toggle, with List unchanged.** Grid draws board 01's tiles: the existing geometry mark
at tile size, the name and the measured size. It adds board 01's category sidebar with icons as a
FILTER over the same shelves, a `Create your own` card calling the existing `New asset` door, and the
filter button. The chosen view lives in Obsidian's own view state beside the expanded categories, per the spec's
§6.3. A change to it is not a navigation.

**The losing arms.** Replacing the list with tiles would drop the price columns off the browsing surface
and rewrite the spec's §3.2/§3.3. Adding the sidebar and card without tiles would leave the board's
defining element out. **What this does NOT reopen:** §10's anti-goals stand (no totals, no bulk edit,
no sort control, no placement); the sidebar filters by the categories the vault already has and
manages none (§10's *"No category management"*). The inspector and the unreadable-notes notice are
unchanged.

### AD18-R19 — relative save time shows on BOTH surfaces that share the indicator. (2026-09-23)

**Taken by the user.** `SaveStateIndicator.vue` is shared by the Plan Editor's status bar and the
designer's header. A designer-only prop would give one state two spellings across surfaces, which is
the shape this repository refuses. So `Saved just now` / `Saved 2 min ago` reads the same in both
places. **The cost this accepts:** the change reaches the Plan Editor, and needs a saved-at time in
the save-state store. The derived `Saved · refresh needed` qualifier keeps its precedence, because a
stale canvas must never read as freshly saved (C08).

### AD18-R20 — grouping did nothing from the state the designer OPENS in, and the resting tool is Select. (2026-09-24)

**Reported by the user from a real vault:** Group from the right-click menu did nothing at all. Nothing
in this repository had ever observed a successful Group from the resting state, because every group
test clicked Select first. Root-caused in the browser harness with real mouse events and at source.
Two faults, **fixed without a ruling** because each breaks a contract that already stands:

- **The designer rests in camera mode** (`activeToolId === null`, drawn as Pan), and
  `selectionKeysRefused` refused every mode but Select. So the context menu, Ctrl+G, Ctrl+Shift+G,
  Ctrl+D and Delete refused silently until the user found Select. Camera mode is not a tool and owns
  no key; it is admitted now, as the Plan Editor's menu admits its own `pan` (b261b1866). Camera mode
  draws no handles, so the menu never hit-tests one there, and a pan still dragging refuses the menu
  as the Plan Editor's does (22c1319eb).
- **A Parts row always REPLACED the selection.** Shift and the panel's own `Select multiple parts`
  toggle, which is C05's modifier-free way to build a set, did nothing there, so a keyboard user could
  not group at all. A row now toggles membership with Shift or with the toggle on, through the same
  `extend` the canvas's additive press uses. A PLAIN row press on a set member still replaces the set:
  a row carries no drag, unlike the canvas press AD08 keeps the set for.

**The resting tool becomes Select, asked and taken by the user.** IMPLEMENTATION-PLAN's *"Selection is
the resting tool"* and C12's *"Selection is the resting mode"* are binding, and both boards draw Select
pressed. The designer opening in camera mode broke them, and had not been ruled as a deviation.
Opening in Select keeps the new-asset empty state visible (the Plan Editor already admits Select
there). What stays as it is: arrows nudge only under Select (`nudge.ts`'s rule), and camera mode keeps
the selection keys when the user picks Pan.

**Also fixed without a ruling** (the polish audit's defects):
- a hidden but SELECTED clearance still drew its outline and handles, and a handle drag resized it;
- a clearance that comes back through redo, an undo of its removal or an external refresh came back
  hidden. Any read-back where the clearance goes from absent to present re-shows it, which is the
  birth rule the round-2 final review already applied to trace, preset and Generate;
- the `setTool` wrapper asks the REQUESTED tool id, not the tool that became active;
- the five designer `<select>`s and the designer's checkboxes lose every focus ring to Obsidian's
  global `:focus { outline: none }`;
- in the library Grid, a one-line tile name is centred and a two-line one left-aligned, because
  Obsidian's `button` centres its flex children. Board 01 left-aligns every tile name;
- duplicated test helpers (`handed()`, `VAULT_FAILED`) move to `tests/helpers/`, where fallow can see
  them; `rightClick` already has.

**Recorded as already fine or ruled out, so nobody reopens them:** `placement(s)` stays (AD18-R7). The
prune watcher's `pre` flush has no visible window. `DesignerSelectionInspector.vue` counts 261/400 and
`dimensionFigures.ts` 254/400, so neither needs a split. The `shape === null` arms in the clearance
helper are reachable, because a new asset has no shape yet. `AssetLibraryContext.browse` is optional
for a documented harness reason. The 460 px stacked rail is AD18-R5/R10's.

### AD18-R21 — a polish round: nine items approved, one declined. (2026-09-24)

**Taken by the user** in one batched round after an audit of the running harness at 1280, 760, 580 and
460 px in both schemes. None is in AD18's *Deliberately absent* table; none needs a stored field, a
schema change or a dependency:

| Item | Shipped before |
|---|---|
| A canvas HANDLE resize of a rounded rectangle keeps its radius, clamped, through the rule typed edits use (closes the item AD18-R17 left open) | the corners go sharp |
| A focus ring on the DESIGNER canvas at `:focus-visible`; the Plan Editor's is not touched | no indicator, though arrows, Delete and Ctrl+G act there |
| While the footprint draws smaller than about 240 px across (the 580 and 460 px leaves today; a canvas-width threshold would never fire at 460, where the stacked canvas is 460 px wide), the resting labels are the overall width and depth only; zooming in brings the rest back, and `All dimensions` still shows every label | detail labels nearly cover the drawing at 580/460 |
| The five designer `<select>`s styled with host variables, like the designer's inputs | browser default: 1px black border |
| Checkbox label rows at least 24 px tall (WCAG 2.5.8) | 13 px boxes in 19 px rows |
| A selected Parts row's controls as ONE row of icon buttons, each with an accessible name and tooltip; pinned Lucide fixtures named to the user before download | five text buttons wrapping on two to four lines |
| Every Add-rail shape tile at one height | 73 px and 58 px |
| A library tile with no design draws its CATEGORY icon, muted, where the mark goes (derived, never stored) | an empty box |
| A save from an earlier calendar day says which day, on both surfaces (AD18-R19's indicator) | `Saved at HH:MM`, which reads as today after midnight |

**Declined: one term for the placement point.** The toolbar's `Set anchor` and the Parts row's `Anchor`
(DE *Ankerpunkt*) stay beside `Placement point` (DE *Platzierungspunkt*) in the legend and the
Placement block. The split is in the English source, and German mirrors it key for key.

The work plan is [`reports/AD18-polish-round-plan.md`](../reports/AD18-polish-round-plan.md).

### AD18-R22 — four questions the polish round's reviews raised. (2026-09-24)

**Taken by the user** in one batched round after the whole-round review:

- **A hidden but selected part refuses the selection keys.** Since AD18-R20, a selected part that is
  not drawn (the clearance while `Show clearance` is off, a graphic hidden in Parts) shows no outline
  and no handles. Arrow keys, Delete, Ctrl+D, Ctrl+G and the right-click menu then acted on something
  the user cannot see. They refuse now; the Inspector's own buttons, which sit beside a named part,
  still act. Shipped as the plan's Task 14.
- **The Parts row's icon buttons WRAP at a 580 px leaf.** Five 24 px buttons need 128 px, and the rail
  there is 128 px with about 104 px inside it. At 1280, 760 and 460 they stay on one row. Smaller
  buttons and a wider rail (which would reopen AD18-R10's canvas share) were declined.
- **A 0 mm offset keeps resting on the canvas.** Hiding it was declined.
- **The Hide and Lock glyphs show the CURRENT state**, following the Plan Editor's `ZoneLockToggle` and
  `LayerRow`. The accessible name and tooltip say the action. An action glyph was declined.

**AD18-R20, R21 and R22 delivered 2026-09-24.** The grouping bug was root-caused in the harness with real
mouse events and fixed first (b261b1866, 22c1319eb), with a test over the real write path watched red
against each fault. Then fourteen tasks ran subagent-driven, each independently reviewed and measured
in Chromium by the integrator. Nine of them needed fix rounds; five of those rounds came from the
integrator's own browser measurements. Task 5's labels took four rounds after a reviewer's probe of
77,964 modelled frames. Two tasks were added mid-round: Task 13, a handle resize of curved geometry
that moved its fixed side (a pre-existing defect found while measuring Task 4), and Task 14 (AD18-R22).
A whole-round review found two Importants, both fixed in a fix wave. **CI GREEN on `e83202e09`, run
`36020948497`**, `verify` ×4 plus `audit`, read by run id, with no red run this session. The manual pass
grew from 182 to **215 steps**, re-derived by the integrator and by an independent reviewer, including a
successful Group from every door at the new resting Select and with Pan chosen. Recorded, not fixed:
a hidden clearance swapped by undo, redo or a peer stays hidden; the rulers' band and Shift+2 follow a
hidden selected part; an overall label on a 280–360 px canvas may keep its anchor on a handle; arrows on
a hidden part are consumed but do nothing (the Plan Editor's arrow door); the Plan Editor's
`ZoneLockToggle` has the same name-plus-`aria-pressed` contradiction the designer's part controls had.

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
