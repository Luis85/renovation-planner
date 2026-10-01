# AD16 — Harden, document and release the asset-designer beta

**Owner:** QA · **Scope:** beta · **Relative size:** M

**Prerequisites:** AD15  
**Exclusive lock groups:** release, quality-config. Exact file leases are still required.

## User or delivery outcome

Deliver a bounded beta with evidence, recovery guidance and no hidden unfinished controls.

## Entry points to inspect

- `Existing CI/test/harness configuration (integrator-owned)`
- `RELEASING.md`
- `docs/tests/`
- `docs/requirements/Asset designer.md`
- `Current user-documentation and changelog paths`

These are investigation/ownership entry points, not blanket edit permission. Resolve actual files and leases in AD00/dispatch; proposed files are not claimed to exist.

## Implementation work

1. Benchmark the defined small/medium/large fixtures, rapid undo chains and repeated leaf open/close. Fix measured bottlenecks rather than adding caches/workers speculatively.
2. Complete accessibility checks: keyboard alternatives, focus visibility/order, accessible names, numeric field errors and reduced-motion behavior where relevant.
3. Run moderated novice tasks against explicit usability targets; record observations and revise confusing interactions.
4. Document creation, composition, precision limits, clearance meaning, live shared edits, revision limitations, supported geometry/export formats and recovery.
5. Prepare changelog, known limitations, migration/backup warning and release checklist. Do not publish, tag or push without the user’s release authorization.
6. Consolidate execution evidence into current repo conventions and mark only proven use cases done.

## Acceptance criteria

- [ ] All core tasks through AD15 are integrated and verified on the candidate commit.
- [ ] No unresolved critical/high issue remains; lower issues have an explicit disposition.
- [ ] Performance figures name hardware, viewport, fixture size and measurement method.
- [ ] No theme, file-size, test-coverage or static-analysis gate was weakened to pass.
- [ ] Fresh install, legacy upgrade and backup-based recovery are exercised or explicitly block readiness.
- [ ] The release notes accurately describe what is implemented, verified and deferred.

## Required verification

- Full package gates and security audit; distinguish baseline issues from introduced regressions.
- Performance, leak, keyboard, compact-pane and usability matrix.
- Real-vault upgrade/reopen/recovery tests on disposable data.

## Handoff and integration gate

Use [TASK-REPORT.md](../templates/TASK-REPORT.md). Record exact base/candidate/integrated commits, contract revision, files changed, tests and exit codes, acceptance coverage, screenshots where relevant, and all verification not performed. Apply [DECISIONS.md](../contracts/DECISIONS.md) and the task-specific requirements above.

No task is verified until its actual integration wiring and relevant consumers pass the required checks. The worker cannot waive missing dependencies, future-schema refusal, negative cases or a real-host test by declaring completion.
