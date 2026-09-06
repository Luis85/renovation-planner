---
type: Issue
parent: "[[Asset library]]"
order: 40
status: New
started: ""
finished: ""
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

# The unit-cost draft comparison is untrimmed while its parse and its siblings trim

`definitionChanges` (`src/presentation/library/definitionDraft.ts:68-70`) diffs three numeric
draft fields against their baseline. `waste` and `height` both trim the draft side of the
comparison (`draft.waste.trim() !== before.waste`, `draft.height.trim() !== before.height`) —
a fix this same pass made for `waste` after a mid-TDD find (`definitionDraft.test.ts`'s "answers
the same no-op diff for a waste value that only differs from the baseline by whitespace"). The
`unitCost` line was not: `if (draft.unitCost !== before.unitCost) changes.unitCost =
moneyOf(draft.unitCost.trim(), baseline.currency);` compares the untrimmed draft string while
parsing the trimmed one.

## What is true today

A user who edits the unit-cost field to add or remove only whitespace (e.g. `"12.50"` →
`" 12.50"`) trips the `!==` comparison, so `definitionChanges` reports a change even though the
parsed value is identical — a whitespace-only edit emits a spurious no-op change through
`UpdateAsset`, unlike the now-fixed `waste` field and unlike `height`.

## What closes it

Trim the comparison the same way `waste` and `height` already do:
`if (draft.unitCost.trim() !== before.unitCost) changes.unitCost = moneyOf(draft.unitCost.trim(),
baseline.currency);`. A case in `definitionDraft.test.ts` mirroring the existing waste
whitespace case, but for `unitCost`, is what would close it — driven red against today's code
first, per CLAUDE.md's mutation-check rule.

## References

- [[Asset library]]
- `src/presentation/library/definitionDraft.ts` — `definitionChanges`'s three comparisons.
- `tests/presentation/library/definitionDraft.test.ts` — the existing `waste` whitespace case
  this note's fix would mirror.
