---
type: Issue
parent: "[[Prototype a screen in the harness before it is built]]"
order: 10
status: New
started: ""
finished: ""
horizon: "MVP"
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
---

# Criterion 7 is held by two instances of one component

What the delivered harness proves about the shared world, and the one word of criterion 7 it
proves by a reading rather than by construction.

## The question

Criterion 7 of [[Prototype a screen in the harness before it is built]] reads: *"Two components
mounted from one prototype read the same plan: a value shown by both matches."*

`tests/harness/SharedWorldPrototype.vue` holds it: a template-only SFC composing `<StatusBar />`
and `<PlanEditorRoot />` through the real registry, resolved rather than made async so an
unseeded store cannot be rescued by a late `onMounted` hydration. Three assertions, each watched
failing. That is a real proof and this note is not asking for it again.

The residue is in **which** two things show the matching value. Of the editor shell's
components, only `StatusBar` renders plan text — so the matching plan name is displayed by two
`StatusBar` instances, one of them the copy nested inside `PlanEditorRoot`. The prototype's own
docblock says this plainly rather than claiming more, and `PlanEditorRoot`'s independent read of
the same store is asserted on two paths that never reach a status bar: `status` deciding the
canvas, and the seeded zones it draws as captions.

So the criterion holds under the reading "two mount points", and does not yet hold under the
reading "two different components display one value". The second is the one the criterion was
written for.

## What is true today

- The proof is construction-honest about the shared world: one prototype, one store, children
  that never import each other.
- No second component in the shell renders plan text, so no other pairing is available to
  assert. This is a fact about the shell, not a gap in the harness.

## What closes it

The Inspector panel drawing a zone's name or area from the store. A fourth assertion then reads
that value out of the Inspector and out of `StatusBar` in the same mounted prototype, and the
criterion holds by construction with no reading attached.

## Why it matters

- The criterion is the one that distinguishes this harness from a component gallery: a gallery
  draws each component from its own props, this draws a *screen* from one world.
- Recording the distinction now is cheaper than rediscovering it the day someone reads the
  passing test as proof of the stronger claim.
