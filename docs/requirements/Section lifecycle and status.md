---
type: PBI
parent: "[[Construction sections]]"
order: 30
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

# Section lifecycle and status

## Actor

[[Private renovator]] tracking whether each renovation job is only an idea, ready to proceed,
underway, blocked or finished.

## Preconditions

- A construction section exists.

## Main flow

1. The renovator opens a construction section.
2. The plugin shows its current lifecycle status in the section list and wherever the section is
   represented on a plan.
3. The renovator chooses one of exactly seven statuses: `idea`, `planned`, `ready`,
   `in-progress`, `blocked`, `completed` or `cancelled`.
4. The plugin persists that exact status in readable frontmatter on the construction-section
   note.
5. Every section view refreshes to show the same status using a word or mark in addition to any
   colour.

## Extensions

- **3a** — The requested value is outside the seven-state vocabulary. The change is refused and
  the previous status remains.
- **4a** — The note changed since it was read. The update is refused as a conflict and the current
  persisted status is reloaded rather than overwritten.
- **4b** — Persistence fails. The failure is reported and no view presents the unsaved status as
  saved.
- **5a** — Colour is unavailable or indistinguishable. The status remains identifiable from its
  text or non-colour mark.

## Guarantee

A section has one persisted status from the exact seven-state lifecycle, and every readable
surface represents that same value without relying on colour alone.

## Out of scope

- Adding statuses, aliases or configurable workflows.
- Inferring status automatically from dates, dependencies, costs or tasks.
- Defining which status transitions are permitted.
- Project, work-package or task lifecycle rules.

## Acceptance criteria

1. The only accepted values are `idea`, `planned`, `ready`, `in-progress`, `blocked`,
   `completed` and `cancelled`.
2. A valid change survives reload with the same exact value.
3. The persisted status is readable in the note frontmatter with the plugin disabled.
4. The list and plan representations show the same persisted status.
5. Status remains distinguishable without colour in both representations.
6. An unknown value cannot replace the last valid status.
7. A failed or conflicting write is not displayed as a saved status change.

## Assumptions

1. This PBI preserves PRD §16's vocabulary exactly and introduces no transition graph.
2. A new section begins at `idea`, as specified by [[Create a construction section]].
3. Human-readable text satisfies the non-colour channel; a visual mark may accompany it but
   cannot replace it.

## Sources

- PRD §16 (construction-section lifecycle and visual status).
- PRD §44 (Accessibility and portability).
- [[Construction sections]].
