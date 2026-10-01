# Subagent orchestration runbook

## 1. Operating model

One lead agent owns baseline selection, contract acceptance, task dispatch, shared-file leases, merge order and the evidence ledger. Use at most three implementation workers at once. A read-only reviewer may examine a candidate in parallel; avoid multiple full test suites competing for the same machine/resources.

Independent work requires independent worktrees/branches, test data, harness ports and generated outputs. Workers never share a live Obsidian vault. Do not assume a subagent tool exists: use the same prompts sequentially when the host offers no parallel delegation. Do not simulate independent reviews by relabeling the same unverified output.

## 2. Bootstrap

Read all applicable repository instructions, including AGENTS.md where present and CLAUDE.md, then this plan and AD00. Inspect `git status --short`; preserve user changes. The reviewed SHA is a reference, not a checkout/reset instruction.

Choose an integration branch from the actual approved local baseline. These Git commands are examples; run them only after checking path/branch collisions and protecting existing work:

```sh
git status --short
git rev-parse HEAD
git worktree list
git worktree add -b asset-designer/integration ../rp-asset-integration HEAD
```

Do not force-create/reset a branch, `git reset --hard`, clean untracked files, delete user changes or force-push. A linked worktree keeps a separate checkout; it does not protect a shared branch from careless Git operations. [W04]

The initial execution state intentionally has no selected local baseline and no accepted contract. The readiness helper should offer AD00, not all implementation work.

## 3. Audit and contract gates

Dispatch AD00 read-first. Record baseline results and screenshots without altering product code. AD01 then resolves the interface/state/schema/geometry decisions and updates the real ADR/spec/requirement references. Accept one contract revision with explicit ownership.

Before dispatching AD02 or later, the lead must know: exact start commit; current schema versions; supported exporters/revision consumers; present mobile behavior; and whether the current designer controls are already superseded by newer work.

Update `execution/state.json` with the actual chosen baseline and accepted contract revision. Status changes require evidence. The helper does not validate Git history or prove tests passed.

## 4. Dispatch a worker

Select a dependency-ready task from `execution/manifest.json`, then check path/lock ownership. Use `scripts/ready-tasks.mjs` as a planning aid. Give the worker:

```text
Task ID and task-card path:
Base/integration commit:
Accepted contract revision:
Branch and worktree:
Allowed files/directories:
Exclusive shared-file leases, if any:
Prohibited files:
Required tests and acceptance scenarios:
Report destination:
```

Create its branch from the accepted integration commit, not from an arbitrary stale main branch. Example after contract integration:

```sh
git worktree add -b asset-designer/ad02 ../rp-asset-ad02 asset-designer/integration
```

This command uses the current integration branch tip; record that resolved SHA in the worker brief. Re-resolve after each wave. Do not change a branch already checked out by another worker.

Install/test using the repository-supported environment and lockfile. Do not run a deployment/test-build script until its destination is proven disposable. Assign different ports when running multiple harness instances, and inspect the actual harness script before adding flags.

## 5. Worker execution

The worker reads its brief, contracts, related current code and tests; proposes a small implementation sequence; reproduces relevant baseline behavior; implements only its assigned delta with tests; then reports evidence. It does not mark its own task verified, push, publish, add dependencies, change schema independently or alter someone else's files.

If a file outside scope is needed, send a change request naming the file, owner, requested operation and dependency impact. Stop only the affected slice; useful independent tests/documentation may continue. Do not carry an unannounced scope expansion into the merge.

A contract change is raised before implementation: state the reason, affected consumers, migration effect and test effect. The lead accepts a new contract revision and updates all affected worker briefs. Never have two active “equivalent” interpretations.

## 6. Review and integrate

A worker handoff contains the exact base/branch/commit, changed files, acceptance coverage, test commands/exit codes, screenshots where relevant, known limitations and integration wiring. The reviewer uses prompts/02-REVIEWER.md against the actual diff and tests.

Integrate one accepted branch at a time in dependency order. Use the repository's normal merge strategy; do not mix ad hoc cherry-picks and merges that duplicate the same changes. Resolve shared root/runtime/locales/schema wiring under one owner.

After integration, run targeted tests and the required broader gates. Verify mounted controls, not just build success. Record the new integration SHA and evidence. Only then may a dependent task consume that result. Review after rebasing or conflict resolution, because the tested patch has changed.

Every task has two distinct questions: was it merged, and was the merged result verified? The execution state keeps `integrated` and `verified` separate. The readiness helper requires `verified` dependencies.

## 7. Shared-file and lock policy

Lock groups in the manifest are conservative scheduling hints. Exact file leases override broad directory assumptions, but only the lead can grant them. The following are shared by default: root view wiring, runtime/context, overlapping inspector/store files, tool registration, locales, plugin composition, schema-version fields, package/lockfiles, test/CI configuration and central docs.

For components built in isolated files, the worker still owes integration. It may provide a wiring change request for the lead, but the task cannot become verified while its control is unmounted or unreachable. Do not “solve” dead-code/reachability checks by importing the component only in tests or suppressing analysis.

## 8. Verification and evidence

Preserve current package scripts. At the reviewed baseline:

```sh
npm run check:fast
npm run check
npm run audit
```

`check` covers build, lint, coverage and analysis; `audit` is a separate gate. Resolve exact harness invocation and browser availability from current scripts. Do not invent `npm run test:e2e` or claim browser tests ran from jsdom component tests. [R02]

Evidence names commit, environment, fixture, action, expected/actual result and test layer. “Not run” remains not run. A screenshot is useful visual evidence but cannot validate a millimetre measurement, serialized state or a history race by itself.

## 9. Recovery from interrupted work

On restart, read prompts/04-RESUME.md, execution state, leases, worker reports and Git status/worktree list. Reconcile actual commits against the ledger. Never relaunch a task over active uncommitted work without assessing ownership.

For an unmerged failed task, retain its branch/report and create a bounded fix. For a merged regression, use a reviewed fix/revert that respects dependent changes; do not reset history. For new persisted schema data, code rollback is not data rollback. Restore test data from verified backups or follow the accepted migration recovery plan.

## 10. Stop conditions

The default run ends at AD16 with a release candidate, evidence and known limitations—not an automatic public release. AD17 and advanced roadmap work require explicit scope activation. Block a release for data loss, incorrect unit/scale, false save state, unsafe historical output, broken essential controls or missing required verification.

If tests or an actual Obsidian session cannot be run, hand over implemented work and exact remaining verification steps, but do not label the beta ready. Do not substitute a promise of future work for the present execution report.
