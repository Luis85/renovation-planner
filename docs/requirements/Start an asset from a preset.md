---
type: PBI
parent: "[[Asset Designer Foundations]]"
order: 8.8
status: Done
started: "2026-09-13"
finished: "2026-09-13"
horizon: MVP
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
strategic-alignment: ""
customer-value: ""
business-impact: ""
reach: ""
risk-reduction: ""
compliance: ""
time-criticality: ""
enablement: ""
confidence: ""
effort: ""
complexity: ""
business-value: ""
business-value-model: ""
release: "[[MVP]]"
---

# Start an asset from a preset

## Actor

[[Private renovator]] who needs a chair, a round table, a toilet or a tree on a plan and does not
have a spec sheet to trace.

## Main flow

1. The renovator opens an asset in the designer and chooses "Start from preset".
2. They pick a preset — tables, seating, bathroom, or plants and beds — and type its dimensions,
   watching a preview.
3. They apply it: the asset's shape becomes the preset's outline, clearance and interior details,
   drawn in the designer, in the library and on every plan the asset is placed on.

## Extensions

- **2a** — A value is outside the preset's range, or the values cannot describe a shape. The
  preview disappears, the reason is shown, and applying is refused.
- **3a** — The asset already had a design. It is replaced; undo restores it.

## Acceptance criteria

1. Presets are offered, grouped as tables, seating, bathroom, and plants and beds. The catalogue
   is not fixed at a number: it was fourteen when this was accepted on 2026-09-13 and is fifteen
   since the vanity landed (AD18-R8, 2026-09-22). `tests/domain/asset/presets/presets.test.ts` pins
   the whole list in order, which is what re-verifying this criterion should read.
2. An applied preset is one undo entry.
3. A preset's width and depth are the asset's derived dimensions.
4. Curved outlines draw as arcs in the designer, the library and on plans.

## Sources

- `docs/superpowers/specs/2026-09-13-asset-designer-symbols-design.md`
- `docs/superpowers/plans/2026-09-13-asset-designer-symbols-pr1.md`
