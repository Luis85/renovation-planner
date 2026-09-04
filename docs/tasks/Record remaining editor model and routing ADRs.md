---
type: Task
parent: "[[Consolidate the current and target editor data models]]"
order: 50
status: Active
horizon: "MVP"
release: "[[MVP]]"
---

# Record remaining editor model and routing ADRs

## Evidence

Phase 0 and WP0/WP1 require explicit ownership and accepted decisions beyond the Room/Zone and
Plan/Floor boundaries already owned by [[Decide Room Zone and Floor Plan boundaries]].

## Why it matters

If hierarchy, renovation state, spatial storage, relationships, selection, routing and refresh
ownership remain implicit, later slices can create competing sources of truth while each local
implementation still appears reasonable.

## Approach

Record the remaining ADR set for ADR-HI, ADR-EPW, ADR-SO, ADR-RL and ADR-SV, plus perspective
state, typed selection, Inspector routing, adapter ownership, event/refresh ownership and the
architecture checks that enforce each boundary. Compare alternatives, compatibility effects and
revisit triggers. Do not duplicate the Room/Zone or Plan/Floor ADRs.

## Acceptance criteria

- ADR-HI decides how Property, Building and Floor hierarchy is introduced and persisted.
- ADR-EPW keeps Existing, Planned and Work distinct from lifecycle status.
- ADR-SO defines compatible evolution from polygon-only geometry to spatial object types.
- ADR-RL names one relationship mechanism between spatial targets and vault-backed records.
- ADR-SV defines when an additive change may remain at schema v1 and when a version bump is owed.
- Accepted records assign perspective state, typed selection, Inspector routing, adapter
  ownership and event/refresh ownership to one layer and one source of truth.
- Each enforceable boundary names its architecture or contract check; an unenforceable part is
  stated as a review obligation.
- [[Decide Room Zone and Floor Plan boundaries]] remains the only Task owning ADR-RZ and ADR-PF.

## Risks

An ADR list can record preferred answers without identifying the checks or compatibility costs
that make those answers durable.

## Outcome

Every remaining editor model and routing decision needed by the first and later slices has an
accepted owner, compatibility account and enforcement plan.

## Amendments

**2026-09-03** — ADR-HI, ADR-EPW, ADR-SO, ADR-RL and ADR-SV are RECORDED AS DEFERRED, each with
its first consumer and the trigger that forces it
(`docs/development/consolidation/2026-09-editor-model-consolidation.md` §6). That is not the same
as accepted, so criteria 1 to 5 are deliberately unmet: no code in this increment reads any of
them, and spec §2.3 gives the reason — a decision nothing pins drifts. Criterion 8 IS met:
[[Decide Room Zone and Floor Plan boundaries]] is still the only Task owning ADR-RZ and ADR-PF.
Criteria 6 and 7 remain open — perspective state, typed selection, Inspector routing, adapter
ownership and event/refresh ownership are not yet assigned to one layer by an accepted record,
and no enforceable boundary among them names its check.
