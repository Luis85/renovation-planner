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

## References

- [[Errors, diagnostics and the test harness]]
- [[Keep the editor truthful across failure and narrow layouts]]
- [[Open a floor and select a room]]
- Reviewed at commit `16757d6d`, PASS 5.
