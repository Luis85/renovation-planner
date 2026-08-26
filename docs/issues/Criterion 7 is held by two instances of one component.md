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

The Inspector panel was always the candidate — it draws a zone's name and area from the store —
and it turned out to be blocked by something this note did not know about: `InspectorPanel`
could not be MOUNTED outside `PlanEditorRoot` at all. It injects the editor runtime, nothing
above it in the harness provided one, and a template-only prototype has no script block with
which to supply an injection. Three other components were in the same position. (A mock may
carry a script now, so a prototype COULD provide one itself — but a per-entry provide in the
index is the right place for it regardless, since every entry needs it and no mock should have
to know that.)

**That half is fixed.** `EntryBoundary` calls `provideEditorRuntime(usePlanEditorContext())`,
the same call with the same argument `PlanEditorRoot` makes in a vault, built per entry so an
entry's `CommandHistory` cannot outlive it. `InspectorPanel` and `EditorToolbar` open in the
index now, and a prototype can compose them.

What is still missing is smaller and more stubborn: **no two components display the same
value.** `StatusBar` shows the plan's name; the Inspector shows the selected zone's name and
area. A prototype composing both would demonstrate two different components reading one world —
worth having — but the criterion's literal "a value shown by both matches" would still be held
by the two `StatusBar` instances. Closing it needs a second component that prints something the
first one prints too, and choosing to build one is a product decision rather than a harness
one.

The fixture is the other half of it: `reseedFixture()` clears the selection, so an Inspector
composed into a prototype today shows `Nothing selected.` Seeding a selection would give it
real content — a better fixture for looking at, which is what this harness is for — and is a
change to every plan-editor capture, so it belongs to whoever makes that call.

## Why it matters

- The criterion is the one that distinguishes this harness from a component gallery: a gallery
  draws each component from its own props, this draws a *screen* from one world.
- Recording the distinction now is cheaper than rediscovering it the day someone reads the
  passing test as proof of the stronger claim.
