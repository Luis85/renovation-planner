# AD13 — Complete the library–designer–plan workflow

**Owner:** INTEGRATION · **Scope:** beta · **Relative size:** L

**Prerequisites:** AD05, AD07, AD12  
**Exclusive lock groups:** library, plan-navigation. Exact file leases are still required.

## User or delivery outcome

An authored object can be reused, edited or duplicated without losing plan context or creating ambiguous changes.

## Entry points to inspect

- `src/presentation/library/`
- `src/presentation/designer/AssetDesignerView.ts`
- `src/presentation/designer/AssetDesignerContext.ts`
- `src/plugin/ (existing asset navigation/composition seams)`
- `Existing asset placement and duplication commands`

These are investigation/ownership entry points, not blanket edit permission. Resolve actual files and leases in AD00/dispatch; proposed files are not claimed to exist.

## Implementation work

1. Implement library → designer → Use in plan and plan → Edit shared asset → return, preserving subject IDs and view context.
2. Use in plan continues into the real placement flow; where no plan is open, offer the existing picker. Cancel creates no placement.
3. Show which editable plans use the definition before impactful changes. Do not introduce an unapproved publish/draft state machine over autosave.
4. Offer Duplicate as new asset, copying valid geometry/metadata with new asset identity and remapped internal identities as required.
5. Keep references correct across renamed/moved library notes and missing assets. Invalidate thumbnails/plan views on relevant asset updates.
6. Coordinate multi-resource duplication failure recovery and historical consumers with AD14.

## Acceptance criteria

- [ ] A measured preset reaches a real plan at its canonical size and orientation.
- [ ] Returning to the original plan preserves selection/viewport as supported by the host state contract.
- [ ] Editing a shared definition has explicit usage scope; a duplicate does not change the original.
- [ ] No asset ID, reference or quantity link points to an orphan after cancel/failure.
- [ ] Graphic parts never become independent purchasable assets automatically.
- [ ] Unsupported mobile navigation follows the actual platform gate instead of opening a broken designer.

## Required verification

- End-to-end library/create/design/place/edit/duplicate round-trips.
- Two projects sharing a definition; verify intentional live update and independent duplicate.
- Failure after note creation/before sidecar save; retry and external deletion tests.

## Handoff and integration gate

Use [TASK-REPORT.md](../templates/TASK-REPORT.md). Record exact base/candidate/integrated commits, contract revision, files changed, tests and exit codes, acceptance coverage, screenshots where relevant, and all verification not performed. Apply [DECISIONS.md](../contracts/DECISIONS.md) and the task-specific requirements above.

No task is verified until its actual integration wiring and relevant consumers pass the required checks. The worker cannot waive missing dependencies, future-schema refusal, negative cases or a real-host test by declaring completion.
