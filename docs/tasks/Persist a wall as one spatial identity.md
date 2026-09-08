---
type: Task
parent: "[[Walls and hosted openings]]"
order: 10
status: Done
horizon: "MVP"
release: "[[MVP]]"
---

# Persist a wall as one spatial identity

## Evidence

M04 and M07 require selectable, reloadable walls, while the current sidecar persists polygons
only and the vertical-slice model reserves wall geometry as an unimplemented kind.

## Why it matters

An editor-only segment cannot be linked to an opening, planned outcome or canonical work.

## Approach

Define the minimum wall identity and valid world geometry, carry it through one completed
command, and round-trip metadata plus geometry through the canonical repositories without
changing room-first Zone persistence.

## Acceptance criteria

- One successful command creates one stable wall identity.
- Metadata and geometry reload to the same wall.
- Invalid or partial writes never appear as a saved wall.
- The wall is queryable without a canvas.

## Risks

Choosing a geometry shape before ADR-SO settles could create an incompatible sidecar contract;
the task must implement the accepted representation, not invent one.

## Outcome

A wall persists as a straight centre-line segment with a stable identity in the `.rpgeo`
sidecar's v2 structure, reloads to the same wall, is queryable without a canvas, and never
appears as a saved wall from an invalid or partial write.

## Closing evidence

**2026-09-08**, the plan-editor stack — landed in 3d08d22a (#86, `codex/connected-walls`,
ADR-0020).

A wall is a straight centre-line segment in the `.rpgeo` sidecar's v2 `structure`, written by
`StructureCommand` under the plan lock; no note is created for it.

Criterion 1 — **one command creates one stable identity** — and criterion 2 — **metadata and
geometry reload to the same wall** — are `tests/application/commands/structureCommand.test.ts`'s
'creates walls plus the Room as one history item; reloads the same IDs through a fresh stack'.
`tests/infrastructure/obsidian/repositories/structurePersistence.test.ts`'s 'migrates v1
idempotently in memory and never rewrites legacy notes or polygons on read' is the other
direction: a v1 sidecar with no structure loads without being rewritten.

Criterion 3 — **invalid or partial writes never appear as a saved wall** — is 'validates before
writing and preserves a draft command after a recoverable failure', 'compensates Room creation
when the structure write fails (%s)' and 'refuses missing sidecar reads and catches thrown reads
without writing' in the same file, with `structurePersistence.test.ts`'s 'rejects malformed
spatial schema and valid-shaped dangling hosts before mutation' and 'refuses a future schema %i
without writes' at the repository.

Criterion 4 — **queryable without a canvas** — is `tests/domain/spatial/structure.test.ts` (a
document read with no Konva anywhere in the environment) and, on the surface, the persistent
keyboard list that `tests/presentation/editor/structureLifecycle.test.ts`'s 'traces a temporary
loop, operates every numeric field, creates its Room and uses list selection and deletion focus'
selects from.

Not in this slice, by its own PR body and not by a defect: curves, implicit crossing or T-junction
splitting, door swing, and automatic Room-outline synchronisation after a wall edit — Room outlines
stay manually maintained (ADR-0020's independent-outline rule, completion-matrix row G05).
