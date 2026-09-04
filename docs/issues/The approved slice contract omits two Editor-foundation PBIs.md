---
type: Issue
parent: "[[Consolidate the current and target editor data models]]"
order: 10
status: Done
started: 2026-09-04
finished: 2026-09-04
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

## What closed it

**2026-09-04.** §1 of `docs/superpowers/specs/2026-09-02-plan-editor-foundation-read-path-design.md`
was amended (by an earlier task of this same review round) to map all 13 PBIs whose frontmatter
parent is `[[Editor foundation]]` — 7 in the table, 6 in "Not advanced here" (two of them added
2026-09-04: Inspect a selected wall, Plan editor and canvas). This task edited
`docs/tasks/Approve the Editor foundation slice contract.md`'s Closing evidence to say so and to
name the review-time check, `rg -l '^parent: "\[\[Editor foundation\]\]"$' docs/requirements`. No
docs gate is added (CLAUDE.md, "Deliberately absent"). Commit "docs(review): correct the records
the review found overclaiming, and defer the vault walk".

## References

- [[Consolidate the current and target editor data models]]
- [[Approve the Editor foundation slice contract]]
- Reviewed at commit `16757d6d`, pass 4.
