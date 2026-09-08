---
adr: 22
title: Material quantity sources, cost reconciliation and ordinary vault evidence
status: Accepted
date: 2026-09-06
area: domain
---

# ADR-0022: Connected Materials → Costs → Evidence

## Ownership and quantities

Extend the existing Asset-backed Requirement, rather than create a second material entity.
Its optional `source` records Plan, spatial target, Work and outcome IDs, current/intended
state, quantity rule, manual input, coverage, lot size and minimum order. The existing
Requirement owns calculated/overridden quantities and estimated costs. Plan renovation
frontmatter owns optional `depth` arrays for procurement, cost obligations and evidence.
Record IDs stay separate from selected Room/wall/opening IDs and from filenames.

Room area/perimeter use the independent Room outline in both states. Straight wall length,
one wall face gross/net area, hosted opening area and selected-item count use the chosen
structure state; absent intended structure falls back to current. Net wall face deducts each
hosted opening once. There is no inference of finish thickness, additional wall faces or a
new Room outline. Current and intended opening-host containment remain independently validated.
Raw millimetres, square millimetres and counts enter the existing quantity engine, which converts
to m/m2/piece, divides by coverage, applies waste and then packaging/minimum. A minimum requires
a positive lot size. Manual input uses the selected asset's supported unit. Dimension mismatch,
missing targets and invalid numbers refuse calculation. Arbitrary catalogue units are not silently
converted. UI waste is percent; persisted waste is a fraction.

A quantity override replaces the calculated result and its packaging allowance, while preserving
the calculated base. Recalculation preserves BOTH quantity and cost overrides; estimated cost
uses effective quantity and the existing project-price-over-catalogue precedence. This intentionally
repairs the older `withRecalculation` quantity-override loss. Geometry, calibration, sidecar and
index rebuild events use the existing stale-first recalculation cascade. Price changes retain its
existing subscribers. Stale/refused figures are labelled; shopping and automatic totals refuse
stale inputs rather than silently presenting them as current. Accepted financial facts never
change because a source estimate changes.

## Procurement and financial meaning

Needed is effective Requirement quantity, including waste/packaging unless overridden.
Purchased is allocated purchased stock; reserved is ADDITIONAL allocated available stock and
must not also be entered as purchased. Outstanding = max(0, needed − purchased − reserved).
These are exclusive local allocations, not shared inventory, delivery, payment or Work progress.
No procurement state changes Work readiness. One allocation record per Requirement is accepted.

Each cost record is ONE obligation with category material/labor/other, optional Requirement,
planned Money (null uses its linked Requirement estimate), and separately identified committed
and actual facts. A standalone cost needs a manual plan. All active amounts must be nonnegative
and use the Project currency; no FX conversion exists. An actual may settle one active commitment
on the same obligation. Open commitment is max(0, commitment − its linked actuals); unlinked actuals
reduce the budget but do not settle an order. Remaining = planned − actual − open commitments.
It may be negative. Committed, actual and planned are displayed separately and are NEVER added
as spending. Partial and excess settlement therefore cannot double-count the same obligation.

Cancellation preserves records and facts and excludes the cancelled obligation/fact from active
totals. Cancelled commitments with active linked actuals must be resolved explicitly. At most one
active obligation links a Requirement. Without one, Costs shows its automatic material estimate;
cancelling a saved order does not remove the underlying material need, so that estimate reappears.
Labour and other obligations are manual. Quotes/invoices are evidence, not parsed financial facts.

## Evidence and generated notes

One shell serves Documents, Photos and Notes, with description, type, Before/During/After/Hidden
services phase, Room/spatial target, optional Work and optional subject/Decision/Requirement/cost
record. An ordinary vault-relative canonical path and separate heading/block subpath own the file
reference. The adapter uses host `parseLinktext` and metadata resolution relative to the Plan note,
with exact canonical paths preferred. Duplicate basenames remain distinct. Paths with spaces and
Unicode are supported. Import refuses separators, control characters, Windows reserved names,
trailing dots/spaces and link delimiters that cannot be unambiguously round-tripped. Import never
overwrites. File creation/import survives cancelling the relationship draft. Unlink never deletes
the user file. Images use the host resource path; there is no owned object URL, camera, OCR or
unimplemented Compare quotes button. Missing paths remain visible and route from Review.

The host's file/folder rename event updates matching evidence path prefixes by conditional Plan
writes. The operation does not overwrite a concurrent Plan edit; a refusal is surfaced and the
missing link can be repaired explicitly. No retroactive host rename history is invented on reload.
An optional pin is a fraction of the Room bounding box: calibration and Room resizing move it
with that box. It is contextual, not a surveyed wall coordinate. The same phase/type list controls
pin numbering and selection. Removing linked spatial targets is refused; no orphan pin is silently
moved. File identity is independent of the pin and record identity.

Shopping/review notes reuse the existing owner/header digest and `Vault.process` compare-and-swap.
Identity is `(kind, Plan ID)`; default location is alongside the Plan's generated notes. Scanning
owned Markdown notes preserves identity after a move/rename. Multiple owners, an unrelated target,
human edits or a changed digest refuse replacement. Removing the ownership header removes the
ability to identify a moved generated projection. Shopping is outstanding-only with one row per
Requirement, preserving asset/unit/price/source context and resolving stable source IDs to vault
links. There is no unsafe name-only merge. Canonical facts never live in generated notes.

## Writes, history and compatibility

Material commands use existing repositories, reference locks, editor dispatcher and shared write
ledger. Initial writes compare the displayed baseline's Plan, geometry, catalogue and Requirement;
undo/redo compares current entity content and ledger generations, preserving peer edits and revision
gaps. Reassignments repeat depth-link validation. Plan commands repeat fresh material-reference
checks and retain the existing conditional multi-file compensation. Geometry writes guard against
removing source targets. Deletion previews name affected records; unresolved links require repair
before removal. Requirement deletion retains the repository's trash policy; undo recreates entity
metadata, while the original user-authored note remains recoverable from the host trash.
Lifecycle and effective-cost events are published after successful writes, including inverses.

Plan metadata v4 and Requirement metadata v2 are the minimal schema changes. Optional facts are
not invented by migration: pure, idempotent steps advance only the discriminator. Legacy documents
remain readable, writes preserve unrelated YAML/body, future versions refuse, and geometry stays
at the inherited v3 schema. Read-only access never migrates bytes. Fresh repository hydration is
part of verification. The register is NOT a durable transaction journal and this increment makes
no durable crash-recovery claim.

## Acceptance boundaries

This delivers a bounded M12/M13/M14/M17 planning slice. Supplier management, purchase orders,
shared inventory, full quote comparison, payment integration, scheduling, collaboration,
engineering checks and live Obsidian/screenreader acceptance remain open. Review adds only stale
figures, reconciliation failures/negative Remaining, and missing linked files. Evidence is never
made mandatory by inference. See the implementation evidence and coverage ledger for measured
criteria and remaining gaps; neither global Increment D nor release readiness is asserted.

### Metadata and geometry interleaving

Every renovation metadata operation performs the sidecar CAS, including unchanged geometry.
It advances the sidecar revision while preserving geometry content. This closes #87's P1 window
in which a target was deleted after validation but before metadata persistence. A failed CAS
conditionally restores the Plan using the operation's own save receipt; failure to restore
retains the existing unrecovered-write state. This is conditional compensation, not a durable
cross-file transaction or crash journal.

Material creation, edits and deletion use the same geometry confirmation boundary. If it
refuses, the command restores/deletes its Requirement using the operation's own receipt, updates
the shared ledger and publishes no lifecycle success. Failed restoration marks the command as
unrecovered and prevents retry on that instance. Regression tests cover create/edit/delete,
returned and thrown failures, peer wall deletion and successful conditional retry.

The legacy delete-and-reassign flow refuses moving a contextual Requirement to another Room:
that operation cannot revise its spatial, Work and outcome source together. Within-Room source changes use the Materials editor. Cross-Room transfer requires resolving
dependants and recreating the Requirement in the destination; in-place transfer is deferred.
Same-Room catalogue replacement retains the
source and enters the existing stale recalculation path.
