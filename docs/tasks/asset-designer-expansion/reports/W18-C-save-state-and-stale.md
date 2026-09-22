# Task report — W18-C

Outcome: implemented
Owner / worktree / branch: W18-C / `.worktrees/ad14` / `w18c-save-state-and-stale`
Base commit / candidate commit: `2dbc7b39a` / the single commit on that branch
Accepted contract revision: `docs/tasks/asset-designer-expansion/contracts/DECISIONS.md`, C08 — "A write is complete only according to a defined outcome … Saved must not imply that a stale canvas is current."
Allowed scope and shared-file leases: the designer root, header, runtime and design store; `SaveStateIndicator.vue` and `save-state-store.ts` (SHARED with the Plan Editor); both `editorShell.ts` locales; `tests/presentation/designer/**`; the save-state tests; this report.

**One lease path does not exist as written.** The card leases `tests/presentation/editor/save-state/**`; the directory on disk is `tests/presentation/editor/saveState/`, and `saveStateIndicator.test.ts` — the file that lease is plainly about — is the one edited there. No file was created under either spelling.

**Two leased files were NOT touched, deliberately**: `save-state-store.ts` (the fix needs no new state — the qualifier stays derived, exactly as SDD companion §2.5 asks) and `{en,de}/editorShell.ts` (no new key was minted; see "Copy" below).

## Changed files and reason

| File | Purpose | Within lease? |
|---|---|---|
| `src/presentation/editor/save-state/SaveStateIndicator.vue` | **SHARED.** One optional `stale` prop, ORed into the qualifier expression it already had; docblock rewritten from "No props" to what the prop is for and why the two stores cannot answer for the designer. | Yes |
| `src/presentation/designer/DesignerHeader.vue` | Takes `stale` and forwards it to `<SaveStateIndicator :stale="stale" />`. | Yes |
| `src/presentation/designer/AssetDesignerRoot.vue` | Passes its existing `staleAfterRefresh` computed to the header, so the label and the strip are one expression rendered twice. | Yes |
| `src/presentation/designer/runtime.ts` | Finding 2: the `writesBlocked` comment's false clause narrowed. Behaviour unchanged. | Yes |
| `tests/presentation/designer/designerSaveStateStale.test.ts` (new) | The red case: the real root, a real peer-provoked read-back failure, both surfaces asserted together. | Yes |
| `tests/presentation/editor/saveState/saveStateIndicator.test.ts` | The shared component's own prop contract, both arms, plus the qualifier's non-application over a save error raised from the prop. | Yes (see the lease-path note above) |

## The fix shape, and why

`SaveStateIndicator` derived its qualifier from `useProjectStore().stale` and `usePlanningReadState()`. `grep -rn "useProjectStore\|usePlanningReadState" src/presentation/designer/` prints **zero hits**, and `AssetDesignerView` calls `app.use(createPinia())`, so on the designer both sat at their defaults forever: `save-state.saved-refresh-needed` was **unreachable on that surface**, and the header read a flat `Saved` directly above the strip saying the canvas could not be re-read.

Shapes considered:

1. **An optional prop on the shared component (taken).** The designer's staleness is a fact the designer owns; the component ORs it into the expression it already had. A caller that passes nothing behaves exactly as before, which is every Plan Editor mount.
2. **Teach `SaveStateIndicator` a second store.** Refused: `assetDesignStore` has no business being constructed inside a Plan Editor's Pinia, and it would make the shared component know which surface it is on.
3. **Scope it to the designer's header — its own label, no shared change.** Refused: it duplicates the derivation and the mark/word rendering, and then two components answer "is my work safe" in two places that can drift.
4. **`provide`/`inject` a staleness source.** Refused as machinery: one prop, one forward, one binding is the whole of it.

**Copy: no new key, and that was checked rather than assumed.** `save-state.saved-refresh-needed` reads `Saved · refresh needed` / `Gespeichert · Aktualisierung nötig` — it names no subject, so it is correct over an asset. The keys that DO name one (`editor.refresh-failed` says "this plan", `designer.refresh-failed` says "this asset") stay per-surface, which is exactly why each surface keeps its own strip.

## Both staleness surfaces are KEPT, not collapsed

The card asks what each answers that the other does not.

- The **header label** is the standing STATE: "is my work safe?" — `Saved`, qualified. It sits in the `<header>` region, which carries no live region, and it is what a user glances at.
- The **`.rp-designer-notice` strip** is the announced SENTENCE: what happened, and about what — "This asset could not be re-read after the last change; what you see may be out of date." It is `role="status"`, so a screen reader hears it when it appears; the label is silent on change.

This is not AD18-R1's shape. That ruling was about the asset's NAME drawn twice — the same string answering the same question. Here the precedent is the Plan Editor's, pinned rather than argued: `tests/presentation/editor/stalePath.e2e.test.ts` asserts the identical pair under its own comment, *"The two surfaces that say so, in the two places a user looks."* Collapsing them on the designer would make the two surfaces disagree across the repository.

What DID collapse is the number of definitions: the strip and the label are now the same `staleAfterRefresh` computed, so they cannot drift.

## Finding 2 — the comment, narrowed

`runtime.ts`'s `createEditorContext` comment claimed the surface "has no `ProjectStore` and no re-read that can go stale over an asset's own design". The second clause was false: `assetDesignStore` declares `const stale = ref(false)` and sets it on a keep-on-failure re-read. It is narrowed to the true claim — no `ProjectStore`, and no tool this surface registers asks `writesBlocked()` — with the staleness stated as real and the behaviour question named as reported rather than answered.

**`writesBlocked: () => false` is UNCHANGED**, and finding 1's fix did not need it changed. `designerRefresh.test.ts`'s `answers false for writesBlocked, which this surface builds but never asks` still pins it through the real context, and still passes.

**Reported, not fixed:** whether a designer write SHOULD be blocked while the canvas is stale is a genuine open question — the Plan Editor blocks, and C08's "a retry after an uncertain write must reconcile before repeating it" points the same way. It is a behaviour change with its own gesture-level test surface and does not belong folded into a comment repair.

## Acceptance coverage

| Criterion/test ID | Result | Exact evidence | Remaining issue |
|---|---|---|---|
| C08: `Saved` must not imply a stale canvas is current (designer) | Pass | `designerSaveStateStale.test.ts` › `qualifies Saved rather than claiming the canvas is current, beside the strip that says why` — asserts `store.stale === true`, the strip's text and the label `Saved · refresh needed`, in one case | — |
| The qualifier retires with the strip | Pass | same file › `drops the qualifier again once a re-read lands` | — |
| The shared component's prop contract, both arms | Pass | `saveStateIndicator.test.ts` › `takes a caller-supplied staleness, and says nothing about one when no prop is passed` | — |
| The qualifier applies to `saved` alone, whichever source | Pass | same file › `does not say refresh needed over a save error from the prop either` | — |
| Plan Editor unaffected | Pass | `stalePath.e2e.test.ts` and all of `tests/presentation/editor/shell/` green (38 files / 412 tests, below) | — |
| Finding 2: comment narrowed, behaviour untouched | Pass | `designerRefresh.test.ts` › `answers false for writesBlocked…` still green | The behaviour question above |

## The red, verbatim

Before the fix, with the new file's two cases in place (`npx vitest run tests/presentation/designer/designerSaveStateStale.test.ts`):

```
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  |suite| tests/presentation/designer/designerSaveStateStale.test.ts > the designer header over a canvas it cannot confirm > qualifies Saved rather than claiming the canvas is current, beside the strip that says why
AssertionError: expected 'Saved' to be 'Saved · refresh needed' // Object.is equality
Expected: "Saved · refresh needed"
Received: "Saved"
 FAIL  |suite| tests/presentation/designer/designerSaveStateStale.test.ts > the designer header over a canvas it cannot confirm > drops the qualifier again once a re-read lands
AssertionError: expected 'Saved' to be 'Saved · refresh needed' // Object.is equality
Expected: "Saved · refresh needed"
Received: "Saved"
      Tests  2 failed (2)
```

Both failures are at the label assertion, with `store.status === 'ready'`, `store.stale === true` and the refresh-failed strip already asserted above them — so the red is the defect and not a broken rig.

And the shared component's own case, watched red by deleting the new `props.stale === true` arm from `shown` and then restoring it:

```
 FAIL  |suite| tests/presentation/editor/saveState/saveStateIndicator.test.ts > the derived Saved · refresh needed label > takes a caller-supplied staleness, and says nothing about one when no prop is passed
AssertionError: expected 'Saved' to be 'Saved · refresh needed' // Object.is equality
Expected: "Saved · refresh needed"
Received: "Saved"
      Tests  1 failed | 17 passed (18)
```

## Branches added

Exactly **one** new branch arm in `src/`, and both of its outcomes are driven:

| Branch | True driven by | False driven by |
|---|---|---|
| `props.stale === true` — the new middle arm of `state.value === 'saved' && (projectStale.value \|\| props.stale === true \|\| planning.failed)` in `SaveStateIndicator.vue` | `designerSaveStateStale.test.ts` (both cases) and `saveStateIndicator.test.ts` › `takes a caller-supplied staleness…` (prop `true`) | every existing Plan Editor case that mounts with no prop and reaches this arm, plus that same new case's `setProps({ stale: false })` and its `without` mount |

Nothing else added a branch, on purpose:

- `stale?: boolean` on `SaveStateIndicator` and on `DesignerHeader` compiles to a props declaration, not a conditional — no default expression, no `??`.
- `:stale="staleAfterRefresh"` in `AssetDesignerRoot` binds a computed that already existed and was already covered.
- `runtime.ts` changed comment text only.
- No guard was added that no case reaches.

## Executed checks

| Command or manual action | Commit / environment | Exit code or observed result | Evidence |
|---|---|---|---|
| `npx vitest run tests/presentation/designer/designerSaveStateStale.test.ts` (pre-fix) | worktree `ad14`, Windows | 1 — 2 failed | quoted above |
| `npx vitest run tests/presentation/editor/saveState/saveStateIndicator.test.ts` (new arm deleted) | same | 1 — 1 failed / 17 passed | quoted above |
| `npx vitest run tests/presentation/designer/designerSaveStateStale.test.ts` | same, post-fix | 0 — `Test Files 1 passed (1) / Tests 2 passed (2)` | terminal |
| `npx vitest run tests/presentation/editor/saveState/` | same | 0 — `6 passed (6) / 109 passed (109)` | terminal |
| `npx vitest run tests/presentation/editor/stalePath.e2e.test.ts tests/presentation/editor/shell` plus `designerHeader`, `assetDesignerRoot`, `regionsReachable`, `designerRefresh` | same | 0 — `38 passed (38) / 412 passed (412)` | terminal; this is the shared-file blast-radius run |
| `npx oxlint` over all six changed files | same | exit 0, no output | terminal |
| `npx eslint` over the three changed `.vue` files | same | exit 0, no output | terminal |

## Verification not performed

- **`npm run check` (build + full lint + coverage-thresholded suite + fallow) — NOT run.** The card forbids it: shared 7.8 GB machine, other cards running, CI in flight. CI on the pull request is where it runs.
- **`npm run test:coverage` — NOT run**, same reason. The branch accounting above is by enumeration rather than by a `coverage-final.json` read of the changed files, which is the weaker instrument; the enumeration is small enough to audit by eye and the one new arm has named drivers on both sides.
- **`vue-tsc` / `npm run build` — NOT run** (heavy gates the card forbids). The typing risk this leaves is the new test file's `ReturnType<typeof mount>` rig type and the two new prop declarations. CI's `build` leg type-checks `tests/**` and will report.
- **`npm run analyze` (fallow) — NOT run**, forbidden. The change adds no export and no module, so the `unused-exports`/`unused-files` exposure is nil, and the `private-type-leak` surface is unchanged (the new `Rig` interface is test-local and not exported).
- **`npm run harness` / `npm run harness-shot` — NOT run.** No layout, spacing or colour changed: the qualified label uses `.rp-save-state-saved-refresh-needed`, a class `styles/editor-status.css` already declares and the Plan Editor already renders. Worth one capture of the designer header in its stale state if a later card is taking pictures anyway.
- **`npm run test-build` in a real vault — NOT run.** No Obsidian API is touched.
- **Accessibility (`tests/harness/accessibility*.test.ts`) — NOT run.** No role, live region or accessible name changed; the label's text changes and it was already the component's whole accessible name.
- **German copy — not reviewed by a speaker.** No new German string was written; the existing `save-state.saved-refresh-needed` translation is reused unchanged.

## Data and integration implications

Schema/migration change: none.
Relevant renderer/export/revision consumers: none — presentation only.
Undo/no-op/conflict/failure coverage: the failure path is the one under test (a keep-on-failure re-read). Undo/redo untouched; `writesBlocked` untouched.
Identity/unit/quantity/calibration invariants: untouched.
Shared root/runtime/locales wiring still required: none. No locale key was added, so no `en`/`de` pairing is outstanding.
Rollback/recovery considerations: reverting the commit restores the previous (wrong) label; nothing persists and no stored value changes shape.

## Reviewer and integrator acceptance

Reviewer outcome and findings:
Integrated commit:
Post-integration checks/evidence:
Final status: integrated / verified / blocked

Only the integrator/reviewer fills final acceptance. A worker's completion statement is not this field.
