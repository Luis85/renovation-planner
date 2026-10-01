# AD10 — Implement grouping, alignment, distribution and repeat

**Owner:** DOMAIN · **Scope:** beta · **Relative size:** L

**Prerequisites:** AD02, AD04, AD08, AD09  
**Exclusive lock groups:** domain, composition. Exact file leases are still required.

## User or delivery outcome

A user can build a recognizable multi-part object through a few deliberate operations.

## Entry points to inspect

- `src/domain/asset/ (pure composition operations)`
- `src/presentation/designer/selection/`
- `src/presentation/designer/inspector/ (proposed multi-selection actions)`
- `Existing reversible shape-write command path`

These are investigation/ownership entry points, not blanket edit permission. Resolve actual files and leases in AD00/dispatch; proposed files are not claimed to exist.

## Implementation work

1. Add shallow group/ungroup without changing world coordinates, canonical element order or procurement semantics.
2. Implement alignment to selection bounds or an explicitly chosen reference part, with stable tie-breaking and visible reference choice.
3. Implement centre/edge distribution with defined gap behavior; retain endpoints and refuse undefined operations.
4. Add duplicate/repeat with explicit count and spacing, bounded inputs, fresh IDs, remapped groups and deterministic redo.
5. Add group move/rotate/proportional scale and bring-to-front/back while preserving internal order; do not silently reorder on Group itself.
6. Compute the complete operation through pure functions, validate once at the aggregate boundary and dispatch one reversible result.

## Acceptance criteria

- [ ] Grouping and ungrouping produce no visual jump, geometry change or quantity change.
- [ ] Any invalid participant refuses the whole edit; no half-aligned group is persisted.
- [ ] Undo/redo restores IDs, membership, order and geometry together.
- [ ] A reference part chosen for alignment remains fixed.
- [ ] Repeat distinguishes centre spacing from edge gap and previews the intended result.
- [ ] Curved groups and mixed coordinate-space groups obey the contracts rather than bypassing geometry safety.

## Required verification

- Table-driven align/distribute tests with equal bounds, rotated parts, zero extents and locked elements.
- Duplicate/repeat undo/redo and fresh-ID tests.
- Group then ungroup invariance; graphical changes leave purchase/quantity inputs unchanged.

## Handoff and integration gate

Use [TASK-REPORT.md](../templates/TASK-REPORT.md). Record exact base/candidate/integrated commits, contract revision, files changed, tests and exit codes, acceptance coverage, screenshots where relevant, and all verification not performed. Apply [DECISIONS.md](../contracts/DECISIONS.md) and the task-specific requirements above.

No task is verified until its actual integration wiring and relevant consumers pass the required checks. The worker cannot waive missing dependencies, future-schema refusal, negative cases or a real-host test by declaring completion.
