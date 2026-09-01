---
type: Task
parent: "[[Produce auditable release evidence]]"
order: 10
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Trace release criteria to named evidence

## Evidence

Phase 12 exits only when all applicable M00–M17 acceptance criteria are traced and verified.

## Why it matters

An aggregate green gate can pass while a screen state or manual-only claim has never been checked.

## Approach

Create a criterion-level matrix linking each screen and hardening criterion to an exact automated
test, manual case, defect, or not-applicable rationale.

## Acceptance criteria

- Every applicable criterion has one current evidence classification.
- Links name test/case identifiers rather than broad suites.
- Missing and stale evidence remain visibly unverified.

## Risks

A copied matrix can outlive renamed tests; verify links against the release candidate.

## Outcome

The release scope is auditable criterion by criterion.
