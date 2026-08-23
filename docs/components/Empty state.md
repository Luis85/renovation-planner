---
name: Empty state
medium: dom
region: in-flow
slice:
  - "[[14-empty-states]]"
partOf: "[[Design System]]"
sources:
  - PRD §39
  - PRD §94
  - PRD §95
type: component
---

# Empty state

What a surface shows when it has nothing. PRD §94 is one sentence long — *every central view
should provide actionable empty states* — and the load-bearing word is **actionable**: a message
alone is a dead end with better manners.

## Anatomy

- **A line saying what is missing**, in the surface's own nouns. [[Information Architecture]]'s
  register decides those: *no assets yet*, not *no library items*.
- **One action that fixes it.** This is the part PRD §94 is actually asking for, and the part
  that makes this a component rather than a paragraph.

One action, not several. A surface with three suggestions has not decided what a user should do
first, which is the decision an empty state exists to make.

## States

**It is a state, so it has none of its own.** What varies is the *cause*, and the causes do not
share an action:

| Cause | The action |
| --- | --- |
| Nothing created yet | Create the first one |
| Nothing selected | None — an instruction, not a button |
| Nothing matches a filter | Clear the filter |
| The load failed | **Not this component's** — see open question 1 |

The second row is the one worth naming: an [[Inspector]] with nothing selected cannot offer a
button, because the action is *select something on the canvas* and the canvas is right there.

## Contract

**Given** a message and at most one action. **Emits** that action.

**It does not know why it is empty.** The surface does, and it passes the right message in. An
empty state that inspected its own container to guess the cause would have made every surface's
emptiness its business.

PRD §95's example project is the other answer to the same problem, and worth naming here so the
two are not built twice: an optional demo project means a new user's first surfaces are not empty
at all. An empty state is what happens when they declined it.

## Where it appears

Every panel of [[Left rail]], the [[Inspector]] with nothing selected, the [[Plan canvas]] with
no plan, and every Bases-backed surface — where **Bases owns the row and therefore its emptiness
too**, per [[The alternative list route is a Bases view]].

`region: in-flow` because it **replaces** content rather than overlaying it. That is the
distinction the four-value region vocabulary could not carry, and this is the component that
forced the fifth value.

## Accessibility

Because it replaces content, **heading order** is the live risk: an empty panel that drops the
`<h2>` its populated sibling has breaks the sequence — and heading order is one of the few things
`tests/harness/accessibility.test.ts` genuinely does check.

The action must be a real control, not a link-styled span. A clickable div is invisible to a
keyboard user and to axe's name-role-value rules alike.

## Open

1. **Does a failed load show an empty state or an error?** Slice 14 defers two cases to slice 17
   by name — a view whose hydrating query failed, and a view whose stored entity id no longer
   resolves — and slice 17's table has to catch both. Showing *nothing here yet* for a failure is
   a lie a user acts on.
2. **Whether the [[Plan canvas]]'s empty state is drawn or DOM.** The canvas is the one surface
   where an in-flow DOM overlay and a drawn message are both available, and they behave
   differently under zoom.

## Sources

PRD §39 · PRD §94 · PRD §95, in
[`docs/prds/obsidian-renovation-planner.md`](../prds/obsidian-renovation-planner.md).
