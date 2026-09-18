# Task report — AD13 hand-off (integration change request 1 of AD13's navigation half)

Outcome: **partially implemented** — the hand-off CHANNEL is built end to end from
`ProjectOrigin.assetId` to an armed `AssetPlacementTool`, and the `getState` question the lease
asked is answered and tested. The SENDER is not wired, because the three files that would wire it
are outside this row; they are ICR 1-H below. AD13 acceptance criterion 1 therefore moves from
"unmet, with a trigger" to **"unmet, with a three-file trigger and the receiving half proven"**.

Owner / worktree / branch: AD13 hand-off worker · `.worktrees/ad13c` · `ad13c-asset-handoff`
Base commit / candidate commit: `044e11f52` / `<candidate>`
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
is public reach that four components already take (`grep -rn "elementTask\.assets" src/` printed nine
lines across `AddMenu.vue`, `AssetLayer.vue`, `AssetPlacementDetails.vue` and `AssetPlacementForm.vue`
before this change). Adding a member to `EditorRuntime` would have been a SECOND way to reach one
task — the shape "one action, every input" refuses — so the ADDITIVE-ONLY grant is returned unused.

**`tests/plugin/assetDesignerUsePlan.test.ts` is untouched** because it drives
`assetDesignerUsePlan`, which lives in `src/plugin/renovationProjectOpenSeams.ts` — not in this row.
A case asserting the origin would be red until ICR 1-H lands, so it belongs in that change.

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

| Command or manual action | Commit / environment | Exit code or observed result | Evidence |
|---|---|---|---|
| `npx vue-tsc --noEmit` | candidate, Windows, Node from this worktree | **0** | whole program, `src/**` + `tests/**` |
| `npx vitest run tests/presentation/editor/{assetPlacement.e2e,assetPlacementInspector,itemPromotion.e2e,transformBox.e2e,editorArrival,editorArrivalAssetHandoff}.test.ts` | candidate | **0** | 6 files, 47 tests passed — the `choose`/`replace`/`pickPlaceable` paths the split touches, plus the arrival's existing record arms |
| `npx vitest run tests/presentation/views/{planEditorHostReturn,planEditorView,planEditorReopen}.test.ts tests/application/navigation tests/plugin/assetDesignerUsePlan.test.ts tests/presentation/designer/designerUsePlan.test.ts` | candidate | **0** | 6 files, 62 tests passed |
| `npx vitest run tests/presentation/designer tests/presentation/editor/recordNavigation.test.ts tests/presentation/editor/editorArrivalRecoveryCompletion.test.ts tests/presentation/views/projectDetailArrival.test.ts` | candidate | **0** | 63 files, 871 tests passed — the whole designer surface plus the remaining navigation suites |
| `npx vitest run` over the five files the last two fixes touched (`designerUsePlan`, `editorArrivalAssetHandoff`, `editorArrival`, `planEditorHostReturn`, `tests/application/navigation`) | candidate | **0** | 5 files, 36 tests passed — re-run after the `require-await` and stub-typing corrections below |
| `npx oxlint <the nine changed files>` | candidate | **0** | it reported `require-await` on `reveal` first (`Async function has no \`await\` expression`); the fix is the union return type, not a suppression |
| `npx eslint <the nine changed files>` | candidate | **0** — after a real red, below | the layer bans, the write boundary, `I18N_LITERAL_BAN`, `NOTICE_TEXT_BAN`, the size and complexity budgets and the Obsidian ruleset, for the changed files only |
| `npm run check` | — | **not run** | Deliberate, per this session's operating rules: the box is shared and a full gate thrashes `coverage/.tmp` and the `tests/build/` ESLint boots. CI on the pull request is where it runs |

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
- **`npm run check` in full**, and therefore `eslint .`, the coverage floors and `npm run analyze`.
  ESLint ran over the changed files only; the coverage floors were not measured at all, so whether
  the new branches (`arm`'s two arms, `reveal`'s asset arm, `consumeAssetHandoff`'s two) move the
  branch figure is unknown from here. `npm run analyze` did not run either, so no statement is made
  about dead exports or clone families — and note that `pickPlaceable` is still returned from
  `createAssetPlacementTask` and now has no `src/` caller other than `choose` in the same module,
  which is exactly the shape fallow reports on. It has test callers, which is why it is left alone
  rather than removed on a guess.
- **The end-to-end gesture**, because the sender does not exist yet (ICR 1-H). What is proven is
  that an origin of `{ planId, assetId }` set on a Plan Editor leaf arms the tool. That an actual
  press of `Use in plan` produces such an origin is not proven by anything, here or in CI, until
  that change lands.
- **No migration, no schema and no performance work** is in this change, so none was run.

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

**ICR 2-H — `pickPlaceable` may now be dead to `src/`.** After the split its only `src/` caller is
`choose`, in the same module, and it is still returned from `createAssetPlacementTask` for the
tests that drive it. `npm run analyze` did not run here. If it reports it, the honest fix is to
stop returning it and have those tests drive `choose` — not a fallow suppression. Flagged rather
than done, because removing a returned member is a change to a shared surface and this row's job
was the channel.

## Reviewer and integrator acceptance

Reviewer outcome and findings:
Integrated commit:
Post-integration checks/evidence:
Final status: integrated / verified / blocked
