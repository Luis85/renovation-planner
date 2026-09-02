---
type: PBI
parent: "[[Package sizes and purchase quantities]]"
order: 10
status: New
horizon: "V1"
release: ""
---

# Update purchased material quantities from spatial context

## Actor

[[Private renovator]], while checking procurement progress for a material need in a selected room,
wall or area.

## Preconditions

- A spatial material need resolves to an authoritative [[Requirement]].
- The procurement authority can resolve the related [[Procurement item]] and its quantity unit.
- Needed quantity and package-derived purchase quantity remain distinct from the recorded purchased
  quantity.

## Main flow

1. The renovator opens a material need from the selected spatial context.
2. The editor queries the procurement authority for needed, purchase and purchased quantities and
   the current purchased-versus-needed status.
3. The renovator edits the purchased quantity using the unit supplied by that authority.
4. The editor dispatches the canonical procurement command with the requirement or procurement
   identity, entered quantity and unit.
5. The domain authority validates unit compatibility, records the purchased quantity and derives
   the purchased-versus-needed status.
6. The editor refreshes the material row from the authoritative query and shows the updated
   quantity and status in the same spatial context.

## Extensions

- **2a** — No procurement item exists yet. The authority creates or identifies the canonical
  purchase record through its normal command path; the editor does not store purchase state on the
  requirement.
- **2b** — The procurement query fails or is unavailable. The material need remains visible, the
  failure is surfaced, and no zero purchased quantity or "not purchased" status is invented.
- **3a** — The entered value is incomplete. It remains a local draft and nothing is dispatched or
  persisted.
- **4a** — The unit is incompatible with the procurement item or material need. The authority
  refuses the command, the draft remains available for correction, and no conversion is guessed.
- **4b** — The requirement, procurement item or spatial target is missing or unreadable. The
  relationship failure is identified and no partial update is persisted.
- **5a** — Persistence fails. The previous authoritative quantity and status remain in force and
  the editor reports the failure rather than presenting the draft as saved.

## Guarantee

Purchased quantity, unit validation, purchased-versus-needed status and persistence have one
authority in the procurement domain. The editor only supplies spatial context, dispatches its
command and renders its query result.

## Out of scope

- Replacing the requirement's needed quantity with a purchased quantity.
- Package-size, minimum-order or outstanding-quantity arithmetic in Vue or Pinia.
- Delivery, consumption, installed quantity, supplier selection or payment tracking.
- Automatic unit conversion.

## Acceptance criteria

1. Updating a purchased quantity from a spatial material row persists it on the canonical
   procurement record, not on the Requirement or editor state.
2. The command rejects an incompatible unit without changing the previous purchased quantity.
3. The status shown after success is returned or derived by the procurement authority and
   distinguishes below, at and above the needed quantity.
4. A failed or unavailable query cannot appear as zero purchased quantity or an empty procurement
   state.
5. Reloading the vault restores the purchased quantity and status through the authoritative query.
6. Changing the needed quantity causes the next query to reassess status without rewriting the
   recorded purchased quantity.
7. The spatial selection and material need remain available after either success or refusal.

## Assumptions

1. "Purchased" records an acquired or committed quantity before delivery; delivery and consumption
   remain separate procurement lifecycle facts.
2. Package-derived purchase quantity may guide the edit but does not become the recorded purchased
   quantity until the canonical command succeeds.
3. One Requirement may be satisfied by more than one Procurement item, and the procurement
   authority owns how their purchased quantities contribute to status.

## Sources

- [[M12-room-materials]]
- [[Package sizes and purchase quantities]]
- [[Geometry-linked quantities]]
- [[Requirement]]
- [[Procurement item]]
- [[Requirement, procurement, cost and installed quantity stay four concepts]]
- [[Purchase quantity rounds up to whole lots, then up to the minimum order]]
- [[A mismatched unit or currency is an error, not a coercion]]
