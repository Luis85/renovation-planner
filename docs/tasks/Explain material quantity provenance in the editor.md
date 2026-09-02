---
type: Task
parent: "[[Manage materials from spatial context]]"
order: 20
status: New
horizon: "V1"
release: ""
---

# Explain material quantity provenance in the editor

## Evidence

M12 says selecting `Calculated` explains geometry, formula, unit and waste inputs. The component
library says `CalculatedValue` must expose provenance and cannot masquerade as an editable stored
value.

## Why it matters

A homeowner must be able to trust and challenge a calculated need without reverse-engineering it
or mistaking it for a number typed by somebody.

## Approach

Extend the authoritative material read model with display-ready provenance references and render
an accessible explanation from the selected row. Keep formula evaluation in the existing quantity
authority and show overrides beside what they replace.

## Acceptance criteria

1. A calculated row identifies its source geometry or work, base quantity, unit and waste input.
2. A manual quantity and an override are labelled differently from a calculated value.
3. Provenance is reachable by keyboard and without hover.
4. Geometry changes alter the explanation only after a refreshed authoritative query.

## Risks

- Formatting provenance in presentation could accidentally become a second formula.
- Missing source records need a truthful stale state rather than a fabricated explanation.

## Outcome

Every calculated material need can explain where its displayed value came from.
