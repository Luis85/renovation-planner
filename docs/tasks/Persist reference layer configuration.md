---
type: Task
parent: "[[Plans and background import]]"
order: 10
status: New
horizon: "MVP"
release: "[[MVP]]"
dependsOn: "[[Scale calibration]]"
---

# Persist Reference plan layer configuration

## Evidence

M06 requires source, page, crop, rotation, opacity, lock and scale-related state to distinguish
draft setup from the prior committed reference.

## Why it matters

A reference that changes after reload cannot be trusted for tracing or comparison.

## Approach

Define one persisted reference configuration over the existing Plan background/geometry storage,
adding schema fields only where required. Map it through DTOs, migrations and repositories while
preserving old vaults. Test full round trips, versioning and unknown user content.

## Acceptance criteria

- Every committed configuration field round-trips.
- Existing valid references still load or migrate through a tested path.
- Draft setup values never overwrite committed configuration.
- The Reference remains separate from editable geometry.

## Risks

Adding optional fields without testing old notes can silently redefine schema behavior.

## Outcome

The Reference plan is a stable, reloadable layer rather than an ephemeral image.
