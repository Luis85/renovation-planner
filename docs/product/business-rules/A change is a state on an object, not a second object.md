---
rule: BR-SPATIAL-004
kind: lifecycle
name: A change is a state on an object, not a second object
area: spatial
sources:
  - PRD §30
type: business-rule
---

# A change is a state on an object, not a second object

**The rule.** §30's six states — `existing`, `to-remove`, `to-retain`, `planned`, `in-progress`,
`installed` — are a property of any [[Spatial object]]. §30's four verbs (retain, remove, modify,
new) are all expressible as an existing object *in a state*, which is why they are not four
separate kinds of object.

**Why.** Renovation is the transformation of an existing state, not construction on empty ground.
Modelling a demolished wall as a deleted object loses the demolition — which is work, has a cost, a
trade and a duration. Modelling the replacement as an unrelated new object loses the relationship
between them. One object with a state keeps both, and lets every quantity downstream ask which it is
dealing with: a wall coming down and a wall going up are distinguishable, and neither has vanished.

**Where it holds.** The state is a field on the spatial object, read by the quantity engine, by
state visualization, by the existing-versus-target view and by as-built documentation — four surfaces
over one field rather than four models.

**Checked by.** Not yet.

**Sources.** PRD §30.
