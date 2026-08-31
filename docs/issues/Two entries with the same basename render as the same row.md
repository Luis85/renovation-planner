---
type: Issue
parent: "[[Prototype a screen in the harness before it is built]]"
order: 40
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

# Two entries with the same basename render as the same row

A latent defect in the index's entry list, found by review rather than by anything failing.

## The question

`tests/harness/entries.ts` derives an entry's `label` from the file's **basename** and its `id`
from the path. Ids are checked unique and a duplicate throws. Labels are not, and cannot be:
`src/prototypes/editor/ZonePanel.vue` and `src/prototypes/ZonePanel.vue` are two legitimate
entries whose basenames are one word.

The list renders `{{ entry.label }}` and `{{ entry.kind }}` and nothing else. Two prototypes
sharing a basename therefore draw **two rows a reader cannot tell apart** — same text, same
kind, differing only in an `href` nobody reads. Clicking one is a coin flip.

The global registry already handles its half of this correctly and deliberately: a label two
entries claim is registered for nobody and reported in `ambiguous`, and `IndexPage.vue` turns
the resulting unresolved tag into a named entry failure. The LIST is the half with no answer,
and `entries.ts`'s docblock now records exactly that — the gap is written where the two sides
disagree rather than living in a review thread.

## What is true today

- No two entries share a basename yet, measured, so nothing is broken in the tree. This is why
  it is recorded rather than fixed under a failing test.
- Criterion 4 still holds: both entries are reachable at their own URL. What fails is the
  reading of the list, not the routing.
- Composition already degrades loudly — a designer writing either name into a prototype gets a
  failure card. Only the picker is silent, which is the disagreement.

## What closed it

`IndexPage.vue` reads `registrableComponents(...).ambiguous` and marks BOTH rows — in words,
not a colour or an icon, because §85 refuses colour as the only channel and because the row has
to say *why* the name cannot be composed, not merely that something is off with it. The entry
stays a link: it opens perfectly well on its own, and it is the TAG that resolves to nothing.

Not "show the path", as recorded: separating the rows would leave a designer composing either
name with the same unexplained failure. What the list was missing is the decision that function
already took, so that is what it shows.

`tests/harness/indexAmbiguity.test.ts` plants the pair the tree does not contain — the entries
are fake because a latent defect can only be driven by planting the state that triggers it, and
everything else is real, the mock spreading over the actual module so the page calls the same
`registrableComponents` a browser does. Three cases, because the silent half matters as much:
a MOCK shadowing a component of the same name is deterministic rather than ambiguous, and
marking it would report the headline workflow as a defect. Watched failing in both directions
— marker removed, and marker shown on every row.

`entries.ts`'s own paragraph recording this as unfixed is rewritten in the same change, since a
fix that leaves its sibling stale is the shape this whole exercise kept producing.

## Why it matters

- The picker is the whole navigation surface. A row that lies about which file it opens wastes
  the exact loop this harness exists to shorten.
- `entries.ts` reasoned this through for the registry and stopped at the module boundary. The
  same ambiguity, one layer up, has no owner.
