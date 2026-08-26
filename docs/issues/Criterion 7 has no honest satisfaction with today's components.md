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

# Criterion 7 has no honest satisfaction with today's components

An acceptance criterion of [[Prototype a screen in the harness before it is built]] that the
delivered harness does not meet, recorded at the finish line rather than quietly dropped.

## The question

Criterion 7 reads: *"Two components mounted from one prototype read the same plan: a value
shown by both matches."* It is the criterion that makes the shared fixture load-bearing — a
prototype composing two real components proves they agree about the world, which is the thing
a screenshot of one component cannot show.

Of the four editor shell components, **only `StatusBar` reads plan data at all**. So the
delivered `ZonePanel` composes `ZoneSummary` (a mock, with its numbers hard-coded) and
`StatusBar` (real, reading `Ground floor` / `Zoom 10%` from the fixture) — one reader, not
two. There is no pair of real components today that read the same value, so the criterion is
not merely unimplemented: with the components that exist, it has no truthful satisfaction.

## What is true today

- `tests/harness/SharedWorldPrototype.vue` and `tests/harness/fixture.ts` deliver the shared
  world, and a test asserts the fixture reaches a mounted component.
- `src/prototypes/ZonePanel.vue` composes a mock and a real component through the index's
  global registry, which is criterion 6 and is met.
- Nothing anywhere asserts two components agreeing on one value, because nothing can.

## What closes it

Either of these, and the choice is the open part:

- **Wait for the second reader.** The Inspector panel is the obvious candidate: once it draws
  a zone's name or area from the store, a prototype composing it beside `StatusBar` satisfies
  the criterion as written, with a test that fails if the fixture stops being shared.
- **Restate the criterion against what a harness can prove.** "One component reads the shared
  fixture, and a second mount of the same prototype reads the same value" is checkable now and
  is a weaker claim; saying so is the cost.

## Why it matters

- The criterion is the only one that distinguishes this harness from a component gallery. A
  gallery draws each component from its own props; this thing exists so a *screen* can be
  drawn from one world.
- Leaving it unstated would make the requirement note read as satisfied. This repository's own
  first rule is to write the guarantee to the check — an acceptance criterion nothing meets is
  the same defect, in the document that defines done.
