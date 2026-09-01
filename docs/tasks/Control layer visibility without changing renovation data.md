---
type: Task
parent: "[[Layers]]"
order: 20
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Control layer visibility without changing renovation data

## Evidence

[M01](../user-experience/renovation-planner-editor-specs/screens/M01-standard-plan-view.md) defines layer toggles as projection changes, and the component contract separates presentation layers from semantic Existing/Planned state.

## Why it matters

Hiding information must never be mistaken for deleting or changing the underlying renovation record.

## Approach

Connect available visibility controls to the canonical layer state and ordered canvas projection, preserving selection identity and domain records.

## Acceptance criteria

- Toggling a layer changes rendered visibility only.
- No domain command or vault mutation is dispatched for transient visibility where not persisted.
- Hidden selected records remain coherently represented by list/Inspector behavior.
- Layer ordering stays deterministic.

## Risks

Canvas and list filtering can diverge when a selected layer becomes hidden.

## Outcome

Users can simplify a busy floor without changing its renovation content.
