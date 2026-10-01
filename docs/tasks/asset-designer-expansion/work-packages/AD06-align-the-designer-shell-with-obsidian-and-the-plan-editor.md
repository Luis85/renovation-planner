# AD06 — Align the designer shell with Obsidian and the Plan Editor

**Owner:** UX · **Scope:** beta · **Relative size:** M

**Prerequisites:** AD01  
**Exclusive lock groups:** shell. Exact file leases are still required.

## User or delivery outcome

A familiar canvas-led workspace presents Add, Parts and contextual properties without overwhelming the user.

## Entry points to inspect

- `src/presentation/designer/AssetDesignerRoot.vue (integration lease only)`
- `src/presentation/designer/DesignerToolbar.vue`
- `src/presentation/designer/DesignerViewMenu.vue`
- `src/presentation/designer/inspector/DesignerInspector.vue`
- `Actual designer styles and locale files resolved in AD00`

These are investigation/ownership entry points, not blanket edit permission. Resolve actual files and leases in AD00/dispatch; proposed files are not claimed to exist.

## Implementation work

1. Implement a restrained header with asset name, library return, actual save state, and contextual Use in plan action; no account/logo chrome.
2. Introduce Add/Parts navigation and contextual inspector slots using existing controls and tokens. Keep dormant future features out of the visible toolbar.
3. Use selection as the resting mode, with discoverable Add actions and temporary pan behavior aligned to the current Plan Editor.
4. Collapse panels into drawers according to available leaf width, not browser window width; keep canvas and recovery actions reachable.
5. Preserve loading, missing asset, invalid sidecar, stale read, unscaled and save-failure states through the redesign. Integrate mounted components rather than leaving standalone demos.

## Acceptance criteria

- [ ] The user can identify the current object, selection, measurement state and save state without opening a menu.
- [ ] Existing tools remain reachable; every enabled control performs a real operation.
- [ ] No duplicated Save/Publish mechanism or green fit-certification state is introduced.
- [ ] Host light/dark themes and neighboring surfaces remain coherent without hardcoded theme assumptions.
- [ ] At compact desktop leaf widths, controls do not overlap the drawing or disappear offscreen.
- [ ] Focus returns predictably after dialogs/drawers; shortcuts do not capture input from notes or fields.

## Required verification

- Component reachability/mounting tests and keyboard focus tests.
- Visual checks at wide, medium and compact leaf widths in both host themes.
- Regression screenshots for empty, selected, error and stale states.

## Handoff and integration gate

Use [TASK-REPORT.md](../templates/TASK-REPORT.md). Record exact base/candidate/integrated commits, contract revision, files changed, tests and exit codes, acceptance coverage, screenshots where relevant, and all verification not performed. Apply [DECISIONS.md](../contracts/DECISIONS.md) and the task-specific requirements above.

No task is verified until its actual integration wiring and relevant consumers pass the required checks. The worker cannot waive missing dependencies, future-schema refusal, negative cases or a real-host test by declaring completion.
