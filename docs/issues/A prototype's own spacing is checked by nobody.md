---
type: Issue
parent: "[[Prototype a screen in the harness before it is built]]"
order: 50
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

# A prototype's own spacing is checked by nobody

The defect class that survived forty-four review rounds, still present in the first mock the
harness shipped.

## The question

`src/prototypes/ZoneSummary.vue` puts its name and its area in two adjacent `<span>`s on
adjacent template lines. Vue's default `whitespace: 'condense'` removes whitespace between two
elements when it contains a newline, and no stylesheet gives `rp-zone-summary__name` or
`rp-zone-summary__area` any margin — so the mock renders **`Kitchen12.60 m²`**.

This is the identical defect the index's own entry rows had (`ZonePanelprototype`), fixed in
`tests/harness/theme.css` by a `margin-inline-start` on the sibling span. The mock has no such
rule. It was found by capturing a PNG and looking at it; nothing else here can find it.

## What is true today

- The suite reads `textContent` and is perfectly happy: `Kitchen12.60 m²` contains both
  strings, and every assertion about them passes.
- jsdom lays nothing out, so the remedy is CSS and the CSS is invisible to every gate.
- `npm run harness-shot` writes the PNG that shows it, asserts nothing about it, and is
  deliberately outside `npm run check` and outside CI.

## What closes it

The immediate half is one rule in the prototype's own styles — and it has to be CSS rather
than a template separator, because `ZoneSummary.vue`'s template block is byte-identical to
`tests/fixtures/promotion/ZoneSummary.promoted.vue` by design: editing it forces the same
edit on the twin and a new clone digest in `.fallowrc.json`. The open half is the general
one, and it is why this is an issue rather than a one-line fix: **the next prototype has the
same trap**, and a mock is exactly the artefact nobody writes a test for.

Candidates, none costed:

- A lint rule refusing adjacent inline elements with no separator in a template — narrow,
  checkable, and would have caught both instances.
- A convention that prototype text nodes carry their own spacing, stated in
  `src/prototypes/README.md` where the relaxed rules already live.
- Baseline image diffing on `harness-shot`, which is a much larger commitment and would put a
  capture step inside CI.

## Why it matters

- `CLAUDE.md` already states the lesson: anything whose symptom is a measurement no layout
  engine performs is outside every gate this repository has. The prototype directory is where
  that class of defect is most likely and least noticed, because a mock's whole job is to look
  right.
- Shipping the harness with the defect in its own showcase mock is the strongest possible
  demonstration that a green `npm run check` says nothing about appearance.
