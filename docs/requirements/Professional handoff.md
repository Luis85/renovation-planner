---
type: Epic
order: 140
status: New
horizon: "V1"
release: "[[Mighty Dragon]]"
---

# Professional handoff

A private renovator can describe an intended result, connect it to rooms, work, quantities,
costs, decisions and evidence, and still arrive at an architect or trade visit with no reliable
way to say what the recipient is being asked to do. A generic export does not close that gap: an
architect needs a live brief and known unknowns, while a contractor asked to quote needs bounded
scope, prerequisites and a common response structure. This epic turns homeowner-owned project
information into a purpose-specific exchange without turning Renovation Planner into CAD, AVA,
contractor CRM or a multi-user collaboration platform.

The package is a projection over canonical records, not a second copy of the renovation. Its
purpose, recipient profile, included source revisions, provenance, unresolved questions and issue
state make the exchange understandable later. Once issued, it is a frozen snapshot; later source
changes can supersede it but never silently rewrite what another person received.

This epic owns handoff purpose, recipient information requirements, handoff readiness, package
assembly and returned-response reconciliation. [[Trades and work packages]] continues to own
Trade and Work Package; [[Suppliers, quotes and procurement]] continues to own Supplier, Quote,
quote items and comparison; [[Documents, photos and evidence]] owns linked files; and
[[Decisions, scenarios and change management]] owns decisions and change history.

Derived from Product Capability Map §§13–14, 21, 25 and 29; the user-research synthesis §§14–16
and Opportunity 4; the competitive landscape's Opportunity 7 and homeowner/professional identity
risk; PRD §§19, 22–23, 43, 49 and 57; and the explicit UJ-W11 product direction.

## Definition of done

An item beneath this epic is done when:

- The renovator states the exchange purpose and recipient before completeness is judged.
- Every included fact remains linked to its canonical source and says whether it is observed,
  homeowner-measured, derived, assumed, supplier-provided, professional-issued or unknown.
- Readiness is recipient- and purpose-specific, deterministic and explainable; an early
  consultation may be ready with open questions while a construction handoff is not.
- A recipient profile changes what the package requests and emphasizes without creating a second
  copy of rooms, work, quantities, costs, evidence or decisions.
- An issued package identifies its source revisions and is never silently updated.
- The recipient is asked to return questions, assumptions, exclusions and scope rather than
  treating homeowner input as the professional's completed design or contractual promise.
- Returned quotes and scope can be reconciled against the same plan and work identities used to
  assemble the package.
- Regulatory, safety and professional-review prompts remain advisory, jurisdiction-labelled and
  dated; the plugin never claims that permission, engineering or professional approval exists.
- Sharing core functionality remains local-first and portable, with no required account, remote
  service or multi-user backend.

## Evidence boundary

Repository research strongly supports the communication, responsibility and quote-comparison
problem, but the project has no real renovation dataset and no validated handoff workflow. The
role profiles, required-information rules and export formats remain hypotheses to test with
homeowners, architects and trades before implementation detail is fixed.
