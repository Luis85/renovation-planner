---
type: Design
epic: "[[Asset designer]]"
status: proposed
date: 2026-08-30
dependsOn:
  - "[[19-the-asset-catalogue-leaves-the-project]]"
---

# The asset designer, first increment

An [[Asset]] definition gains a **shape** — footprint, clearance boundary, anchor, facing,
height — and a designer surface of its own to draw it on. Typing 120 × 80 yields a rectangle a
renovator can use immediately; tracing a spec sheet over the object's own calibrated background
replaces that rectangle rather than sitting beside it.

This document covers the increment's design. It does not restate
[`docs/requirements/Asset designer.md`](../../requirements/Asset%20designer.md); that epic is the
specification, and a rule stated in two notes is two rules the day one of them is edited.

## Why this now, and what it waits on

The epic's Definition of Done puts the asset's geometry sidecar **with the shared library**, not
with any plan and not with any project. On `main` at `1cc687b`, `Asset` still carries a required
`projectId`, its notes sit under `<projectFolder>/Assets/`, and there is no library folder. Design
slice 19 is what changes that, and **slice 19 is a design, not an implementation**: PR 41 is open,
`mergeable_state: clean`, and reports `changed_files: 2` — a spec and a plan, no production code.

So this increment is designed against slice 19's post-state and **cannot merge before slice 19's
code does**. Four things it consumes from that slice, named so that a change in any of them is a
change here:

| From slice 19 | Consumed here as |
| --- | --- |
| the `libraryFolder` setting (task 3) | the root of `Geometry/` (ADR-0014 below) |
| `Asset` loses `projectId` (task 5) | a shape referenced across projects at all |
| `t(language, key, params?)` (task 1) | parameterised copy for dimensions and refusals |
| `ListAssets` reaching the whole vault | the designer's picker |

That last row is a correction to an easy assumption: **`ListAssets` already exists**
(`src/application/queries/ListAssets.ts`) and is project-scoped — `execute(projectId)` over
`assets.listByProject`. This increment writes no new list query; it consumes the one slice 19
re-scopes.

## What was measured, rather than assumed

Every number and path below was read this session, on `main` at `1cc687b`.

- **`CreateAssetCommand` has no user-facing caller.** It is constructed at
  `src/plugin/composition-root.ts:344` and guarded at `src/plugin/guardedServices.ts:308`. A grep
  of `src/presentation` and `src/plugin` for `createAsset` returns those two files and nothing
  else. Nothing anywhere selects an Asset either — slice 19's own document records the same gap
  from the delete side. **The only way a vault has an Asset today is a hand-written note.**
- **Three view types are registered**, at `RenovationPlannerPlugin.ts:181` (`renovation-project`),
  `:184` (`PLAN_EDITOR_VIEW`) and `:188` (`GEOMETRY_SIDECAR_VIEW`, ADR-011's extension
  registration rather than a UI surface).
- **`EditorContext` is already almost subject-agnostic.** `tools/editor-context.ts:31-61` declares
  `viewport`, `selection`, `snapService`, `commandDispatcher`, `writeLedger`, `renderState` — none
  of which name a Plan or a Zone. Its deps carry exactly one coupled field, at `:102`:
  `activePlan: { id: PlanId; calibration: Calibration | null }`.
- **`PlanCanvas.vue` is 1220 physical lines** (template, script and style together, `grep -c ""` —
  not the count `max-lines` reads, which skips blanks and comments). It is also the most
  defect-dense file in the repository: CLAUDE.md carries roughly thirty findings against its
  pointer and camera handling.
- **Plan background is note frontmatter**: `background-path`, `background-kind`,
  `background-page` (`dto/planFrontmatter.ts:30-32`). Calibration is not — it is the sidecar's
  (`dto/planGeometry.ts`), whose `PlanGeometrySchemaV1` carries `schemaVersion`, `planId`,
  `revision`, `unit: 'mm'`, `calibration` and `objects`.
- **Calibration rescales the object it belongs to.** `ReversibleCalibratePlan.ts:150-164` applies
  `scaleShape(…, scaleCorrection, origin)` to every stored point **including the calibration's own
  pair**.

## A contradiction this increment has to answer for

[`docs/issues/The plan editor is a mode, not a second view.md`](../../issues/The%20plan%20editor%20is%20a%20mode,%20not%20a%20second%20view.md)
is `status: Done`, finished 2026-08-23. It decides: *"One view type, `renovation-project`, with
the plan editor as a mode inside it"*, and states as a consequence *"Slice 05 registers no new
view type."*

Slice 05's task document designs `PLAN_EDITOR_VIEW = 'renovation-plan-editor'` as a per-plan view
with `getState()`/`setState()`, and `main` registers it. **The code took the alternative that note
rejected, and nothing recorded the reversal.** Registering a fourth view type while that sentence
stands would make it wrong twice, so ADR-0015 below records the supersession as part of taking
this increment's surface decision — which the epic already says is owed to `docs/development/adrs/`.

That note's own *Revisit when* is arguably met here: it says the second view type is the answer
when *"a use case needs the canvas and the project overview visible at the same time"*, and tracing
a spec sheet beside the plan the object will be placed into is that use case.

## Decisions

### 1. The footprint is the only stored geometry of record

Typing dimensions writes a four-point rectangle into the footprint. Tracing replaces it. **Width
and depth are always the footprint's bounding box and are stored nowhere.**

This is §88's "a derived value is recomputed on read" and the epic's "dimensions read off the
geometry rather than typed beside it" satisfied by construction rather than by discipline: there
is no second field for a trace to disagree with, and no reconciliation step for anybody to forget.
It is also what makes "usable before it is accurate" cost nothing structurally — the cheap path
and the accurate path produce the same kind of thing.

**Rejected:** storing typed `width`/`depth` beside a traced polygon. It is duplicate data by
§88, and it makes "which one is true" a question every reader has to answer.

### 2. The note carries scalars; the sidecar carries the space

Following `Plan`'s split exactly, because the reasons are the same ones:

| | `Plan` today | `Asset`, this increment |
| --- | --- | --- |
| note frontmatter | `background-path`, `background-kind`, `background-page` | the same three keys, plus `height` |
| sidecar | `calibration`, `objects[]` | `calibration`, `footprint`, `clearance`, `anchor`, `facing`, `footprintOrigin`, `pendingScale` |

`height` is frontmatter because it is a scalar a human should read with the plugin uninstalled
(§3.2) and nothing in the coordinate space depends on it. The **anchor is sidecar** because it is
a point in the same space as the footprint, and two files agreeing about one coordinate space is a
defect waiting for its first hand edit.

**Height is stored, shown and exported and interpreted by nothing.** No calculation, no clearance
check, no fit test reads it. No task beneath this increment may add a reader; the first epic that
needs a vertical answer earns the right to state that differently.

### 3. Provenance, so the calibration rule can be told the truth

The epic inherits every rule of [[Calibration and measurement]] with one replacement — the
calibration belongs to the object — and singles out one to read twice: **an uncalibrated surface
says so wherever a measurement would otherwise appear.**

Applied naively that rule misfires in both directions. A polygon traced over an uncalibrated
background is background pixels relabelled as millimetres at the placeholder scale of 1 — exactly
the defect slice 7 shipped and a human found — so its derived dimensions must be marked unscaled.
But a typed 120 × 80 involves no background at all and is exact millimetres, so marking *those*
unscaled is the same lie pointed the other way.

So the sidecar records two facts about how the coordinates came to exist:

- `footprintOrigin: 'typed' | 'traced'` — whether the outline was authored in millimetres or taken
  off the background. This decides whether the footprint is among what a calibration rescales, and
  never on its own whether a calibration rescales at all (Decision 6).
- `pendingScale: boolean` — whether the traced coordinates are still awaiting a scale, set at the
  moment of capture and cleared by the calibration that converts them. This is what gates rescaling
  at all (Decision 6), and it is the half that moves.

`dimensionsUnscaled` is `pendingScale`, and that is a **correction to this document's own first
draft**, which derived it as `traced && calibration === null`. That derivation asks a question
about the PAST — was there a scale when these coordinates were captured — out of LIVE state, so it
answers wrongly the moment either input moves: replacing a background (Decision 5) would re-flag an
outline that really was measured, and the answer would change without the geometry changing. It is
the "a phase test cannot answer a question about the past" shape this repository has recorded
repeatedly, and writing it down as a stored fact is what makes the staleness unrepresentable rather
than refreshed on one more event.

Neither field is derivable from the geometry, so neither is duplicate data under §88.

### 4. ADR-0014 — asset geometry lives in the library's own `Geometry/`

`<libraryFolder>/Geometry/<assetId>.rpgeo`, a sibling of `Assets/`, named by the **full prefixed
id**, carrying `assetId` where the plan's sidecar carries `planId`, `unit: 'mm'`, its own
`revision`, and the shape.

This is ADR-011's reasoning with one noun changed. That ADR says *"the unit that owns data here is
the project"* and derives the folder from the project's own; for a catalogue entry the owning unit
is the library, whose folder slice 19 introduces. Both alternatives ADR-011 rejected stay rejected
for its own stated reasons: colocation scatters `.rpgeo` files through the `Assets/` folder a user
reads and re-couples geometry to a display name, and a second configurable folder re-answers a
question one setting up has already answered.

**A `libraryFolder` change must move `Geometry/` with `Assets/`.** Slice 19's own settings
migration validates, moves, rebuilds and persists the new value **last**; asset geometry joins that
move rather than getting a second one. Without it the store would resolve sidecars under the new
folder the instant the setting persisted, every designed shape would vanish from the application,
and the files would be orphaned under the old path — a silent loss, since an absent sidecar reads
as `shape: null` rather than as an error. The move is part of the same migration and the same
failure handling: the setting does not persist unless the move succeeded.

**A consequence recorded rather than discovered.** Slice 19's open question 3 says asset notes
already filed outside the library are indexed but never moved. Their geometry still lands in the
library's `Geometry/`, because the path derives from the setting and not from where the note
strayed. That is the intended answer — one geometry home — and it means the index is the only thing
pairing a stray note with its sidecar, exactly as it already is for plans.

### 5. Replacing the background clears the calibration

A calibration is two points on a **particular document** and a scale derived from them. Give the
asset a different background and those points name nothing, so `SetAssetBackground` clears the
calibration in the same write that changes the reference — atomically, because a state where the
scale belongs to the old document and the picture is the new one is one no reader could interpret.

What it deliberately does **not** do is re-flag existing geometry. Coordinates already converted to
millimetres are measurements of a real object, and the object did not change size because the
drawing of it did; `pendingScale` is untouched. What the clearing prevents is the next trace
silently inheriting the previous document's scale, and the designer says the surface is
uncalibrated again, which is the epic's own inherited rule doing the work.

### 6. Calibration rescales what came off the background, and nothing else

`CalibrateAsset` multiplies by `scaleCorrection` **only the coordinates that came from the
background and have not yet been converted** — the clearance, the anchor, its own calibration pair
and a `traced` footprint — and never a `typed` footprint.

**`pendingScale` gates whether a calibration rescales anything at all; `footprintOrigin` decides
whether the footprint is among what it rescales.** Both are necessary and neither is sufficient, so
the rule is a conjunction rather than one flag.

This is the one place slice 7's plan rule may not be copied, and the first draft of this document
copied it. `ReversibleCalibratePlan` rescales *every* coordinate the plan owns, which is correct
there because every one of them was drawn on the background at the placeholder scale of 1. An asset
has a coordinate source a plan never had: a typed 1200 × 800 is authored in true millimetres and
was never in the background's space at all. Rescaling it would turn an exact oven into an arbitrary
one — silently, since the number would still look like a plausible oven.

`footprintOrigin` is what makes that distinction expressible, which is the second job that field
does and the reason it is worth its byte. It is **not** sufficient alone, and gating on it alone was
this document's rule until the owner ruled otherwise: `footprintOrigin` stays `'traced'` for the life
of the outline, while the coordinates it describes stop being background pixels the moment the first
calibration converts them. So a trace that was calibrated, then had its background **replaced**
(Decision 5), then had the new document calibrated, was rescaled a second time — multiplying
millimetres by a correction that answers a question about pixels, and silently, since the result
still looks like a plausible oven. `pendingScale` is the fact that moves: set at capture, cleared by
the calibration that converts, so a second calibration over already-converted coordinates rescales
nothing.

**What that costs, accepted rather than hidden:** correcting a calibration no longer retroactively
repairs an earlier trace, because the first calibration has already cleared `pendingScale`. The user
re-traces. That is affordable for one footprint and one clearance and would not be for a plan full of
zones — which is exactly why the plan editor keeps slice 7's rule and the designer does not.

**The known limitation, stated rather than discovered:** a typed footprint and a trace taken before
calibrating are not in one space until the calibration lands, so the two draw a picture that does
not agree with itself in between. Calibrating repairs it. Refusing the mix outright was the
alternative, and it is rejected because the epic's whole "usable before it is accurate" ladder is
built on letting a renovator start before the surface is exact.

**This case is also why the gate is a conjunction and not `pendingScale` alone.** Here the shape
carries a typed footprint *and* a trace awaiting a scale, so `pendingScale` is set; rescaling on that
flag by itself would multiply the typed footprint too, which is the precise defect Decision 6 exists
to prevent, reintroduced under a different flag.

### 7. ADR-0015 — the designer is a per-asset view type

`renovation-asset-designer`, several leaves coexisting, the open asset carried in Obsidian's own
per-leaf view state as `{ assetId }` — the Plan Editor's shape, method for method, including the
`setState` trust rule that a restored state naming an asset this build cannot read falls back
rather than throws.

The ADR also records the supersession described above, so the tree stops holding a `Done` decision
its own code contradicts.

## Scope

### In

- `Asset` gains a shape: footprint, clearance boundary, anchor, facing (all sidecar) and height
  (frontmatter).
- `AssetGeometrySchemaV1` and its store, under ADR-0014's layout.
- The Asset Designer view, its background, its own calibration, its origin, and its tools.
- Typed dimensions producing a footprint, and tracing replacing one.
- A create dialog and an `open-asset-designer` command with a picker, so the loop is walkable from
  an empty vault.
- ADR-0014 and ADR-0015.

### Out, named so no task claims otherwise

- **Drawing the shape on a plan**, flagging an overlap between two clearances, and any fit test.
  Those belong to [[Plan editor]] and [[Asset placement]] and this epic explicitly does not promise
  them. This increment therefore ships shapes nothing on a plan yet draws.
- **Any reading of `height` by any calculation.**
- **Retained history for a referenced shape, and the epic's recoverability condition is therefore
  NOT met by this increment.** The sidecar is a single mutable document: its `revision` identifies
  the latest write and retains no earlier state, so editing a footprint overwrites in place and the
  previous one is gone. That is the opposite of "recoverable rather than overwritten in place", and
  the first draft of this document claimed the revision counter satisfied it, which it does not.

  Nothing is lost today, and that is a fact rather than a defence: placement is out of scope, so no
  plan references a shape, and [[Plan revisions]] does not exist to have approved one. Building
  version history now would also pre-empt the choice the epic explicitly assigns to that epic — a
  version pin or a snapshot at approval — with the mechanism nobody has chosen yet.

  **The trigger is named so this cannot land quietly:** the first increment that lets a placement
  reference a shape, or [[Plan revisions]] itself, whichever comes first, owes retained history
  before it ships. Until then this condition is open, and no task beneath this increment may tick
  it.
- `Supplier` and `Trade` catalogues, and an Asset delete affordance.

## Application layer

Eight commands, each guarded at the composition root, each with a reversible adapter where the
designer's undo must reach it:

`SetAssetFootprintFromDimensions` · `SetAssetFootprint` · `SetAssetClearance` · `SetAssetAnchor` ·
`SetAssetFacing` · `SetAssetHeight` · `SetAssetBackground` · `CalibrateAsset`

**Not one `SetAssetShape` taking a partial.** A patch smuggles fields past the smart constructor
that `Asset.withChanges` exists to re-run, and undo granularity is per gesture: a user who traces a
clearance and regrets it should not lose their anchor with it.

`CalibrateAsset` borrows `ReversibleCalibratePlan`'s machinery and **not** its rule: when
`pendingScale` is set it rescales the clearance, the anchor, its own calibration pair and a `traced`
footprint, leaving a `typed` one alone; when it is not, it rescales nothing and merely records the
new calibration (Decision 6). It clears `pendingScale`, since the coordinates it just converted are
millimetres now. Recalibrating an oven rescales that oven and nothing else on any plan, which is
the whole reason the epic gives the designer a calibration of its own.

`SetAssetBackground` clears the calibration in the same write (Decision 5).

`GetAssetDesign(assetId)` is the one new query: asset fields, shape, calibration, background and
the derived dimensions, with the provenance flag that decides whether those dimensions are
presented as measured or as unscaled.

Every command reports a `DispatchOutcome` — `'wrote'` or `'no-write'` — rather than letting `ok`
be read as evidence of a write, because the save-state indicator infers nothing.

## Presentation

### The extraction, in a commit of its own

`PlanCanvas.vue`'s camera and pointer routing move to a subject-agnostic
`presentation/editor/surface/EditorSurface.vue`: the pan override, the swallowed-pointer set, the
chorded-button bitmask, the blur and cancel ordering, the wheel and keyboard camera, and the
`display: contents` overlay wrapper that keeps an overlay's own controls working. The plan editor
mounts it with its layer stack; the designer mounts it with a different one.

**Behaviour-preserving, alone in its commit, gated by `canvasPointerRouting.test.ts`,
`canvasNavigation.test.ts` and `interactionLayer.test.ts`.** No behaviour change rides along with
it. Those suites are the only thing standing between this extraction and thirty rediscovered
pointer defects, and a mixed commit makes them unable to say which half moved.

Two generalisations fall out of it: `EditorContext`'s deps take `subject: { id, calibration }` in
place of `activePlan` — one field, already the only coupled one — and `DrawPolygonTool` stops
hard-wiring `CreateZone`, taking instead what a completed polygon *does*, so one tool serves zones,
footprints and clearances.

### The designer itself

`AssetDesignerView.ts` and `AssetDesignerRoot.vue`, its own isolated Vue app (SDD §12), with a
layer stack (background, footprint, clearance, anchor and facing gizmo, measurement, interaction),
a toolbar (select, trace footprint, trace clearance, anchor, facing, calibrate), and an inspector
whose dimensions are read-only derived values beside a `height` field on slice 16's
`useFieldCommit`. It mounts slice 15's `DialogHost`, slice 13's save-state indicator, and reaches
the notice queue through the same one door.

**One dispatcher per leaf, and it refreshes.** Tools, toolbar and inspector all dispatch through one
wrapped object per designer leaf, which re-reads `GetAssetDesign` after every dispatch — on a
rejection as well as on success, since a thrown fault is not "nothing happened" and a write may
already have landed. The store's hydration takes a request ticket, or the slower of two overlapping
reads wins and a just-drawn footprint vanishes with no error; and one event — `AssetDesignChanged`, published by every design
command including the two that change no geometry — refreshes any other leaf showing the same
asset. A subscription keyed on shape events alone leaves a peer leaf stale after a height or
background change, and a per-field event list goes stale the day a ninth command is added. None of this comes along with the extracted gesture surface — it
lives above it, and the plan gives it a task of its own.

**Two dialog kinds, not one.** `NewAssetForm` creates an asset; a second kind edits the dimensions
of the asset already open, and it is what `assetDesigner.noShape`'s action opens. Without it an
existing asset with no geometry has no way to reach "type 120 × 80", since the inspector's
dimensions are read-only by construction. Typing dimensions over a traced outline retypes its
provenance to `typed`, because the numbers are authored from that point on and Decision 6 must not
later rescale a rectangle nobody measured.

Empty states are **overlays**, per slice 14's rule that an empty state replacing a region hides the
thing the region exists to show: `assetDesigner.noShape` carries the action that opens the
dimensions form.

`assetDesigner.noBackground` is where a claim had to be narrowed during review of this document.
`planEditor.noBackground` ships buttonless because `set-plan-background` is a plugin **command**
the Vue tree cannot reach without either widening its context or reaching for the global `app`,
which the marketplace rules refuse. Making `SetAssetBackground` an application command does not on
its own fix that: choosing a document needs a **file picker**, which is an Obsidian modal, and
`presentation/` may not import `obsidian` at all. So the button exists only if this increment adds
the seam the plan editor lacked — a `pickBackgroundDocument(): Promise<DocumentRef | null>` port on
the designer's deps, bound at the composition root, the same way its commands already are. That is
a decision taken here rather than a consequence: it costs one port and one binding, and it is what
lets the plan editor's own buttonless empty state be closed later by adding a caller rather than by
re-litigating the layering.

### Reaching it

An `open-asset-designer` command over a `FuzzySuggestModal` of the indexed assets — a **plain
callback**, never a `checkCallback`, which is what kept `open-plan-editor` out of the palette in
every vault that had no plans — and a **new-asset dialog** on `DialogHost` and `useFormCommit`
that opens the designer on what it created. Both go through `revealCandidate`'s in-flight map, so a
double click gives one leaf rather than two.

This is what stops the increment repeating slice 7, where `CalibrateTool` was proven by tests,
registered nowhere, and unreachable for two whole slices until a human opened the toolbar.

## Errors, copy and accessibility

Every new code gets English **and** German copy, bound to its raise sites by a table in
`toUserMessage.test.ts` copied from the raise sites rather than from `en.ts`, because a table
derived from the locale file would agree with a typo. German says *Objekt*, never *Material* — the
term this repository has corrected twice and reintroduced once, and which its two-term gate does
watch.

The new view joins `tests/harness/accessibility.test.ts`, and its case scans the action-carrying
empty state — the standing gap that file records about itself.

## Testing strategy

- **Node tests** for the shape maths: a rectangle from dimensions, the bounding box, `scaleShape`
  across all five attributes, and the degeneracy refusals (`coincident` rather than bitwise
  equality, which this repository has already paid for twice).
- **Repository contract tests** for the new sidecar store, including the **three-decimal** float
  rule — `594.005` is not representable in binary floating point where `594.00` and `99.99`
  survive a coercion.
- **A designer rig** mirroring `planEditorRig`, with a **dispatching** event bus rather than a
  recording one, and pointer streams obeying the real device's grammar: a click is down+up on the
  same button, `buttons` is set on every move, and a chord fires no second `pointerdown`.
- **Fixture-vault fixtures** (slice 12): an asset with geometry and one without.
- **A harness entry** and captures in both colour schemes, plus `?view=asset-designer`; spacing,
  focus rings, contrast and hit size are measurable nowhere else here.
- **A manual case**, `docs/tests/cases/Design an Asset.md`, under the smoke suite — appearance and
  any assumed Obsidian API are verifiable in a real vault and nowhere else, and every one of the
  four gates was green for each of the three fakes that shipped a defect.
- Branch-coverage headroom is **tight, and the figure here is somebody else's measurement**: PR 41
  reports 98.08% (2660/2712) against a floor of 98 after a fresh `npm ci`; CLAUDE.md records 98.12
  on the tree that merged slice 13. Neither was measured for this document, and the number moves on
  merge — it has fallen on merge twice in this repository's history. Re-measure before planning, and
  plan tests **with** the code either way: an untested new arm does not reduce coverage, it fails
  the gate — except where headroom hides it, which is why the changed files get read out of
  `coverage-final.json` rather than trusted to the threshold.

## How this meets the epic's Definition of Done

The epic states seven conditions on any item beneath it. Mapped once, so that a task cannot be
ticked against a condition nobody read:

| Epic condition | Where it is met, or why not yet |
| --- | --- |
| A footprint obeys [[Asset library]]'s rules — reference, never copy; derived recomputed on read | Decision 1: the footprint is the only stored geometry, dimensions are its bounding box. Placement references the definition because placement does not exist yet to copy it. |
| Every attribute a placement referenced stays identifiable | **Not met, and named as open** — see Scope/Out. All five are stored rather than derived, but one mutable sidecar retains no earlier state. Nothing references a shape yet; the first increment that lets one owes retained history. |
| The designer's calibration belongs to the object and never reaches a plan's | `CalibrateAsset` writes the asset's own sidecar and rescales only that object's background-derived coordinates (Decision 6). Enforced by the sidecar boundary, not by convention. |
| Usable before accurate | Typed dimensions need no background and no calibration; half A ships them without a canvas at all. |
| Clearance captured as a boundary distinct from the footprint | Its own sidecar field and its own tool. What a plan does with it is out of scope, as the epic says. |
| Anchor and facing captured and round-tripping | Their own sidecar fields, in the footprint's coordinate space. Open questions 1 and 3 name what is still undecided about them. |
| Height stored, shown, exported, interpreted by nothing | Frontmatter, read by the inspector and by no calculation. Stated in Scope/Out so no task may add a reader. |
| Round-trips as plain Markdown plus a geometry sidecar in the library | ADR-0014, with the consequence for stray notes written down rather than discovered. |

That is eight rows against seven conditions because the last condition carries two claims — the
round trip and where the sidecar lives — and a row per claim is what makes each one checkable.

## Sequencing

One spec, two independently-green halves:

- **A — the shape.** `AssetGeometrySchemaV1` and its store, ADR-0014, the six non-drawing commands,
  typed dimensions, the create dialog and the picker. A complete, usable feature with no new
  canvas: a renovator types 120 × 80 and every plan referencing that asset knows its footprint.
- **B — the designer.** ADR-0015, the `EditorSurface` extraction, the view, the tools, tracing, and
  `CalibrateAsset`.

If B slips, A still ships something usable. That is the epic's own "usable before it is accurate"
applied to the delivery rather than to the oven.

## Open questions, raised rather than assumed

1. **Facing's unit and zero.** Radians match the geometry code; degrees match what a renovator
   would type. Which direction is zero — the anchor's own +x, or the footprint's longest edge — is
   a decision [[Asset placement]] will inherit and cannot renegotiate.
2. **Whether the clearance may be derived by default** as a uniform offset of the footprint, with
   tracing as the refinement. It would make the cheap path cheaper; it also invents a second
   derived-versus-stored question in an increment that just settled one.
3. **What the designer's origin is.** The epic says the shape is drawn *around* an origin. Whether
   that origin is the anchor, or a separate thing the anchor may sit away from, decides whether
   the anchor is one field or two.
4. **A second asset with the same background.** Two objects on one spec-sheet page each carry
   their own calibration of the same document, and nothing shares it. Correct, and possibly
   annoying; measured only by using it.
5. **Merge order against slice 19 and slice 17**, both of which are in flight as designs.
