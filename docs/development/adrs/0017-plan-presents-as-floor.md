---
adr: 17
title: Plan Presents as Floor
status: Accepted
date: 2026-09-02
area: presentation
---

# ADR-0017: Plan Presents as Floor

## Context

The locked screens show a `Willow House › Main House › Ground Floor` breadcrumb and a
Property tree. The implemented model has `Project` owning `Plan`s; there is no Property,
Building or Floor entity, and the vertical-slice specification asks whether `Plan.name` can
carry floor context in the first slice.

## Decision

**`Plan` remains the persisted concept. "Floor" is its homeowner name in copy.** A
`FloorDto` (`src/presentation/read-models/spatialRecords.ts`) is a `PlanDto` with the
project's name beside it, and the context bar reads `Project › Floor`. No `Floor`,
`Building` or `Property` entity, no persisted hierarchy, no `FloorId`.

## Alternatives

- **Introduce `Floor` now and make `Plan` depict one.** A second identity per plan, a join
  and a migration, for a hierarchy with exactly one level of content today.
- **A presentation-only Building grouping.** Nothing to group: every project in the field
  study has one building. A grouping of one is a label pretending to be structure.

## Consequences

- The breadcrumb has two segments and the Property tree is not built in this increment.
- `Plan.name` is what a user reads as the floor's name; "Ground floor" is the sample's.
- Deciding hierarchy (ADR-HI) is deferred with the trigger below, recorded in the
  consolidation report.

## Revisit when

A project has two buildings, or two plans must be aligned as floors of one building
(stairs, shafts, load-bearing walls through). Either is the trigger for a `Floor` identity.

## References

- Vertical-slice specification §4.5 (Property, Building, Floor rows), §5.6
- Design spec §2.2
- `docs/requirements/Navigate property, building and floor context in the editor.md`
