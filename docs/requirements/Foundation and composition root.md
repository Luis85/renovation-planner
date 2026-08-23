---
type: PBI
parent: "[[Architecture and Software Design]]"
order: 10
status: ""
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
---
# Foundation and composition root

Slices 1 to 4: the plugin loads, the pure primitives exist, the first three entities are
modelled, and something can be written to the vault and read back. Nothing here is visible
to a user — the payoff is that everything after it has a floor to stand on.

| Slice | Increment | Primary SDD sections |
| --- | --- | --- |
| [1 — Plugin Bootstrap & Composition Root](../tasks/01-plugin-bootstrap-and-composition-root.md) | 1 | §§4–12, §76 |
| [2 — Core Primitives](../tasks/02-core-primitives.md) | 2 (part) | §7.1, §22–23, §33–34, §64–66, §82 |
| [3 — Domain Foundation: Project, Plan, Zone](../tasks/03-domain-foundation-project-plan-zone.md) | 2 (part) | §7.2, §29, §32/34 (applied), §35 (applied); PRD §8 |
| [4 — Persistence & Repository Layer](../tasks/04-persistence-and-repository-layer.md) | 3 | §35–47; ADR-002, ADR-011 |

**This is the one group with no parallelism in it.** Each slice depends on exactly the one
before it, so the chain is the schedule: composition root, then the primitives it hands out,
then the entities built from them, then the repositories that persist those entities. A
slice here cannot be started early by splitting it differently — the dependency is on the
types the previous slice exports, not on a convention it establishes.

Two later groups reach back into this one rather than only forward from it. Slice 9 depends
on slice 2 alone, so the cost engine can be built as soon as the primitives exist; slice 11
depends on slices 1 and 2, so error handling can. Neither waits for persistence, which is
why they sit in their own groups rather than at the end of this one.

## Outcome

The plugin loads into a real vault, composes its dependencies in one place, and can write a
Project, a Plan and a Zone to disk and read them back — with the layer rule enforced by lint
from the first commit rather than retrofitted once there is code to violate it.
