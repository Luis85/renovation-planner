# Asset designer: consolidate before the object iteration

**Date:** 2026-09-16
**Baseline:** `main` at `d90b7e34`.
**Status:** proposed design, approved section by section in brainstorming on 2026-09-16. No
implementation plan yet.
Where this document and the SDD disagree, the SDD is the authority. ADR-0014 (the library-scoped
asset geometry sidecar) and ADR-0015 (the designer is its own view) are unchanged by it.

## 0. Where this sits

A concept review proposed evolving the designer into a purpose-built top-down object editor, in six
increments: consolidate, easy creation, composition, richer symbols, reliable reuse, advanced
authoring. This document is **increment 0 only**, and it exists because the review found two live
defects and one overdue obligation that every later increment would build on top of.

It does not interrupt the precision and measuring iteration
(`2026-09-15-asset-designer-snapping-and-guides-design.md` §0): snapping shipped, and dimensions on
canvas and rulers are still that iteration's to deliver. Increment 0 is deliberately small and
touches the resize path those increments draw numbers over, which is why it goes first.

**Nothing persisted changes.** No schema version moves, so there is no migration to write.

## 1. Decisions taken

| Question | Decision |
| --- | --- |
| The overdue recoverability obligation | An approved revision snapshots the shapes it references. The trigger moves to Plan revisions; nothing is built before a plan can be approved. |
| A non-uniform resize of curved geometry | The numbers agree, the silhouettes may differ. A typed size is honoured on both surfaces; the designer keeps bulges and the plan flattens first, and that approximation is written down with its trigger. |
| Set dimensions: scale or replace | Scale whatever is measured. The rectangle is written only when there is no shape yet, or the footprint is still unscaled tracing pixels. |

## 2. The recoverability obligation moves to Plan revisions

`docs/requirements/Asset Designer Foundations.md`, in the paragraph beginning "The epic's
recoverability condition is open beneath this feature", names the trigger as "the first
increment that lets a placement reference a shape, or Plan revisions itself, whichever comes first".
Placement shipped (`2026-09-10-plan-editor-asset-placement-design.md`) and nothing retains history,
so that trigger fired and was missed.

Nothing has been lost. Plan revisions does not exist, so no plan has been approved and no approved
drawing has been silently redrawn. What decides whether history is owed *now* is which answer that
epic takes, and this design takes it: **an approved revision snapshots every shape it references.**
A snapshot taken at approval needs no earlier state, because the state it freezes is the one on
screen at the moment somebody commits to it. A version pin would need history reaching back before
the pin existed, and it also fights the epic's own correct-it-once promise for working plans.

The edits, all docs:

- **`docs/requirements/Asset Designer Foundations.md`** — the paragraph's last sentence becomes the
  approval trigger rather than the placement trigger, and says why a placement referencing a live
  shape is correct until something can be approved. It keeps naming the sidecar as a single mutable
  document, because that is still true.
- **`docs/requirements/Asset designer.md`** (Definition of done, the "Every attribute of the shape a
  placement referenced" bullet) — keeps its list of five attributes and its refusal to decide for
  Plan revisions in general, and records that the decision has since been taken: the snapshot, not
  the pin. The bullet stops reading as an obligation open beneath this epic.
- **`docs/requirements/Plan revisions.md`** — one more Definition of done item: an approved revision
  reproduces every asset shape it referenced — footprint, clearance, anchor, facing and height —
  not the plan's own geometry alone.
- **`docs/requirements/Immutable approved revisions.md`** — its Outcome names referenced asset
  shapes, so "what somebody quoted against can always be reproduced" is not read as the plan
  sidecar alone.

The five attributes are restated in the receiving notes on purpose: the source epic says an
obligation written about *the geometry* reads as the outline, and the other four move the drawing
just as surely.

## 3. Set dimensions scales a measured footprint

`editDimensions` in `src/presentation/designer/AssetDesignerRoot.vue` takes the
replace-with-a-rectangle path when the footprint is unscaled **or** when `scalesDrawing` answers
false — no details and no curved edge on the footprint or clearance. So a calibrated, straight-sided,
non-rectangular footprint with no details, an L-shaped counter, is silently replaced by a centred
rectangle. `scaleDesign` handles a straight polygon exactly, so nothing about that outline needed
replacing.

**The new branch, and the whole of it:**

- No shape at all, or `dimensionsUnscaled` (that is, `footprintPending`) →
  `setFootprintFromDimensions`, the centred rectangle, as today.
- Otherwise → `scaleDesignToDimensions` (§4) through `editShape`.

`scalesDrawing` is deleted with its docblock; `hasCurves` stops being imported by that file.

**Two consequences worth stating rather than discovering.**

A typed rectangle that is edited now *scales about its anchor* instead of being rewritten centred on
the origin. For the default anchor at the centre the two are the same picture. For an anchor moved
to the back edge the scaled result keeps the anchor on the back edge, which is the answer a
placement wants; the rewrite moved the shape out from under its own anchor.

The pending path still replaces a traced outline, and now says so.
`designer.dimensions.unscaled` gains one sentence — in `en.ts` and `de.ts`, no new key, because the
warning already occupies exactly that state and a second key would be two sentences about one
thing. English: the traced outline is replaced by a rectangle at the size typed here.

## 3a. Amendment (implementation plan, 2026-09-16): provenance follows the path

Found while planning Task 3, not while writing §3. `SetAssetFootprintFromDimensions` retypes what it
replaces — `withFootprint(current, footprint, 'typed', false)` — and a case in
`assetDimensions.test.ts` asserts exactly that for a TRACED, measured square, which is a shape the
new branch scales instead.

**A scaled trace stays `'traced'`.** Its coordinates came from the drawing and only their scale
changed, so retyping would claim an authorship the outline does not have. Nothing is put at risk by
keeping it: `CalibrateAsset` already states that provenance and the pending flag have no conjunction,
and a calibration converts pending groups alone, so a measured traced footprint is never rescaled by
a later one. Retyping stays where the outline really is replaced — the rectangle path.

That case is rewritten in Task 3 rather than bent: its expectation was the defect.

## 4. A typed size lands on curved geometry

`resizeToExtent` (`src/presentation/designer/selection/partExtent.ts`) already knows that a kept
bulge makes `target / current` miss: it solves the factor with a secant over the measured extent,
caps the tries, halves a step that goes non-positive, and answers the nearest landing. Its docblock
carries the measurement — a bowl typed to Depth 900 landing at 596.

`scaleDesign` uses the plain ratio, so **whole-object Set dimensions has exactly the defect the part
inspector fixed**: type 1200 on a round table and the design does not measure 1200.

**One solver, two callers.** The loop moves to `src/domain/asset/scaleSolve.ts`:

```ts
export function solveScale<T>(attempt: {
  start: number;                                    // the extent at factor 1
  target: number;
  apply: (factor: number) => Result<T, ValidationError>;
  measure: (value: T) => number;
}): Result<T, ValidationError>
```

with `TOLERANCE_MM` and `MAX_STEPS` unchanged, the nearest-landing rule unchanged, and the
non-positive-step halving unchanged. It is in `domain/` because both callers must reach it and
`domain/` is the layer `presentation/` may import. `resizeToExtent` keeps its signature, its
docblock and its behaviour, and becomes a call with `apply = resizeBox(…)` and
`measure = partBox(…)[axis]`.

**`scaleDesignToDimensions(shape, width, depth)`** goes in `shapeEdits.ts` beside `scaleDesign`,
which it uses as its `apply`:

- `dimensionsOf(shape.footprint)` gives the start extents; its refusal is the function's refusal.
- Solve x against the footprint's width, then y against the depth **of that result**, then x once
  more: three solves, each bounded by the part solver's own step cap.
- The rounds are needed rather than tidy: an arc keeps its bulge, so its sagitta follows its chord,
  and scaling y changes how far that arc reaches in x. The axes are coupled, and one pass each
  leaves the first axis drifted.
- The answer is the pass whose combined miss is smallest, so the result is the nearest landing
  rather than the last try — the rule the part solver already states.
- A straight-sided shape lands exactly at the first factor, unchanged from today.

`editDimensions` calls it in place of its inline `scaleDesign` computation, so the ratio is still
taken against the shape the write is computed from.

**Known ceiling, carried in the docblock:** some extents are unreachable while bulges are kept — a
four-arc circle cannot be narrowed below about a fifth of its diameter — and a shape needing more
rounds lands near the typed value rather than on it. That is the part solver's existing ceiling, now
stated once for both callers.

## 5. The two surfaces approximate a stretched arc differently

A placement flattens arcs and then stretches each axis (`placedOutline`,
`src/domain/spatial/assetPlacement.ts`), which is a true stretch. The designer keeps bulges, so each
arc stays circular through its new chord. **The same nominal size therefore draws a slightly
different silhouette on the two surfaces, and after §4 both measure what was typed.**

This is written down rather than closed. `assetPlacement.ts`'s header comment names the difference,
names the reason (the designer must STORE its curves and a bulge cannot express an ellipse, while a
placement renders a polyline and needs to store nothing), and names the trigger: **native ellipse or
path geometry in `CurvedPolygon`**, which the concept's increment 3 would have to bring for
validation, bounds, hit testing, persistence and export at once.

Making the plan follow the designer was considered and refused here: it would cost the placement
size fields that shipped in #224 their exactness, or require the solver to run on every plan render.

## 6. Out of this increment, each with its trigger

- **An asset-geometry migration table.** Nothing persisted changes, every migration table in this
  repository is empty, and adding one means deciding whether an asset's shape is an eighth
  `DiagnosticEntityKind`. Trigger: the first non-additive asset-geometry schema change — the open
  geometry of the concept's increment 3.
- **A "Replace with a rectangle" action.** Start from preset already replaces a whole design.
  Trigger: somebody wanting to discard a drawing and keep the asset, without a preset that fits.
- **Retained shape history, and placement pinning.** §2's decision removes the need. Trigger: Plan
  revisions choosing a pin after all.
- **Any change to the placement `size` override.** An instance keeps the absolute size it was given
  when the definition is corrected. Trigger: a user reporting that a corrected definition should
  have moved a resized instance.
- **A pending clearance on a measured footprint is scaled with everything else.** Found by the final
  review of this branch. The state is reachable — calibrate, swap in an uncalibrated background, trace
  a clearance — and the replace path used to leave such a clearance alone where the scaling path
  multiplies its placeholder pixels by a millimetre-derived factor that a later calibration multiplies
  again. Scaling a pending group is `scaleDesign`'s own pre-existing behaviour, which this branch
  widens rather than introduces. Trigger: the increment that decides whether a pending group is exempt
  from every scale, which is calibration's question and needs its own spec.
- **Multi-selection, groups, open linework, a preset gallery.** The concept's later increments; each
  keeps the trigger its own spec already recorded.

## 7. Testing

- **`solveScale` (node, domain):** a straight part lands exactly at step 1; a curved part lands
  within tolerance; an unreachable target answers the nearest landing rather than a refusal; a
  non-positive target refuses as `invalid-scale`. `resizeToExtent`'s existing cases stay green
  unchanged — that is the evidence the extraction preserved behaviour, and they are watched failing
  against a deliberately broken solver first.
- **`scaleDesignToDimensions` (node, domain):** a straight design lands both axes exactly; a design
  with a curved footprint lands both within tolerance where a single plain-ratio `scaleDesign`
  misses, and the miss is measured in the test rather than asserted as "close"; the footprint, every
  detail and a PENDING clearance are scaled about the anchor; pending flags ride through unchanged;
  a design whose footprint has no representable extent refuses.

  **AMENDED 2026-09-18 by AD14 / ADR-0034, and the amendment is the point of the line.** This read
  *"every part — clearance and details included — is scaled about the anchor"*, which was true when
  it was written and is no longer true of a MEASURED clearance: that one is an authored planning
  boundary, so it is now PRESERVED at the size its author drew and carries a durable
  `clearanceNeedsReview` flag (asset-geometry schema 4) instead of being silently redrawn at a size
  nobody chose. A PENDING clearance goes on scaling with everything else, which is §6's own parked
  decision and is what the reworded sentence above still covers. The two fixtures that pinned the
  old behaviour are AMENDED rather than deleted, and say in place what they used to assert and why
  it changed.
- **The divergence (node):** one curved asset scaled in the designer to W x D, and the same asset
  placed with `size` W x D, measure the same width and depth, and their outlines are not identical.
  The test states which fact is the guarantee and which is the tolerated approximation.
- **`editDimensions` (jsdom):** a calibrated straight-sided non-rectangular footprint keeps its
  corner count and its topology and is not re-centred; a pending footprint still becomes a
  rectangle and the dialog carries the warning that names the replacement; a shape with details is
  scaled as before; a cancel writes nothing; one gesture is one undo entry.
- **Locales:** the amended key round-trips in both languages under the existing locale tests.
- **Manual:** `docs/tests/cases/Design an Asset.md` gains a step — trace an L-shape, calibrate it,
  Edit dimensions, and see it scaled rather than squared off — with its Runs table left honestly
  empty until somebody runs it in a vault.

## 8. Changelog

One `[Unreleased] / Fixed` entry: Set dimensions now resizes a traced footprint instead of replacing
it with a rectangle, and a typed size lands on a design with curved edges.
