---
type: PBI
parent: "[[Construction sections]]"
order: 10
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

# Create a construction section

## Actor

[[Private renovator]] defining a job that will later be located, budgeted, awarded and scheduled.

## Preconditions

- A renovation project exists.
- The project can create and persist construction-section notes.

## Main flow

1. The renovator starts construction-section creation.
2. The plugin asks for a meaningful section name, such as *Replace the bathroom*.
3. The renovator enters the name and confirms.
4. The plugin creates one construction section with a stable identity independent of its note
   name or path.
5. The plugin writes one human-readable construction-section note carrying that identity, the
   name and the initial `idea` lifecycle status.
6. The new section appears as a job that can later receive zones, trades, work packages and a
   budget.

## Extensions

- **3a** — The name is empty or only whitespace. Creation is refused at the field and nothing is
  written.
- **3b** — The renovator cancels. Nothing is written.
- **5a** — The note cannot be written. The failure is reported and no section is presented as
  created.
- **5b** — A readable note cannot be produced without overwriting an existing note. Creation is
  refused and the existing note is left unchanged.

## Guarantee

Either one construction section exists with one stable identity, one readable note and an
initial lifecycle status, or the project remains unchanged.

## Out of scope

- Assigning zones, owned by [[Spatial assignment]].
- Changing or displaying later lifecycle states, owned by [[Section lifecycle and status]].
- Assigning trades, work packages, dates or costs.
- Defining a project-wide naming convention or automatic section code.

## Acceptance criteria

1. Confirming a valid name creates exactly one construction section and one note.
2. The note carries a stable section id, the entered name and `idea` status in readable
   frontmatter.
3. Renaming or moving the note does not change the section id.
4. Empty and whitespace-only names create no section.
5. Cancelling creates no section or note.
6. A failed write leaves no section presented as successfully created and does not overwrite an
   existing note.
7. The note remains readable as plain Markdown with the plugin disabled.

## Assumptions

1. A newly created section starts in `idea`, the first state in PRD §16's lifecycle.
2. The section's stable id, rather than its note basename or path, is its identity.
3. Zone, trade, work-package and budget relationships may be absent at creation.

## Sources

- PRD §16 (Epic 5 — Construction Sections).
- PRD §36 (Vault Data Model).
- PRD §44 (Interoperability and portability).
- [[Construction sections]].
