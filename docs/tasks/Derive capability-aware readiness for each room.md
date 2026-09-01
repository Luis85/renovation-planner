---
type: Task
parent: "[[Review renovation readiness spatially]]"
order: 10
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Derive capability-aware readiness for each room

## Evidence

M17 requires deterministic, explainable readiness per room/change. The implementation plan puts
the rules in Phase 8, while the vertical-slice plans require unavailable capability to remain
distinct from empty data.

## Why it matters

Treating an absent later feature as a failed check makes every early project look unready;
treating it as empty can make the same project look falsely complete.

## Approach

Define readiness rules over current authority-owned query results and declare each rule's required
capabilities. Evaluate only supported rules, preserving unknown reads and deriving all findings on
demand.

## Acceptance criteria

- Identical available inputs yield identical status, findings and explanations.
- An unavailable capability is disclosed and does not pass or fail its dependent rule.
- An unreadable expected input yields unknown, not ready or an ordinary missing finding.
- No readiness value or finding is persisted.

## Risks

A rule may infer completeness from the capabilities that happened to be implemented first.

## Outcome

Each room receives an honest readiness result bounded by what the product can currently know.
