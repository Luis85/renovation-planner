---
type: Epic
order: 190
status: ""
started: ""
finished: ""
horizon: "V2"
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
---

# Existing state, planned change and as-built

This is the epic that makes the product a *renovation* planner rather than a drawing tool. A new
build draws what will exist. A renovation has to hold four things at once — what is there now,
what goes, what stays, what arrives — and then a fifth, what actually got built. §30 draws that
chain and gives the six object states it needs.

It is a modelling concern rather than a feature, which is why it sits this late and touches
everything before it. A wall that is being removed and a wall that is being built are the same
geometry answering two different quantity questions: one is demolition volume and disposal cost,
the other is material to buy. Without the state, [[Cost and budget engine]] cannot tell them
apart, and a renovator gets a plausible total that has silently paid for a wall twice or not at
all.

It is deliberately **not** merged with [[Plan revisions]], although §31's lifecycle ends at the
same word. That epic versions the plan as a document, for awarding and pricing; this one types the
objects inside it. The shared word `as-built` is a joint between the two, not evidence that they
are one thing, and merging them would make an immutability rule govern a modelling concern.

Derived from PRD §30 (Epic 19), with the spatial object model from §34, the renovation lifecycle
from §35 and accessibility from §44.

## Definition of done

An item beneath this epic is done when:

- Every spatial object can hold each of §30's six states, and the state is frontmatter a human can
  read.
- Existing, planned and as-built are three views of one model, not three copies of the geometry.
  Three copies is how they come to disagree.
- A quantity knows which state it belongs to, so demolition and new material are separate
  questions about the same wall.
- An object marked `to-remove` stays in the model after it is gone, because the as-built record is
  a record of what was there.
- State visualization is not colour-only (§44), which matters more here than anywhere: the whole
  epic is a distinction between things that look identical on a plan.
