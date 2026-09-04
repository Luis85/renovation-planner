---
type: Issue
parent: "[[Consolidate the current and target editor data models]]"
order: 20
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

# The migration amendment counts a pre-merge tree

## The question

The 2026-09-03 amendment at
`docs/tasks/Establish the editor migration and compatibility contract.md:59-65` says all six
migration tables are empty. The merged tree contains seven empty migration tables. The omitted
one is `ASSET_PRICE_MIGRATIONS` at
`src/infrastructure/persistence/migration/entities/asset-price/asset-price.migrations.ts:4`.

## What is true today

Measured at the reviewed head with:

```powershell
rg -n '_MIGRATIONS: (readonly )?Migration\[\] = \[\];' src/infrastructure/persistence/migration
```

The command returns seven declarations: Project, Plan, Zone, Asset, Requirement, Plan geometry
and Asset price. Every declaration is empty, so the amendment's compatibility conclusion is
still true; only its fixed count describes the pre-merge tree rather than commit `16757d6d`.

## Why it matters

A numeric inventory in an amendment becomes false whenever another branch adds an entity kind.
Because the count supports the claim that `MigrationRunner` remains unproven on a real chain, a
stale number makes the evidence look incomplete even when the underlying state has not changed.

## What closes it

Replace the count with the state rule: every registered migration table is empty, so the runner
remains unproven on a real chain. Keep the grep above as the review-time evidence and assert the
property rather than seven as an ordinal; a future non-empty table should change the conclusion,
while a new empty table should not require another count correction.

## What closed it

**2026-09-04.** `docs/tasks/Establish the editor migration and compatibility contract.md`'s
2026-09-03 amendment now states the property rather than an ordinal: "every registered migration
table is empty" — `rg -n '_MIGRATIONS: (readonly )?Migration\[\] = \[\];'
src/infrastructure/persistence/migration` prints one line per table and every one ends `= [];`
(seven at `bc6ca060`) — so a future entity kind adding an eighth empty table does not make the
paragraph false again. Commit "docs(review): correct the records the review found overclaiming,
and defer the vault walk".

## References

- [[Consolidate the current and target editor data models]]
- [[Establish the editor migration and compatibility contract]] — 2026-09-03 amendment.
- Reviewed at commit `16757d6d`, pass 4.
