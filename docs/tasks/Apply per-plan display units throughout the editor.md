---
type: Task
parent: "[[Open a floor plan in the Obsidian editor shell]]"
order: 40
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Apply per-plan display units throughout the editor

## Evidence

[[Switch the measurement unit in the plan editor]] defines one per-plan display-unit contract:
canvas labels, Inspector values, status readouts and real-world numeric input use the visible
unit, while geometry remains canonical world millimetres and calibration interprets input through
that same visible unit.

## Why it matters

Different editor regions formatting or interpreting one measurement independently can show
contradictory dimensions or persist a calibration wrong by factors of 10 or 1,000.

## Approach

Resolve the plan's display unit once at the editor boundary and provide one bidirectional
presentation conversion service. Feed display-ready values and symbols to canvas measurement
labels, Inspector fields and status readouts; parse every real-world dimension input, including
calibration, through the inverse conversion before dispatch. Convert an open numeric draft when
the visible unit changes, without rounding or silently reinterpreting it.

## Acceptance criteria

- Canvas labels, Inspector measurements and status readouts show the same value, precision and
  unit for one world measurement.
- Every real-world numeric editor interprets its draft in the unit visible beside that draft.
- Calibration converts the known distance to world millimetres exactly once before dispatch.
- Changing unit while a numeric or calibration input is open preserves the represented physical
  distance without rounding.
- Switching or applying a display unit changes no geometry-sidecar byte and performs no
  canonical-unit migration.
- Cost and quantity pipelines receive no display-unit value.

## Risks

Formatting at individual components or chaining display conversion into quantity conversion can
create plausible but materially wrong measurements and costs.

## Outcome

Every editor measurement speaks one visible per-plan unit while canonical geometry and
calculation boundaries remain unchanged.
