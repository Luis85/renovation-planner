---
type: PBI
parent: "[[Decisions and alternatives]]"
order: 10
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Link unresolved decisions to planned spatial state

## Actor

[[Private renovator]], while reviewing a planned room outcome whose final choice has not been made.

## Preconditions

- A canonical Planned record exists for a stable spatial target.
- A canonical [[Decision]] can be created or selected through the decision authority.
- Planned and Decision identities survive note renames and editor remounts.

## Main flow

1. The renovator selects a Planned outcome or marker in its spatial context.
2. They create a Decision with its alternatives and reasoning, or select an existing unresolved
   Decision.
3. The application stores one stable relationship between the Planned identity and Decision
   identity.
4. The planned-state query returns the linked Decision with its authoritative resolved state.
5. The editor shows the unresolved Decision beside the Planned outcome and lets the renovator open
   either side from the other.
6. When the Decision is resolved, the next query shows the resolved state without rewriting the
   Planned record or deleting the relationship.

## Extensions

- **2a** — The chosen Decision is already linked to the Planned outcome. The operation is a no-op
  and creates no duplicate relationship.
- **2b** — The Decision is resolved already. It may remain linked as history, but it is not
  presented as an unresolved blocker.
- **3a** — Either endpoint belongs to an incompatible project. Linking is refused without changing
  either record.
- **3b** — Either endpoint disappears or becomes unreadable before commit. No partial relationship
  is persisted and the specific integrity failure is surfaced.
- **4a** — A previously linked Planned or Decision target is now missing or unreadable. The query
  returns an unresolved relationship with the missing endpoint identified; it does not silently
  omit the link or manufacture a replacement.
- **4b** — The query itself fails. Existing planned context remains visible and linked decisions
  are marked unavailable rather than presented as an authoritative empty list.

## Guarantee

Every Planned-to-Decision association is one persisted relationship between stable domain
identities, and its displayed resolution and integrity state comes from the decision query.
Missing, unreadable, resolved and never-linked states remain distinct.

## Out of scope

- Scenario modelling or comparison.
- Copying Decision reasoning, alternatives or status into the Planned record.
- Automatically changing planned geometry when a Decision resolves.
- Work-package dependencies, impact analysis or change-request approval.

## Acceptance criteria

1. Linking a Planned outcome and Decision survives reload and note rename by stable identity.
2. Repeating the same link creates no duplicate relationship.
3. Querying the Planned outcome returns each linked Decision and its current resolved state.
4. Resolving a Decision changes the next query result without rewriting or deleting the Planned
   record or relationship.
5. A missing Planned endpoint and a missing Decision endpoint are reported distinctly and neither
   is treated as no link.
6. A query failure cannot appear as an authoritative empty decision list.
7. The relationship can be followed in both directions through non-canvas as well as spatial
   navigation.

## Assumptions

1. MVP needs one Planned-to-Decision relationship and resolved-state projection, not scenario
   comparison or automated impact analysis.
2. A Decision may relate to more than one Planned outcome when one choice governs several spatial
   targets.
3. Resolved Decisions remain readable history and are not deleted merely because they no longer
   block planning.

## Sources

- [[M09-planned-room-details]]
- [[M11-multi-selection]]
- [[Decisions and alternatives]]
- [[Describe existing and planned spatial state]]
- [[Define and compare an intended room state]]
- [[Decision]]
- [[Spatial object]]
- [[Identity is the id, never the filename, title or path]]
- [[Four kinds of reference failure are detected by name]]
