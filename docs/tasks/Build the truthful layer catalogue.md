---
type: Task
parent: "[[Layers]]"
order: 10
status: Done
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

## Closing evidence

**2026-09-03**, the plan editor foundation's first increment.
`src/presentation/editor/layers/layerCatalogue.ts` derives an ordered two-entry list from the plan
and the scene, and `tests/presentation/editor/layers/layerCatalogue.test.ts` holds it: 'lists
Reference plan then Rooms, in that order, and nothing else' is criterion 1's stable order, 'marks
the reference plan supported-empty with a reason when the plan has no background, and disables Set
scale' is criterion 3, and 'lists nothing for a null plan' is the pre-hydration arm.
`tests/presentation/editor/shell/layerList.test.ts` renders one labelled checkbox per entry.
Criterion 2 is what the row does NOT draw: lock and opacity are absent because the sidecar
persists neither (spec §5.3), rather than rendered as controls that would not work. Criterion 4 is
the four empty Konva layers being ABSENT from the catalogue rather than listed with a fabricated
count, and their `editor.layer.*` keys deleted with their rows.
