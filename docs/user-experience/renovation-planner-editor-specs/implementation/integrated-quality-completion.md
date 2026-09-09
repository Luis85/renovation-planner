# Integrated editor quality — PR #115

Scope: complete the implementation and automated quality step on `codex/editor-deliver-quality`. PR #117's `remaining-plan.md` was read from `codex/editor-release-remaining-plan`; its visual/native acceptance and whole-editor completion remain separate. No PR #116 acceptance journeys, browser drivers, screenshots or release deliverables are incorporated by this follow-up.

## Integrated source and reconciliation

- Starting PR #115: `2259f0a577f4673e2d834148036e03b3ca095792`.
- Updated PR #114: `b17b418c5a72ebd7054724859895425819f18772`, integrated by merge `2b29d194`.
- Worktree: `.worktrees/editor-deliver-quality`. Main and downstream branches remain untouched.
- Both review submissions and inline review threads were empty at the initial inspection. The old CI run `34326626504` failed at six conditional-expect lint findings in `groupPointerRotation.test.ts`; PR #114's updated test already fixes those findings.
- The merge retains exact padded group names, the additional singleton target regression, the unified selection preview and the narrowed Room-dimension geometry. The version-6 schema remains exported because updated group-storage compatibility tests consume that public schema.

## Behavior and lifecycle corrections

- Structure no-ops return without a sidecar write or structure event. The existing history contract still records a successful command even when its result is `no-write`; Undo remains a no-write as well. UI gesture admission continues to avoid constructing unchanged movement commands.
- Shared spatial-command exception handling detects a completed applied-state transition before an unexpected failure, marks retained writes as uncompensated and retires the command. Retries cannot repeat a successful structure write after publication failure. Command-specific write, Room compensation, ledger and event ordering remain in their existing commands.
- Numeric rotation, wall rotation, element editing and wall/opening editing track reactive context generations. Selection round trips, tool/perspective changes, relevant projected geometry/metadata changes, cancellation and disposal retire captured callbacks. Read-only and disabled states use the same captured generation as dispatch and preview admission.
- Saved-group operations retire their captured generation when the operation ends, including cancellation with an unchanged selection.
- The existing component extractions, public form contracts, native structure, focus behavior and rendered layout are retained.

## Regressions and inherited failures

The initial integrated `npm run check` stopped at the missing version-6 schema export. A focused diagnostic run then reproduced all seven inherited Room/Zone/Inspector failures and ten newly tested lifecycle/command defects (17 failures, 51 passes). The inherited tests referred to pre-existing UI contracts: rotation arrows now require idle hover, the empty floor uses the delivered setup state, the layer toggle has its current component structure, and the blocked Create hint must be located by its actual `aria-describedby` ID rather than by a class shared with a persistent hint.

The focused corrections to those four test files and `zoneEditingHandles.ts` match the previously reconstructed corrections in PR #116. They are incorporated individually to repair PR #115's demonstrated failures, retaining vertex counts, rotation-handle assertions, repository/selection/Undo checks, marker visibility and ARIA assertions. No acceptance bundle is imported.

New command and runtime tests cover stale callbacks after cancel, selection/tool/perspective changes, disposal and projected peer changes; visible form refusal; no-write behavior; publication failure and write/event ordering. Existing integrated regressions cover curved boundaries, hosted-opening movement, group transforms, member deletion, singleton previews and dimension labels, enclosure, Stair/Arrow precision, compensation, readback recovery and exact repeated history.

## Follow-up session (type repair and fresh verification)

The three source corrections this step had made — element-edit and numeric-rotation `inputBlocked`
following the captured context generation rather than the write gate, an explicit stale-write
refusal on the element deletion path, and saved-group menu actions retiring with the operation
generation they were listed under — were on disk but had never been type-checked. Their five
companion test files did not compile: an `expectErr` over a union of two error types, a
`SessionWriteLedger` parameter handed the runtime's `WriteLedger`, and two assignments to
`EditorStore.pointerWorld`, which is a computed and read-only (`setPointer` takes the screen
point instead). One `unicorn(no-array-reverse)` finding stood beside them. All are repaired;
`vue-tsc -noEmit` and whole-repository `oxlint --deny-warnings` are clean.

Those corrections are what turn this branch's three published CI failures green:
`elementDeletionLifecycle` (the deletion baseline refusal now reports), `elementRecovery` and
`elementRetryFailures` (a read-paused outline stays editable, because the write gate no longer
freezes the field while context retirement still does).

`spatialActionGuards.test.ts` adds regressions for the refusal and retirement contract this step
consolidated: a refused wall read opening no impact review, a selected record that hosts no wall
opening none either, an impact review naming a room the plan no longer holds by its stored
identity, a wall-review failure reported as a fault leaving no preview, a refused element
deletion leaving the stored element in place, and grouping a plan that stores no saved groups.

### Automated verification, this head

- Full serial `test:coverage` (`VITEST_MAX_WORKERS=1`): **745 files, 8,761 passed, 70 skipped, 0
  failed**, 2,472s. That run's tree is exactly the source and the five repaired test files
  committed here. `spatialActionGuards.test.ts` was written after it and is verified alongside
  the eight files it shares subject matter with: **9 files / 56 tests passed**.
- `vue-tsc -noEmit`, `oxlint --deny-warnings` over the repository, and `eslint .` all pass.
- Coverage measured **99.03% statements, 97.70% branches, 99.07% functions, 99.53% lines**.
  Statements, functions and lines clear their floors; **branches remains under its 98% floor by
  48 covered branches**. That shortfall is inherited rather than introduced — PR #114's base
  measures 97.30% — and the gap is spread thin across roughly 150 files at one to eight arms
  each. Closing it is being handled on the upstream concern branches; the coverage packages
  drafted here for modules those branches own are deliberately not committed.
- Fallow's coverage-weighted health step has **not** been validly measured on this head. Targeted
  diagnostic runs overwrote `coverage/coverage-final.json` with a subset, so its 470-item report
  describes that subset and not this branch. It needs a re-run against a full coverage report.

Automated verification is in progress; the final receipt below will record only fresh results from the integrated source. Diagnostic logs are outside the repository in the system temporary directory. Coverage uses the normal ignored `coverage/` directory. Check scripts, assertions, thresholds, timeouts, lint rules and exclusions are unchanged.

## Acceptance ownership

Manual acceptance is user-owned and pending. No Obsidian or desktop control, manual browser walkthrough, screenshot acceptance, vault access or manual-test confirmation was performed or requested. This does not block the implementation step. No merge, release, downstream-branch update or whole-editor completion is authorized or claimed.
