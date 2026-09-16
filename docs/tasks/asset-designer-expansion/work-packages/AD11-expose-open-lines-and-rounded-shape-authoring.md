# AD11 — Expose open lines and rounded-shape authoring

**Owner:** CANVAS · **Scope:** beta · **Relative size:** M

**Prerequisites:** AD02, AD04, AD05, AD08, AD10  
**Exclusive lock groups:** geometry-tools, domain. Exact file leases are still required.

## User or delivery outcome

Users can draw seams and recognizable rounded details without abusing closed polygons.

## Entry points to inspect

- `src/presentation/designer/tools/registerDesignerTools.ts`
- `src/presentation/designer/tools/ (proposed line/polyline tools)`
- `src/domain/asset/ (primitive builders)`
- `src/presentation/designer/inspector/ (supported geometry properties)`

These are investigation/ownership entry points, not blanket edit permission. Resolve actual files and leases in AD00/dispatch; proposed files are not claimed to exist.

## Implementation work

1. Expose line and polyline tools backed by AD04 geometry; define click-to-add, completion, cancel and snapping behavior.
2. Add rounded-rectangle creation with validated radius, reusing circular arc representation where exact. Store parameter intent only if subsequent edits can maintain it honestly.
3. Retain existing rectangle/circle/detail tracing and bending; improve discovery instead of reimplementing them.
4. Keep style controls restrained and preserve solid/dashed meaning. Open paths are strokes without closed-region fills.
5. Use shared tool registration/reachability tests, one-gesture history, and complete renderer/export coverage before showing the controls.
6. Defer arbitrary Bézier editing, freehand smoothing, native ellipses and SVG import to separate approved increments.

## Acceptance criteria

- [ ] An open polyline remains open after save, reopen, duplication, grouping and export.
- [ ] One line stroke with zero width or height can be valid without applying the closed-area validator.
- [ ] Radius bounds are explicit; changed dimensions cannot produce invalid corner geometry.
- [ ] All new tools are mounted, accessible and cancellable; completion returns to Select unless repeat is explicit.
- [ ] No fake thin polygon or silently flattened unsupported geometry is written.
- [ ] Unsupported property fields are absent or explain their limitation rather than doing nothing.

## Required verification

- Full author → edit → save → reopen → place/export tests for each new kind.
- Tool reachability and completion/cancel gesture tests.
- Closed geometry regression suite after the new discriminant is introduced.

## Handoff and integration gate

Use [TASK-REPORT.md](../templates/TASK-REPORT.md). Record exact base/candidate/integrated commits, contract revision, files changed, tests and exit codes, acceptance coverage, screenshots where relevant, and all verification not performed. Apply [DECISIONS.md](../contracts/DECISIONS.md) and the task-specific requirements above.

No task is verified until its actual integration wiring and relevant consumers pass the required checks. The worker cannot waive missing dependencies, future-schema refusal, negative cases or a real-host test by declaring completion.
