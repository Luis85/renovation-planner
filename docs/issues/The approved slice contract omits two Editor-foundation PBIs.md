---
type: Issue
parent: "[[Consolidate the current and target editor data models]]"
order: 10
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

# The approved slice contract omits two Editor-foundation PBIs

## The question

`docs/tasks/Approve the Editor foundation slice contract.md:26` requires every PBI under
[[Editor foundation]] to map to approved inputs, outputs and failure states. Its closing evidence
at `docs/tasks/Approve the Editor foundation slice contract.md:40-42` says the approved design's
§1 maps every such PBI. The table and the following "Not advanced here" paragraph at
`docs/superpowers/specs/2026-09-02-plan-editor-foundation-read-path-design.md:25-40` omit
[[Inspect a selected wall]] and [[Plan editor and canvas]], although both declare
`parent: "[[Editor foundation]]"` in their frontmatter
(`docs/requirements/Inspect a selected wall.md:3` and
`docs/requirements/Plan editor and canvas.md:3`).

## What is true today

The parent set contains 13 distinct requirement notes. Measured with:

```powershell
rg -l '^parent: "\[\[Editor foundation\]\]"$' docs/requirements | Sort-Object -Unique
```

The approved design names seven PBIs in its table and four more PBIs in "Not advanced here".
The other two entries in that paragraph, [[Reveal one floor in one editor leaf]] and
[[Apply per-plan display units throughout the editor]], are Tasks rather than PBIs. The contract
therefore maps 11 of the 13 PBIs while the Done task says it maps all 13.

## Why it matters

The Done approval records a stronger review boundary than the approved contract provides. A
reader can treat wall inspection and the existing plan-editor scheduling PBI as reviewed,
deferred or intentionally excluded when §1 states none of those outcomes for either one.

## What closes it

Add both missing PBIs to the §1 table or its explicit "Not advanced here" set, with the same
scope statement the other entries receive, and correct the task's closing evidence if either is
deliberately outside the contract. A parser-backed documentation check should collect every
`docs/requirements/` note whose frontmatter parent is [[Editor foundation]] and require its
basename to appear in one of those two §1 inventories; the command above is the review-time
check until such a gate exists.

## References

- [[Consolidate the current and target editor data models]]
- [[Approve the Editor foundation slice contract]]
- Reviewed at commit `16757d6d`, pass 4.
