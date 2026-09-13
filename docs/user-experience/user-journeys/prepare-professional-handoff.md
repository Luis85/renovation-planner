---
id: UJ-W11
title: "Prepare and reconcile a professional handoff"
type: user-journey
status: documented
source_maturity: proposed
version: 1
language: en
updated: 2026-09-13
area: workspace
actor: private-renovator
sources:
  - path: "../../product/Product Capability Map.md"
    section: "§21: communicate and share; §25: progressive planning; §29: readiness"
  - path: "../../product/research/renovation-planner-competitive-market-landscape.md"
    section: "Opportunity 7: contractor brief / scope export"
  - path: "../../product/research/renovation-planner-user-research-synthesis.md"
    section: "§§14–16: shareable outputs, contractor communication and document context"
related_journeys:
  - UJ-E06
  - UJ-E08
  - UJ-E09
  - UJ-E10
  - UJ-W03
  - UJ-W09
---

# Prepare and reconcile a professional handoff

## Goal

Prepare the right project information for an architect, consultant, general builder or trade,
make its limits clear, and bring the recipient's questions and response back into the renovation.

## Actor and entry

A private renovator working in Obsidian. They are ready to ask for consultation, feasibility
feedback, a site visit, a comparable quotation or preparation for execution from somebody who
does not use their vault.

## Main flow

1. Start a handoff from project, room, work or Review context.
2. Choose the purpose and recipient profile before the plugin judges completeness.
3. Review the recipient-specific information requirements and requested response.
4. Inspect readiness findings and distinguish missing, unknown, unavailable, stale and
   professional-input items.
5. Resolve source issues where useful, or retain explicit open questions for consultation.
6. Preview the complete inclusion and attachment manifest, removing optional private material or
   declaring required omissions.
7. Issue a frozen, portable package that identifies its purpose, recipient, issue date, source
   revisions, provenance, warnings and open questions.
8. Record when it was sent, whether receipt was acknowledged and which questions returned.
9. Link the recipient's own scope, assumptions, exclusions, alternatives, documents and quote to
   the issue without rewriting the request.
10. Compare the response with the issued baseline, record decisions through their canonical
    authority and issue a new version when affected project information changes.

## Alternatives and recovery

- A project with no floor plan can still produce a consultation brief from objectives, notes,
  photos and open questions; quote or execution readiness may remain blocked.
- An early consultation can be ready with open questions because resolving them is the purpose.
- A missing or unreadable source is never silently omitted or presented as an empty fact.
- The renovator may issue without optional evidence; required omissions stay visible in the
  package and readiness result.
- A generation failure leaves the draft unissued. Partial output is reported and is never treated
  as what the recipient received.
- Acknowledgement, approval and professional verification are never inferred from time, file
  presence or homeowner notes.
- Later source changes do not mutate an issued package. They create an impact list and may seed a
  new issue that explicitly supersedes the old one.
- Responses may arrive outside the plugin and be recorded by the homeowner; no recipient account,
  messaging system or collaboration backend is required.

## Outcome

The recipient understands why they were contacted, the renovation context and what response is
needed. The homeowner can later reconstruct exactly what was sent, what the professional assumed
or excluded, what changed and which decision followed.

## Scope and evidence

This is a proposed journey created from repository research and an explicit product direction. It
is not a claim of shipped functionality, professional sufficiency, legal compliance or passed
usability testing. It keeps the homeowner as the product user and treats professionals as
recipients/participants; CAD, BIM, permitting, engineering, AVA, contractor CRM and multi-user
collaboration remain outside product scope.

- [Capability map: communication, progressive planning and readiness](<../../product/Product Capability Map.md>)
- [Competitive opportunity: contractor brief / scope export](../../product/research/renovation-planner-competitive-market-landscape.md#opportunity-7--contractor-brief--scope-export)
- [Research synthesis: contractor communication and responsibility](../../product/research/renovation-planner-user-research-synthesis.md#15-problem-cluster--contractor-communication-and-responsibility-are-opaque)
- [Professional handoff epic](../../requirements/Professional%20handoff.md)

## Related journeys

- [UJ-E06 — Turn renovation intent into room work](plan-room-work.md)
- [UJ-E08 — Estimate and review renovation costs](estimate-and-review-costs.md)
- [UJ-E09 — Attach and find evidence in context](attach-and-find-evidence.md)
- [UJ-E10 — Review renovation readiness and address issues](review-renovation-readiness.md)
- [UJ-W03 — Schedule renovation work progressively](schedule-renovation-work.md)
- [UJ-W09 — Compare alternatives and preserve a decision](evaluate-and-record-decision.md)
