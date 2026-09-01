---
type: PBI
parent: "[[Construction sections]]"
order: 50
status: New
started: ""
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

# Trade assignment

## Actor

[[Private renovator]] identifying which kinds of specialist work a construction section requires.

## Preconditions

- A construction section exists.
- The canonical [[Trade catalog]] contains at least one trade.

## Main flow

1. The renovator opens trade assignment for a construction section.
2. The plugin presents trades from the canonical catalog.
3. The renovator selects one or more trades.
4. The plugin stores links from the section to the selected catalog entries by stable identity.
5. The section shows the current canonical name and details for every assigned trade.
6. The assignments are available to later work-package, budget and schedule capabilities without
   creating section-local trade records.

## Extensions

- **2a** — The catalog is empty. The plugin explains that a catalog trade must be created first
  and writes no assignment.
- **3a** — The renovator searches for a spelling that is not in the catalog. No ad hoc trade is
  created from the search text; the renovator may leave and add it through the catalog authority.
- **3b** — A selected trade is already assigned. The existing link is kept and no duplicate is
  created.
- **4a** — A selected catalog entry was removed or became unreadable before saving. That
  assignment is refused and no copied name is stored as a substitute.
- **4b** — Persistence fails. The failure is reported and unsaved assignments are not presented
  as saved.
- **5a** — A catalog trade is renamed. Every section linked to it shows the new canonical name
  without being reassigned.
- **5b** — An assigned trade is later missing. The broken reference is visible and is not silently
  replaced by a new local trade.

## Guarantee

Every section-to-trade assignment is a reference to one canonical catalog entry; assigning,
renaming or removing a link never creates a copied or section-local trade authority.

## Out of scope

- Creating, renaming, merging or deleting catalog trades.
- Creating work packages, tasks or dependencies for an assigned trade.
- Choosing a contractor or supplier.
- Awarding work, scheduling it or calculating trade totals.

## Acceptance criteria

1. Trades can be assigned only by selecting entries from the canonical catalog.
2. A section may link to more than one trade.
3. Reassigning the same trade creates no duplicate link.
4. The persisted assignment stores trade identity rather than a copied name.
5. Renaming a trade in the catalog changes the name shown by every linked section.
6. Removing an assignment does not delete or modify the catalog trade.
7. A missing or unreadable trade remains an identifiable broken reference and is not replaced
   with copied text.
8. A failed assignment write is not displayed as saved.

## Assumptions

1. Trade identity and lifecycle are owned by [[Trade catalog]], while this PBI owns only the
   section-to-trade link.
2. PRD §16's plural `trades` property permits more than one trade per construction section.
3. Assignment does not itself create work packages or imply that work has been awarded.

## Sources

- PRD §8 (Core Entities — Trade and Work Package).
- PRD §16 (trade assignment).
- PRD §19 (Epic 8 — Trades & Work Packages).
- [[Construction sections]].
- [[Trade catalog]].
