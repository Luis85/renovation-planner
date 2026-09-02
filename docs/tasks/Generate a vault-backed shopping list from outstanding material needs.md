---
type: Task
parent: "[[Update purchased material quantities from spatial context]]"
order: 40
status: New
horizon: "V1"
release: ""
---

# Generate a vault-backed shopping list from outstanding material needs

## Evidence

M12 specifies Create shopping list as a generated or reopened vault-backed list using outstanding
quantities by default, with other inclusion behavior only when configured.

## Why it matters

A presentation-calculated list can disagree with package and procurement authorities, while
creating a new note on every activation fragments one shopping list into competing copies.

## Approach

Ask the material/procurement authority for the configured inclusion set and authoritative
quantities, generate or update the canonical vault-backed shopping list, and reveal that same note
after success.

## Acceptance criteria

- With default settings, only material needs reported as outstanding are included.
- Configured inclusion behavior is applied by the owning authority and is visible in the generated
  list's scope.
- Needed, outstanding and purchase quantities and units come from authoritative query results;
  presentation performs no subtraction, package rounding or unit conversion.
- Repeating the action opens or updates the canonical shopping-list note rather than creating an
  unlinked duplicate.
- The list uses stable links back to its source requirements or procurement items.
- Unavailable, unreadable or incompatible source data is reported and cannot appear as zero or be
  silently omitted from a supposedly complete list.
- Reloading the vault preserves and reopens the generated list as an ordinary vault note.

## Risks

Generated prose may become a second quantity authority, or partial reads may produce a
precise-looking but incomplete purchase list.

## Outcome

The renovator can continue outstanding spatial material needs in one durable shopping list whose
scope and quantities remain authority-owned.
