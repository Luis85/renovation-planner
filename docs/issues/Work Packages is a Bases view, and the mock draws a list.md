---
type: Issue
parent: "[[User Interface]]"
order: 70
status: New
started: ""
finished: ""
horizon: Now
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
---

# Work Packages is a Bases view, and the mock draws a list

An open conflict, raised by the first author to prototype the screen and recorded here rather
than settled in the file that hit it.

## The question

[[Sitemap]] records Work Packages as a **Bases view** — Obsidian's own read-only table over the
notes, registering no view type — on the strength of PRD §41, and
[[The alternative list route is a Bases view]] makes Bases the canvas-free route for every
spatial surface rather than a decision taken per surface.

`src/prototypes/WorkPackages.vue` draws a **plugin-rendered list**. It was written because a
list view was asked for and looked at, and it is a different answer to that row.

## What is true today

- Nothing is built either way: the mock is a mock, and no view type is registered.
- The two design decisions in it are invisible in a Bases table, which is the sharpest form of
  the conflict rather than an argument for the drawn list. Bases renders the columns it is
  given: the per-task pips collapse to a number, and the paired glyph-and-word status collapses
  to one text column. §85's "colour is never the only channel" survives that collapse; the
  *density* both decisions exist for does not.
- The pips were reached for because a template-only mock cannot express a proportion — no script
  block, so no bound width, and an inline `style` is what promotion would have to remove. That
  constraint has since been lifted (a mock may carry a `<script setup>` now), and the pips are
  kept on their own merit: a bar at 0% and a bar at 12% look alike, eight pips and three do not.
  Worth knowing when settling this, because the decision no longer has a constraint behind it.

## What closes it

Somebody deciding, on the product's terms rather than the prototype's: either Work Packages is
a Bases view and the mock is a study whose ideas move into column choices, or the row changes
and this becomes a registered surface with the trigger for it named — the shape
[[Budget, Schedule and Procurement are Bases views first]] already established for exactly this
question.

Nothing should be built from the mock until that is settled, and `WorkPackages.vue` says so in
its own header too.

## Why it matters

- [[Sitemap]]'s inventory is the artefact that claims every surface has a name and a place
  decided before it is drawn. A drawn surface contradicting a row is that claim failing in the
  one direction it was built to catch.
- The trigger mechanism exists precisely so a new workspace view has to argue for itself. Using
  a prototype as the argument, without naming the trigger, is how three surfaces nobody has a
  use case for get built.
