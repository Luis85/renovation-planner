---
type: Issue
parent: "[[Consolidate the current and target editor data models]]"
order: 30
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

# AssetGeometryStore and PlanGeometryStore share about 90 duplicated lines

`src/infrastructure/obsidian/repositories/AssetGeometryStore.ts` (389 lines) and
`src/infrastructure/obsidian/repositories/PlanGeometryStore.ts` (261 lines) are the two
geometry sidecar stores the 2026-09-05 whole-tree review's finding I9 measured at roughly 90
duplicated lines between them. The review's own verdict (PLAUSIBLE, low severity) is that the
two diverge structurally enough — different migrations, different absence semantics, different
error payloads — that extracting a shared base today would be extracting a coincidence rather
than a rule.

## What is true today

Neither store shares a base class or a shared module with the other; the duplication the
review measured is still present at `283b18b0`, unchanged since the review. The stores are not
simply parallel copies: `AssetGeometryStore.declaredAssetOf`
(`AssetGeometryStore.ts:128`) and `PlanGeometryStore.declaredPlanOf`
(`PlanGeometryStore.ts:77`, whose own docblock calls itself "the plan half of
`AssetGeometryStore.declaredAssetOf`") are near-identical guards that were each hardened
separately rather than through one shared base — evidence the two stores' divergence is a real
design difference kept in step by hand, not neglect.

## What closes it

The review's own fix shape is "leave; revisit at a third sidecar store" — a third store
sharing enough of the same shape as these two would be the signal that a common base is
extracting a rule rather than a coincidence. No fix is owed until then; this note exists so
the deferral is findable rather than re-discovered.

## References

- [[Consolidate the current and target editor data models]]
- `src/infrastructure/obsidian/repositories/AssetGeometryStore.ts`
- `src/infrastructure/obsidian/repositories/PlanGeometryStore.ts`
- `docs/superpowers/specs/2026-09-05-whole-tree-review-findings.md` — finding I9.
