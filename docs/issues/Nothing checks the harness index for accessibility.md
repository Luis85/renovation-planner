---
type: Issue
parent: "[[Prototype a screen in the harness before it is built]]"
order: 30
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

# Nothing checks the harness index for accessibility

A gap between what `tests/harness/accessibility.test.ts` claims by its name and what it
actually scans.

## The question

The accessibility suite is axe-core driven in jsdom against the real mounted views —
`mountHarness` and the real Plan Editor. It does not mount `IndexPage.vue` at all: there is no
reference to the index anywhere in that file. So the harness index — a `nav` with a labelled
region, a list of links, an `h1`, a live `role="alert"` failure card and a stage that swaps its
contents — has never been through axe.

That surface is the one most likely to have an accessibility defect of the kind axe *can* see
in jsdom: it is the only page here built out of interactive controls rather than a canvas.

## What is true today

- The suite's own header is honest about what it cannot check (contrast, focus indicators, hit
  size, page-wide landmark rules) — this note is about scope, not about those limits.
- The index has an `aria-label` on its `nav`, which is the shape axe found wrong on role-less
  `<div>`s in the Plan Editor. Whether it is right here is unverified.
- The failure card's `role="alert"` and the `data-failure` attribute beside it are a pairing
  axe would have an opinion about.

## What closes it

One more case in `tests/harness/accessibility.test.ts` mounting the index through
`tests/harness/indexApp.ts` — the app config both index test files already share, so the mount
is a few lines — and scanning it, with a second case for the failure state, since the alert is
only in the tree when something failed.

## Why it matters

- The suite is named for a category, not for a list of views. A category invariant checked by
  driving the paths someone thought of is exactly the shape this repository refuses everywhere
  else.
- The index is developer tooling, which is the usual reason given for skipping this, and it is
  not a good one: a designer using a screen reader is a person this tool would exclude.
