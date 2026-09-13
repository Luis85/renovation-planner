---
type: PBI
parent: "[[Handoff purpose and recipient requirements]]"
order: 10
status: New
horizon: "V1"
release: "[[Mighty Dragon]]"
---

# Choose a handoff purpose and recipient

## Actor

[[Private renovator]] preparing to involve an architect, consultant, general builder or trade.

## Preconditions

- A renovation project exists.
- The renovator has at least an objective, question or work item worth discussing.

## Main flow

1. The renovator starts a professional handoff from project, room, work or Review context.
2. They choose one purpose: consultation, feasibility review, site visit, quotation request or
   preparation for execution.
3. They choose a recipient profile and may record a recipient name and contact reference.
4. The plugin explains the response that purpose requests and the level of information it needs.
5. The chosen context, purpose and recipient seed one handoff draft without marking it issued.

## Extensions

- **1a** — No plan exists. Consultation and feasibility remain available from note-first project
  context; quote or execution purposes disclose the missing spatial source where relevant.
- **2a** — The renovator is unsure. The plugin recommends consultation and keeps all later
  purposes available without claiming the project is ready for them.
- **3a** — The required role is not listed. The renovator may use a custom label while selecting
  the closest information profile; no new Trade or contractor record is invented.
- **5a** — The renovator cancels. No package, recipient or readiness result is persisted.

## Guarantee

Every handoff draft has one explicit purpose and recipient profile before information requirements
or readiness are evaluated.

## Out of scope

- Finding, recommending or messaging professionals.
- Creating a Trade, Supplier or contractor CRM record.
- Deciding whether a professional is legally qualified.

## Acceptance criteria

1. Purpose and recipient are required and independently selectable.
2. Each purpose states the requested recipient response in homeowner language.
3. Starting without a plan remains possible for consultation and feasibility.
4. A custom recipient label does not create a second trade catalogue.
5. Cancelling writes no handoff record.
6. The draft retains its originating project, room, work or Review context by stable identity.

## Sources

- Product Capability Map §§13, 21 and 25.
- Competitive landscape Opportunity 7 and homeowner/professional identity risk.
- PRD §§19, 22 and 49.
- [[Professional handoff]].
