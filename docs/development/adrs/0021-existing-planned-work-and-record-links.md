---
adr: 21
title: Independent renovation facts and stable spatial record links
status: Accepted
date: 2026-09-06
area: domain
---

# ADR-0021: Existing / Planned / Work and record links (ADR-EPW, ADR-RL)

## Contract

The implemented repositories contain Project, Plan, Zone, Asset and Requirement. WorkPackage
and Trade are reserved SDD concepts, without domain implementations, repositories or fixtures.
ZoneStatus remains a progress axis. No Room clone or new hierarchy is needed.

The smallest coherent aggregate is a Plan's optional renovation register in Markdown
frontmatter. Its records belong to the Plan's Project. A subject has one stable record ID,
one Room context, and one stable spatial target (Room, wall or opening). A wall/opening has at most one subject in a floor register; multiple descriptive subjects may target the Room. This prevents one subject from discarding another subject’s intended geometry. Existing description,
surface/element kind and condition are independent of its optional intended description and
change classification. Add has no Existing facts; modify/remove/unchanged require Existing.
Remove carries no intended facts. Unchanged cannot assert different intended facts. Discarding
a proposal preserves its Existing source. Removing a referenced subject or outcome is refused
until the explicitly listed Work/Decision relationships are resolved.

WorkPackage is the domain name for an ordered, project-owned work record. Its UI name is Work
item. It references subjects as outcomes and stable spatial IDs as targets. Responsibility is
unassigned or DIY in this repository, because no Trade catalogue exists to choose from. This
does not fabricate a trade assignment, schedule, material total or cost estimate. Dependencies
are IDs within the floor register (cross-floor dependencies are not implemented); cycles are refused. Blocking is derived from incomplete predecessor
work, never persisted as another progress status.

Decision records have stable IDs, question text, subject/Room context and unresolved/resolved
state. The register is ordinary vault-backed content reached through the owning Plan note;
there is no parallel filename-based identity or shadow record database.

## Geometry and relationships

Spatial relationships use `{roomId, targetId}` in the owning Markdown record. Subject IDs join
Work outcomes and Decisions. Names and paths are display/navigation properties, never keys.
The existing index resolves the owning Plan note. Renaming Rooms or moving notes retains links.

Current geometry remains ADR-0020's structure. An optional intended structure in the same
sidecar retains the same IDs for unchanged/modified subjects and allocates fresh IDs only for
actual additions. It is a state snapshot, not another set of selectable spatial entities.
Current and intended opening-host containment and overlap are validated independently. Removing
a wall from the intended state requires removing or rehosting its intended openings explicitly.
The supported transformations remain straight walls and hosted openings. Room outlines and
boundary provenance keep ADR-0020 ownership and never synchronize implicitly.

Markdown owns renovation descriptions, classification and record links; the sidecar owns
coordinates and measurements. Perspective, focused record, viewport and visibility are leaf
presentation state. Planned comparison uses text/markers and patterns as well as host colors.
Calculated measurements remain projections with provenance; manual description never becomes
a geometry authority. Calibration transforms both spatial states through the existing math.

## Writes and compatibility

This triggers ADR-SV: Plan metadata and geometry versions advance when new owned content is
written. Pure migrations advance the in-memory discriminator to v3 without inventing optional facts and never rewrite files on read.
Unsupported versions refuse. Existing IDs, reference appearance and old fixtures remain valid.
Commands capture both persistence versions and compare the user's displayed projection before
accepting a fresh baseline. Composite writes compensate with versions returned by their own
operations, refuse peer changes and report failed compensation through existing save state.
Undo/Redo is conditional. There is no durable cross-file crash journal.

Draft forms use explicit Apply/Cancel, resolving SDD §101 only for these forms. Root-owned
draft state survives responsive panel changes. Navigation cannot silently discard a draft;
busy commands reject duplicate submission and late responses retire on leaf disposal.

## Readiness scope

Review deterministically reports unresolved Decisions, changed outcomes lacking Work, Work
lacking an outcome, and Work blocked by incomplete dependencies. Findings carry actionable
Room/record routes. No findings means only that these checks found no gaps. Costs, evidence,
engineering/code compliance, procurement and scheduling are outside this review's scope.
Review exposes no creation or geometry editing. A generated review note is a projection with
links back to its sources; repeat generation must condition replacement on the prior content
and preserve human edits. It is not a new canonical register.

This records the design contract, not acceptance evidence. Demonstrated criteria and remaining
gaps belong in implementation status and the connected-workflow test case.

## Navigation and generated notes

Perspective changes return to Select. An active spatial draft requires an explicit discard
confirmation; an open renovation form must be applied or cancelled before navigation. Review
remembers the prior Room, focused item, ordered spatial selection and viewport. Choosing an
issue intentionally enters its source context. Marker visibility uses the existing annotation
layer and a leaf-only visibility flag. It never writes records.

Generated notes live alongside the owning Plan at `Review-<hash-of-plan-id>.md`. Their first
line records the owner and a digest of the generated body. An unchanged generation opens the
same path without writing. Regeneration replaces only a valid owned body, through Vault.process
conditioned on the bytes just read; an occupied folder, unowned note, edited body, race or I/O
failure refuses. The source Plan note is linked and findings identify their stable record IDs.
There are no individual Decision filenames or anchors in frontmatter. Users resolve Decisions
in the Inspector or inspect the ordinary source note. Human prose in the generated note is
preserved by refusing replacement; no force-overwrite action is offered.

## History limits

Room repository writes return a nonpersisted receipt for the sidecar version consumed and
produced under the write lock. Reversible Room adapters observe and record that receipt in the
shared editor ledger. A peer revision gap changes its generation and cannot be erased by a
subsequent local edit/undo. Exact document comparison ignores object-array ordering introduced
by Room upsert but preserves polygon point order. Legacy reference/calibration transactions
retain their stricter exact-version history contract; interleaving whole-reference changes can
therefore require reopening rather than allowing an unsafe historical replacement.
