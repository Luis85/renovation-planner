---
type: Issue
parent: "[[Errors, diagnostics and the test harness]]"
order: 110
status: Done
started: 2026-09-04
finished: 2026-09-04
horizon: Now
start: ""
due: ""
risk: ""
priority: high
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
effort: S
complexity: ""
business-value: ""
business-value-model: ""
---

# The fixed-shot inventory test omits two merged captures

## The question

Spec §10 makes the fixed-shot set the visual review inventory. The source list at
`scripts/harness-shot.mjs:139-288` contains twenty entries, while
`tests/build/harness-shot.test.ts:567-593` claims to enumerate eighteen. Which check notices
either of the two price-section shots disappearing?

## What is true today

`scripts/harness-shot.mjs` defines **20 fixed shots**. The inventory case in
`tests/build/harness-shot.test.ts` still says eighteen and enumerates eighteen names, omitting
`project-detail-prices` and `project-detail-prices-narrow`.

Both omitted captures exist in the merged script, so deleting either one would leave the
inventory test green despite its claim to hold the argumentless run's complete fixed set.

Measured by counting the `SHOTS` entries and comparing the test's literal names:
`project-detail-prices` and `project-detail-prices-narrow` occur in the source list and not in
the inventory loop.

## Why it matters

The inventory test is the mechanism meant to make a silently dropped visual state visible.
When its hand-written list omits the newest merged entries, it certifies an older set and gives
the current capture surface no complete census.

## What closes it

Update the inventory assertion and its stated count to include both price-section captures,
then keep the list derived from or checked against the actual `SHOTS` set so a later addition
cannot land on only one side.

## What closed it

**2026-09-04.** The hand-written eighteen-name list is gone. `tests/build/harness-shot.test.ts`
now slices the `const SHOTS = [` … `];` block out of the source and matches every `name: '…'`
inside it, so the expected list is compared against what the script actually iterates rather
than against a second, independently maintained enumeration — a shot added or removed there
changes the test's answer without anyone touching this file. The count is twenty-one, one more
than the twenty this note measured, because the same increment closed
[[Unsupported width has no horizontal-overflow check]] in the same commit and added
`plan-editor-unsupported`. Holding test: `tests/build/harness-shot.test.ts` › 'the headless
harness capture script' › 'defines exactly the twenty-one fixed shots, derived from the SHOTS
source rather than remembered'. Commit "test(harness-shot): wait for the state each
plan-editor shot names, derive the inventory from SHOTS, and measure the 320 px shell for
horizontal overflow".

**Amended 2026-09-04, at the merge of the Renovation Planner Home branch.** The holding test is
named `defines exactly the twenty-eight fixed shots, derived from the SHOTS source rather than
remembered` now: the two branches appended shots to different parts of the `SHOTS` array, so the
array merged cleanly at twenty-eight while the assertion about it conflicted, and neither side's
count described the merged array. The derivation this note asked for is what made that safe to
resolve — the list came back from the array rather than from either side. The case gained a
second assertion in the same edit, a whole-FILE `name: '` count, because the derivation can only
see inside `SHOTS` and an entry written outside it would be invisible to exactly the census this
note exists to make complete. **The count in the test's NAME is the part of this that will go
stale again**, and it is the one thing here nothing checks: the list and the count are both
derived, the title is not.

**Amended 2026-09-04, at the merge of the Add Room branch — the same collision a third time, and
the prediction above was already answered before it could fire.** The two branches again appended
to different regions of `SHOTS` (this branch two `plan-editor-add-room` captures into the
plan-editor run, `main` the asset-library and Home shots elsewhere), so `harness-shot.mjs` merged
cleanly at **thirty-seven** while the assertion about it conflicted for the third consecutive
merge. Resolved the way this note asked for: re-derived from the merged array, not taken from
either side.

The stale-title risk this note flagged did NOT materialise, because the same increment that
predicted it had already removed the number — the case is
`defines exactly the fixed shots this file lists, in both directions`, and its docblock now
opens **NO NUMBER IN THE NAME**. So all three of the list, the count and the title are
derivation-or-nothing, and the one number left anywhere near this case is in prose that says to
run `grep -c "name: '" scripts/harness-shot.mjs` instead of reading it. **A recorded prediction
that gets closed by the increment that recorded it is the cheap case; this note is kept open in
the ledger as the record that the derivation is what made three merges safe to resolve.**

## References

- [[Errors, diagnostics and the test harness]]
- [[Keep the editor truthful across failure and narrow layouts]]
- [[Open a floor and select a room]]
- Reviewed at commit `16757d6d`, PASS 5.
