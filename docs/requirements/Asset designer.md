---
type: Epic
order: 155
status: New
started: ""
finished: ""
horizon:
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
strategic-alignment: ""
customer-value: ""
business-impact: ""
reach: ""
risk-reduction: ""
compliance: ""
time-criticality: ""
enablement: ""
confidence: ""
effort: ""
complexity: ""
business-value: ""
business-value-model: ""
release: "[[Mighty Dragon]]"
---

# Asset designer

[[Asset library]] gives a renovator a table, a sink or a wardrobe as a *definition* — a unit, a
price basis, a category — and nothing about its size or its shape. So the two moments where a
[[Private renovator]] most needs one are the two the product is silent in: laying out a room and
wanting to know whether the island leaves a walkway, and holding the manufacturer's spec sheet for
something they are about to buy and wanting that footprint to be true in every plan it lands in.

What they do today is **not do it at all**, and the cost of that shows up in three places at once.
The layout is a lie, because a floor plan of unlabelled polygons cannot prove that anything fits.
The budget is short by everything they will actually buy, because furniture and fixtures have
nowhere to be. And the plan cannot be shown to a partner or a trade, because it does not depict
the objects it is about.

This epic answers that by giving an [[Asset]] definition a **shape**. Not a new entity beside it
and not a stamp copied at placement time — the same definition [[Asset library]] already owns,
extended with geometry, so a footprint corrected once is corrected in every plan that references
it. An object carries a footprint, a clearance boundary, an anchor and a facing direction, a
height, and dimensions read off the geometry rather than typed beside it.

It is drawn on a **designer surface of its own**, opened on one asset: its own background — the
technical drawing or spec sheet — its own calibration, and an origin the shape is drawn around.
That separation is the point rather than an implementation detail. A spec sheet is at 1:20 and the
plans it will be placed into are at 1:100, and a product where tracing an oven could disturb the
scale of the bathroom is a product whose numbers cannot be trusted anywhere.

**This epic is not derived from the PRD's twenty epics.** §17's Asset Library lists six features —
asset definition, placement, quantity, geometry-linked asset, automatic quantity, searchable
catalog — and drawing an asset's shape is in none of them. It was requested directly, and it
*extends* §17's definitions, §13's asset layer, §82's calibration and §88's derived data rather
than being read out of them. It also needs a workspace surface **SDD §11 does not enumerate**,
which lists two primary views and four future ones and no designer among them; SDD §12's
per-view Vue app generalises to a seventh without amendment, but the enumeration does not, and
that is an architecture decision owed to `docs/development/adrs/` when somebody slices this work rather than
one this note may take.

## Definition of done

An item beneath this epic is done when:

- A footprint obeys [[Asset library]]'s existing rules rather than a second set: a placement
  references the definition and never copies it, and a derived value is recomputed on read (§88).
  This epic extends those rules from price to geometry and deliberately does not restate them — a
  rule stated in two notes is two rules the day one of them is edited.
- **Every attribute of the shape a placement referenced** stays identifiable after the fact —
  footprint, clearance boundary, anchor, facing and height, not the outline alone — so that
  freezing a plan has something to freeze. This epic hands [[Plan revisions]] a problem it did not
  have: an approved revision is immutable and must stay recoverable, that epic snapshots a plan's
  *own* geometry, and a referenced shape is in none of it — so editing a definition would silently
  redraw, reorient or re-export a drawing somebody had already approved, which is exactly the
  failure that epic exists to prevent. The attributes are named one by one on purpose: an
  obligation written about *the geometry* reads as the outline, and the other four move the
  rendering and the export just as surely. Whether the answer is a version pin or a snapshot taken
  at approval is **that epic's to decide**; the obligation here is only that the state a placement
  used is recoverable rather than overwritten in place.
- The calibration a designer surface takes belongs to **that object** and never reaches a plan's.
  The act itself stays [[Calibration and measurement]]'s, and this epic inherits **every rule that
  epic states**, with exactly one replaced: *calibration belongs to the plan* becomes *an object's
  calibration belongs to the object*, a replacement rather than an exception, because the two
  notes cannot both be read as owning it. Inheriting wholesale and naming the single exception is
  deliberate. An earlier wording here listed the three rules it inherited, which silently dropped
  the other two — a list of somebody else's rules is stale the day they state a sixth. The one
  worth reading twice: **an uncalibrated surface says so wherever a measurement would otherwise
  appear.** An object traced before its background is calibrated is exactly that surface, and
  unscaled dimensions presented as real is the failure the derived-dimension rule would otherwise
  walk straight into.
- An object is usable before it is accurate. Typing 120 × 80 yields a rectangle a renovator can
  place immediately; tracing a technical drawing is the refinement and never the entry fee (§3.5's
  progressive complexity — this persona abandons a plugin rather than learn a schema).
- Clearance is captured as a boundary **distinct from the footprint** and correctly scaled, so a
  placement carries onto the plan an outline nothing has to guess the meaning of. What the plan
  then does with it — drawing it, flagging an overlap between two of them — belongs to
  [[Plan editor]] and [[Asset placement]] and is **not promised by this epic**.
- An **anchor** and a **facing direction** are captured with the shape and round-trip with it, so
  a placement reads one reference point and one canonical orientation instead of each deriving its
  own. Which of them a placement applies, and what it does when a renovator rotates or mirrors an
  object, belongs to [[Asset placement]] and is likewise not promised here. Stated as its own
  condition because an epic that names an attribute in its prose and in none of its criteria has
  promised a field nothing is judged against.
- Height is **stored, shown and exported, and interpreted by nothing**: no calculation, no
  clearance check and no fit test anywhere in the product reads it. Displaying a number and
  computing with one are different acts, and only the second is refused here. *Does the worktop
  clear the window sill* is therefore a question this epic does not answer, and no item beneath it
  may claim otherwise. The first epic that needs a vertical answer is the one that earns the right
  to state this differently.
- A designed object round-trips as plain Markdown plus a geometry sidecar, readable and useful
  with the plugin uninstalled (§3.2), and a renovator's own words for a category or a kind of
  object survive the round trip unchanged (§84). **That sidecar lives with the shared library, not
  with any plan and not with any project**, which follows from where its definition lives: §59 as
  amended makes [[Asset]] a catalogue shared across projects, in the library folder's `Assets/`
  (§83)
  ([[Work belongs to one project, catalogues belong to the vault]]). Neither scope ADR-011 offers
  will do — that ADR puts one `.rpgeo` per *plan*, named by the plan's id and carrying a `planId`,
  on ADR-002's per-plan-not-per-spatial-object rule, inside a *project's* `Geometry/` folder — and
  a footprint many plans across many projects reference cannot live in any one of their sidecars
  without breaking the correct-it-once guarantee this epic exists for. **What is still owed to
  `docs/development/adrs/`, beside the surface decision above, is the file layout rather than the scope**: what
  an asset's geometry file is called, what it carries in place of a `planId`, and whether it sits
  beside its note or in a `Geometry/` folder of the library's own.
