---
adr: 34
title: A resized object preserves its measured clearance and flags it for review
status: Accepted
date: 2026-09-17
area: domain
---

# ADR-0034: A resized object preserves its measured clearance and flags it for review

## Context

`scaleDesign` (`src/domain/asset/shapeEdits.ts`) scales every outline about the anchor, the
clearance among them, under no condition at all. It reaches a user through one gesture: Edit
dimensions, whose dialog result goes to `scaleDesignToDimensions`, which uses `scaleDesign` as the
per-axis step of its secant solve.

A clearance is not geometry of the object. It is an authored planning boundary — the distance a
renovator decided they need in front of an oven or beside a radiator — and the object's own size is
not what determines it. Scaling it with the object therefore rewrites a figure nobody asked to
change: type 500 where the oven was 600, and the 600 mm of front clearance silently becomes 500 mm.

Nothing recorded that it happened. The surface could have warned at the moment of the resize, but a
warning that vanishes on reopen is exactly what the asset designer's behaviour contract refuses:
somebody who reopens the file a week later sees a boundary that looks authored and is not.

The decorative and dimensional consequences are not symmetric with the footprint's. A footprint
scaled to a typed size is the gesture's whole purpose; a clearance scaled alongside it is a side
effect.

## Decision

- **A MEASURED clearance is preserved under a whole-object scale.** `scaleDesign` stops transforming
  it. Its absolute geometry stands, which is what makes the mismatch against the object's new size
  visible on the canvas rather than merely recorded.
- **It is flagged**, by a new durable `clearanceNeedsReview: boolean` on `AssetShape`, beside the
  three existing per-group pending flags. Set when the scale is not the identity and the shape has a
  measured clearance. Both directions set it, not shrinking alone: a clearance the user authored at
  one size is one they did not author at the other, whichever way it went.
- **A PENDING clearance goes on scaling with everything else and is never flagged.** Its coordinates
  are background pixels, the whole capture shares one space, and scaling them weakens nothing that
  is yet a measurement. That behaviour was parked deliberately with its own trigger in
  `2026-09-16-asset-designer-consolidate-design.md` §6 and this ADR does not disturb it.
- **Cleared by any write whose subject is the clearance itself** — re-tracing it, the four-side
  helper regenerating it, removing it, and any transform of the boundary's own outline — because a
  gesture aimed at the clearance is a review of it; and by an explicit **Reviewed** action in the
  designer inspector, drawn only while the flag is set.

  **The implementing change reached every one of those but the four-side helper**, which lives in
  `DesignerClearanceHelper.vue` — a file in no wave-5 lease row — and is one line
  (`clearanceNeedsReview: false` in its `validateAssetShape` call) away. The assertion that fails
  without it ships deliberately red in
  `tests/presentation/designer/designerClearanceReview.test.ts`, in the idiom the lease ledger
  prescribes, so the gap is a failing check rather than a sentence. **This paragraph is here rather
  than the wider claim standing alone** because a record that promises more than the code delivers
  is the same defect as an unchecked comment and reads as settled.
- **Isometries set nothing.** Translation, rotation and reflection preserve every distance, so they
  weaken no boundary.
- **Authority:** the asset geometry sidecar (ADR-0014), on the shape. **Schema 4.** The field
  defaults to `false` on read, so every v1, v2 and v3 document is a valid v4 one without being
  rewritten. A present malformed value fails the read rather than being coerced, because coercing it
  to `false` would present an unreviewed clearance as reviewed.
- **History:** the flag rides on `AssetShape`, which the reversible design commands snapshot whole,
  so undoing the resize restores the unflagged shape through the mechanism that already exists.

## Alternatives

- **Scale the clearance and flag it.** Fabricates a boundary the user never authored and then asks
  them to check a number that looks authored. At 600 mm becoming 500 mm a glance accepts it, and the
  plan carries a figure the renovator believes they chose.
- **Refuse the resize until the user picks a clearance action.** Blocks a common gesture to guard a
  rarer state, and makes Set dimensions fail on exactly the assets that are furthest along.
- **Warn at the moment of the resize and store nothing.** Lost on reopen, which is the case that
  matters: the person who reads the boundary later is usually not the person who resized the object.
- **Reuse `clearancePending`.** That flag means *these coordinates are background pixels*.
  Overloading it would fire the unscaled warning over genuine millimetres and let a calibration
  clear a review.
- **Compare a stored review revision against the sidecar's `revision` counter.** That counter bumps
  on every write to the document, so an untouched clearance would read as stale whenever an
  unrelated detail moved. A warning that always fires is one nobody reads.
- **Keep the pre-scale clearance so it can be restored.** That is retained shape history, which
  `2026-09-16-asset-designer-consolidate-design.md` §2 removed the need for by deciding that an
  approved revision snapshots what it references.

## Consequences

- A vault whose asset carries the flag, opened in a build that reads only schema 3, refuses that
  asset's sidecar until the build is updated — rather than loading it and erasing the flag on its
  next write.
- After a resize, a measured clearance no longer hugs the object. That is the intended picture and
  it will read as a defect to somebody who has not met this rule; the inspector's review notice is
  what explains it.
- Two fixtures that pinned the old behaviour are amended rather than deleted:
  `tests/domain/asset/shapeEdits.test.ts`'s literal scaled-clearance points and its bounding-box
  case. `2026-09-16-asset-designer-consolidate-design.md` §7's line *"every part — clearance and
  details included — is scaled about the anchor"* stops being true of a measured clearance and is
  corrected there.
- No asset-geometry migration table is owed: schema 4 is additive, so the trigger recorded for that
  table — the first non-additive asset-geometry schema change — still has not fired.

## Revisit when

A renovator asks for the clearance to follow the object after all — most likely for a clearance that
was generated by the four-side helper from the footprint rather than traced by hand, where the two
really are coupled. That is a distinction the model does not draw today, and drawing it is the work
that decision would need.
