# AD15 — Validate the complete custom-object workflow

**Owner:** QA · **Scope:** beta · **Relative size:** M

**Prerequisites:** AD09, AD10, AD11, AD12, AD13, AD14  
**Exclusive lock groups:** integrated-e2e. Exact file leases are still required.

## User or delivery outcome

Demonstrate the promised product journey on the integrated branch rather than isolated components.

## Entry points to inspect

- `Existing browser harness and Playwright scripts`
- `tests/ paths resolved in AD00`
- `docs/tests/cases/`
- `Disposable test-vault fixture`

These are investigation/ownership entry points, not blanket edit permission. Resolve actual files and leases in AD00/dispatch; proposed files are not claimed to exist.

## Implementation work

1. Run the vanity, bench, repeated-slats and legacy-asset scenarios in ACCEPTANCE-AND-QA.md against integrated code.
2. Cover all S00–S11 states and both themes; verify keyboard alternatives, compact panes, error recovery and cross-leaf behavior.
3. Compare canonical data before/after each operation, including purchase and plan-calibration invariants.
4. Run a real Obsidian smoke test separately from the browser harness. Capture host navigation, remount/rebind and leaf cleanup behavior.
5. Return defects with reproductions, expected/actual behavior, commit, fixtures and severity; re-run impacted scenarios after fixes.

## Acceptance criteria

- [ ] Every claimed capability is reached from a real visible control in the running plugin or is explicitly not yet verified.
- [ ] Whole workflow passes on the exact integration SHA, not merely individual task branches.
- [ ] No unresolved data-loss, scale, incorrect-save, frozen-state or unreachable-control defect remains.
- [ ] Test evidence separates browser harness automation, unit tests, visual review and real-vault manual execution.
- [ ] Screenshot approval never substitutes for geometry, persistence or failure-path assertions.

## Required verification

- Execute the complete acceptance matrix and record pass/fail/not-run.
- Run npm run check and npm run audit under the repository environment.
- Re-test post-merge fixes with a clean disposable vault and existing migrated fixtures.

## Handoff and integration gate

Use [TASK-REPORT.md](../templates/TASK-REPORT.md). Record exact base/candidate/integrated commits, contract revision, files changed, tests and exit codes, acceptance coverage, screenshots where relevant, and all verification not performed. Apply [DECISIONS.md](../contracts/DECISIONS.md) and the task-specific requirements above.

No task is verified until its actual integration wiring and relevant consumers pass the required checks. The worker cannot waive missing dependencies, future-schema refusal, negative cases or a real-host test by declaring completion.
