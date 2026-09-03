---
type: Issue
parent: "[[Errors, diagnostics and the test harness]]"
order: 70
status: New
started: ""
finished: ""
horizon: Now
start: ""
due: ""
risk: ""
priority: medium
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

# The smoke-test census omits the newest case

## The question

Spec §10 makes `docs/tests/cases/Open a floor and select a room.md` the increment's manual
instrument. Why does the canonical census at
`docs/tests/suites/Smoke Test the Editor.md:76-99` still describe the case set from before that
file's ten rows at `docs/tests/cases/Open a floor and select a room.md:65-80` arrived?

## What is true today

A fresh census measures **274 steps across fifteen cases**. The tier counts are `suite` 99,
`browser` 41, `obsidian` 112, `desktop` 13 and `judgement` 9.

[[Smoke Test the Editor]] still reports **264 steps across fourteen cases**, split as 96, 39,
108, 12 and 9. The newest case, [[Open a floor and select a room]], is present under
`docs/tests/cases/` but absent from that account.

Measured with the suite document's two stated patterns: the table-row search returns 258 rows
across fourteen files and the `Canvas Navigation` list search returns 16, for 274 across
fifteen cases.

## Why it matters

The census is the basis for deciding what can leave the manual suite. An omitted case
understates both the remaining manual work and the automation opportunity, while the existing
figures still sum correctly and therefore give no visible sign that a whole case is missing.

## What closes it

Re-run the documented two-pattern census over all case files and update the total, case count
and five tier counts together. Also change the triage section's stale “twelve cases whose steps
are a table” to fourteen; otherwise the corrected total would still sit beside an older
denominator.

## References

- [[Errors, diagnostics and the test harness]]
- [[Keep the editor truthful across failure and narrow layouts]]
- [[Open a floor and select a room]]
- Reviewed at commit `16757d6d`, PASS 4.
