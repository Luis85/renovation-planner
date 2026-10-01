# AD03 — Unify command sequencing, undo and recovery behavior

**Owner:** SESSION · **Scope:** beta · **Relative size:** L

**Prerequisites:** AD01  
**Exclusive lock groups:** session, history. Exact file leases are still required.

## User or delivery outcome

Fast user actions and two open leaves cannot cause silent overwrites, misleading Saved states or inconsistent undo.

## Entry points to inspect

- `src/presentation/designer/selection/editShape.ts`
- `src/presentation/designer/runtime.ts`
- `src/presentation/designer/designerCommands.ts`
- `src/application/editor/asset/`
- `src/application/queries/GetAssetDesign.ts`

These are investigation/ownership entry points, not blanket edit permission. Resolve actual files and leases in AD00/dispatch; proposed files are not claimed to exist.

## Implementation work

1. Trace all write doors. Put shape edits, preset replacement, dimension replacement, background changes, height edits and history barriers under one coherent per-leaf sequencing policy.
2. Preserve distinct noteVersion and geometryVersion checks. Capture subject and intent before queuing; read the relevant canonical state at the correct execution boundary.
3. Keep pointer previews ephemeral; commit one whole validated result per completed gesture. Ensure no-op outcomes do not enter history.
4. Prevent queue reentrancy/deadlocks: code already inside the chain must call unqueued primitives. Fence undo/redo against writes and refreshes rather than wrapping the queue around itself.
5. Route thrown faults and coded refusals through existing error/logging policy. Handle failed read-back, external changes, deletion, view teardown and retries without pretending success.

## Acceptance criteria

- [ ] A queued move followed by resize composes correctly; undo cannot overtake an unsettled write.
- [ ] Every new composite action is all-or-nothing at the shape-document boundary.
- [ ] Two leaves editing one asset use expected versions and surface a conflict instead of last-writer-wins.
- [ ] A successful write with failed refresh displays stale content honestly; retries do not duplicate a mutation.
- [ ] Closing/rebinding a view does not leak listeners or write a queued action into a different asset.
- [ ] Multi-resource operations are not advertised as atomic unless a real recovery protocol supports them.

## Required verification

- Fault-injection tests before write, after write/before refresh, on refresh, on inverse write and during close.
- Burst sequence: draw → nudge → replace preset → undo → redo; assert order and history count.
- Test expected-version mismatch separately for note and sidecar.

## Handoff and integration gate

Use [TASK-REPORT.md](../templates/TASK-REPORT.md). Record exact base/candidate/integrated commits, contract revision, files changed, tests and exit codes, acceptance coverage, screenshots where relevant, and all verification not performed. Apply [DECISIONS.md](../contracts/DECISIONS.md) and the task-specific requirements above.

No task is verified until its actual integration wiring and relevant consumers pass the required checks. The worker cannot waive missing dependencies, future-schema refusal, negative cases or a real-host test by declaring completion.
