# AD09 — Add a Parts panel for finding and organizing the object

**Owner:** UX · **Scope:** beta · **Relative size:** M

**Prerequisites:** AD08  
**Exclusive lock groups:** parts. Exact file leases are still required.

## User or delivery outcome

Users can find, name and isolate small parts without precision clicking.

## Entry points to inspect

- `src/presentation/designer/ (proposed Parts component files)`
- `src/presentation/designer/inspector/DesignerSelectionInspector.vue`
- `src/presentation/designer/stores/assetDesignStore.ts (integration lease only)`

These are investigation/ownership entry points, not blanket edit permission. Resolve actual files and leases in AD00/dispatch; proposed files are not claimed to exist.

## Implementation work

1. Build a Parts view over the canonical selection contract: physical footprint, graphic parts/groups, clearance, placement and reference.
2. Allow user labels without changing stable preset semantic names. Reflect canonical visual ordering.
3. Implement transient edit locks and visibility/isolation in leaf-local UI preferences, clearly separate from final symbol content.
4. Provide keyboard navigation, rename, explicit move forward/back actions for parts, and accessible group expansion.
5. Preserve selection/focus after rename, removal, grouping and refresh; show a meaningful empty panel state.

## Acceptance criteria

- [ ] Selecting a row selects the same part on canvas and vice versa.
- [ ] Rename survives a file round-trip while preset semantic identifiers remain unchanged.
- [ ] Editing isolation does not remove content from placement, quantities or export.
- [ ] User can unlock/find a hidden part without hunting on the canvas.
- [ ] Parts never imply separate procurement units or prices.
- [ ] Group rows do not create a second rendering order or a Konva layer per row.

## Required verification

- Component keyboard tests, rename round-trip and focus restoration.
- Canvas/Parts integration for hidden, locked and deleted selections.
- Snapshot order checks with interleaved grouped and ungrouped parts.

## Handoff and integration gate

Use [TASK-REPORT.md](../templates/TASK-REPORT.md). Record exact base/candidate/integrated commits, contract revision, files changed, tests and exit codes, acceptance coverage, screenshots where relevant, and all verification not performed. Apply [DECISIONS.md](../contracts/DECISIONS.md) and the task-specific requirements above.

No task is verified until its actual integration wiring and relevant consumers pass the required checks. The worker cannot waive missing dependencies, future-schema refusal, negative cases or a real-host test by declaring completion.
