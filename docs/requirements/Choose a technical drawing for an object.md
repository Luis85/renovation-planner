---
type: PBI
parent: "[[The designer surface]]"
order: 20
status: Active
started: 2026-08-30
finished: ""
horizon: "MVP"
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

# Choose a technical drawing for an object

## Actor

[[Private renovator]] holding the manufacturer's spec sheet for something they are about to buy,
who wants that footprint to be true in every plan it lands in.

## Preconditions

- The designer surface is open on an object.
- The drawing — an image or a PDF — is already in the vault.

## Main flow

1. The renovator chooses a background from the surface's own empty state.
2. They pick an image or a PDF that is already in the vault.
3. The surface draws it behind the shape, at **this object's** scale and touching no plan's.
4. The reference is stored with the object; the document itself is never copied.

## Extensions

- **2a** — The renovator cancels. Nothing changes.
- **3a** — The document the reference names is missing. The surface says so and draws no
  background, rather than leaving a blank canvas that invites a trace.
- **3b** — The document cannot be decoded — a corrupt image, an unreadable PDF. The surface says
  so, distinctly from the missing case, because the remedies differ.
- **4a** — A background **replaces** an existing one. The object's calibration is cleared, because
  a calibration measured against the document that is gone is worse than none
  ([[Calibrate an object's own drawing]] is how it is re-established).
- **4b** — The same reference is submitted again. Nothing is written and an existing calibration
  survives, because resubmitting a document is not replacing it.
- **4c** — The write fails. The previous reference stands and the failure is reported.

## Guarantee

An object carries at most one background reference. Choosing one alters no plan's background and
no plan's scale, and a replacement never leaves behind a calibration measured against a document
the object no longer references.

## Known limitation

**There is no way to replace a background once one is set**, which is why this item is not done.
The picker is the empty state's own action, and that empty state stops applying the moment a
background exists — so reaching a second background today means creating a second object. The
remedy is a door to the picker that does not depend on the empty state.

## Out of scope

- Getting the document into the vault in the first place, which is
  [[Document linking and types]]'.
- A plan's background, which is [[Plans and background import]]'s.
- Sharing one calibrated drawing between two objects; each calibrates its own copy of the
  reference and nothing is shared.

## Acceptance criteria

1. An image or a PDF already in the vault can be chosen and is drawn behind the shape.
2. The reference is stored, the document is not copied, and both round-trip.
3. Replacing a background clears the object's calibration.
4. Resubmitting the same reference writes nothing and keeps an existing calibration.
5. A missing document and an undecodable one are each reported, and differently.
6. Choosing a background for an object changes no plan.

## Assumptions

- A spec sheet is one page. Choosing which page of a multi-page PDF to trace is not offered.

## Sources

- PRD §17 (Asset Library)
- PRD §81 (Coordinate transformations)
- ADR-0014 (Library-scoped asset geometry sidecar)
- ADR-0015 (Asset designer workspace surface)
