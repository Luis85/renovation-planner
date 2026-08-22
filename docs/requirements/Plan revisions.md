---
type: Epic
order: 200
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

# Plan revisions

A plan that changes silently cannot be the basis of a quote, an award or an argument. §31 makes
the versioning explicit, and the requirement that carries the epic is the last one in its list:
an approved revision is immutable. A trade priced *that* drawing, and if the drawing can still
move, the price means nothing and neither does the disagreement about it.

This is document control rather than domain modelling, which is the line between this epic and
[[Existing state, planned change and as-built]]. That one types the objects inside a plan; this
one freezes the plan those objects were in at the moment somebody committed to it. §31's lifecycle
runs draft, proposed, approved, superseded, as-built — and `superseded` is the state that makes
immutability survivable, because a plan does keep changing and the answer is a new revision rather
than an edit.

Its cost is real and worth stating: every write path in the product has to know whether the thing
it is about to change belongs to an approved revision. That is a rule at the write, not a habit.

Derived from PRD §31 (Epic 20), with geometry persistence from §38, schema versioning from §61 and
derived data from §88.

## Definition of done

An item beneath this epic is done when:

- An approved revision is immutable, and a change to it produces a new revision with the old one
  marked superseded, never an edit in place.
- Immutability is enforced where geometry and frontmatter are written, so code written later
  inherits it. A convention that lives in whoever remembers it is not this epic's deliverable.
- The lifecycle is exactly §31's five states, ending at `as-built`, which is the joint with
  [[Existing state, planned change and as-built]].
- Revision comparison is derived from the two revisions (§88) and stored nowhere.
- Revision metadata says who, when and — the part that becomes unrecoverable within a month — why.
