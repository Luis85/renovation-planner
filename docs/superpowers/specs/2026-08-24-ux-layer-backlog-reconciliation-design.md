# Reconciling the UX layer with the backlog — design

**Date:** 2026-08-24
**Status:** Approved, not yet executed
**Output:** one findings ledger in `docs/reviews/`. No derived note is edited by this work.

## Why

`main` gained a user-experience layer written after the backlog it describes: a second PRD
(`docs/prds/renovation-project-workspace.md`, 1,451 lines) and four documents under
`docs/user-experience/` — a prototype design specification (1,432), wireframes (1,143), a
UX journey and interaction design document (682) and a JTBD research backlog (424) — plus
HTML concept pages and seventeen screenshots.

They landed beside 19 Epics and 121 notes in `requirements/` that were derived from the
*other* PRD. Nothing conflicted, because nothing ever does between two documents: a
convention arriving next to documents that predate it clashes semantically or not at all,
and never as a merge conflict. That is the entire reason this pass exists.

The divergence is already visible without reading closely. `Space`, `Project Home` and
`Planner Home` appear across the new documents and in **zero** requirement notes, while
`Zone` — the backlog's central spatial concept — carries twenty. The new PRD's glossary
lists Property, Building, Floor, Space, Room and Outdoor Area *alongside* Zone and Plan,
where the backlog's model is Project → Plan → Zone.

## What is not in question

The new PRD is **additive, not competing**, and says so: *"The Renovation Planner already
has a technically sound foundation for spatial planning, zones, assets, quantities, costs,
work packages, scheduling, and project documentation. The purpose of this PRD is to define
the user-facing product layer."* This is not an adjudication between two specifications.

The **direction is already settled by the register's own rules.** Both PRDs sit in
`docs/prds/`, which `docs/README.md` defines as received evidence kept verbatim — "corrected
only by receiving a new one". Reconciliation can therefore only ever change *derived*
documents. The backlog moves; the PRDs do not. No question needs to be asked about this and
none is.

## Scope

**In**, on the evidence side: the workspace PRD, all four `docs/user-experience/` documents,
and `component-gallery.html` read for component vocabulary only.

**In**, on the derived side: `requirements/` (121), `entities/` (34), `business-rules/` (27),
`components/` (17), `actors/` (8), `deliverables/` (5), `adrs/` (12), `issues/` (3) —
**227 notes, 11,336 lines.**

**Out, deliberately:**

- **The 17 design slices in `tasks/`** (14,763 lines). They are SDD-derived architecture
  sitting one layer below this question, and whether slices 3, 5 and 8 need touching depends
  entirely on what `Space` turns out to be relative to `Zone` — which is the decision this
  ledger exists to put in front of a human. Sweeping them first means reading fourteen
  thousand lines to produce findings whose resolution is "depends". Named as a follow-on
  that is blocked on that decision, not as an oversight.
- **The HTML concept pages beyond the component gallery**, and **the seventeen screenshots**.
  A screenshot is not something a note can be checked against.

## The instrument

The risk in a sweep this size is that "read one corpus against another" is a disposition
rather than a method, and a finding set assembled from what the reader happened to notice
cannot state its own coverage. So the comparison is built on an enumerable inventory:

1. **Extract** every named thing from the new evidence — the workspace PRD's glossary
   concepts, every named screen and view, and the component names in the gallery.
2. **Establish presence mechanically** for each: is there an `entities/` note, a
   `components/` note, a Feature or PBI in `requirements/`.
3. **Derive the finding set from the resulting matrix**, so absence is *counted* rather than
   spotted.
4. **Read for contradiction only in the cells where both sides speak** — same name with a
   different meaning, or different names for one thing. This part is judgement, and it is
   bounded to cells the matrix identified rather than applied to the whole corpus.

Absence is mechanical. Contradiction is read, but only where reading is warranted.

## The ledger

`docs/reviews/2026-08-24-ux-layer-backlog-reconciliation.md`, following the shape the two
existing ledgers set: narrative, naming its instrument and its counts, findings grouped by
cluster rather than listed flat.

**Two deviations from that shape, stated in the ledger's own opening rather than left to be
inferred:**

- Both existing ledgers open with "All findings below are fixed." **This one is written
  before any fix**, because the work was scoped findings-first deliberately.
- It states its own coverage limits — the slices, the HTML, the screenshots — where a reader
  meets them, rather than letting "reconciled" read wider than it is.

Every finding names **both sides with file and section**, and says which side is received and
which is derived, since that already decides what may change. A reader must be able to check
a finding without trusting the ledger.

### Finding kinds

Ordered by consequence, not by effort:

| Kind | Means |
| --- | --- |
| **Contradiction** | Both sides speak and disagree. Worst: one of them is misleading a reader today. |
| **Gap** | The new evidence names something with no note behind it. |
| **Orphan** | The backlog holds something the new evidence supersedes or ignores. |
| **Convention** | The register's own rules — e.g. `user-experience/` and `templates/` are absent from `docs/README.md`'s folder table, which claims to name every folder so the first note of a kind "has somewhere obvious to go". |

### Findings that need a decision

A separate section, and not a severity. `Space` versus `Zone` is the certain member: whether
Space is a new entity, a parent of Zone, or a user-facing name for one is a **product
decision with consequences for the domain model, and it is not mine to make**. Each such
finding carries the options and a recommendation. None is resolved unilaterally, and the
ledger says so where they are listed.

## Definition of done

1. Every inventory item has a matrix row carrying a state — present, absent, or contradictory
   — and the ledger reports the counts rather than describing them.
2. Every finding is checkable: file and section on both sides.
3. Decision-needing findings are listed apart, with options and a recommendation, and none is
   settled in this pass.
4. The coverage limits above appear in the ledger.
5. `npm run check` shows **no failure this pass introduced**. It cannot be required to pass
   outright: `main` is red today, before any of this work — `vue-tsc` rejects
   `src/infrastructure/obsidian/repositories/ObsidianPlanRepository.ts:113`
   (`Result<never, ValidationError>` returned where
   `Promise<Result<Loaded<Plan>, …>>` is declared), which is another session's in-flight
   implementation of slice 4 and not this pass's to fix. Confirmed pre-existing by running
   the build on a clean tree. Writing "the gate passes" into a definition of done while the
   gate is red would be the defect this repository's own guide names first: write the
   guarantee to the check, never ahead of it.
6. **No derived note is edited.** The ledger is the whole deliverable; fixing is a separate
   piece of work, separately approved.

## What this deliberately does not do

It does not fix anything. It does not create Epics, Features or PBIs from the new PRD. It
does not decide the spatial model. Each of those is a follow-on that this ledger is meant to
make answerable, and any of them started here would be a second piece of work smuggled into
the first — with the added defect that the decision underneath them would have been made by
whoever happened to be typing.
