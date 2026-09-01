---
type: Task
parent: "[[Understand room costs and follow them to their authority]]"
order: 30
status: New
horizon: "V1"
release: ""
---

# Explain calculated room cost provenance

## Evidence

M13 requires a calculated estimate to explain quantity multiplied by rate with waste inputs. The
component contract requires calculated values to expose provenance and distinguish overrides.

## Why it matters

The user needs to know whether changing geometry, a material rate or an override will change the
amount they are reviewing.

## Approach

Carry the cost authority's derivation provenance into the room-cost read model and present its
quantity, rate, unit basis, waste contribution and effective override state. Do not reconstruct
the estimate in the Inspector.

## Acceptance criteria

1. A calculated estimate exposes quantity, rate, unit basis and waste contribution.
2. The display distinguishes the calculated amount from any effective override.
3. Stale provenance is labelled and cannot be presented as current.
4. The explanation remains consistent with the authoritative amount after a geometry or price
   change and refresh.

## Risks

- Presentation-side arithmetic could drift from the money pipeline's rounding point.
- A compact Inspector may hide which of calculated and overridden values is effective.

## Outcome

Room estimates explain their authoritative inputs without creating a second cost pipeline.
