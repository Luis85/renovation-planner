---
type: Issue
parent: "[[The project surface]]"
order: 10
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

# The filter field looks like an input across a region that cannot be clicked

The Home surface's filter is one bordered box holding an `<input>` and the pane's count line.
Only the `<input>` takes a click, and it is not the whole box.

## The question

The design spec's teletext raise says that at rest the field **is** the pane's count line, and
the field was rebuilt as a single bordered wrapper to make that literally true rather than
approximately so. A user reading that box reads one control. Which parts of it answer a click?

## What is true today

`src/presentation/views/ProjectFilter.vue` renders the border on a wrapper, with the `<input>`
and the count as siblings inside it. The wrapper carries no `cursor`, no `@pointerdown` and no
`@click` — measured, not inferred: grepping that file for all three returns nothing.

So two regions inside a control that looks like a text field are inert:

- the wrapper's inline padding, and
- the count region at the trailing edge, which is roughly 70–90px at 1280 and holds
  `10 projects` at rest.

Clicking either one focuses nothing. The caret does not appear, and typing goes wherever focus
already was.

The visually-hidden `<label>` is correctly associated and the focus ring lands on the wrapper
through `:focus-within`, so the keyboard path is intact. This is a pointer defect only.

## Why it matters

The whole argument for composing the field this way is that a search box which says nothing at
rest is furniture — the launcher direction's own recorded risk. Making the box wider and giving
it content answers that, and simultaneously widens the area a user will aim at. A control that
advertises a click across its whole face and honours it across part of it is a worse trade than
the empty box it replaced, because the empty box at least did not mislead about where to aim.

Nothing in the suite can see it: jsdom dispatches no native focus-on-click, and the surface's
captures are read for layout rather than driven for pointer behaviour.

## What closes it

A `pointerdown` handler on the wrapper that focuses the inner input, plus `cursor: text` so the
box stops disagreeing with itself.

**Both halves, or neither.** `cursor: text` alone makes it worse — it advertises a click that
still does nothing, which is why this was deferred rather than half-taken during the Home build.

The cost that deferred it is real and should be planned for rather than discovered: the handler
is a new function, and functions coverage sits at **one** covered unit of headroom
(`vitest.config.ts`'s ledger). An untested callback fails the gate outright, so the test is part
of the change rather than a follow-up to it.
