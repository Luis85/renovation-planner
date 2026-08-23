---
rule: BR-DATA-002
kind: derivation
name: A derived value is recomputed on read, not persisted
area: data
sources:
  - PRD §88
type: business-rule
---

# A derived value is recomputed on read, not persisted

**The rule.** §88: prefer calculation over redundant persistence. Where a value can be computed
from something else that is stored, it is computed — on every read — and never written into
frontmatter beside its own inputs.

```text
polygon → area → requirement → estimated cost
```

Every arrow in that chain is a calculation, and none of the intermediate results is a stored fact.

**Why.** A persisted derivation has two states — agreeing with its input and disagreeing with it —
and nothing in the file can tell a reader which one it is looking at. [[Zone]] area is the clearest
case: stored, it drifts from the polygon that produced it the first time somebody drags a vertex,
and the wrong number is indistinguishable from the right one.

The exception that proves the rule is the geometry sidecar: it is *derived-format* but not derived
*data* — canonical geometry in a second file, where losing it loses work ([[Plan]]).

**Where it holds.** Everywhere. The named instances are
[[A cost rollup is derived along its axis, never stored]], zone area and perimeter, and
[[Work package]] progress — derived from its tasks, never a percentage somebody types. The one
sanctioned way to put a number in by hand is
[[A manual override is stored as an override, beside what it replaced]].

**Checked by.** Not yet.

**Sources.** PRD §88.
