---
type: Task
parent: "[[Link planned outcomes to canonical work]]"
order: 30
status: New
horizon: "MVP"
release: "[[MVP]]"
dependsOn: "[[Resolve canonical work from spatial context]]"
---

# Keep planned outcome and work links intact

## Evidence

The PRD's stable-reference and deletion rules apply at both ends of the Planned-to-Task link;
M10 expects navigation in both directions.

## Why it matters

A renamed task must remain linked, while a deleted endpoint must not leave a relationship that
looks actionable.

## Approach

Put the relationship under the canonical reference-integrity policy, preserve it across ordinary
task edits and renames, and require an explicit resolution before deleting a referenced endpoint.

## Acceptance criteria

- Renaming or editing a task preserves the relationship.
- Re-linking the same pair is a no-op.
- Deleting either endpoint reports the referent and applies only an explicit valid resolution.
- Reload and undo preserve one coherent relationship state.

## Risks

Automatic cascade deletion would erase planning intent; silent retention would leave dangling
work. Both directions require explicit policy.

## Outcome

Not started.
