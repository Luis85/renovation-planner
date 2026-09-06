---
type: Issue
parent: "[[Errors, diagnostics and the test harness]]"
order: 190
status: New
started: ""
finished: ""
horizon: Next
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

# Polish leftovers from the 2026-09-05 pass

A bundle of small, independent, non-blocking findings from the pass's review rounds, none
worth its own note. Each is a one-line fix with no test needed beyond the gate already passing.

## What is true today

- **`SequenceMarkerFileStore.ts` repeats the `'sequence.marker-unreadable'` code literal
  across three guards** (lines 88, 95, 99), two of them (95, 99) sharing the identical message
  text as well as the identical code.
- **`RenovationPlannerPlugin.saveSettings`'s docblock states its write-then-swap argument in
  full**, and the inline comment inside the method's own body restates the same argument
  ("a session running on a value the file does not hold creates notes under a root the next
  start will not know about, and `projectFolder` is a/such a setting") almost verbatim.
- **`ZoneShape.vue`'s docblock — the paragraph reading "`listening: false` matches all four
  children and the layer above them (SDD §62); Konva resolves hit-testing by walking a node's
  ANCESTORS…" — cites the layer's `listening: false` as the reason selection never touches
  Konva hit-testing**, rather than the stronger and more general reason (this canvas hit-tests
  nothing via Konva at all — SDD §62, the same rule
  `tests/presentation/designer/layers.test.ts`'s designer measurement case below cites).
- **`GestureSketch.vue`'s header cites `ZoneShape.vue` with no line range**, unlike its sibling
  citation of `RoomDraftSketch.vue:158`, which does carry one.
- **The designer's measurement-tape test case in `tests/presentation/designer/layers.test.ts`**
  ("draws the shared gesture measurement tape for a two-point calibration") asserts only that
  `.gesture-sketch` and `.measurement-marks` groups exist (`toBeDefined()`), not their content —
  thinner than the Plan Editor's own mirror of the same drawing.
- **`InteractionLayer.vue` has a stray blank line immediately before its `</script>` tag.**
- **`tests/application/commands/requirement/overrides.test.ts:108`** mixes a tab and a space
  in its leading indentation (`\t const resetter = ...`), unlike every surrounding line's
  tabs-only indent.
- **A `registration.test.ts` test name uses a curly apostrophe** ("answers the palette’s own
  question...", line 336) while the docblock immediately preceding that `it(...)` — the one
  opening "The other half of the `checking` branch, off mobile: the palette's own question" —
  uses a straight one for the identical phrase.
- **`definitionDraft.test.ts`'s file header still frames its second review finding as
  "`definitionChanges` parsing unguarded when called without the `validateDefinition` gate in
  front of it"** — a caller-error scenario — when the case it actually added
  ("answers the same no-op diff for a waste value that only differs from the baseline by
  whitespace") is about an untrimmed comparison inside the gate, a different failure mode than
  the header's framing describes.

## What closes it

Each bullet is a standalone one-line-to-few-line edit with no behavior change: extract the
repeated literal/message in `SequenceMarkerFileStore.ts` to a shared constant; delete the
restated paragraph from one of `saveSettings`'s two write-then-swap sites and point to the
other; rewrite `ZoneShape.vue`'s docblock to cite SDD §62 the way the designer's own layer
docblocks do; add `GestureSketch.vue`'s missing line range; strengthen the designer
measurement-tape case to assert the tape's actual points/marks the way the Plan Editor's
mirror does; delete the stray blank line in `InteractionLayer.vue`; fix the tab+space line in
`overrides.test.ts`; make the apostrophe in `registration.test.ts` straight, matching the
comment beside it; and rewrite `definitionDraft.test.ts`'s header to describe the untrimmed-
comparison finding it actually fixed. `npm run check` passing is the whole test for all nine —
none changes behavior.

## References

- [[Errors, diagnostics and the test harness]]
- `src/infrastructure/obsidian/plugin-data/SequenceMarkerFileStore.ts`
- `src/plugin/RenovationPlannerPlugin.ts`
- `src/presentation/editor/layers/zone/ZoneShape.vue`
- `src/presentation/editor/layers/GestureSketch.vue`
- `tests/presentation/designer/layers.test.ts`
- `src/presentation/editor/layers/InteractionLayer.vue`
- `tests/plugin/registration.test.ts`
- `tests/application/commands/requirement/overrides.test.ts`
- `tests/presentation/library/definitionDraft.test.ts`
- Item 23, `.superpowers/sdd/2026-09-05-improvement-and-polish-pass/issues-brief.md`.
