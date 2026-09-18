# Task report — AD13 hand-off (integration change request 1 of AD13's navigation half)

Outcome: **partially implemented** — the hand-off CHANNEL is built end to end from
`ProjectOrigin.assetId` to an armed `AssetPlacementTool`, and the `getState` question the lease
asked is answered and tested. The SENDER is not wired, because the three files that would wire it
are outside this row; they are ICR 1-H below. AD13 acceptance criterion 1 therefore moves from
"unmet, with a trigger" to **"unmet, with a three-file trigger and the receiving half proven"**.

Owner / worktree / branch: AD13 hand-off worker · `.worktrees/ad13c` · `ad13c-asset-handoff`
Base commit / candidate commit: `044e11f52` / **the branch tip of `ad13c-asset-handoff`**, which is round 2's fix commit. Named as the tip rather than as a SHA on purpose: a report that quotes its own commit needs a second commit to do it, and the round-1 version of this line spent one that way. `git log --oneline 044e11f52..ad13c-asset-handoff` is the list
Accepted contract revision: `r1`
Allowed scope and shared-file leases: wave 5's `AD13 hand-off` row —
`application/navigation/ProjectDestination.ts`,
`presentation/editor/renovation/editorArrival.ts`,
`presentation/editor/elements/assetPlacementTask.ts`,
`presentation/editor/elements/spatialEditing.ts`, `presentation/editor/runtime.ts`
(ADDITIVE ONLY), `presentation/views/PlanEditorView.ts` (integrator lease),
`presentation/designer/inspector/DesignerUsePlan.vue` (integrator lease), its own tests plus
`tests/plugin/assetDesignerUsePlan.test.ts`.
**Two of those leases were not used and one test file was not touched** —
`spatialEditing.ts` and `runtime.ts` need no change (see the first row of the table below), and
`tests/plugin/assetDesignerUsePlan.test.ts` tests a seam this row does not own, so nothing in it
could honestly change. `git diff --name-only 044e11f52..HEAD` is the check: it prints nine code
files, every one of them in the row, plus this report under
`docs/tasks/asset-designer-expansion/reports/`.

## Changed files and reason

| File | Purpose | Within lease? |
|---|---|---|
| `src/application/navigation/ProjectDestination.ts` | `ProjectOrigin.assetId`, and `'assetId'` in `projectOriginFrom`'s key whitelist so the value survives the workspace-layout trust boundary instead of being stripped | yes |
| `src/presentation/editor/elements/assetPlacementTask.ts` | The split ICR 1 asked for: `resolvePlaceable(id)` (shape lookup + the existing `REFUSALS` map) and `startDraft(id, answer)` (the `Object.assign` + `setTool('place-asset')`) are lifted out of `pickPlaceable`/`choose`, and `arm(assetId)` is the two of them with no picker between. `choose` keeps its exact behaviour and is now two lines | yes |
| `src/presentation/editor/renovation/editorArrival.ts` | `reveal(origin)` becomes a two-arm dispatcher: an `origin.assetId` arms the placement tool, anything else goes to `revealRecord`, which is the previous body moved unchanged. Without the asset arm an asset-only origin falls through to `notifyWarning(tr('schedule.return-missing'))` — watched, red text below | yes |
| `src/presentation/views/PlanEditorView.ts` | The `getState` answer: `consumeAssetHandoff()`, one call at the end of `setState` | yes (integrator lease) |
| `src/presentation/designer/inspector/DesignerUsePlan.vue` | Hands `design.assetId` to `usePlan`, and the docblock narrows — the channel exists now, the sender does not | yes (integrator lease) |
| `tests/application/navigation/projectDestination.test.ts` | The round trip of an asset hand-off through `projectDestinationState`/`projectRouteFrom`, and the blank-string trim | yes |
| `tests/presentation/editor/editorArrivalAssetHandoff.test.ts` | NEW. The arming arm, the order claim against a record id in the same origin, and both refusals — through the real `navigateToRecord`, the real task and the real asset-shape query | yes |
| `tests/presentation/views/planEditorHostReturn.test.ts` | The one-shot case: neither the workspace layout nor a `rebind` can re-arm | yes |
| `tests/presentation/designer/designerUsePlan.test.ts` | The click now has to carry the asset, and the root's `getAssetDesign` stub stops being thinner than the real query | yes |

### Two leases deliberately unused, and why the second one matters

**`runtime.ts` and `spatialEditing.ts` need no edit at all.** ICR 1 item 3 says the primitive must
be "exposed to `editorArrival` through `spatialEditing.ts`/`runtime.ts`". It already is:
`createSpatialEditing` returns `elementTask` as `Object.assign(createElementTask(...), { assets, promotion })`
and `EditorRuntime.elementTask` is typed `SpatialEditing['elementTask']`, so `runtime.elementTask.assets`
is public reach that four components already take. **The count in the first version of this sentence
was wrong and self-inflating, which is finding 5 of the review.** `grep -rn "elementTask\.assets" src/`
prints **seven** lines at the base commit, across `AddMenu.vue`, `AssetLayer.vue`,
`AssetPlacementDetails.vue` and `AssetPlacementForm.vue`. It prints **nine** at the candidate, and one
of those nine is `editorArrival.ts`'s own docblock sentence about the count — verbatim the shape
CLAUDE.md records for `grep -c "registerView"`. The conclusion is unchanged and correct: the reach
already exists, so no edit is owed. Adding a member to `EditorRuntime` would have been a SECOND way to reach one
task — the shape "one action, every input" refuses — so the ADDITIVE-ONLY grant is returned unused.

**`tests/plugin/assetDesignerUsePlan.test.ts` was untouched in round 1 and that was the review's
most important finding (finding 3).** The reasoning above — "a case asserting the origin would be red
until ICR 1-H lands, so it belongs in that change" — is exactly backwards: the ledger's idiom for a
cross-lease wire is to submit the change request **and write the assertion that fails without it**, so
the integrator applies the lines and that assertion is what turns green. Returning the file unused left
nothing anywhere — no type error, no test, no lint rule — able to fail if ICR 1-H were never applied or
applied wrongly, which is the unwired-callback shape this wave's sub-letting exists to prevent. The two
cases are in the file now and are **RED at this candidate on purpose**; see the fix-round section.

## The `getState` question, answered

The lease offered two defensible answers: exclude `assetId` from `getState`, or clear it once
`useEditorArrival` has consumed it. **Taken: clear it at consumption** (`consumeAssetHandoff`,
one call at the end of `setState`), and `getState` is untouched.

**The reason is measured, not preferred.** Excluding `assetId` from `getState` closes the restart
door and nothing else: `this.origin` would still hold the asset in memory, and `rebind` — what
`saveSettings` calls on every open leaf — unmounts and remounts with `initialNavigation`, so the
placement tool would re-arm on a settings save. That is not hypothetical; it is the second half of
the red below, where the same test with `consumeAssetHandoff` removed reports
`expected "notifyWarning" to be called once, but got 2 times` after a `view.rebind(deps)`.
One rule closes both doors, so one rule is what was written.

**One thing the first version got wrong, kept as a finding rather than smoothed over.** Stripping
`assetId` alone leaves `origin: { planId }` — a shell that names no destination, which
`useEditorArrival` answers with `schedule.return-missing`. That would have traded a re-armed tool
for a spurious warning on every restart. The method now drops the whole origin when nothing but
`planId` remains; the red that found it is below.

**What the claim does NOT cover, said narrowly.** `consumeAssetHandoff` guarantees that `getState`
never emits an `assetId` *after* `setState` returns. It cannot speak for a `getState` Obsidian
might perform DURING `setState` — but there is no `await` between the assignment and the call, and
the one `await` in the method (`navigateToRecord`, on the already-mounted arm) runs while
`this.origin` still holds its previous, already-stripped value. That is a property of reading the
method, not of a test.

## Acceptance coverage

| Criterion/test ID | Result | Exact evidence | Remaining issue |
|---|---|---|---|
| AD13 criterion 1 — a measured preset reaches a real plan at its canonical size and orientation | **receiving half met; still unmet end to end** | `tests/presentation/editor/editorArrivalAssetHandoff.test.ts` → `arms the placement tool with the asset the origin names, and warns about no return record`: `activeToolId === 'place-asset'`, `draft` matching `{ assetId, name: 'Radiator', error: null, conflict: false }`, `draft.shape` non-null, and `notifyWarning` not called. Size and orientation stay `domain/spatial/assetPlacement`'s, untouched | The SENDER does not build the origin — ICR 1-H, three files. Until then the button still navigates and the user picks the asset once more in `AddMenu.vue`'s picker |
| Hand-off refusals are the placement flow's, not the schedule's | **met** | Same file → the two-case `it.each`: an asset with no shape saved gives `editor.asset.no-shape` and an id no catalogue answers for gives `editor.asset.unreadable`, each `toHaveBeenCalledExactlyOnceWith`, with `activeToolId` not `'place-asset'` and `draft.assetId === ''` | A leaf whose `queries.assetShapes` is unbound refuses SILENTLY — the unrecovered-settings session, where no placement of any kind is possible. Stated in `arm`'s docblock |
| The asset arm runs before `recordFor` | **met** | Same file → `prefers the asset over a record id in the same origin, selecting nothing`: an origin with both `assetId` and `roomId` arms the tool and leaves `selection.selectedIds` empty | Nothing in `src/` builds an origin with both; the case exists to pin the ORDER the docblock claims |
| The value survives the workspace-layout trust boundary | **met** | `tests/application/navigation/projectDestination.test.ts` → `round trips the asset a designer hand-off names, and trims a blank one like every other id` | — |
| The lease's `getState` question | **answered and tested** | `tests/presentation/views/planEditorHostReturn.test.ts` → `consumes a designer asset hand-off once, leaving neither the layout nor a rebind able to re-arm it`: `getState()` equals `{ planId }` after arrival and again after `rebind`, and `notifyWarning` stays at one call across both | See "what the claim does NOT cover" above |
| The control hands over the asset it is drawing | **met** | `tests/presentation/designer/designerUsePlan.test.ts` → `reaches the door it was handed, carrying this asset` and `is carried from the leaf context through the root to the inspector`, both `toHaveBeenCalledExactlyOnceWith` the DTO's own `assetId` | The two `usePlan` declarations between the template and the seam are still `() => void` (`grep -rn "usePlan" src/` — exactly two), so the argument is accepted and dropped today |

## Invariants watched failing, with the red verbatim

Every one was watched by reverting the fix, running the named file and restoring it.

**1. `editorArrival`'s asset arm** — the line `if (origin.assetId !== undefined) return runtime.elementTask.assets.arm(origin.assetId);` replaced by a comment.
`npx vitest run tests/presentation/editor/editorArrivalAssetHandoff.test.ts` → exit 1, 4 of 4 failed:

```
AssertionError: expected false to be true // Object.is equality
- Expected
+ Received
- true
+ false
 ❯ tests/presentation/editor/editorArrivalAssetHandoff.test.ts:34:76

AssertionError: expected 'select' to be 'place-asset' // Object.is equality
Expected: "place-asset"
Received: "select"
 ❯ tests/presentation/editor/editorArrivalAssetHandoff.test.ts:54:41

AssertionError: expected "notifyWarning" to be called once with arguments: [ Array(1) ]
Received:
  1st notifyWarning call:
  [
-   "This asset has no footprint yet. Give it one in the asset designer first.",
+   "The original room or record is no longer available. The floor remains open.",
  ]
Number of calls: 1
 ❯ tests/presentation/editor/editorArrivalAssetHandoff.test.ts:74:15
```

The third is ICR 1's own prediction, reproduced: an asset-only origin falls through to
`schedule.return-missing`.

**2. `ProjectOrigin.assetId` in `projectOriginFrom`'s whitelist** — the key list reverted to
`['roomId', 'workId', 'costId']`.
`npx vitest run tests/application/navigation/projectDestination.test.ts` → exit 1, 1 of 15 failed:

```
AssertionError: expected { section: 'schedule', …(1) } to deeply equal { section: 'schedule', …(1) }
- Expected
+ Received
  {
    "origin": {
-     "assetId": "asset-01JABC",
      "planId": "floor",
    },
    "section": "schedule",
  }
 ❯ tests/application/navigation/projectDestination.test.ts:24:60
```

**3a. `consumeAssetHandoff`, the workspace-layout door** — the call removed.
`npx vitest run tests/presentation/views/planEditorHostReturn.test.ts` → exit 1, 1 of 4 failed:

```
AssertionError: expected { …(2) } to deeply equal { Object (planId) }
- Expected
+ Received
  {
+   "origin": {
+     "assetId": "asset-01NOTHERE",
+     "planId": "plan-01M2TH8N681TA2ZRHYERDJNZA8",
+   },
    "planId": "plan-01M2TH8N681TA2ZRHYERDJNZA8",
  }
 ❯ tests/presentation/views/planEditorHostReturn.test.ts:56:27
```

**3b. `consumeAssetHandoff`, the `rebind` door** — the call still removed, and the two `getState`
assertions temporarily relaxed so the run reaches the rebind. Same command → exit 1:

```
AssertionError: expected "notifyWarning" to be called once, but got 2 times
 ❯ tests/presentation/views/planEditorHostReturn.test.ts:58:16
     56|   expect(warn).toHaveBeenCalledOnce();
     57|   view.rebind(deps); sizedShellRoot(view.contentEl); await settle();
     58|   expect(warn).toHaveBeenCalledOnce();
```

This is the measurement behind the `getState` decision: a `getState`-only fix leaves this red.

**3c. The empty-origin shell** — this one was not staged, it was the first version of the method.
With `consumeAssetHandoff` stripping only `assetId` and keeping the rest, the same case reported:

```
AssertionError: expected { …(2) } to deeply equal { Object (planId) }
- Expected
+ Received
  {
+   "origin": {
+     "planId": "plan-01M2TGY5FMMHB620T0TDAN6V1T",
+   },
    "planId": "plan-01M2TGY5FMMHB620T0TDAN6V1T",
  }
```

**4. `DesignerUsePlan.vue`'s hand-over** — `@click="usePlan(design.assetId)"` reverted to
`@click="usePlan"`.
`npx vitest run tests/presentation/designer/designerUsePlan.test.ts` → exit 1, 2 of 7 failed:

```
AssertionError: expected "vi.fn()" to be called once with arguments: [ 'asset-01M2TH7DQBYHACHAM32SRH2YE5' ]
Received:
  1st vi.fn() call:
  [
-   "asset-01M2TH7DQBYHACHAM32SRH2YE5",
+   MouseEvent {
+     "_vts": 1789744363247,
+     "isTrusted": false,
+   },
  ]
 ❯ tests/presentation/designer/designerUsePlan.test.ts:124:19
```

Worth its own sentence, because it is a latent defect this change removes rather than merely a
red: `@click="usePlan"` hands the DOM `MouseEvent` to the door as its first argument. That is inert
against today's `() => void` binding and would become an asset id of `[object MouseEvent]` the
moment ICR 1-H widens the signature.

**5. A fake that was thinner than the real thing**, found while writing case 4 rather than
predicted. `mountRoot`'s `getAssetDesign` stub was `() => Promise.resolve(ok(design()))` — it
ignored the id it was asked for and handed back a design carrying a freshly generated one, where
the real query answers about the id. The first green-looking run of the root-binding case reported:

```
AssertionError: expected "vi.fn()" to be called once with arguments: [ 'asset-01JABC' ]
Received:
  1st vi.fn() call:
  [
-   "asset-01JABC",
+   "asset-01M2TH5W88DZEC7BVMHF16A24X",
  ]
```

The stub now answers about the id it is given.

## Executed checks

**One caveat about the evidence in this table, found late and worth more than it cost.** The first
round of these runs redirected their output into `/tmp/tN.log`, and on this machine `/tmp` is
SHARED between every agent working on this repository. It is not a theory: a log this card wrote
to `/tmp/t11.log` came back holding two failures in
`tests/presentation/designer/designerReferenceView.test.ts`, a file this card never ran, at a
timestamp inside the window this card's run was still queued. So a green read out of a shared path
is not evidence of anything. **Each row below therefore names its PROVENANCE**: `foreground` means
this session read the process's own output directly, `scratchpad` means a log written under this
session's private scratchpad directory, and `shared /tmp` means a row this caveat applies to — kept
rather than deleted, and superseded by the scratchpad re-run beneath it. The remedy for the next
worker is one line: redirect to the scratchpad, never to `/tmp`.

Every RED in the section above is unaffected: each one was read as the failing assertion text
naming this card's own test file and its own line, which is not something another agent's run
could have produced.

| Command or manual action | Provenance | Exit code or observed result | Evidence |
|---|---|---|---|
| `npx vue-tsc --noEmit` | **foreground** | **0** | whole program, `src/**` + `tests/**`; run again after the `revealRecord` extraction |
| `npx vitest run tests/presentation/editor/{assetPlacement.e2e,assetPlacementInspector,itemPromotion.e2e,transformBox.e2e,editorArrival,editorArrivalAssetHandoff}.test.ts` | shared /tmp | **0** | 6 files, 47 tests passed — the `choose`/`replace`/`pickPlaceable` paths the split touches, plus the arrival's existing record arms |
| `npx vitest run tests/presentation/views/{planEditorHostReturn,planEditorView,planEditorReopen}.test.ts tests/application/navigation tests/plugin/assetDesignerUsePlan.test.ts tests/presentation/designer/designerUsePlan.test.ts` | shared /tmp | **0** | 6 files, 62 tests passed |
| `npx vitest run tests/presentation/designer tests/presentation/editor/recordNavigation.test.ts tests/presentation/editor/editorArrivalRecoveryCompletion.test.ts tests/presentation/views/projectDetailArrival.test.ts` | shared /tmp | **0** | 63 files, 871 tests passed — the whole designer surface plus the remaining navigation suites |
| `npx vitest run` over the five files the last two fixes touched (`designerUsePlan`, `editorArrivalAssetHandoff`, `editorArrival`, `planEditorHostReturn`, `tests/application/navigation`) | shared /tmp | **0** | 5 files, 36 tests passed — re-run after the `require-await` and stub-typing corrections below |
| `npx oxlint <the nine changed files>` | **foreground** | **0** | it reported `require-await` on `reveal` first (`Async function has no \`await\` expression`); the fix is the union return type, not a suppression |
| `npx eslint <the nine changed files>` | **foreground** | **0** — after a real red, below | the layer bans, the write boundary, `I18N_LITERAL_BAN`, `NOTICE_TEXT_BAN`, the size and complexity budgets and the Obsidian ruleset, for the changed files only |
| `VITEST_MAX_WORKERS=1 npx vitest run tests/presentation/editor/editorArrivalAssetHandoff.test.ts tests/presentation/views/planEditorHostReturn.test.ts tests/presentation/editor/editorArrival.test.ts` | **scratchpad** | **0** | 3 files, 14 tests passed, 139s. The authoritative run for the hand-off's own cases and the arrival's existing record arms, taken at the candidate commit AFTER the `revealRecord` extraction |
| `VITEST_MAX_WORKERS=1 npx vitest run tests/presentation/editor/{assetPlacement.e2e,assetPlacementInspector,itemPromotion.e2e,transformBox.e2e}.test.ts tests/presentation/designer/designerUsePlan.test.ts tests/application/navigation tests/plugin/assetDesignerUsePlan.test.ts tests/presentation/views/{planEditorView,planEditorReopen}.test.ts` | **scratchpad** | **0** | 9 files, 95 tests passed, 279s. The `choose`/`replace`/`pickPlaceable` paths the split touches, the control's own suite, the origin parser, the untouched seam suite and the two other Plan Editor view suites |
| `npm run check` | — | **not run** | Deliberate, per this session's operating rules: the box is shared and a full gate thrashes `coverage/.tmp` and the `tests/build/` ESLint boots. CI on the pull request is where it runs |

**`VITEST_MAX_WORKERS=1` on the two scratchpad rows is a CONTENTION measure and not a claim about
the tests.** The same five files under default parallelism, on a box carrying 15 other node
processes, produced one `Test timed out in 5000ms` on this card's own heaviest case and, on a
second attempt, `[vitest-pool]: Failed to start forks worker` with no test run at all. Neither is a
defect and no budget was raised: re-run alone, both pass. It is the hazard CLAUDE.md names for
`tests/build/`, met in a different directory.

### One gate red that was NOT a watched invariant, recorded because it changed the code

`npx eslint` on the nine files reported:

```
src/presentation/editor/renovation/editorArrival.ts
  55:2  error  Function 'reveal' has a complexity of 17. Maximum allowed is 16  complexity
```

`reveal` was already AT 16 before this change, so the single `if` the hand-off adds was the
seventeenth branch. The fix is the extraction described in the changed-files table — `reveal`
becomes a two-arm dispatcher and the record path moves to `revealRecord` unchanged — and not a
budget raise, which is not available anyway (`linterOptions.noInlineConfig`). Worth knowing for
the next change to that function: **it has no headroom left**, and `revealRecord` is back at 16.

A second gate red on the way, also real and also fixed at the code:
`oxlint` reported `require-await` on `reveal` when it was written `async` with nothing to await.
The fix is the union return type `boolean | Promise<boolean>`, which also keeps the record arms
out of a microtask they never needed.

## Verification not performed

Never blank, and this environment makes the list long.

- **`npm run test-build` and every manual case under `docs/tests/`.** There is no Obsidian here.
  Nothing in this change has been seen in a vault. That matters more than usual for two of its
  claims: the `rebind` arm is reached by a real `saveSettings` and the restart arm by a real
  workspace-layout restore, and both are modelled here by `FakeLeaf`, which RECORDS asks rather
  than behaving. `docs/tests/suites/Smoke Test the Editor.md` is where a walkthrough would go; none
  was performed.
- **Every capture.** `npm run harness-shot` needs the pinned Chromium, which is not installed, and
  `npx playwright install chromium` is forbidden on this machine. So no layout, spacing, contrast
  or hit-size look at anything — including `DesignerUsePlan`'s button, whose markup this change
  edits.
- **`tests/presentation/designer` as a whole** at the candidate commit. It was run (63 files, 871
  tests green) BEFORE the `revealRecord` extraction and its log went to the shared `/tmp`, so it is
  not claimed here; `designerUsePlan.test.ts` alone was re-run on the scratchpad. The extraction
  touches no designer file, so the risk is low and the statement is still narrower than the run.
- **`npm run check` in full**, and therefore `eslint .`, the coverage floors and `npm run analyze`.
  ESLint ran over the changed files only; the coverage floors were not measured at all, so whether
  the new branches (`arm`'s two arms, `reveal`'s asset arm, `consumeAssetHandoff`'s two) move the
  branch figure is unknown from here. `npm run analyze` did not run either, so no statement is made
  about dead exports or clone families. The one shape that looked like a candidate —
  `pickPlaceable` going dead after the split — was checked by grep and is not one; the Integration
  change requests section carries what the grep printed.
- **The end-to-end gesture**, because the sender does not exist yet (ICR 1-H). What is proven is
  that an origin of `{ planId, assetId }` set on a Plan Editor leaf arms the tool. That an actual
  press of `Use in plan` produces such an origin is not proven by anything, here or in CI, until
  that change lands.
- **No migration, no schema and no performance work** is in this change, so none was run.

**Round 2 (the fix round) adds to this list rather than shortening it.** Every item above still
holds — no Obsidian, no pinned Chromium, no coverage gate — and three more are owed by this round
specifically:

- **The coverage FIGURE for the two branches this round moved.** 7a's case covers
  `resolvePlaceable`'s unbound-query arm and 7b DELETES a branch, so the direction is two units of
  headroom recovered — but `npm run test:coverage` may not be run on this machine, so that is
  arithmetic rather than a measurement and no number is claimed.
- **`npm run analyze`.** Not run. The `Object.keys` deletion removes no export and adds none, and
  no new module was created, so no clone or dead-export statement is made either way.
- **Everything ICR 1-H would prove end to end.** The ICR was applied, type-checked, run and
  REVERTED. What is measured is that it compiles and that it turns this card's two new cases green
  and the two named existing ones red. That an actual press of `Use in plan` in a vault arms the
  placement tool is still proven by nothing, here or in CI, until the ICR lands for real and a
  walkthrough is run.


## Data and integration implications

Schema/migration change: **none.** `ProjectOrigin` is Obsidian's per-leaf ephemeral view state,
not a persisted document — and the one field added to it is now removed before the layout is
written, so the layout's shape does not change at all.

Relevant renderer/export/revision consumers: **none.** Nothing here touches geometry, the asset
sidecar or any of r1 row 4's three consumers.

Undo/no-op/conflict/failure coverage: arming writes nothing to the vault and creates no history
entry — `AssetPlacementTool`'s own `place` is still the only writer, unchanged. A refused hand-off
writes nothing, arms nothing and reports its reason through the existing `REFUSALS` map. A hand-off
arriving while the projection is paused or a save is in flight is held by `useEditorArrival`'s
existing `pending`/watch machinery, not by anything new.

Identity/unit/quantity/calibration invariants: untouched. `arm` resolves through the same
`assetShapes` read model the picker uses, so the `unscaled` refusal (a footprint still in
background pixels) applies identically — C07's "do not invent physical dimensions from placeholder
pixels" is enforced by the same code path, not by a second one.

Shared root/runtime/locales wiring still required: **ICR 1-H below.** No new locale string was
added, so the `assetWorkflow` pair is unchanged and no empty pair is owed.

Rollback/recovery considerations: reverting this commit restores the previous behaviour exactly —
`projectOriginFrom` drops an unknown key, so a workspace layout written by a build that had this
change is read without complaint by one that does not.

## Integration change requests

**ICR 1-H — the SENDER (three files).** This is what closes AD13 criterion 1. Every one of these
was traced in this change and none of them is in this row.

1. `src/plugin/renovationProjectOpenSeams.ts` — `assetDesignerUsePlan(...)` returns
   `() => void`; it needs to return `(assetId: string) => void` and pass an origin on both arms:
   the already-open arm becomes `void openPlan(only, { planId: only, assetId })` and the picker arm
   `await openPlan(plan.id, { planId: plan.id, assetId })`. Nothing else in that function changes —
   `renovationProjectOpenPlan` already has the `origin?: ProjectOrigin` parameter,
   `revealPlanEditor` already forwards it to `prepareEditorArrival`, and that queue sets the state
   on whichever leaf was revealed, including one that was already open. Its "How far this gesture
   reaches" paragraph then stops being true and should narrow.
2. `src/presentation/designer/AssetDesignerContext.ts` — `AssetDesignerDeps.usePlan?: () => void`
   becomes `(assetId: string) => void` (line reached by `grep -rn "usePlan" src/`, one hit in that
   file).
3. `src/presentation/designer/inspector/DesignerInspector.vue` — the same one-token widening on its
   `usePlan?` prop. `AssetDesignerRoot.vue`, `AssetDesignerView.ts` and `assetDesignerDeps.ts` are
   pass-throughs and need no edit; `vue-tsc` is the check that this is true.

   `DesignerUsePlan.vue` needs **no** further change: it already passes `design.assetId`, and its
   docblock's "the two `usePlan` declarations between here and it are still `() => void`" paragraph
   is the sentence to delete when they are not.

   The case to add with it belongs in `tests/plugin/assetDesignerUsePlan.test.ts` (leased to this
   row but left untouched for exactly this reason): assert the origin reaching the leaf on BOTH
   arms, and note that the already-open arm's assertion has to read the state the arrival QUEUE
   wrote, not `revealCandidate`'s — the two are different mechanisms and F3 of AD13's navigation
   half is the record of asserting the wrong one.

**No second ICR.** One was drafted about `pickPlaceable` possibly becoming dead after the split and
is withdrawn on a grep rather than left standing:
`grep -n "pickPlaceable" src/presentation/editor/elements/assetPlacementTask.ts` prints four lines —
the declaration, `choose`, `replace` and the returned member — which is exactly what it printed
before this change, so nothing about its reachability moved. The two functions the split ADDS,
`resolvePlaceable` and `startDraft`, are module-private and appear in no return, so this change
widens the task's public surface by exactly one member (`arm`), which `editorArrival` calls.

**One note for whoever takes ICR 1-H, not a request.** `src/plugin/renovationProjectOpenSeams.ts`'s
`planPicker` docblock already cites `assetPlacementTask.pickPlaceable` by name for its
`dialogs.current !== null` refusal. That citation still resolves — `pickPlaceable` keeps that guard
and the split did not move it — but it is worth re-reading in the same edit, since the function it
names is one the same edit is reasoning about.

## Fix round — what the review found, and what changed

Nine findings, **REQUEST CHANGES**, addressed on top of `5a758f74b` without rebase or amend. The
headline is finding 3: **`tests/plugin/assetDesignerUsePlan.test.ts` now carries two cases that are
RED at this candidate and that ICR 1-H turns green.** That is deliberate and is the point of them;
a reader running that file and finding two failures has found the instrument working, not a defect.

| # | Finding | Disposition |
|---|---|---|
| 1 | ICR 1-H does not compile as written — the `then` closure is built once at composition and has no lexical access to a per-press `assetId` | **Agreed and amended.** The corrected ICR is below in full and uses a closure-scoped slot. It was APPLIED to the three files, `npx vue-tsc --noEmit` was run (exit **0**), the seam suite was run, and all three files were reverted — so "compiles" here is a measurement rather than a reading |
| 2 | ICR 1-H omits that it turns two EXISTING cases red, and that the preserved-selection claim has to be re-derived | **Agreed and amended.** Both reds reproduced verbatim below by applying the ICR; both named in the ICR with their repair, and the re-derivation is written into it |
| 3 | Write the assertion that fails without ICR 1-H | **Agreed and done.** Two cases added; both watched RED at this candidate and watched GREEN under the applied ICR, verbatim text below |
| 4 | False docblock claim in `DesignerUsePlan.vue`'s prop | **Agreed and corrected.** The false clause is deleted; the replacement states the opposite and names the gate that disproves it. `npx vue-tsc --noEmit` exits 0 at this candidate with the wiring absent — run, exit code read |
| 5 | The `elementTask.assets` count is wrong and self-inflating | **Agreed and corrected** in `editorArrival.ts` and in this report's own repeat of it. Seven at base, nine at the candidate, one of the nine being the sentence itself |
| 6 | `arm`'s docblock over-claims, and there may be a live control that can only refuse | **Narrowed, no guard**, per the integrator ruling — the divergence is NOT demonstrable; see below |
| 7a | `resolvePlaceable`'s unbound-query arm is undriven | **Agreed and covered.** One case in `editorArrivalAssetHandoff.test.ts`, watched red |
| 7b | `consumeAssetHandoff`'s `Object.keys(rest).length > 1` arm is unreachable | **Agreed and deleted**, per the ruling. `this.origin = undefined`, one branch recovered |
| 8 | A sentence in `assetDesignerUsePlan`'s docblock became false | **Agreed.** Named explicitly in ICR 1-H, alongside the two others that go false with it |
| 9 | The `revealRecord` extraction is a move, not a decomposition | **Kept stated.** `revealRecord` is at 16 of 16; the next `if` on that path reds. Unchanged by this round |

### Finding 6, measured: the two conjuncts cannot diverge, so no guard was added

`available` is `commands.renovation !== undefined && context.queries.assetShapes !== undefined`, and
`arm` consults only the second — so on paper a leaf with shapes bound and `renovation` unbound arms
a tool whose `write` then refuses silently. **In the real composition root that pair cannot come
apart, and the evidence is one ternary.** `src/plugin/planEditorDeps.ts` decides both off the same
`const persistence = root.persistence`:

- `queries: persistence?.planEditorQueries ?? unavailablePlanEditorQueries()` — and
  `unavailablePlanEditorQueries()` declares no `assetShapes` key at all.
- `commands: persistence ? { ...planningEditorServices(root, vault, workspace), … } : …`, and
  `planningEditorServices`'s first two lines are `const persistence = root.persistence;` /
  `if (!persistence) return {};` — the same condition — after which `renovation:` is bound
  unconditionally.

The other half is bound unconditionally too: `composition-root.ts` builds `planEditorQueries` with
`getAssetDesign: guarded.assetDesign.get`, and `createPlanEditorQueries` spreads `assetShapes` in
whenever `getAssetDesign` is present. So `persistence` present binds both, `persistence` absent binds
neither. A guard in `arm` would cost a branch nothing in `src/` can reach and it can never pay back —
CLAUDE.md's own rule, with roughly nine arms of margin above the 98% floor. **The sentence was
narrowed instead**, and it now names both conjuncts, says `arm` reads only one, says what would happen
if they diverged, and says a test rig composing them independently CAN produce it while nothing in
`src/` can. The smaller over-claim in the same docblock is corrected with it: the
`ViewStateResult.history` verdict reaches `setState` only on the already-mounted arm
(`parsed.planId === this.mountedPlanId && this.root`), and a hand-off that mounts the editor for the
first time falls past that condition with its verdict read by nothing.

### Reds watched in this round, verbatim

**A. Finding 7a's case, with the guard it asserts removed** — `if (!context.queries.assetShapes) return null;`
deleted from `resolvePlaceable` and the call non-null-asserted.
`VITEST_MAX_WORKERS=1 npx vitest run tests/presentation/editor/editorArrivalAssetHandoff.test.ts` →
exit 1, 1 of 5 failed:

```
FAIL  |suite| tests/presentation/editor/editorArrivalAssetHandoff.test.ts > refuses silently when the leaf has no asset-shape query at all
TypeError: context.queries.assetShapes is not a function
 ❯ resolvePlaceable src/presentation/editor/elements/assetPlacementTask.ts:34:41
 ❯ Object.arm src/presentation/editor/elements/assetPlacementTask.ts:112:24
 ❯ reveal src/presentation/editor/renovation/editorArrival.ts:65:91
 ❯ Object.navigateToRecord [as navigate] src/presentation/editor/renovation/editorArrival.ts:30:10
 ❯ tests/presentation/editor/editorArrivalAssetHandoff.test.ts:97:9
```

Guard restored: 5 of 5 pass.

**B. Finding 3's two cases, at THIS candidate — the standing red this card hands off.**
`VITEST_MAX_WORKERS=1 npx vitest run tests/plugin/assetDesignerUsePlan.test.ts` → exit 1,
**2 failed | 13 passed (15)**:

```
FAIL  tests/plugin/assetDesignerUsePlan.test.ts > use in plan > carries the asset into the Plan Editor it continues into
AssertionError: expected undefined to deeply equal { …(2) }

- Expected:
{
  "assetId": "asset-01M2TPTQ4MVMW0ACXY3A9076D7",
  "planId": "plan-01M2TPTQ4HN6SBK60BSZWRZM5B",
}

+ Received:
undefined

 ❯ tests/plugin/assetDesignerUsePlan.test.ts:367:41

FAIL  tests/plugin/assetDesignerUsePlan.test.ts > use in plan > carries the asset into the plan it picked
AssertionError: expected undefined to deeply equal { …(2) }
+ Received:
undefined

 ❯ tests/plugin/assetDesignerUsePlan.test.ts:381:45
```

**C. The same file with ICR 1-H APPLIED**, to prove the assertion is the one the integrator turns
green and to measure finding 2. Same command → exit 1, **2 failed | 13 passed (15)** again — but a
DIFFERENT two: the pair above went green and these two, both pre-existing, went red.

```
FAIL  tests/plugin/assetDesignerUsePlan.test.ts > use in plan > continues into the one Plan Editor already open, asking nothing
AssertionError: expected { Object (type, state) } to be { Object (type, state) } // Object.is equality

- Expected
+ Received

  {
+   "active": true,
    "state": {
+     "origin": {
+       "assetId": "asset-01M2TPYGCYTQVM90WW1CBQ5235",
+       "planId": "plan-01M2TPYGCWZ1AKXQPECR9C6X0R",
+     },
      "planId": "plan-01M2TPYGCWZ1AKXQPECR9C6X0R",
    },
    "type": "renovation-plan-editor",
  }

 ❯ tests/plugin/assetDesignerUsePlan.test.ts:131:22

FAIL  tests/plugin/assetDesignerUsePlan.test.ts > use in plan > asks which plan when none is open, and opens the one picked
AssertionError: expected { Object (type, active, ...) } to deeply equal { Object (type, active, ...) }

- Expected
+ Received

  {
    "active": true,
    "state": {
+     "origin": {
+       "assetId": "asset-01M2TPYGCYTQVM90WW1CBQ5235",
+       "planId": "plan-01M2TPYGCX39TRKMWB2C45HPNZ",
+     },
      "planId": "plan-01M2TPYGCX39TRKMWB2C45HPNZ",
    },
    "type": "renovation-plan-editor",
  }

 ❯ tests/plugin/assetDesignerUsePlan.test.ts:193:26
```

The three ICR files were reverted afterwards; `git status` names only this row's six files.

### Why no existing case went red at THIS candidate from the `wired` change

`wired()` now annotates the built seam at the signature ICR 1-H gives it
(`const send: (assetId: string) => void = assetDesignerUsePlan(…)`) and returns
`usePlan: () => { send(ASSET); }`. `() => void` is assignable to `(assetId: string) => void`, so the
line compiles on both sides of the widening and today's build drops the argument — which is why the
run above is 13 passed and not 11. It also means the widening needs **no edit to any of the file's
other cases**, which is the whole reason it was done in `wired` rather than in the new cases alone.

## Integration change request 1-H, CORRECTED (supersedes the version above)

**Three source files, plus two existing cases in a test file this row owns.** Every line below was
applied, type-checked, run and reverted; the reds it produces are section C above.

**1. `src/plugin/renovationProjectOpenSeams.ts`.** The seam returns `(assetId: string) => void`, and
the picker arm reaches the asset through a **closure-scoped slot** rather than through the `then`
callback's parameters. The callback is built ONCE at composition, so it has no lexical access to a
per-press `assetId`; rebuilding `pick` per press is refused by `planPicker`'s own docblock
("Rebuilding it per press would guard nothing at all").

```ts
): (assetId: string) => void {
	const openPlan = renovationProjectOpenPlan(app.workspace, logger);
	let armed: string | undefined;
	const pick = planPicker(app, () => index, (plan) => {
		const assetId = armed;
		armed = undefined;
		void (async (): Promise<void> => {
			const outcome = await openPlan(plan.id, assetId === undefined ? { planId: plan.id } : { planId: plan.id, assetId });
			if (outcome === 'opened' && plan.projectId !== undefined) rememberContinue({ projectId: plan.projectId, planId: plan.id });
		})();
	});
	return (assetId: string) => {
		const open = [ /* unchanged */ ];
		const only = open.length === 1 ? open[0] : undefined;
		if (only !== undefined) {
			void openPlan(only, { planId: only, assetId });
			return;
		}
		armed = assetId;
		pick();
	};
}
```

**The slot is exactly as wide as the property, and that is an argument rather than a hope.**
`planPicker`'s `picking` flag serialises presses, so at most one picker is open per closure; and
`RenovationPlannerPlugin.assetDesignerViewDeps()` builds one bundle — and therefore one
`assetDesignerUsePlan` closure, and one slot — per designer leaf, which its own comment states
("composed inside `assetDesignerDeps` off the `root` this call passes, so it is still built per
bundle"). So no two leaves share a slot, and one leaf's button names one asset. The ternary on
`assetId === undefined` is defensive rather than required — `armed` is only ever set to a string
before `pick()`, and this repository does not set `exactOptionalPropertyTypes` — but it keeps the
function total without a cast.

**Three docblock sentences in that file go FALSE with this change and must be rewritten in the same
edit**, not one:

- *"it does NOT arm that editor's placement tool with the asset"* — the whole "How far this gesture
  reaches" paragraph.
- *"the only channel into an open editor is `ProjectOrigin`, which is `application/`-owned and
  carries `roomId`/`workId`/`costId` and no asset"* — **already false at this candidate**, before
  ICR 1-H, because `ProjectOrigin.assetId` landed in it (review finding 8).
- *"Continuing into an ALREADY OPEN editor preserves that editor's selection and camera … because
  `revealCandidate` calls `setViewState` only on a leaf IT created"* — the MECHANISM changes. Once
  an origin is passed, `revealPlanEditor` builds `prepareEditorArrival(origin)`, which calls
  `setViewState` on whichever leaf was revealed, **including one that was already open**. The
  property survives; its reason does not. **Re-derive it as:** `PlanEditorView.sync()` returns early
  on `this.planId === this.mountedPlanId`, so a re-state naming the same plan remounts nothing — the
  camera and selection live in the mounted tree, which is not rebuilt. AD13's second acceptance
  criterion now rests on that early return, not on the reveal declining to re-state.

**2. `src/presentation/designer/AssetDesignerContext.ts`** — `readonly usePlan?: () => void;` becomes
`readonly usePlan?: (assetId: string) => void;` (one hit for `usePlan` in that file).

**3. `src/presentation/designer/inspector/DesignerInspector.vue`** — the same one-token widening on
its `usePlan?` prop. `AssetDesignerRoot.vue`, `AssetDesignerView.ts` and `assetDesignerDeps.ts` are
pass-throughs and need no edit: `npx vue-tsc --noEmit` exits **0** with exactly those three files
edited, measured.

`DesignerUsePlan.vue` needs **no** change — it already passes `design.assetId`. Its prop docblock's
closing sentence ("the only instrument that fails without the wiring is the case named in this card's
report") is the sentence to rewrite when the wiring lands.

**4. `tests/plugin/assetDesignerUsePlan.test.ts` — two existing cases turn RED and must be repaired
in the same edit.** Both reds are in section C verbatim. Neither is a defect in the ICR; both are the
arrival queue doing its job.

- **`continues into the one Plan Editor already open, asking nothing`** asserts
  `expect(open.state).toBe(before)` — object IDENTITY, chosen deliberately (its own docblock explains
  why `toEqual` proved nothing). `FakeLeaf.setViewState` assigns a fresh state object, so the
  identity cannot survive an arrival. **Repair:** assert the CONTENT instead —
  `expect(open.state?.state).toEqual({ planId: GROUND, origin: { planId: GROUND, assetId: ASSET } })`
  — and rewrite the case's docblock, which currently says "Revealed, never re-stated". The
  no-remount property it was really guarding is pinned elsewhere, by `PlanEditorView`'s `sync` early
  return; `tests/infrastructure/obsidian/workspace/revealPlanEditor.test.ts`'s
  `does not re-set the view state of a leaf it found` still holds, because it passes no origin.
- **`asks which plan when none is open, and opens the one picked`** asserts `created?.state` deep-equal
  to `{ type, active: true, state: { planId: FIRST } }`. **Repair:** add
  `origin: { planId: FIRST, assetId: ASSET }` inside `state`.

**5. The two new cases in that same file are the acceptance test for this ICR** —
`carries the asset into the Plan Editor it continues into` and `carries the asset into the plan it
picked`. They are red at this candidate and green with the four items above applied, measured both
ways. **An integration that leaves them red has not landed ICR 1-H.**

**No second ICR**, and the `pickPlaceable` note under the round-1 section stands unchanged.

## Reviewer and integrator acceptance

Reviewer outcome and findings:
Integrated commit:
Post-integration checks/evidence:
Final status: integrated / verified / blocked
