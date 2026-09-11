---
adr: 28
title: A plan may detail a zone of another plan
status: Accepted
date: 2026-09-10
area: domain
---

# ADR-0028: A plan may detail a zone of another plan

## Context

A renovator builds a property top-down: a site plan with a garden zone and a house zone, a plan
for the house, and floor plans inside it. ADR-0017 kept `Plan` flat with no persisted hierarchy
and named "two plans aligned as floors of one building" as its revisit trigger. This is that
trigger, met by a lighter structure than the Floor identity ADR-0017 anticipated.

## Decision

- `Plan.parent: { planId, zoneId } | null`, set only at creation by `CreatePlanCommand`, which
  refuses a parent plan that is missing or in another project and a zone that is missing or not
  on that plan. No command changes it afterwards. A plan cannot be its own parent.
- Persisted as `parent-plan` and `parent-zone` in plan frontmatter schema v9, written only for a
  plan with a parent. Both keys are optional in the schema (every older note is lifted to 9 in
  memory); the mapper refuses a note carrying only one. Both ids are stored so the up-link
  survives the zone's deletion.
- One read (`readPlanHierarchy`) answers ancestry, the plan's detail plans and the parent zone
  outline from `GetPlan`, `ListPlansByProject` and `FindZonesByPlan`; a per-leaf Pinia store
  holds it.
- The parent zone outline is drawn on the detail plan as a non-listening guide, translated so its
  vertex bounding box's top-left corner is world origin, because ADR-0019 pins a reference crop's
  corner at world origin with no free translation.
- No `Site`, `Building` or `Floor` entity. `Plan` still presents as Floor (ADR-0017).

## Alternatives

- **Store detail plan ids on the zone.** Two writers per creation, and deleting a zone would have
  to rewrite or orphan a list.
- **A `Site`/`Building` entity.** A second identity and a migration for a hierarchy the parent
  link already expresses.
- **An unlinked "new plan named after the zone".** No navigation, no guide, and the relationship
  lives only in the user's head.

## Consequences

- ADR-0017's "no persisted hierarchy" is amended to one optional, immutable link.
- A vault opened in an older build refuses detail plan notes.
- Deleting a zone leaves its detail plans; they lose the guide and say so.
- A detail plan created in one leaf appears in another leaf of the same parent on that leaf's next
  hydrate, not immediately.

## Revisit when

Plans must align across different origins or scales, a zone delete must account for its detail
plans, or ADR-0019 gains a free reference translation (the guide's placement depends on it).
