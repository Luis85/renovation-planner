---
type: Task
parent: "[[Consolidate the current and target editor data models]]"
order: 40
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Approve the Editor foundation slice contract

## Evidence

WP0 exit criteria and WP1 in the [approved vertical-slice plan](../user-experience/renovation-planner-editor-specs/Renovation%20Planner%20—%20First%20Vertical%20Slice%20Plan%20and%20Data-Model%20Specification.md) require named sources of truth, error outcomes and unavailable-versus-empty semantics before UI implementation.

## Why it matters

Separate teams cannot build shell, read model, selection and Inspector honestly from an unresolved vocabulary matrix.

## Approach

Turn accepted inventory and ADRs into one reviewed Feature A contract naming IDs, DTO mappings, command/query boundaries, events, persistence impact, error states and test scenarios.

## Acceptance criteria

- Every PBI under [[Editor foundation]] maps to approved inputs, outputs and failure states.
- Unsupported Inspector sections have an explicit unavailable representation.
- The contract records no schema change unless its migration and fixture plan are accepted.

## Risks

A contract can merely restate screens without assigning authority to data and commands.

## Outcome

Feature A has an approved, testable contract and may proceed without inventing model decisions in components.
