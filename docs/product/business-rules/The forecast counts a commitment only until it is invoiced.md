---
rule: BR-COST-001
kind: calculation
name: The forecast counts a commitment only until it is invoiced
area: cost
sources:
  - PRD §33
  - PRD §28
type: business-rule
---

# The forecast counts a commitment only until it is invoiced

**The rule.** Estimated final cost is `actual + committed-but-not-invoiced + remaining estimate`.
A commitment that has been invoiced is counted once, as actual, and no longer as committed.
Booking an [[Invoice]] retires the matching commitment, which is the mechanism that makes the
subtraction unnecessary rather than merely correct.

**Why.** The PRD states the Forecast concept twice and the two do not agree: §28 (Epic 17)
writes `Actual Cost + Committed Cost + Remaining Estimate`, while §33 (Financial Lifecycle)
writes `Actual + Committed but not invoiced + Remaining Estimate`. Read literally, §28 counts an
invoiced commitment twice and inflates the forecast. §33's is the one implemented; §28's
`Committed Cost` is shorthand for it, not a second, full-commitment total.

**Where it holds.** The cost engine's rollup, not the reporting view — a screen that computed
its own forecast would be a second answer. [[Cost item]] carries the full reconciliation and the
reason it lives in a derived note rather than as an edit to the received PRD.

**Checked by.** Not yet. Slice 09 (`docs/tasks/09-quantity-and-cost-engine.md`) is where the
rollup lands; the forecast case belongs in its Money/aggregation tests.

**Sources.** PRD §33 · PRD §28, in
[`docs/product/prds/obsidian-renovation-planner.md`](../prds/obsidian-renovation-planner.md).
Both are cited by section number rather than feature number because Epic 17 lists its features
as an unnumbered bullet list — no `F17.x` identifier exists to check against the source.
