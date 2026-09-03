---
type: PBI
parent: "[[Editor foundation]]"
order: 10
status: Done
started: 2026-09-02
finished: 2026-09-03
horizon: "MVP"
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
release: "[[MVP]]"
---

# Consolidate the current and target editor data models

This scheduling PBI holds the evidence and decisions that must precede any editor schema,
entity or migration change. The locked screens speak in homeowner concepts while the current
implementation and vault data use `Project`, `Plan`, `Zone`, `Asset` and `Requirement`.
Treating those vocabularies as either identical or unrelated would make the first UI increment
rewrite valid data or show claims the model cannot support.

The work inventories the current model and storage shapes, traces representative round trips,
maps locked concepts across UI, read models, domain and persistence, and records the ADRs and
approved slice contract. It has no predecessor. It is itself the predecessor for model-changing
work under [[Editor foundation]].

Compatibility is the starting constraint, not a decision to skip the work:

- `Plan` presents as **Floor** in V1.
- A `Zone` with room classification presents as **Room**.
- Stable IDs, Markdown metadata and `.rpgeo` geometry remain canonical unless an accepted ADR
  changes them.
- Existing, Planned and Work are not aliases for the current Zone lifecycle status.
- Unsupported Inspector sections must distinguish unavailable capability from supported empty
  data.

## Outcome

The team has one reviewed inventory, one round-trip account, accepted Room/Zone and Plan/Floor
decisions, and one approved contract saying exactly which current fields and identities the
first editor slice reads and writes. No unresolved high-severity conflict remains for open,
select, create, move, undo, redo, save or reload.

## Sources

- [Vertical-slice plan: WP0 and data-model specification](../user-experience/renovation-planner-editor-specs/Renovation%20Planner%20—%20First%20Vertical%20Slice%20Plan%20and%20Data-Model%20Specification.md)
- [Editor implementation plan: Phase 0](../user-experience/renovation-planner-editor-specs/implementation/implementation-plan.md)
- [Locked editor specification set](../user-experience/renovation-planner-editor-specs/README.md)

## Amendments

**2026-09-03** — closed by the plan editor foundation's first increment
(`docs/superpowers/specs/2026-09-02-plan-editor-foundation-read-path-design.md`, Wave 0). The
Outcome is met in full: one reviewed inventory, mapping matrix and ranked gap register
(`docs/development/consolidation/2026-09-editor-model-consolidation.md` §1, §2, §4), accepted
Room/Zone and Plan/Floor decisions (ADR-0016, ADR-0017), one round-trip account backed by a
contract test (`tests/infrastructure/persistence/editorRoundTrip.test.ts`, report §3), and one
approved slice contract naming exactly what the first editor slice reads and writes.

**Two of its Tasks stay Active on purpose, and this PBI is Done anyway.**
[[Establish the editor migration and compatibility contract]] recorded the NO-CHANGE decision
(spec §2.4, report §5) and can go no further until a schema transition exists to accept.
[[Record remaining editor model and routing ADRs]] recorded ADR-HI, ADR-EPW, ADR-SO, ADR-RL and
ADR-SV as DEFERRED with a first consumer and a trigger each (report §6) rather than accepting
them, because no code in this increment reads any of them and a decision nothing pins drifts.
Both are exactly what this PBI asked for — "no unresolved high-severity conflict remains" — and
neither is a promise this increment left unkept.
