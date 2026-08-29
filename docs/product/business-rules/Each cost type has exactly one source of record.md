---
rule: BR-COST-003
kind: separation
name: Each cost type has exactly one source of record
area: cost
sources:
  - PRD §11
  - PRD §33
type: business-rule
---

# Each cost type has exactly one source of record

**The rule.** §11's five cost types are five different questions, and each is answered by exactly
one entity. Nothing derives one type from another, and nothing records the same figure twice.

| Cost type | Answered by | Moves? |
| --- | --- | --- |
| Budget | [[Project]] — the top of §10's hierarchy | Set by the user |
| Estimated | [[Cost item]], from the quantity chain | Derived, recomputed |
| Quoted | [[Quote]] | Recorded, does not move |
| Committed | [[Order]] | Recorded, retired by an [[Invoice]] |
| Actual | [[Invoice]] | Recorded, does not move |

**Why.** §33's chain — budget → estimate → quote → commitment → invoice → payment — is a
lifecycle, not a set of aliases for one number. A project whose budget and estimate are the same
stored field cannot show the variance the whole cockpit exists to show, and a committed total
recorded independently of its [[Order]] is a figure with no document behind it.

**Where it holds.** Each entity owns its own figure; the cost engine reads all five and computes
nothing back into them. See [[The forecast counts a commitment only until it is invoiced]] for
the one place the types are combined.

**Checked by.** Not yet. Slice 09 owns the aggregation; the five-type rollup is its test surface.

**Sources.** PRD §11 · PRD §33 · PRD §10.
