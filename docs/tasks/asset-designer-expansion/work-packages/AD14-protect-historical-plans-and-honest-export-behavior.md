# AD14 — Protect historical plans and honest export behavior

**Owner:** INTEGRATION · **Scope:** beta · **Relative size:** L

**Prerequisites:** AD05, AD13  
**Exclusive lock groups:** revisions, exports. Exact file leases are still required.

## User or delivery outcome

Asset edits cannot silently alter a plan that the product claims is frozen or issued.

## Entry points to inspect

- `docs/requirements/Plan revisions.md (resolve current implementation in AD00)`
- `Current plan approval/revision/export consumers`
- `src/application/queries/GetAssetDesign.ts`
- `Existing asset/revision persistence ports`

These are investigation/ownership entry points, not blanket edit permission. Resolve actual files and leases in AD00/dispatch; proposed files are not claimed to exist.

## Implementation work

1. Resolve actual shipped revision capability. Extend its snapshot/version-pinning mechanism where it exists; do not invent an independent designer revision database.
2. Capture all render-relevant asset state: footprint, graphic elements, groups where meaningful, clearance, placement point, facing and descriptive height, plus stable source identity.
3. Ensure a frozen consumer does not re-read mutable catalogue geometry or mutable export-affecting metadata on reopen/export.
4. Where freezing is not implemented, explicitly gate any unsupported “approved/frozen” handover claim and document the dependency; a live draft preview must say it is live.
5. Test deletion/renaming of the live definition and older revision data, not just edits to the main polygon.
6. Provide rollback/recovery instructions aligned to current revision and sidecar schemas.

## Acceptance criteria

- [ ] For every shipped frozen/issued workflow, edit the live asset and prove the historical render/export remains reproducible.
- [ ] Changes to anchor, facing, graphics, clearance or height cannot bypass the preservation rule.
- [ ] Where no frozen workflow exists, no new UI promises one and the explicit capability gate has tests.
- [ ] Draft live-reference behavior remains distinct and continues to work.
- [ ] Existing exports report unsupported geometry/data rather than silently dropping content.
- [ ] Recovery does not rely on a thumbnail as the only surviving object definition.

## Required verification

- Freeze → edit every asset attribute → reload/export → compare stored geometry and supported deterministic outputs.
- Delete/move current definition and render the frozen state.
- Test capability-gated unimplemented revision paths separately from real frozen-state tests.

## Handoff and integration gate

Use [TASK-REPORT.md](../templates/TASK-REPORT.md). Record exact base/candidate/integrated commits, contract revision, files changed, tests and exit codes, acceptance coverage, screenshots where relevant, and all verification not performed. Apply [DECISIONS.md](../contracts/DECISIONS.md) and the task-specific requirements above.

No task is verified until its actual integration wiring and relevant consumers pass the required checks. The worker cannot waive missing dependencies, future-schema refusal, negative cases or a real-host test by declaring completion.
