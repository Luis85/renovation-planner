---
type: PBI
parent: "[[Professional response reconciliation]]"
order: 10
status: New
horizon: "V1"
release: "[[Mighty Dragon]]"
dependsOn: "[[Export and supersede a frozen handoff package]]"
---

# Record acknowledgement and professional questions

## Actor

[[Private renovator]] following up after a professional handoff was issued.

## Main flow

1. The renovator opens an issued package and records when and how it was sent.
2. They record acknowledgement against that exact package issue.
3. Questions from a site visit, email, phone call or document are added with author, date and
   affected package section or canonical project link.
4. Each question is open, answered or superseded, and may link to supporting evidence.
5. An answer that changes the renovation routes to the appropriate source record and decision;
   closing the question does not silently mutate the plan.

## Extensions

- **2a** — No acknowledgement is received. The issue remains sent/unconfirmed; the plugin does
  not infer receipt from an elapsed time.
- **3a** — A question concerns an item excluded from the package. The omission is visible and the
  item can enter a new issue without rewriting the old one.
- **4a** — A later issue replaces the context. Earlier questions remain attached to the issue in
  which they were asked and may be explicitly superseded.

## Guarantee

Acknowledgement and questions identify the exact issued package and never imply professional
approval or change canonical project data by themselves.

## Out of scope

- Email, chat, notifications or recipient accounts.
- Read receipts or cryptographic proof of delivery.
- Professional approval/signature workflows.

## Acceptance criteria

1. Sent and acknowledged are separate explicit events with date and channel.
2. Every question links to one package issue and may additionally link to canonical scope.
3. Question author, date and lifecycle remain visible.
4. Answering a question does not directly edit plan, work, cost or evidence authorities.
5. No acknowledgement or answer is inferred.
6. Superseded package questions remain historically readable.

## Sources

- User-research synthesis §§14–15.
- Product Capability Map §§13 and 21.
- PRD §§23, 25 and 57.
