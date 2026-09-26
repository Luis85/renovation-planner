# AD12 — Clarify reference calibration, clearance and placement

**Owner:** UX · **Scope:** beta · **Relative size:** M

**Prerequisites:** AD02, AD03, AD07, AD08  
**Exclusive lock groups:** placement-ui, reference-ui. Exact file leases are still required.

## User or delivery outcome

Users understand scale, reserved space and orientation without a CAD vocabulary or false fit assurance.

## Entry points to inspect

- `src/presentation/designer/inspector/DesignerInspector.vue (integration lease only)`
- `src/presentation/designer/tools/set-anchor-tool.ts`
- `src/presentation/designer/tools/set-facing-tool.ts`
- `Existing reference/background and calibration pipeline`

These are investigation/ownership entry points, not blanket edit permission. Resolve actual files and leases in AD00/dispatch; proposed files are not claimed to exist.

## Implementation work

1. Provide a guided reference sequence: choose local image/supported PDF page, calibrate known length, lock reference, trace, inspect dimensions.
2. Use Placement point and Front direction labels with centre/back-centre/custom choices mapped to the existing coordinate convention.
3. Display footprint, graphics and clearance distinctly. Preserve arbitrary traced clearance polygons; do not pretend every outline is represented by four numeric setbacks.
4. Offer a rectangular-clearance helper only for supported geometry and explicitly author a boundary; defaults are illustrative, not standards.
5. Implement persisted review state where required by AD01 after relevant dimension/orientation changes. Calibrated, manually entered and independently verified remain different claims.
6. Check plan-placement transform behavior and return context with the integration owner.

## Acceptance criteria

- [ ] Asset calibration does not modify any plan calibration or already measured coordinate group.
- [ ] Back centre is actually opposite the displayed front, including after rotation/mirroring.
- [ ] Replacing/deleting a reference does not silently mark measured geometry unscaled or erase pending warnings.
- [ ] Resize never weakens a clearance silently; a required review survives reopening.
- [ ] No green “fits well” or compliance claim is produced from a visual preview.
- [ ] Height remains descriptive; no vertical clash calculation is introduced.

## Required verification

- Calibration isolation, mixed pending flags and reference replacement tests.
- Anchor/facing transform fixtures for 0/90/180/270-degree placement and mirror operations.
- Review-state round-trip and missing-reference recovery.

## Handoff and integration gate

Use [TASK-REPORT.md](../templates/TASK-REPORT.md). Record exact base/candidate/integrated commits, contract revision, files changed, tests and exit codes, acceptance coverage, screenshots where relevant, and all verification not performed. Apply [DECISIONS.md](../contracts/DECISIONS.md) and the task-specific requirements above.

No task is verified until its actual integration wiring and relevant consumers pass the required checks. The worker cannot waive missing dependencies, future-schema refusal, negative cases or a real-host test by declaring completion.
