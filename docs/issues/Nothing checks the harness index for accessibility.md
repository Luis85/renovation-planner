---
type: Issue
parent: "[[Prototype a screen in the harness before it is built]]"
order: 30
status: Done
started: 2026-08-26
finished: 2026-08-26
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

## What closed it

Three cases in `tests/harness/accessibility.test.ts`, mounted through `indexAppConfig()` — the
same object the browser's page is configured from — one per state, because the three draw
different markup and only the first is reachable by default:

- **the picker**, which is the labelled `nav`, the `h1` and the list of links;
- **an entry open on the stage**, which grades the prototype's own markup as well as the
  index's — this is the case that would catch a mock shipping an unlabelled control;
- **the failure card**, the one piece of live-region markup in the tree, which exists only
  when something has gone wrong.

All three passed on the first run, so a fourth case makes them worth their runtime: a
nameless `<button>` injected into the template reds all three, and a separate case asserts the
middle scan actually opened `ZonePanel` rather than quietly scanning a failure card — a
renamed prototype would otherwise leave it green while grading nothing it claims to. Watched
failing both ways.

The file's whole ceiling still applies and this note must not be read as widening it: contrast,
focus visibility, hit-target size and the page-wide landmark rules are as invisible on the
index as they are on every other surface here.

## Why it matters

- The suite is named for a category, not for a list of views. A category invariant checked by
  driving the paths someone thought of is exactly the shape this repository refuses everywhere
  else.
- The index is developer tooling, which is the usual reason given for skipping this, and it is
  not a good one: a designer using a screen reader is a person this tool would exclude.
