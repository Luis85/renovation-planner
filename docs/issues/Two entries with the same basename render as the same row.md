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
entries claim is registered for nobody and reported in `ambiguous`, with the reasoning written
down in that file. The LIST is the half with no answer.

## What is true today

- No two prototypes share a basename yet, so nothing is broken in the tree. This is why it is
  filed rather than fixed under a failing test.
- The registry's ambiguity handling means composition already degrades safely; only the picker
  misleads.

## What closes it

Showing enough of the path to disambiguate — the id, or the directory segment, or the label
with a parenthesised parent — and a test that mounts two same-basename fixtures and asserts the
two rows differ in their rendered text. The test is the part that matters: it is what stops the
next reorganisation from reintroducing it silently.

## Why it matters

- The picker is the whole navigation surface. A row that lies about which file it opens wastes
  the exact loop this harness exists to shorten.
- `entries.ts` reasoned this through for the registry and stopped at the module boundary. The
  same ambiguity, one layer up, has no owner.
