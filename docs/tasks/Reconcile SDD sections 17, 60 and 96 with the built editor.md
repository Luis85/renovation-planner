---
type: Task
order: 10
status: New
horizon: "MVP"
release: "[[MVP]]"
dependsOn: "[[Confirm merged main carries the verified editor state]]"
---

# Reconcile SDD sections 17, 60 and 96 with the built editor

## Evidence

Measured in `docs/development/sdds/obsidian-renovation-planner-SDD.md` and `src/` on `main` at
`5dcc1f20`:

- **§17 *Konva Scene Structure*** marks `ArchitectureLayer` as "walls and openings, reserved —
  §97", and `ConstructionLayer` and `AssetLayer` as reserved. Yet `export interface Wall` is in
  `src/domain/spatial/Structure.ts`, beside `src/domain/spatial/rotateWall.ts`,
  `src/domain/spatial/openingGeometry.ts` and `src/domain/spatial/openingSwing.ts`, and ADR-0020,
  connected walls and hosted openings, is accepted.
- **§96 *Editor Interaction Model*** calls the Plan, Renovate and Review perspectives "a PROPOSED
  extension" whose domains "(§97) do not exist yet", and says of the Add catalogue that today Room
  and Area are available and the rest say *not yet*. Two sections later, §97 opens by stating that
  ADR-0021 resolves the existing, planned and work register for the connected workflow.
  `export type Perspective = 'plan' | 'renovate' | 'review'` is in
  `src/presentation/editor/renovation/renovationSession.ts`, five `Review*.vue` components sit
  beside it, and `tests/presentation/editor/stairsArrows.test.ts` asserts thirteen Add catalogue
  entries.
- **§60 *UI Layout*** draws the perspective switch and the Property tree "once their domains exist
  (§96)".

A search for `reserved|PROPOSED|not yet|do not exist yet|once their domains exist` finds seven
lines across the three sections: three in §17, one in §60 and three in §96.

## Why it matters

The SDD is the architectural authority, and `CLAUDE.md` tells every reader to read it before
proposing structure. Read today, it says walls and the review perspective do not exist, which is
the conclusion a scope finding reached during the stack's integration before it was corrected. A
stale authority is believed precisely because it is the authority.

## Approach

Rewrite only the stale sentences, citing ADR-0020, ADR-0021, ADR-0022 and ADR-0023 wherever one of
them now decides, and record the search used to find them in the change. Keep what still holds
under ADR-0017, and keep the absences §97 itself names.

## Acceptance criteria

1. §17's layer tree, §60 and §96 state what the build has, citing ADR-0020 to ADR-0023 where they
   decide it.
2. Every "reserved", "PROPOSED", "not yet", "do not exist yet" and "once their domains exist"
   sentence in the three sections is either still true with its reason stated, or amended. The
   search used is recorded in the change.
3. What still holds under ADR-0017 stays: the two-segment breadcrumb and no Property tree.
4. The absences §97 names stay stated: no Trade repository, no durable cross-file crash recovery,
   and intended-structure transformations limited to existing straight walls and hosted openings.
   Whether that last one still holds now that #111 added curved Room and wall boundaries is
   answered, not assumed.
5. A catalogue entry is called available only where the current Add menu offers it.

## Risks

- Rewriting the SDD to match the code can smuggle in design the code merely happens to have. Cite
  the ADR that decided each sentence, and where none did, say so instead.
- ADR-0017's deferral is easy to smooth over while the breadcrumb sentence is being edited.

## Outcome

A reader of §17, §60 and §96 learns what the merged editor actually has, and what is still deferred
and why.
