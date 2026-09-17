# Task report — ADQ (integration-queue items: the reference as a view preference, and as a removable thing)

Outcome: **implemented, with ONE deliberately red assertion awaiting a two-line integrator wire.**
Owner / worktree / branch: queue worker · `.worktrees/adq` · `adq-reference-view`
Base commit / candidate commit: `ae6bb2a63` / `<CANDIDATE>`
Accepted contract revision: `r1` (rulings **AD12-R1** and **AD12-R2**)
Allowed scope and shared-file leases: the dispatch brief's exclusive list — `runtime.ts`,
`DesignerCanvas.vue`, `DesignerViewMenu.vue` (all three integrator-sub-let),
`layers/backgroundLayer.ts`, `inspector/DesignerReferenceStatus.vue`, `plugin/assetBackgroundPicker.ts`,
`application/commands/asset/SetAssetBackground.ts`,
`application/editor/asset/ReversibleAssetDesignCommands.ts`, the `{en,de}/assetReferenceView.ts`
pair, and new test files. **Nothing outside that list is touched** — `git status` is nine files
and every one is on it.

## Changed files and reason

| File | Purpose | Within lease? |
|---|---|---|
| `src/application/commands/asset/SetAssetBackground.ts` | AD12-R2's removal arm: `SetAssetBackgroundInput` becomes a union whose `path: null` arm removes the reference; the arm sits ABOVE both path-shaped pre-read refusals; `write()` now takes an already-resolved `AssetBackgroundRef \| null` instead of a validated `kind` | yes |
| `src/presentation/designer/runtime.ts` | `removeBackground()` and the leaf-local `backgroundOpacity` ref on `DesignerRuntime`; the two background gestures collapsed onto one `dispatchBackground` | yes |
| `src/presentation/designer/DesignerViewMenu.vue` | AD12-R1's opacity row, drawn only while the asset has a reference | yes |
| `src/presentation/designer/DesignerCanvas.vue` | binds the leaf's `backgroundOpacity` at the background layer | yes |
| `src/presentation/designer/inspector/DesignerReferenceStatus.vue` | the **Remove reference** control and its optional callback prop | yes |
| `src/presentation/i18n/locales/{en,de}/assetReferenceView.ts` | the two new strings (the scaffold pair, filled) | yes |
| `tests/application/commands/asset/removeAssetBackground.test.ts` | new — the removal arm | yes |
| `tests/presentation/designer/designerReferenceView.test.ts` | new — opacity and the delete control | yes |

**Two leased files are deliberately UNCHANGED, and that is the reuse half of this card.**
`ReversibleAssetDesignCommands.ts` needed nothing: `ReversibleAssetBackgroundEdit` is generic over
`SetAssetBackgroundInput` and passes it through `runForward`, so admitting one input arm gave
removal the existing two-resource inverse, its two ledgers, its generation checks and its
`markUncompensated` arm for free. `assetBackgroundPicker.ts` needed nothing: removal names no
document, so there is nothing to pick.

## Acceptance coverage

| Criterion | Result | Exact evidence | Remaining issue |
|---|---|---|---|
| AD12-R1 — background opacity exists, as a leaf-local view preference | **met** | `designerReferenceView.test.ts` › *fades the background layer the whole way down to the control's floor* — the Konva `.asset-background` layer node reads `1`, then `0.4` after the control is set | nobody has LOOKED at a faded sheet (see *Verification not performed*) |
| AD12-R1 — it is `PartView`'s shape: transient, per leaf, written nowhere | **met** | *writes nothing — not the sidecar, and not this device's remembered choices*; the value is a plain `ref` in `buildRuntime`, reaching no command and no `useViewPreferences` key | the SIDECAR half of that case is a standing guard, not a demonstrated one (below) |
| AD12-R1 — it lives in `DesignerViewMenu`, not the inspector | **met** | the row is in `DesignerViewMenu.vue`; `DesignerInspector.vue` is untouched | — |
| AD12-R1 — no lock control is built | **met** | nothing named lock exists in the diff | — |
| AD12-R2 — a reference can be removed, through the command that replaces one | **met** | `removeAssetBackground.test.ts` › *takes the reference off the note and clears the scale measured off it* | the CONTROL does not yet reach it: one red assertion, below |
| AD12-R2 — the calibration is cleared, same order, same compensation | **met** | same case; the clear is the shared `write()` path and its compensation is unchanged | compensation not re-tested — deliberate, see the suite's own header |
| AD12-R2 — the pending flags are untouched | **met** | *leaves every per-group pending flag exactly as it was* | the guarantee turns out to be STRUCTURAL: the flags are on the sidecar's shape and this command's only sidecar write is the calibration clear. Recorded in the case's docblock |
| AD12-R2 — the removal arm sits above both cheap pre-read refusals | **met** | *succeeds when the referenced file has already been deleted* | — |
| AD12-R2 — the control is drawn only while a reference exists | **met** | *draws no control for an asset with no sheet, even with the gesture bound*; a `v-if`, never a `:disabled` | — |
| AD12-R2 — one completed gesture is one logical history action | **met by reuse** | the gesture dispatches through `chain.enqueue(() => dispatcher.run(edits.setBackground(...)))`, the identical path a replacement takes | undo of a REMOVAL is not separately driven; the adapter is unchanged code |

## Executed checks

All on the candidate tree, in `.worktrees/adq`, with `TEMP=TMP=D:/tmp-claude`.

| Command | Exit code | Evidence |
|---|---|---|
| `npx vue-tsc -noEmit` | **0** | whole tree, `src/` + `tests/` |
| `npx vitest run tests/application/commands/asset/removeAssetBackground.test.ts` | **0** | 4 passed |
| `npx vitest run tests/presentation/designer/designerReferenceView.test.ts` | **1** | 6 passed, **1 failed — the deliberate one**, named below |
| `npx oxlint <new test file>` | **0** | clean after fixing one `unicorn/no-array-callback-reference` (a selector constant handed to `wrapper.find`) |
| `npx eslint <the nine touched source and test files>` | **0** | first run reported `buildRuntime has too many lines (108). Maximum allowed is 100`; fixed by collapsing the two background dispatches onto one `dispatchBackground`, then clean |
| `npm run check:fast -- tests/application tests/presentation/designer` | **1** | `Test Files 1 failed | 195 passed (196)`, `Tests 1 failed | 2045 passed (2046)`, 224.59s. **The one failure is the deliberate assertion below and nothing else** — no regression anywhere in either directory. `oxlint --deny-warnings` and `vue-tsc -noEmit` both clean in the same run (two oxlint findings were fixed first: an `eqeqeq` on `!= null` in `DesignerViewMenu.vue`, and `vitest/no-commented-out-tests` firing on the words "put it (SDD §55)" in an English locale comment, which reads as `it(`) |

### Invariants watched FAILING, and what the red said

Every one reverted and restored afterwards; the tree is back at the candidate in each case.

1. **Removal arm below the two pre-read refusals** — moved it under both: all four command cases red,
   `TypeError: Cannot read properties of null (reading 'slice') ❯ backgroundKindOf … path.slice(...)`.
2. **Removal arm below `fileExists` only** (with `backgroundKindOf` null-guarded, so the experiment
   isolates the second guard) — all four red,
   `Expected ok, got error: {"category":"Reference","code":"asset.background-not-found","message":"No vault file at \"null\"."}`.
   That is precisely the state the removal gesture exists to repair, refused.
3. **The calibration clear** — made the removal arm write the document back unchanged:
   *takes the reference off the note and clears the scale measured off it* red,
   `AssertionError: expected { pointA: …(3) } to be null`.
4. **The pending flags** — cleared them in the sidecar write: *leaves every per-group pending flag
   exactly as it was* red, `AssertionError: expected false to be true`. **Clearing them through
   `Asset.withChanges` instead left it GREEN**, which is how the structural finding above was
   measured rather than assumed.
5. **The opacity binding** — dropped `:opacity` from `DesignerCanvas`: *fades the background layer…*
   red, `expected 1 to be close to 0.4, received difference is 0.6`.
6. **The opacity predicate** — replaced `v-if="hasReference"` with an unconditional label: *is not
   drawn at all for an asset with no sheet* red.
7. **"Written nowhere"** — made the control also write a remembered choice: *writes nothing…* red,
   `snappingEnabled: true` → `false`. A second probe making the control dispatch a real command did
   NOT redden the sidecar half, because the rig seeds no calibration; the case's docblock says so.
8. **The Remove control** — `v-if="false"` on the button: *offers the gesture while there is a sheet*
   red, `Cannot call text on an empty DOMWrapper`.
9. **The unwired-callback predicate** — dropped the `removeBackground !== undefined` half of
   `canRemove`: *draws no control when nothing is bound to it* red.

## The deliberately RED assertion, and the integration change request

### The red

`tests/presentation/designer/designerReferenceView.test.ts` › `removing the reference` ›
**`reaches the real command from the real inspector, once the parent binds it`**

```
AssertionError: expected false to be true // Object.is equality
- Expected: true
+ Received: false
 ❯ tests/presentation/designer/designerReferenceView.test.ts:160:28
    159|    const button = remove(rig.wrapper, '.rp-designer-inspector ');
    160|    expect(button.exists()).toBe(true);
```

**This is correct and expected. The candidate is not broken.** `vue-tsc` is clean, `eslint` is
clean, and every other case in both new files passes. The control and its callback are built as if
the wire existed; the wire is two lines in `DesignerInspector.vue`, a file this card does not own
and must not edit.

### The request — exact file, exact lines

**File:** `src/presentation/designer/inspector/DesignerInspector.vue`

**Line 324**, currently:

```vue
		<DesignerReferenceStatus :design="design" />
```

must become:

```vue
		<DesignerReferenceStatus
			:design="design"
			:remove-background="removeBackground"
		/>
```

**Prop name:** `removeBackground` (kebab `remove-background` in the template).
**Type:** `() => Promise<void>`.
**What it must be bound to:** `DesignerRuntime.removeBackground` — this leaf's own. Either shape
works and the assertion goes green for both:

- **Cheapest (3 lines, one file):** `import { useDesignerRuntime } from '../runtime';` beside the
  existing imports, `const runtime = useDesignerRuntime();` beside `const props = defineProps<…>()`,
  then `:remove-background="runtime.removeBackground"`. `DesignerViewMenu.vue`, `DesignerToolbar.vue`
  and `DesignerCanvas.vue` all read the runtime this way; the inspector would be the fourth.
- **Prop-drilled (two files):** add `removeBackground: () => Promise<void>` to `DesignerInspector`'s
  own `defineProps` and bind `:remove-background="runtime.removeBackground"` at
  `AssetDesignerRoot.vue`'s `<DesignerInspector …>` (around line 538), beside the `:edit-shape` and
  `:set-height` bindings already there. This matches the inspector subtree's existing prop-drilling
  style but costs a second integrator-owned file.

**A second, one-word request once that lands:** make `removeBackground` REQUIRED in
`DesignerReferenceStatus.vue`'s `defineProps` (drop the `?`). It is optional today only so that this
candidate type-checks with nothing bound. Required, `vue-tsc` refuses an unbound parent outright,
which is a stronger gate than any test — and it closes the optional-with-no-default shape
permanently. `tests/presentation/designer/designerReferenceView.test.ts`'s *draws no control when
nothing is bound to it* case would then be deleted in the same edit, since its premise becomes
uncompilable.

### A third request, smaller, and NOT required for anything to work

`src/presentation/editor/layers/background/BackgroundLayer.vue` declares five props and no
`opacity`. The designer's binding works **through Vue's attribute fallthrough** onto that
component's root `<VLayer>`, which vue-konva applies to the Konva node — measured, not assumed:
the layer node's `opacity()` really does read `0.4`. It is nonetheless an arrangement no type
checks, so declaring `opacity?: number` there (defaulting to `1`) and putting it in the config
object beside `visible` would make it explicit, and would give the Plan Editor the same capability.
**Not urgent**, because what holds it today is a SCENE assertion that goes red the moment the
fallthrough stops working, and `DesignerCanvas.vue`'s own comment names the mechanism where the
next reader is standing.

## Verification not performed

Named rather than left blank; every one is an environment this machine does not have.

- **`npm run check` in full** — not run, by the dispatch brief's instruction: the integrator runs it
  serially, and two heavy gates on this box produce wrong reds rather than slow ones. **So
  `eslint .` over the WHOLE tree and the coverage floors are unverified.** ESLint was run on the nine
  touched files only (exit 0). Coverage was not measured at all, so whether the two new files hold
  the 99/99/99/98 floors is unknown — the new source arms are small (one `if` in the command, one
  computed and one `v-if` in each of two components) and each has a case, but that is an argument
  rather than a measurement.
- **`npm run analyze` (fallow)** — not run, same reason. The two things worth a look when it is:
  whether `removeAssetBackground.test.ts`'s `seeded()` helper trips the clone detector against
  `setAssetBackground.test.ts`'s much larger one (they share about six lines of stack setup), and
  whether the new `SetAssetBackgroundBase` interface — not exported, named in an exported type —
  reports as a `private-type-leak`. `vue-tsc` is happy; fallow's lens is a different one.
- **`npm run test-build` and every manual case under `docs/tests/`** — no Obsidian on this machine.
  So nothing here is evidence about what Obsidian does.
- **`npm run harness-shot`** — no pinned Chromium on this machine and no
  `RP_CHROMIUM_EXECUTABLE`. **This matters more than usual for this card: opacity is a VISUAL
  property and nobody has looked at it.** What is verified is the number on the Konva layer node.
  Whether a reference at 0.4 is legible enough to trace over, whether the range input is usable at a
  460 px sidebar width, and whether the third row crowds the View menu are all unseen. The floor of
  0.1 was chosen by argument (a fully transparent sheet is indistinguishable from one that failed to
  load, and this surface's two background notices would then be saying nothing about a picture the
  user cannot see) and not by looking.
- **The notice a refused removal would raise** — unverified in appearance anywhere. The browser
  harness declares no `.notice` and no `.notice-container` rule at all, so a notice has no position,
  no stacking and no chrome there. `docs/tests/cases/Notices and save state.md` remains the only
  instrument, and it needs a vault.
- **Undo of a removal, driven end to end** — not driven. The reasoning is that
  `ReversibleAssetBackgroundEdit` is unchanged and generic over the input, so a removal takes the
  same inverse a replacement takes; that is an argument from reading, not a run.
- **The removal's compensation and uncompensated arms** — deliberately not re-tested. They are the
  same lines `setAssetBackground.test.ts` already drives per-line; the new suite's header states the
  trade.
- **German register** — `strings.test.ts` was not run in isolation (it rides the full suite). Both
  new German strings are noun phrases with no verb at all (`Deckkraft der Vorlage`,
  `Vorlage entfernen`), which is the spelling that keeps the Sie/du question from arising; that is a
  precaution, not a passing check.

## Data and integration implications

**Schema/migration change:** none. `Asset.background` was already `AssetBackgroundRef | null`,
`withChanges` already resolved `changes.background ?? null`, `checkBackground(null)` already answered
`ok(null)` on its first line, and the frontmatter mapper already round-trips the absent case. **No
schema version bump is owed and none is taken.** AD12-R2's own measurement, re-checked against the
code before writing.

**Relevant renderer/export/revision consumers:** `BackgroundLayer` already draws
`kind: 'none'` for a null reference — the arm it takes for an asset that never had one. The
designer's two background notices (missing / unreadable) are driven off `BackgroundStatus` and are
not reached by a removal. `DesignerReferenceStatus` falls back to `designer.reference.sheet.none`.
Nothing exports a background reference.

**Undo/no-op/conflict/failure coverage:** undo — the unchanged two-resource inverse, reached by the
unchanged dispatch path. No-op — removing from an asset with no reference is `no-write` through the
existing `sameBackground(null, null)`, with a case. Conflict — the unchanged `expected` /
`expectedGeometry` pair. Failure — the unchanged compensation, including `markUncompensated`. **The
opacity half has none of these by construction: it writes nothing, so it cannot conflict, cannot
fail and pushes no history entry.**

**Identity/unit/quantity/calibration invariants:** the calibration is CLEARED by a removal, which is
AD12-R2's ruling and is the same clear a replacement makes. The per-group pending flags are
untouched — coordinates captured in background pixels stay flagged as such, which is the only safe
direction. No millimetre is invented and none is destroyed: a shape that was measured stays
measured, and a shape that was pending stays pending.

**Shared root/runtime/locales wiring still required:** the `DesignerInspector.vue` binding above,
and nothing else. The locale pair was created and spread by the integrator in the base commit and is
now non-empty, so neither aggregator needs touching (and neither was touched).

**Rollback/recovery considerations:** a user who removes a reference by mistake presses Ctrl+Z and
gets back both the reference and the calibration, because the inverse captures the whole note entity
and the whole sidecar document. The vault FILE is never touched by any of this — "Remove reference"
is worded that way for exactly that reason, and the English string carries the note.

## Reviewer and integrator acceptance

Reviewer outcome and findings:
Integrated commit:
Post-integration checks/evidence:
Final status: integrated / verified / blocked
