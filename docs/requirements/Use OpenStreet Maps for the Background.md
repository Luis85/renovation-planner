---
type: PBI
parent: "[[Import and export]]"
order: 10
horizon: "V2"
status: New
started: ""
finished: ""
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
release: ""
---

# Use OpenStreet Maps for the Background

## Actor

[[Private renovator]], when a site or garden plan needs geographic context that an image or PDF
they already own cannot provide.

## Main flow

1. The renovator explicitly chooses the future OpenStreetMap acquisition source.
2. They search for or navigate to the property and review the geographic extent before any
   network request is retained as project data.
3. The plugin shows source attribution, the selected extent and the resolution that will become
   the background.
4. The renovator confirms the acquisition.
5. The acquired result enters the ordinary plan-background import boundary as a vault-backed
   reference with its source and attribution preserved.
6. The renovator can subsequently align and calibrate that reference through the same
   background workflow used for other sources.

## Extensions

- **1a** — Remote acquisition is disabled or unavailable. Existing local image/PDF import remains
  available; no map control is shown as if it worked offline.
- **2a** — Search is ambiguous. The renovator must select a result and visible extent before
  continuing; an address match is never silently treated as the project boundary.
- **4a** — The request fails, is rate-limited or returns no usable imagery. Nothing is attached
  to the plan and the prior background remains unchanged.
- **5a** — The provider's terms do not permit the requested use or required attribution cannot
  be preserved. The import is refused rather than producing an unattributed background.
- **6a** — The acquired image has no trustworthy scale. It remains visibly uncalibrated until
  [[Scale calibration]] succeeds.

## Guarantee

OpenStreetMap access is explicit, optional and attributable. A remote response never becomes a
hidden source of truth: the plan refers to a vault-backed imported artifact, and local
image/PDF planning continues to work without the network integration.

## Out of scope

- The locked M00–M17 editor scope, whose acquisition boundary is image/PDF upload and reference
  setup only.
- Geocoding the whole project model, live slippy-map editing, routing, parcel ownership or legal
  boundary claims.
- Background synchronization after import.
- Offline tile infrastructure or a general map-provider abstraction.

This is a V2/later acquisition capability. It must not expand the locked image/PDF scope or
become a prerequisite for starting a floor or site plan.

## Acceptance criteria

1. No network request occurs until the renovator explicitly opens and uses the map source.
2. The selected extent is previewed before confirmation.
3. Attribution and source metadata remain available with the imported artifact.
4. A failed or refused acquisition leaves the current plan background byte-identical.
5. The acquired artifact follows the existing background validation, locking and calibration
   path rather than creating a second canvas background model.
6. The plugin remains fully usable for local image/PDF backgrounds when the integration is
   unavailable.

## Assumptions

1. Provider licensing and API terms will be reviewed when V2 planning begins; this note grants
   no permission to scrape tiles.
2. A static acquired reference is sufficient for the first version. A live map would be a
   separate product and architecture decision.

## Sources

PRD §42 (plan import), PRD §44 (privacy, interoperability and open formats), SDD §3.1
(local-first), SDD §18 (background layer), SDD §54–55 (document import and Vault-backed assets),
and the locked M05/M06 specifications, read specifically as the image/PDF boundary this item
does not widen.
