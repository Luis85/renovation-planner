---
type: Issue
parent: "[[Plan editor and canvas]]"
order: 60
status: New
started: ""
finished: ""
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

# The canvas has no budget left for the next input rule

`EditorSurface.vue` measures **399 lines against the 400 the linter allows**. Task 11 already
extracted `PlanCanvas.vue`'s pointer vocabulary out to `pointerButtons.ts` once (twice,
counting the rename that carried `PlanCanvas`'s own pointer/keyboard routing into this file),
and the next rule anyone adds to it — a pointer door, a shortcut, a guard — does not fit.

**This note originally named `PlanCanvas.vue` as the subject.** That file is now a 102-line
wrapper (`src/presentation/editor/PlanCanvas.vue`) that hands its layers and its slot to
`src/presentation/editor/surface/EditorSurface.vue`, which is where the pointer routing, the
keyboard handling and the gesture state actually live today — the same file the analysis below
was written about, under its later name.

## What is true today

Measured with the counter the gate itself runs, rather than by reading a line number in an
editor:

```bash
npx eslint src/presentation/editor/surface/EditorSurface.vue src/plugin/composition-root.ts \
  src/application/reference/deleteResolution.ts src/presentation/editor/runtime.ts \
  --rule '{"max-lines":["error",{"max":1,"skipBlankLines":true,"skipComments":true}]}'
```

| Module | Linted lines | Headroom |
| --- | --- | --- |
| `src/presentation/editor/surface/EditorSurface.vue` | 399 | **1** |
| `src/presentation/editor/runtime.ts` | 394 | **6** |
| `src/plugin/composition-root.ts` | 361 | 39 |
| `src/application/reference/deleteResolution.ts` | 373 | 27 |

Re-measured 2026-09-06: `composition-root.ts` is no longer at the cap the way it was when this
note was written (it had 2 lines of headroom then; task 4 and task 5's wiring changes moved it
since), so `EditorSurface.vue` is the only module actually at the edge today, with `runtime.ts`
close behind it — both canvas-adjacent, both counted here because the same command prints them.

`wc -l` answers 1367 for `EditorSurface.vue` and that figure is misleading in a way worth
naming precisely, because it is not simply "the rule skips comments": **36 of those raw lines
are one HTML comment inside `<template>`** (the pointer-swallowing overlay's rationale), and
`max-lines` does NOT skip a template comment the way it skips a `//` or `/* */` one in a
`<script>` block — it counts every one of those 36 lines against the budget. So the gap between
1367 raw and 399 counted is mostly ordinary `<script>`-block comment (each routing rule's
argument, written beside the code, exactly as this note originally said), but the template's
own commentary pays the budget in full. One line is the real number left.

## Why this is not a formatting problem

`runtime.ts` stood exactly here during slice 13. One object literal was collapsed onto a
single line to buy three, under a comment predicting that the next change adding a line of
*code* — of any size — would trip the rule and that the answer would then be an extraction
rather than a second collapsed literal. The next review round took it to 411, and
`inspector-wiring.ts` is what came out of it. **A budget bought back by reformatting is a
budget that has already been spent.**

This file has already spent it twice. `pointerButtons.ts` says so in its own header: "the
vocabulary `PlanCanvas` routes on, extracted when that file crossed its line cap — twice,
`isPrimary` arriving on the second".

## What a decomposition must not do

The canvas navigation section of `CLAUDE.md` runs to **44 rules**, and the majority of them
are one door not asking what its sibling asks: the release door committing at a foreign
pointer's coordinates, the move door recording a position the guard above it had just
declined, the cancel door abandoning the wrong gesture. The lesson those rounds ended on is
that a question worth asking at one door is a *function* — `isGestureOwner` and
`gestureInFlight` are asked at four doors each — and that the moment such a question is
spelled longhand anywhere, the count of places it is missing becomes unknowable.

So the seam is constrained rather than free. Four fields are read and written across six
handlers — `lastStagePoint`, `toolGesturePointer`, `swallowedPointers` and `panOverride` —
and a split that puts a handler in one module and the state it owns in another turns the two
predicates into two spellings. **One module per handler is the shape to refuse**, however
naturally the file falls into it.

## Candidate seams

Approximate proportions, from a comment-stripping count that totals 369 against ESLint's
398 — read them as shares of the file, not as budget arithmetic:

| Region | ~Lines |
| --- | --- |
| Setup: imports, stores, computed, sizing | 90 |
| Pointer routing, `onWheel` through `onPointerLeave` | 140 |
| Keyboard: `fitShortcut`, `isCanvasKey`, `zoomShortcut`, `onKeyDown`, `onKeyUp` | 73 |
| Template | 65 |

Two options worth costing:

1. **The keyboard alone**, into a composable. Buys about 73 lines and is the smaller change —
   but the keyboard door arms the pan override and consults the camera lock, so the shared
   state crosses the seam anyway. Cheapest, and the one that leaves the invariant hardest to
   read.
2. **The whole input layer** — every pointer and key handler, the four shared fields and both
   predicates — into one composable, leaving the SFC with the stage, the seven layers, the
   sizing and the template. Buys about 210 lines and keeps every door in one file, so they go
   on being read against each other. **This is the recommendation.**

## What would notice

Six test files drive this canvas's input directly and total 2,767 lines —
`canvasChordedButtons`, `canvasGestureOwnership`, `canvasKeyboardGestures`,
`canvasNavigation`, `canvasPointerRouting`, `canvasSwallowedPointers` — beside
`interactionLayer.test.ts` (456) on what the tools draw. A decomposition that changes no
behaviour changes none of them. **If a case has to be edited to keep it passing, that is the
signal that the seam moved a rule rather than a function**, and it is worth more than any
review of the diff.

## Why it matters

- The person who trips the cap will be mid-fix. Every change this file has taken since slice
  8 arrived as a review finding about a pointer that a door was not asking about, which is
  the worst possible moment to be designing an extraction under a red gate.
- One line is smaller than the noise of an ordinary edit. A guard added at a fifth door, the
  kind the 44 rules above keep asking for, is three lines with its comment.
- The alternative to deciding this deliberately is deciding it under a lint error, and the
  file's own history says what gets reached for then: a collapsed literal, and the same
  question spelled twice.
