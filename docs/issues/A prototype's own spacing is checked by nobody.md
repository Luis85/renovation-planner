---
type: Issue
parent: "[[Prototype a screen in the harness before it is built]]"
order: 50
status: Done
started: 2026-08-26
finished: 2026-08-26
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
- The second mock written here, `src/prototypes/WorkPackages.vue`, does **not** have the
  defect — it ships `styles/work-packages.css`, whose gaps and margins put every adjacent
  element apart on purpose. That is the sharpest statement of the trap: it is sprung by a
  mock with no stylesheet of its own, and nothing anywhere notices that a mock has none.

## What closed it

**The spacing itself, in `styles/zone-panel.css`** — a `column-gap` on the row, plus
`justify-content: space-between`, so the two spans are separated at every width rather than
only at comfortable ones. It had to be CSS and not a template separator: `ZoneSummary.vue`'s
template is byte-identical to `tests/fixtures/promotion/ZoneSummary.promoted.vue` by design.

**The precondition, in `tests/build/prototype-styles.test.ts`** — a prototype may not name a
class the assembled sheet leaves undeclared. That is deliberately not the same claim as "the
mock looks right", and the note has to say which one it is: the spacing is still measured by
nobody, because jsdom lays nothing out and `textContent` reads `Kitchen12.60 m²` as two happy
strings. What is now impossible is the CONDITION that produced it — a mock shipped with no
styles of its own, which is how the defect got past forty-four rounds while `WorkPackages.vue`
avoided it by having a stylesheet at all.

Two things came out of building it, both worth keeping:

- **It found a second instance on its first run.** `rp-wp-state-word`, in an hour-old mock, was
  a class carrying no rule and never had one — invisible, because its parent's flex gap already
  did the spacing. The class is gone rather than given a rule.
- **The instrument was wrong first, and the probe caught it.** The check read the `styles/`
  directory while its own comment claimed "the assembled sheet", and removing the `@import`
  that was supposed to red it left it green. It calls `assembleStyles()` now — the build's own
  function. The assembler happens to refuse an unimported partial anyway, so the two agree
  today; measuring the set the sentence names is not something to leave resting on that.

## Why it matters

- `CLAUDE.md` already states the lesson: anything whose symptom is a measurement no layout
  engine performs is outside every gate this repository has. The prototype directory is where
  that class of defect is most likely and least noticed, because a mock's whole job is to look
  right.
- Shipping the harness with the defect in its own showcase mock is the strongest possible
  demonstration that a green `npm run check` says nothing about appearance.
