# AD00 — Reconcile the live repository and establish the baseline

**Owner:** ARCH · **Scope:** beta · **Relative size:** S

**Prerequisites:** None; audit is the entry point.  
**Exclusive lock groups:** baseline. Exact file leases are still required.

## User or delivery outcome

Produce an evidence-backed delta between this plan and the checkout before any production changes.

## Entry points to inspect

- `CLAUDE.md`
- `docs/development/sdds/obsidian-renovation-planner-SDD.md`
- `docs/development/agent-guide-increment-history.md`
- `docs/requirements/Asset designer.md`
- `package.json`
- `src/presentation/designer/`
- `src/infrastructure/persistence/dto/assetGeometry.ts`

These are investigation/ownership entry points, not blanket edit permission. Resolve actual files and leases in AD00/dispatch; proposed files are not claimed to exist.

## Implementation work

1. Record branch, HEAD, dirty state, supported Node version, dependency lockfile, baseline build/test/lint/analyzer results, and access to a disposable Obsidian vault.
2. Trace each existing capability from visible control to tool, command, validator, storage adapter, renderer and tests. Classify it as retain, improve, missing, obsolete or unverified. Resolve actual infrastructure paths by imports; do not infer them from shortened docblocks.
3. Inventory every AssetDetail/AssetShape consumer, including library thumbnails, placed instances, hit-testing, snapping, exports and any revision snapshots. Find the symbols spec and record existing decisions about arc stretching and presets.
4. Capture the running designer and neighboring Plan Editor in light/dark themes when runnable. Record screenshot/test limitations rather than fabricate a visual audit.
5. Map these execution IDs to the existing Asset Designer epic and its use cases. Record overlap with ongoing branches and designate a single integration branch.

## Acceptance criteria

- [ ] The selected baseline is an exact commit; the dated review SHA is not used to reset or overwrite newer work.
- [ ] Every existing feature has a disposition and evidence; already completed work is not reimplemented.
- [ ] All current rendering/export consumers and supported persistence versions are listed.
- [ ] The baseline report distinguishes passed, failed and not run; no claim of a clean build is inferred from documentation.
- [ ] The current approval/revision behavior and any mobile entry gate are resolved before scope is finalized.

## Required verification

- Run the existing package gates on the selected baseline; preserve exact commands and exit codes.
- Inspect one legacy sidecar and one current fixture without editing a real vault.
- Check current view registration/reachability tests and harness invocation.

## Handoff and integration gate

Use [TASK-REPORT.md](../templates/TASK-REPORT.md). Record exact base/candidate/integrated commits, contract revision, files changed, tests and exit codes, acceptance coverage, screenshots where relevant, and all verification not performed. Apply [DECISIONS.md](../contracts/DECISIONS.md) and the task-specific requirements above.

No task is verified until its actual integration wiring and relevant consumers pass the required checks. The worker cannot waive missing dependencies, future-schema refusal, negative cases or a real-host test by declaring completion.
