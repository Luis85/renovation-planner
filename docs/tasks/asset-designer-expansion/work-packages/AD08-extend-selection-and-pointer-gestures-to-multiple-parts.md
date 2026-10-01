# AD08 — Extend selection and pointer gestures to multiple parts

**Owner:** CANVAS · **Scope:** beta · **Relative size:** L

**Prerequisites:** AD03, AD04, AD06  
**Exclusive lock groups:** selection, canvas-input. Exact file leases are still required.

## User or delivery outcome

Users can select and manipulate several graphic parts predictably, including by keyboard-accessible alternatives.

## Entry points to inspect

- `src/presentation/designer/selection/designerSelection.ts`
- `src/presentation/designer/stores/assetDesignStore.ts`
- `src/presentation/designer/tools/designer-select-tool.ts`
- `src/presentation/designer/designerKeys.ts`
- `src/presentation/designer/DesignerCanvas.vue (integration lease only)`

These are investigation/ownership entry points, not blanket edit permission. Resolve actual files and leases in AD00/dispatch; proposed files are not claimed to exist.

## Implementation work

1. Implement a selected-part set plus a focused/primary part; retain stable IDs across refreshes and prune deleted IDs.
2. Add additive selection, marquee selection, selected count and deterministic overlapping-object selection with an accessible alternative.
3. Keep footprint/clearance/anchor/facing special selections separate from bulk graphic composition. Offer explicit Edit footprint and Select whole object actions.
4. Implement pointer capture, drag thresholds, cancellable preview, out-of-bounds release and keyboard nudging; suppress click-after-drag selection errors.
5. Preserve existing point/bend modes for one eligible closed element. Multi-selection presents group-level actions rather than invalid individual fields.
6. Use shared snapping conventions with screen-space tolerance and visible targets; never auto-snap across incompatible unscaled spaces.

## Acceptance criteria

- [ ] Canvas and Parts selection observe the same model, not two synchronized copies.
- [ ] No modifier is required for the only available route to multi-select.
- [ ] Clicking inside the current multi-selection preserves it until the user intentionally changes it.
- [ ] A finished drag is one write/history entry; Escape/pointercancel is none.
- [ ] Locked/temporarily hidden parts are handled consistently and can still be found/unlocked in Parts.
- [ ] External edits or deleted selected elements do not cause commands to target a different part.

## Required verification

- Selection reducer and hit-test tests; rotated geometry, zoom extremes and overlapping parts.
- Pointer sequences including pointercancel, Escape, blur, release outside leaf and stale queued data.
- Keyboard field-vs-canvas focus tests and two-leaf isolation.

## Handoff and integration gate

Use [TASK-REPORT.md](../templates/TASK-REPORT.md). Record exact base/candidate/integrated commits, contract revision, files changed, tests and exit codes, acceptance coverage, screenshots where relevant, and all verification not performed. Apply [DECISIONS.md](../contracts/DECISIONS.md) and the task-specific requirements above.

No task is verified until its actual integration wiring and relevant consumers pass the required checks. The worker cannot waive missing dependencies, future-schema refusal, negative cases or a real-host test by declaring completion.
