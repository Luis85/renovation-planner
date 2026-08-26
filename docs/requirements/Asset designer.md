---
type: Epic
order: 85
status: New
started: ""
finished: ""
horizon: "V1"
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
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
that is an architecture decision owed to `docs/adrs/` when somebody slices this work rather than
one this note may take.

## Definition of done

An item beneath this epic is done when:

- A footprint obeys [[Asset library]]'s existing rules rather than a second set: a placement
  references the definition and never copies it, and a derived value is recomputed on read (§88).
  This epic extends those rules from price to geometry and deliberately does not restate them — a
  rule stated in two notes is two rules the day one of them is edited.
- The calibration a designer surface takes belongs to **that object** and never reaches a plan's.
  The act itself stays [[Calibration and measurement]]'s, and this epic inherits its rules on
  units (§70), on the separation of internal from display precision (§71), and on loud
  invalidation when a background changes. The one rule it does **not** inherit is that epic's
  *calibration belongs to the plan*: an object's calibration belongs to the object. That is a
  replacement rather than an exception, because the two notes cannot both be read as owning it.
- An object is usable before it is accurate. Typing 120 × 80 yields a rectangle a renovator can
  place immediately; tracing a technical drawing is the refinement and never the entry fee (§3.5's
  progressive complexity — this persona abandons a plugin rather than learn a schema).
- Clearance is captured as a boundary **distinct from the footprint** and correctly scaled, so a
  placement carries onto the plan an outline nothing has to guess the meaning of. What the plan
  then does with it — drawing it, flagging an overlap between two of them — belongs to
  [[Plan editor]] and [[Asset placement]] and is **not promised by this epic**.
- Height is **stored, shown and exported, and interpreted by nothing**: no calculation, no
  clearance check and no fit test anywhere in the product reads it. Displaying a number and
  computing with one are different acts, and only the second is refused here. *Does the worktop
  clear the window sill* is therefore a question this epic does not answer, and no item beneath it
  may claim otherwise. The first epic that needs a vertical answer is the one that earns the right
  to state this differently.
- A designed object round-trips as plain Markdown plus a geometry sidecar, readable and useful
  with the plugin uninstalled (§3.2), and a renovator's own words for a category or a kind of
  object survive the round trip unchanged (§84). **Where that sidecar lives is a question this
  epic does not answer, and ADR-011 does not answer it either**: that ADR scopes geometry to one
  `.rpgeo` file per *plan*, named by the plan's id and carrying a `planId`, inside a *project's*
  `Geometry/` folder, on ADR-002's per-plan-not-per-spatial-object rule. An asset definition is
  reusable across plans **and projects** ([[Asset library]]), so its footprint fits none of those
  three scopes, and storing one inside a plan's sidecar would break the correct-it-once guarantee
  this epic exists for. An asset-scoped storage decision is owed to `docs/adrs/` beside the
  surface decision above.
