---
type: Task
parent: "[[Plans and background import]]"
order: 10
status: Done
horizon: "MVP"
release: "[[MVP]]"
dependsOn: "[[Scale calibration]]"
---

# Persist Reference plan layer configuration

## Evidence

M06 requires source, page, crop, rotation, opacity, lock and scale-related state to distinguish
draft setup from the prior committed reference.

## Why it matters

A reference that changes after reload cannot be trusted for tracing or comparison.

## Approach

Define one persisted reference configuration over the existing Plan background/geometry storage,
adding schema fields only where required. Map it through DTOs, migrations and repositories while
preserving old vaults. Test full round trips, versioning and unknown user content.

## Acceptance criteria

- Every committed configuration field round-trips.
- Existing valid references still load or migrate through a tested path.
- Draft setup values never overwrite committed configuration.
- The Reference remains separate from editable geometry.

## Risks

Adding optional fields without testing old notes can silently redefine schema behavior.

## Outcome

The Reference plan is a stable, reloadable layer rather than an ephemeral image.

## Closing evidence

**2026-09-08**, the plan-editor stack — landed in 0c51dcc3 (#85, ADR-0019).

The committed configuration is `reference-appearance` (source, page, crop, rotation, visibility,
lock) in the Plan note's frontmatter at schema v2, beside the calibration the sidecar already held.

Criterion 1 — **every committed field round-trips** — is
`tests/application/commands/plan/configurePlanReference.test.ts`'s 'commits one coherent
configuration, publishes in both directions, and reloads through a fresh stack', and on the
surface `tests/presentation/editor/referenceWorkflow.e2e.test.ts`'s 'accepts pointer endpoints,
persists hidden/unlocked appearance and seeds layer visibility on refresh'.

Criterion 2 — **existing valid references still load or migrate through a tested path** — is the
read-only v1→v2 step: `tests/infrastructure/persistence/referencePlanMigration.test.ts`'s
'upgrades legacy metadata only in memory and preserves its absent appearance and calibration',
'writes v2 for prepared references and prevents a legacy reader from dropping transforms' and
'refuses malformed appearance and future versions instead of defaulting silently'. An old
reference keeps its previous rendering; nothing rewrites its note on read.

Criterion 3 — **draft setup values never overwrite committed configuration** — is
`configurePlanReference.test.ts`'s 'does not write before confirmation and makes repeated
execute/undo no-ops' and the e2e's 'preserves the committed reference when replacement is
cancelled, including page changes and another distance'.

Criterion 4 — **the Reference stays separate from editable geometry** — is the two files:
appearance in the note, geometry in the `.rpgeo` sidecar, each conditioned on its own version
('refuses a peer change to %s before commit without overwriting it', over both). The review's P1
on #85 was here: `digest.ts` still derived the plan's owned keys from the v1 schema, so a sync
editing `reference-appearance` without touching `revision` was invisible to external-modification
detection and `plans.save` would have overwritten it. 6670aa27 derives the owned keys from
`PlanFrontmatterSchemaV2`; `tests/infrastructure/obsidian/repositories/digest.test.ts` derives its
expected key set from V2 too, so its generated 'moves the token when its own reference-appearance
changes' case was red before the change.
