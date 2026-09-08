# Element completion and composed service fault boundaries

Date: 2026-09-07. Bounded contribution on `codex/element-lifecycle-completion`,
based on combined editor checkpoint `cd362dd06b1f8f82668a92411dc67d14cade5b8d`.
Integration and the complete quality gate belong to PR #91.

## Retained drafts and retired leaves

Four new tests mount the actual editor and outline form over real commands and repository
adapters backed by FakeVault. They verify:

- A peer deletes the edited Path, ordinary hydration removes its selection and Inspector
  opener, and native Cancel returns focus to the connected Details rail. Cancellation
  dispatches no write and leaves the peer's vault contents intact.
- An Object with four distinct collinear corners retains its invalid draft and validation
  message without dispatching. Corrected corners save once, and Undo restores the original
  geometry and spatial metadata.
- A captured outline form dispatch after leaf disposal returns the existing stale-write
  refusal without writing, reopening a dialog or restoring the preview.
- An initial edit read that rejects after leaf disposal produces no late fault notice,
  operation notice, dispatch or preview.

These cases pass on the integrated production lifecycle behavior. They do not establish
new production defects. The initial focused run's sole assertion failure assumed an empty
optional element collection was present; the repository correctly omits it after deleting
the last element. The assertion was corrected to check absence of the deleted identity.

## Composed service guards

Fifteen new cases construct the actual plugin composition root, Project Work services and
Quote services. Injected repository exceptions exercise Trade/Supplier list and create,
Quote read and save, Project Work listing and renovation baseline reads. The tests assert
the mapped technical fault and single structured log, unchanged vault contents, and no
published mutation on failed creation/save. Explicit creation/save retries retain their
identity and succeed once the repository is available. Real Work execute/undo write faults
remain handled inside `RenovationCommand`; these are not claimed as outer-guard catches.
Failed settings recovery leaves downstream persistence services unavailable.

Both new files use explicit jsdom environments because they load browser-hosted editor or
plugin composition. This was their environment from creation; no environment or coverage
configuration was changed to alter counters. The Work Workspace stub is unused by these
cases, which do not exercise navigation.

## Shared structural baseline recovery

`structureActions.ts` now uses one baseline preparation function for edit and removal.
It reports a failed read, compares the fresh geometry with the displayed projection, and
returns any required read-only recovery separately from a usable snapshot. Matching
baselines return synchronously, preserving the existing lifecycle/selection checks before
opening an edit. Stale refreshes remain awaited within the action's existing catch/finally,
and still happen before a missing-structure or missing-target return.

The first extraction left a six-line caller clone. Consolidating the baseline failure and
staleness decisions removed it: Fallow's repository duplication scan reports zero clone
groups with the existing configuration and existing intentional clone exception unchanged.

## Verification boundary

The final five-file Vitest run passed all 46 tests in 30.18 seconds: the two new files plus
`structureActions.test.ts`, `structureLifecycle.test.ts` and `structureSourceRecovery.test.ts`.
`vue-tsc --noEmit`, whole-tree Oxlint, scoped ESLint for all three changed TypeScript
files, and `git diff --check` passed after the final production refinement.
Machine reports remain in `%TEMP%/rp-e-lifecycle-first.json`,
`rp-e-lifecycle-corrected.json`, `rp-e-lifecycle-final.json` and
`rp-e-lifecycle-dupes-final.json`. All heavy checks were serialized with the other editor
contributors. This contribution adds no
browser, timing, heap, live Obsidian or screen-reader acceptance claim. The final integrated
browser capture and complete coverage/health gates remain separate requirements. No
thresholds, exclusions, skips or suppressions were changed.
