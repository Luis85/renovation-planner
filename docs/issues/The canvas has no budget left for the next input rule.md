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

`PlanCanvas.vue` measures **398 lines against the 400 the linter allows**. It has been
extracted from twice already for this reason, and the next rule anyone adds to it — a
pointer door, a shortcut, a guard — does not fit.

## What is true today

Measured with the counter the gate itself runs, rather than by reading a line number in an
editor:

```bash
npx eslint src --ext .ts,.vue \
  --rule '{"max-lines":["error",{"max":1,"skipBlankLines":true,"skipComments":true}]}'
```

| Module | Linted lines | Headroom |
| --- | --- | --- |
| `src/presentation/editor/PlanCanvas.vue` | 398 | **2** |
| `src/plugin/composition-root.ts` | 398 | **2** |
| `src/application/reference/deleteResolution.ts` | 340 | 60 |
| `src/presentation/editor/runtime.ts` | 316 | 84 |

`wc -l` answers 1221 for this file and that figure is worthless here: the rule skips blank
and comment lines, and the file is mostly comment because each of its routing rules cost a
review round and the argument is written beside the code. Two lines is the real number.

The `composition-root.ts` row is not this note's subject and is recorded because the same
command printed it: two modules, not one, are at the cap.

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
- Two lines is inside the noise of an ordinary edit. A guard added at a fifth door, the kind
  the 44 rules above keep asking for, is three lines with its comment.
- The alternative to deciding this deliberately is deciding it under a lint error, and the
  file's own history says what gets reached for then: a collapsed literal, and the same
  question spelled twice.
