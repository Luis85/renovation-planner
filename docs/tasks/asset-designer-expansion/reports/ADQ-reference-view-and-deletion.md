# Task report — ADQ (integration-queue items: the reference as a view preference, and as a removable thing)

Outcome: **implemented, with ONE deliberately red assertion awaiting a two-line integrator wire.**
Owner / worktree / branch: queue worker · `.worktrees/adq` · `adq-reference-view`
Base commit / candidate commit: `ae6bb2a63` / **`e48dc0386`** — the review-round-1 fix, which is
where every source and test change ends. `de2c8e9e3` was the first candidate; this commit names the
SHA and touches nothing else, so `e48dc0386` is the one to review and this one is the one to
integrate. **Fix round after REQUEST CHANGES:** see
[Review round 1](#review-round-1--what-the-reviewer-found-and-what-changed)
Accepted contract revision: `r1` (rulings **AD12-R1** and **AD12-R2**)
Allowed scope and shared-file leases: the wave-4 row's exclusive list — `runtime.ts`,
`DesignerCanvas.vue`, `DesignerViewMenu.vue` (all three integrator-sub-let),
`layers/backgroundLayer.ts`, `inspector/DesignerReferenceStatus.vue`, `plugin/assetBackgroundPicker.ts`,
`application/commands/asset/SetAssetBackground.ts`,
`application/editor/asset/ReversibleAssetDesignCommands.ts`, the `{en,de}/assetReferenceView.ts`
pair, and new test files — **plus the two files the lease amendment at `d56de8198` added for the fix
round**: `src/presentation/editor/layers/background/BackgroundLayer.vue` (ADDITIVE ONLY) and
`tests/application/commands/asset/assetReferenceReplacement.test.ts` (a header claim this candidate
falsified). **Nothing outside that list is touched** — `git diff --stat ae6bb2a63..HEAD` is the
proof, and `DesignerInspector.vue` is deliberately not in it.

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
| `src/presentation/editor/layers/background/BackgroundLayer.vue` | **fix round** — `opacity?: number` defaulting to `1`, in the layer config beside `visible`, so the designer's binding is a declared prop rather than attribute fallthrough. Additive: the plan editor passes nothing and draws exactly as before | yes, by the `d56de8198` amendment |
| `tests/application/commands/asset/assetReferenceReplacement.test.ts` | **fix round** — its header said deleting a reference had no door because `path` was a bare `string`. This candidate falsified that; the paragraph now points at `removeAssetBackground.test.ts` | yes, by the `d56de8198` amendment |

**Two leased files are deliberately UNCHANGED, and that is the reuse half of this card.**
`ReversibleAssetDesignCommands.ts` needed nothing: `ReversibleAssetBackgroundEdit` is generic over
`SetAssetBackgroundInput` and passes it through `runForward`, so admitting one input arm gave
removal the existing two-resource inverse, its two ledgers, its generation checks and its
`markUncompensated` arm for free. `assetBackgroundPicker.ts` needed nothing: removal names no
document, so there is nothing to pick.

## Acceptance coverage

| Criterion | Result | Exact evidence | Remaining issue |
|---|---|---|---|
| AD12-R1 — background opacity exists, as a leaf-local view preference | **met** | `designerReferenceView.test.ts` › *fades the background layer the whole way down to the control's floor* — the control's `min` reads `0.1` and the Konva `.asset-background` layer node reads `1`, then `0.1` after the control is set to its floor | nobody has LOOKED at a faded sheet (see *Verification not performed*), and the layer that number reaches holds **no raster** in this rig (see *Carried risk*) |
| AD12-R1 — it is `PartView`'s shape: transient, per leaf, written nowhere | **met** | *writes nothing — not the sidecar, and not this device's remembered choices*; the value is a plain `ref` in `buildRuntime`, reaching no command and no `useViewPreferences` key | the SIDECAR half of that case is a standing guard, not a demonstrated one (below) |
| AD12-R1 — it lives in `DesignerViewMenu`, not the inspector | **met** | the row is in `DesignerViewMenu.vue`; `DesignerInspector.vue` is untouched | — |
| AD12-R1 — no lock control is built | **met** | nothing named lock exists in the diff | — |
| AD12-R2 — a reference can be removed, through the command that replaces one | **built, and UNREACHABLE at this SHA** | `removeAssetBackground.test.ts` › *takes the reference off the note and clears the scale measured off it* — the command arm is real and driven. But `grep -rn removeBackground src/` prints seven lines, four in `DesignerReferenceStatus.vue` and three in `runtime.ts`, and **nothing consumes the runtime member**: no user can reach the gesture until the integrator binds it | the whole criterion is pending the `DesignerInspector.vue` wire below. It becomes tickable then and not before — the queue row must not be closed on this SHA |
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
 ❯ tests/presentation/designer/designerReferenceView.test.ts:166:28
    165|    const button = remove(rig.wrapper, '.rp-designer-inspector ');
    166|    expect(button.exists()).toBe(true);
```

**This is correct and expected. The candidate is not broken.** `vue-tsc` is clean, both linters are
clean, and every other case in both new files passes. The control and its callback are built as if
the wire existed; the wire is two lines in `DesignerInspector.vue`, a file this card does not own
and must not edit.

**It failed at the WRONG line in the first candidate, and that was a real defect rather than a
detail** — see [Review round 1](#review-round-1--what-the-reviewer-found-and-what-changed),
finding 1. The red is now the first assertion in the case, which is the one whose premise is the
missing wire.

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
below works, and **the assertion was verified green against the first of them** (measured in the fix
round: the binding applied locally, the file run, `Tests 7 passed (7)`, then reverted). The second
shape is not measured, only read — it hands the same function to the same prop, so the case cannot
tell them apart, but that is an argument and the sentence has to say which half was run:

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

### A third request, WITHDRAWN because the fix round did it

The first candidate's opacity binding relied on Vue's attribute fallthrough onto
`BackgroundLayer.vue`'s root `<VLayer>`, and this section asked the integrator to make it a declared
prop later. The lease amendment at `d56de8198` granted that file, so it is done rather than
requested: `opacity?: number` defaulting to `1`, in the layer config beside `visible`. Additive —
the plan editor passes nothing and gets `1`.

**Three things the fix round learned about the arrangement it replaced**, worth keeping because they
are the argument for not leaving a fallthrough in place anywhere:

- Vue **warned on every mount** and nobody had read the warning:
  `[Vue warn]: Extraneous non-props attributes (opacity) were passed to component but could not be
  automatically inherited because component renders fragment or text or teleport root nodes`, with
  `at <Layer config={name, listening, visible, x, y, scaleX, scaleY} opacity=1>`. The value reached
  the Konva node anyway — vue-konva consumes `attrs` itself rather than through Vue's DOM
  inheritance — which is exactly why the warning cost nothing and taught nobody.
- That log line is also the direct evidence for the ordering hazard: `opacity` sat in `attrs`, NOT
  in `config`, and vue-konva's factory spreads `{ ...attrs, ...props.config, ...listeners }`. A
  later `opacity` in the config literal would have won silently.
- Declaring it removed the warning: the same file, same cases, `Tests 7 passed (7)` with no stderr.

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
  **`SetAssetBackgroundBase` is deliberately NOT exported pre-emptively**, and the reviewer agreed:
  fallow's first suggested action on that finding is "export the referenced private type by name",
  and CLAUDE.md records that advice being wrong twice in nineteen — once destroying a `unique symbol`
  access lock, once trading two leaks for an `unused-exports` finding. The integrator measures it
  with `npm run analyze` and acts on what it prints, rather than on what it is expected to print.
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
- **German register** — `strings.test.ts` was not run in isolation (it rides the full suite), and
  passing it would not settle the question anyway: its du-form check is an **enumerated, incomplete**
  verb list, so a form it does not name is unjudged rather than blessed.

  The two strings are `Deckkraft der Referenz` and `Referenz entfernen` — **"Referenz" and not
  "Vorlage"**, because `de/assetReference.ts` already uses the first for this block's heading and
  reserves the second for the document's NAME row, and both of these strings are about the reference
  rather than about which file it is. (This paragraph said `Vorlage` in the first candidate, against
  the code it was describing. The code is right; the report was wrong.)

  **Why the register is safe, stated correctly this time.** `Deckkraft der Referenz` is a noun
  phrase. `Referenz entfernen` is **not** — `entfernen` is an infinitive, so the earlier claim that
  both are "noun phrases with no verb at all" was simply false. What makes it safe is that a German
  **infinitive** is the neutral, Sie-compatible form German UI uses for an action label, as against
  a du-imperative (`Entferne …`), which is the form this repository's register rule refuses. That is
  the reasoning, and it is a reading of the rule rather than a check that ran.

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

## Review round 1 — what the reviewer found, and what changed

Independent review of `de2c8e9e3` returned **REQUEST CHANGES** with six findings. Much of the
candidate was agreed and is untouched: the removal arm's placement above both pre-read refusals, the
input union, reusing the unchanged reversible inverse, the leaf-local opacity ref, both controls
being `v-if` predicates rather than `:disabled`, the layering, and the `buildRuntime` collapse onto
one `dispatchBackground`. Every fix below was verified by running the affected file.

### 1 (blocking) — the deliberate red would not have gone GREEN when the wire landed

**Confirmed independently before acting, by reading the three files rather than taking the finding
on trust.** The chain: `designerRig` seeds the sidecar `{ calibration: null, shape }`
(`designerRig.ts:269`); `toiletShape()` builds from `ASSET_PRESETS`, and
`presetGeometry.ts:89-91` writes `footprintPending`/`clearancePending`/`anchorPending` all `false`
with every detail `pending: false` too; so after a successful removal
`DesignerReferenceStatus.vue:87`'s `relevant` — background OR calibration OR any pending flag — is
`false`, the whole `<section v-if="relevant">` is not rendered, and
`designer.reference.sheet.none` is written nowhere in `src/` except line 54 of that component,
inside that section. The button-is-gone assertion would have passed for the wrong reason and the
sheet-line assertion would have failed.

**Measured, not reasoned.** With the two-line parent binding applied locally:

```
× reaches the real command from the real inspector, once the parent binds it
AssertionError: expected 'PanSelectTrace footprintTrace clearan…' to contain 'None chosen'
Expected: "None chosen"
Received: "PanSelectTrace footprintTrace clearanceDraw rectangle… Placement point… Saved"
 ❯ tests/presentation/designer/designerReferenceView.test.ts:172:31
 Tests  1 failed | 6 passed (7)
```

**The fix** seeds that rig's shape `{ ...toiletShape(), footprintOrigin: 'traced',
footprintPending: true }` — the same pair the sibling case at line ~122 already needed, and
`'traced'` is required rather than decorative because `validateAssetShape` refuses a typed footprint
that is pending (`AssetShape.ts:232`). A pending flag is also the state AD12-R2 is most specific
about, so the case gained one line asserting the footprint-pending notice is still on screen after
the sheet is gone: the removal took the reference and left the pixels flagged as pixels. With the
binding still applied, `Tests 7 passed (7)`, exit 0. The binding was then **reverted**, and the
declared red returned — now at the case's FIRST assertion, `designerReferenceView.test.ts:166`,
`expected false to be true`, which is the assertion whose premise is the missing wire.

### 2 (blocking) — a wrong count in shipped code

`DesignerCanvas.vue`'s comment said `BackgroundLayer` "declares five props and no `opacity`". It
declares **seven** — `name`, `reference`, `vault`, `transform`, `visible`, `pixelsPerWorldUnit`,
`fileChanges` — read off its own `defineProps` rather than recalled. The number is **dropped**, not
corrected: the load-bearing half is "no `opacity` prop", and a count is the thing in this repository
that has gone stale four times in one session. (The comment is rewritten anyway, because finding 4
made the prop declared.)

### 3 (blocking) — a claim this candidate falsified and left standing

`assetReferenceReplacement.test.ts`'s header said deleting a reference had no door, because
`SetAssetBackgroundInput.path` was a bare `string`. True when written, false at `70937e5af`. The
paragraph now says what the file covers (replacement) and points at `removeAssetBackground.test.ts`
for the other arm, and keeps a sentence naming what it used to say — CLAUDE.md's
fixture-behind-the-change-it-was-the-reason-for rule, met at a header rather than a fixture.

### 4 (recommended, taken) — the opacity binding is structural now

Covered above under *A third request, WITHDRAWN*. `opacity?: number` defaulting to `1` on
`BackgroundLayer.vue`, in the config beside `visible`; `DesignerCanvas.vue`'s mechanism note
rewritten for what is now true. The plan editor's mount is unchanged and `vue-tsc` now holds the
designer's binding. It also silenced a `[Vue warn]` nobody had been reading.

### 5 (required) — the 0.1 floor

The case titled *fades the background layer the whole way down to the control's floor* was setting
**0.4**. It now sets **0.1** and asserts `min` reads `'0.1'` first, so the title is honest and the
floor is a number something reads. `backgroundOpacity` is still an unclamped `Ref<number>` and the
control is still its only writer — stated in the case's own docblock rather than implied.

### 6 (record) — the German strings

Covered under *Verification not performed*. The report had quoted `Deckkraft der Vorlage` /
`Vorlage entfernen` against code that says `Referenz`; the code is right. The report's reason was
also wrong — `entfernen` is an infinitive, not a verbless noun phrase — and the locale file's own
comment said the same thing, so **both** were corrected to the reasoning that actually makes the
form safe: a German infinitive is the neutral Sie-compatible action label, as against a du-imperative.

### Carried risk — three things not done, with why

- **The opacity evidence is about an EMPTY layer.** The reviewer measured this and it is real:
  `designerRig`'s `SPEC_SHEETS` is `['Specs/oven.pdf','Specs/other.png','Specs/a.png']` while the
  rig seeds `Specs/oven.png`, in neither that list nor the fake vault, so the `.asset-background`
  layer whose `opacity()` the case reads contains no raster. The number arrives; no picture dims.
  The suggested remedy — one case in `designerBackground.test.ts`, which has a real-raster harness —
  is **out of lease**: that file is neither "its own tests" in the wave-4 row nor one of the two the
  `d56de8198` amendment granted, and the amendment granted exactly two files on purpose. What
  partially offsets it is finding 4: the value now travels as a declared prop into the layer config,
  so `vue-tsc` holds the binding and only Konva's own layer-opacity semantics are unwitnessed here.
  **Recorded as uncovered, not as covered.**
- **Removal-then-undo is still not driven end to end.** Argued from reading
  `ReversibleAssetBackgroundEdit` — whole `Asset` and whole `AssetGeometryDocument` snapshotted
  before `runForward`, `secondaryVersion` into the geometry ledger, restore note-then-sidecar under
  both generation checks — and the reviewer confirmed that reading. It stays an argument.
  `reversibleAssetDesign.test.ts` is likewise not in this card's lease.
- **Nobody has looked at any of it.** No Obsidian, no pinned Chromium. Legibility at 0.1 or 0.4,
  the range input at a 460 px sidebar, and whether a third View-menu row crowds the pane are all
  unseen, and no gate in this repository can see them.

### Fix-round checks

| Command | Exit | Evidence |
|---|---|---|
| `npx vitest run tests/presentation/designer/designerReferenceView.test.ts` (parent binding applied locally) | **1**, then **0** | before the fix: 1 failed at `:172`, `to contain 'None chosen'`. After: `Tests 7 passed (7)`, no stderr |
| same, binding reverted | **1** | `Tests 1 failed \| 6 passed (7)`, the declared red at `:166` — `expected false to be true` |
| `npx vue-tsc -noEmit` | **0** | whole tree |
| `npx oxlint` (whole repository) | **0** | clean |
| `npx eslint` on the two touched SFCs | **0** | clean |
| `npx vitest run tests/presentation/designer tests/presentation/editor/layers` | **1** | `Tests 1 failed \| 859 passed (860)` — the declared red and nothing else. `BackgroundLayer`'s new prop regresses neither surface |
| `npx vitest run tests/presentation/editor/background.test.ts tests/presentation/editor/backgroundInEditor.test.ts tests/presentation/designer/designerBackground.test.ts tests/presentation/designer/designerViewMenu.test.ts tests/application/commands/asset/` | **0** | `Test Files 18 passed`, `Tests 198 passed` |

`npm run check`, `npm run test:coverage` and `npm run analyze` were again NOT run, by the dispatch
brief's instruction — two AD13 workers are on this box and a second heavy gate produces wrong reds.
So `eslint .` over the whole tree and the coverage floors remain unverified, exactly as the first
candidate recorded.

## Reviewer and integrator acceptance

Reviewer outcome and findings: **round 1 — REQUEST CHANGES**, six findings plus two overstatements
in this report. All addressed; see [Review round 1](#review-round-1--what-the-reviewer-found-and-what-changed).
No finding was disputed: every one was reproduced or read against the code before being acted on.

**Integrated commit:** `cde0e8444` (the candidate, merged unchanged), plus the wire commit that
follows it and turns this candidate's deliberate red green.

**Post-integration checks/evidence.** The deliberate red went GREEN with the wire, which is the
whole point of it: `tests/presentation/designer/designerReferenceView.test.ts` runs **7 passed**,
including *"reaches the real command from the real inspector, once the parent binds it"*. `vue-tsc
-noEmit` exits 0 over the whole tree, `src/` and `tests/` together.

**The integrator took the SECOND of the two shapes this report offered for the wire, not the first,
and the reason is a measurement rather than a preference.** This report recommended the cheapest
form — `useDesignerRuntime()` inside `DesignerInspector.vue`, three lines in one file — and noted it
was the half actually run. It was applied exactly as written and it turned a case red that neither
this report nor its reviewer had reason to look at:

```
FAIL tests/presentation/designer/designerReferencePanels.test.ts
     > mounted in the real inspector > draws all three blocks, bound to the leaf's own write door
Error: The asset designer was mounted without a DesignerRuntime.
 ❯ useDesignerRuntime src/presentation/designer/runtime.ts:674:9
 ❯ setup src/presentation/designer/inspector/DesignerInspector.vue:110:17
```

Reading an injection in that component makes it **un-mountable outside a designer leaf**, and
AD12's panel suite deliberately mounts the real inspector bare — its own header says why, *"because
a component proven bare and bound to nothing is the shape this repository refuses"*. So the cheap
shape bought one saved binding at the cost of the component's testability in isolation. The
prop-drilled shape was taken instead: `removeBackground: () => Promise<void>` on
`DesignerInspector`'s own `defineProps`, bound at `AssetDesignerRoot.vue` beside
`:set-height="runtime.commitHeight"` and `:edit-shape="runtime.editShape"` — which is where every
other collaborator this panel has already comes from, so it is the established shape and not a new
one. `DesignerInspector`'s prop docblock carries the measurement so the next reader does not
re-take the decision from the report alone.

**A FOURTH file the wire needed, named by no plan.** Making `removeBackground` required broke seven
bare mounts of `DesignerReferenceStatus` in `designerReferencePanels.test.ts` — AD12's file, not
this card's — with `TS2322: Property 'removeBackground' is missing`. That is the required-prop gate
doing exactly the job this report argued for it, one file earlier than expected. Fixed by binding a
module-scope no-op at all seven, never by relaxing the prop. Three mounts of `DesignerInspector`
across three suites needed the same.

**`canRemove` lost a conjunct in the same commit.** It read
`design.background !== null && removeBackground !== undefined`; with the prop required the second
arm is unreachable, and an unreachable guard costs a branch it can never pay back against a tree
with roughly nine arms of margin. The *"draws no control when nothing is bound to it"* case was
deleted rather than rewritten with a cast, since a cast would have tested the cast; a comment stands
where it was, saying `vue-tsc` now holds what it held.

**Final status: integrated.** NOT verified: no Obsidian and no pinned Chromium here, so the opacity
slider and the Remove control have had no layout, contrast or hit-size check, and
`docs/tests/cases/` remains unwalked. See this session's report on the full-gate shortfall.
