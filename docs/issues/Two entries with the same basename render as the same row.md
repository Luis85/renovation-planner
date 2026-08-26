---
type: Issue
parent: "[[Prototype a screen in the harness before it is built]]"
order: 40
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

## What closes it

Not "show the path", which is the obvious fix and the wrong one: it disambiguates the rows and
still leaves a designer meeting an unresolved tag with no explanation. The fix worth making is
to surface what `registrableComponents` **already decided** — mark the ambiguous pair in the
list as unusable in a prototype, for the reason it is unusable — plus a test mounting two
same-basename fixtures and asserting the rows say so. The test is the part that matters: it is
what stops the next reorganisation from reintroducing the silence.

## Why it matters

- The picker is the whole navigation surface. A row that lies about which file it opens wastes
  the exact loop this harness exists to shorten.
- `entries.ts` reasoned this through for the registry and stopped at the module boundary. The
  same ambiguity, one layer up, has no owner.
