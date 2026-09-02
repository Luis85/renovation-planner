---
type: Task
parent: "[[Layers]]"
order: 10
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Build the truthful layer catalogue

## Evidence

The [component library LayerList contract](../user-experience/renovation-planner-editor-specs/components/component-library.md) names descriptors for visibility, lock, opacity, status and count, while the vertical plan forbids fake future data.

## Why it matters

A static future-layer list makes unsupported capability look implemented.

## Approach

Derive the ordered catalogue from available floor/reference and current semantic capabilities, with explicit unsupported and supported-empty states.

## Acceptance criteria

- Every rendered layer has a stable ID, homeowner label and capability state.
- Unsupported controls are absent or explained.
- Supported empty layers remain distinguishable.
- Future Feature layers can join without hard-coded fake counts.

## Risks

Presentation defaults can make missing capability appear as `false` or zero.

## Outcome

The layer panel lists only controls and information the editor can honor.
