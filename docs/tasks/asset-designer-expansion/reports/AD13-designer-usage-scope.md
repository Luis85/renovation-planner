# Task report — AD13-C3 (the designer's usage scope)

Outcome: **implemented**, with one integration change request outstanding (see below) that does
NOT block the block from shipping.
Owner / worktree / branch: worker AD13-C3 · `.worktrees/ad13c` · `ad13c3-designer-usage-scope`
Base commit / candidate commit: `f947d8079` / **`3f73023d0`**
Accepted contract revision: `r1`, plus ruling **AD13-R1** (2026-09-18)
Allowed scope and shared-file leases: the wave-6 row for AD13-C3 — four owned source files, one NEW
component, the NEW locale pair, plus three ADDITIVE-ONLY sub-lets (`DesignerInspector.vue`,
`{en,de}.ts`, `styles/designer-object.css`) and this card's own tests.

## What ships

`src/presentation/designer/inspector/DesignerUsageScope.vue`, mounted in the Inspector's asset
block directly under the asset's NAME and above every control that rewrites it — Edit dimensions,
Start from preset, and every geometry command the canvas dispatches. It draws a heading, the plans
that place this definition with their placement counts, and `AssetUsageScope.vue`'s own four states.
It is a passive statement: no dialog, no confirm, no dismiss control, and **no control of any kind**
(asserted as a category at the block, not by naming the two kinds considered).

`guardAssetUsage(ports, logger, map)` is extracted out of `guardAssetDuplication` under the existing
`query.listPlansUsingAsset.failed` event name. `grep -rn 'new ListPlansUsingAsset' src/` prints
exactly one line at the candidate commit; its callers are `guardAssetDuplication` (for
`assetLibraryDeps`) and `assetDesignerDeps` directly. Composing `guardAssetDuplication` from the
designer was refused as the ruling asks — it would build a `DuplicateAssetCommand` nothing there
dispatches.

## Changed files and reason

| File | Purpose | Within lease? |
|---|---|---|
| `src/plugin/guardedAssetLibrary.ts` | `guardAssetUsage` extracted; `guardAssetDuplication` calls it; its "only consumer either door has" sentence corrected, since the scope now has two | yes |
| `src/plugin/assetDesignerDeps.ts` | calls `guardAssetUsage` off `persistence.{projects,plans,geometry}` and `VAULT_EXCEPTION_MAPPER`, passing the query to `createAssetDesignerQueries` | yes |
| `src/presentation/read-models/assetDesignerQueries.ts` | second member `listPlansUsingAsset`; refusing arm in `unavailableAssetDesignerQueries`; second factory parameter; header's "one member" claim rewritten and pinned by a test | yes |
| `src/plugin/assetLibraryDeps.ts` | **NOT changed.** The extraction is behind `guardAssetDuplication`, whose signature and return shape are unchanged, so this file needed no edit | n/a |
| NEW `src/presentation/designer/inspector/DesignerUsageScope.vue` | the block | yes |
| `src/presentation/designer/inspector/DesignerInspector.vue` | ONE import line, ONE `<DesignerUsageScope />` mount and its explaining comment. Nothing else in that file | yes (additive sub-let) |
| `styles/designer-object.css` | appended four rules (`usage-scope`, `usage-title`, `usage-note`, `usage-plans`). 61 → 117 lines against the 400 cap; `styles/designer.css` untouched; nothing reordered and nothing moved in | yes (additive sub-let) |
| `src/presentation/i18n/locales/{en,de}.ts` | **NOT changed** — see the change request | n/a |
| NEW `{en,de}/assetUsageScope.ts` | **NOT created** — see the change request | n/a |
| NEW `tests/presentation/designer/designerUsageScope.test.ts` | nine cases, through the real `DesignerInspector` | yes |
| NEW `tests/helpers/designerQueries.ts` | `unwiredPlanUsage` — production's own refusal, for the fifteen suites that built `{ getAssetDesign }` as a literal | yes |
| `tests/plugin/assetDesignerWiring.test.ts` | one case: the COMPOSED plugin draws a real scope, not a refusal | yes |
| `tests/presentation/read-models/assetDesignerQueries.test.ts` | three cases: the new mapping's pass-through, the refusing arm's category, the bundle's exact key set | yes |
| `tests/harness/assetDesigner.ts` | a populated two-plan scope, so `?view=asset-designer` shows the state worth looking at | yes |
| `tests/helpers/designerRig.ts` + 13 designer suites | one `listPlansUsingAsset` member each, because the bundle's new member is REQUIRED | yes |

**The 13-suite fan-out is the price of the member being required rather than optional**, which the
brief demands and which `unavailableAssetDesignerQueries`' own docblock demands: absence would mean
something different from any default. No suite's behaviour changed — `unwiredPlanUsage` is
`unavailableAssetDesignerQueries().listPlansUsingAsset`, borrowed rather than invented, because a
stub answering `ok({ plans: [], unreadable: 0 })` would be a fake KINDER than the real thing at the
one surface whose job is to state a blast radius.

## Acceptance coverage

| Criterion/test ID | Result | Exact evidence | Remaining issue |
|---|---|---|---|
| AD13-R1 part 1 — a usage scope exists in the designer | met | `designerUsageScope.test.ts` "names the plans that place this asset, under a heading that says what they are"; `assetDesignerWiring.test.ts` "draws a composed usage scope in the inspector, not a refusal" | — |
| part 2 — a passive STATEMENT, not a confirmation | met | "draws no control of any kind" — `block.findAll('button, a, input, select, textarea, [role="button"]')` is empty | — |
| part 3 — a SECOND CONSUMER, never a second query | met | constructed once, in `guardAssetUsage`; two callers. **The grep prints TWO lines, not one** — the construction and the docblock sentence about it — which the review caught and this row originally got wrong | — |
| part 3 — the four states are `AssetUsageScope.vue`'s own, no fifth spelling | met | four cases; every string is a `view.asset-library.used-in-plans.*` key, no new key exists | — |
| the read is GATED on `indexScanCompleted()` | met | "does not read at all before the index scan has run, and says the scope is unknown" — asserts BOTH that nothing was asked and that *unknown* is drawn | — |
| `unavailableAssetDesignerQueries()` gains a refusing arm in the same edit | met | "refuses the usage scope as a persistence failure" + "declares an arm for every member, by exact key set" | — |
| C11 *show impact scope*, in the designer's own words | **partially** | the scope and its heading ship; the designer-only impact sentence does not | **change request 1** |

## Watched failing — verbatim red

Each invariant was reverted, the suite run, the red read, and the code restored. All four reds are
from this branch.

**1. The index-scan gate** (`scanned.value = true; void section.run(...)` in place of the gate):

```
FAIL  |suite| tests/presentation/designer/designerUsageScope.test.ts > the designer’s usage scope > does not read at all before the index scan has run, and says the scope is unknown
AssertionError: expected [ 'asset-01M2TZMGDHNCFXK0BQCGJWN15N' ] to deeply equal []

- Expected
+ Received

- []
+ [
+   "asset-01M2TZMGDHNCFXK0BQCGJWN15N",
+ ]
```

**2. The mount** (`<DesignerUsageScope />` deleted from `DesignerInspector.vue`) — 10 failures:

```
❯ tests/presentation/designer/designerUsageScope.test.ts (9 tests | 9 failed)
❯ tests/plugin/assetDesignerWiring.test.ts (6 tests | 1 failed)

FAIL  tests/plugin/assetDesignerWiring.test.ts > ... > draws a composed usage scope in the inspector, not a refusal
AssertionError: the given combination of arguments (undefined and string) is invalid for this assertion. ...

FAIL  tests/presentation/designer/designerUsageScope.test.ts > ... > names the plans that place this asset ...
Error: Cannot call text on an empty DOMWrapper.
```

**`tests/presentation/designer/regionsReachable.test.ts` stayed GREEN through that revert**, because
the `import DesignerUsageScope from './DesignerUsageScope.vue'` line was still there — the documented
blind spot in that instrument's own header ("it reads specifier text, so a component imported and
never rendered counts as reached"). What actually catches an unrendered import is
`@typescript-eslint/no-unused-vars`, which I did not separately re-measure on this branch; I am
relying on that header's recorded measurement rather than my own.

**3. The composition** (`guardAssetUsage(...)` swapped for `unavailableAssetDesignerQueries().listPlansUsingAsset`):

```
FAIL  |suite| tests/plugin/assetDesignerWiring.test.ts > a designer leaf restored by the composed plugin > draws a composed usage scope in the inspector, not a refusal
AssertionError: expected 'Editing this asset changes every plan…' to contain 'No plan places this asset'

Expected: "No plan places this asset"
Received: "Editing this asset changes every plan that places it.Settings could not be read. Fix or remove data.json in the plugin folder, then reload the app."
```

(That `Received` still carries the impact sentence because this revert was run before the sentence
was withdrawn. The case's assertion on the scope is unchanged; only its first `expect` now names the
heading.)

**4. The additive `unreadable > 0` arm** (the paragraph deleted):

```
FAIL  |suite| tests/presentation/designer/designerUsageScope.test.ts > the designer’s usage scope > keeps the plans it read and says the list may be incomplete
Error: Cannot call text on an empty DOMWrapper.
 ❯ tests/presentation/designer/designerUsageScope.test.ts:157:56
```

One more red was **not** deliberately staged and is worth recording because it corrected a wrong
assumption of mine: the first version of the refusal case asserted the section's generic sentence,
and the real refusal goes through `trError`:

```
AssertionError: expected 'Editing this asset changes every plan…' to contain 'The plans that place this asset could…'
Expected: "The plans that place this asset could not be read, so the scope below is unknown."
Received: "Editing this asset changes every plan that places it.Reading or writing the vault failed unexpectedly. Try again."
```

So the panel now has two different sentences for two different unknowns — the refusal's own words
when a read failed, and the generic line when the GATE declined and no error was ever raised — and
the two cases assert that contrast separately.

## Executed checks

All on the candidate tree at `3f73023d0` unless noted. Every run wrote a full log to
`D:/tmp-claude/`; none was piped through `tail`.

| Command | Environment | Result | Evidence |
|---|---|---|---|
| `npx vue-tsc -noEmit` | worktree, `TEMP=D:/tmp-claude` | **exit 0** | `tsc8.log` empty |
| `npx oxlint --deny-warnings <29 changed files>` | worktree | **exit 0** | `ox3.log` empty |
| `npx eslint <29 changed files> --max-warnings 0` | worktree | **exit 0** | `es3.log` empty |
| `npx vitest run tests/presentation/designer tests/harness` | `VITEST_MAX_WORKERS=2` | **exit 0** — 94 files, 1259 tests | `v10.log` |
| `npx vitest run tests/presentation/library` | (with the designer run above, earlier revision) | **exit 0** — 83 files, 1133 tests combined | `v4.log` |
| `npx vitest run tests/plugin/{assetDesignerWiring,assetLibraryWiring,guardCategory,guardedGroups,libraryOverlapWiring}` | | **exit 0** — 43 tests | `v8.log` |
| `npx vitest run tests/build/{libraryComponentStyles,styles,prototype-styles}` | | **exit 0** — 172 tests | `v5.log` |
| `npx vitest run tests/presentation/i18n tests/build/localeModuleSentenceCase` | | **exit 0** — 197 tests | `v6.log`, `v9.log` |
| `npx vitest run tests/presentation/read-models/assetDesignerQueries.test.ts` | | **exit 0** | `v11.log` |
| `npx eslint src/presentation/i18n/locales/{en,de}.ts --max-warnings 0` **at the BASE content** | | **exit 0** | `es-base.log` — the measurement behind change request 1 |
| the same two files **with one import + one spread each** | | **exit 1**: `en.ts 526:1 File has too many lines (401)`… see below | `es.log` |

The exact red for change request 1, verbatim:

```
src/presentation/i18n/locales/de.ts
  526:1  error  File has too many lines (401). Maximum allowed is 400  max-lines

src/presentation/i18n/locales/en.ts
  875:1  error  File has too many lines (402). Maximum allowed is 400  max-lines
```

`max-lines` skips blanks and comments, so at base `en.ts` counts **exactly 400** and `de.ts` **399**.

## Verification not performed

- **`npm run check`, `npm run test:coverage`, `npm run analyze`** — forbidden to this worker by the
  dispatch (7.8 GB shared box). The integrator runs all four on the integration SHA. In particular
  **I have not measured coverage**, so I cannot state this change's effect on the 98 branch floor;
  see the coverage note below for what I did instead.
- **The full suite.** I ran `tests/presentation/designer`, `tests/presentation/library`,
  `tests/harness`, five `tests/plugin/` files, four `tests/build/` files and
  `tests/presentation/i18n`. I did **not** run `tests/application`, `tests/domain`, `tests/core`,
  `tests/infrastructure`, `tests/contracts`, `tests/release`, the rest of `tests/plugin/` or the
  rest of `tests/build/`. The change touches no domain, application or infrastructure module, but
  that is an argument, not a run.
- **`eslint .` over the whole tree.** I linted the 29 changed files only. The layer bans, the write
  boundary and both text bans are ESLint-only rules; they pass on the files I changed and I have not
  run them tree-wide.
- **Obsidian.** There is no Obsidian in this environment. Nothing here has been opened in a vault,
  so appearance, real `Notice` behaviour and any assumed API are unverified.
  `npm run test-build` was not run.
- **`npm run harness-shot` / any capture.** There is **no pinned Chromium in this environment**, so
  nothing this card draws has been photographed. Spacing, wrapping, overflow, contrast and hit size
  in the Inspector's asset block are therefore unmeasured — which is precisely the class of defect
  CLAUDE.md records those captures as having caught ten times. The harness page now has a populated
  two-plan fixture (`?view=asset-designer`) so a capture is one command away for whoever has a
  browser. **I did not run `npm run harness` either.**
- **Manual walkthrough.** No manual test case was written or run for this block.
- **Migration / performance.** Neither applies: no schema, no durable field, no render cost.

## Coverage — what I did instead of measuring it

I could not run `test:coverage`, so I planned the arms with the code rather than after it, and every
branch in the new component has a case: bound/unbound context, gated/ungated, failed/idle, rows/none,
unreadable/not, and both arms of `failureLabel`'s ternary (the GATE case takes the `error === null`
arm and the refusal case takes the other). Two deliberate choices to reduce arms:

- the loading arm is `section.status.value !== 'ready'` rather than `'idle' || 'loading'`. After the
  refusal arm above it, only idle/loading/ready remain, and `idle` is unreachable once the gate has
  passed because `run` assigns `'loading'` before its first `await` — a disjunction whose second arm
  no test could reach is a branch that can never pay itself back. The component's template carries
  that reasoning.
- the heading and the list are unconditional inside the block, so no branch was spent on them.

**This is not a coverage measurement and must not be read as one.** `coverage-final.json` for the
changed files is the only instrument that can see a single arm, and I did not run it.

## Integration change requests

**1. `en.ts` and `de.ts` have no `max-lines` headroom, so the wave-6 lease's "ONE import line and
ONE spread line each" grant cannot be taken.**

- *Measured, not assumed*: at the base content both files pass `eslint --max-warnings 0` (exit 0);
  with one import and one spread added to each they report `en.ts` 402/400 and `de.ts` 401/400. Both
  runs are logged; the verbatim red is above. So `en.ts` sits at **exactly** its cap and `de.ts` one
  under it.
- *What I did instead*: withdrew the new locale pair entirely and drew the block's heading from
  `view.asset-library.used-in-plans` — the string the library's own panel uses. Nothing in
  `{en,de}.ts` is touched and no locale module was created, so the sub-let is unused rather than
  overrun. The ruling's three parts are all met by what ships; what is missing is only the
  designer-only sentence I had drafted.
- *The request*: give `en.ts` and `de.ts` headroom — the extraction that `en-assetLibrary.ts` and
  `en/editor.ts` already are, not a wider cap — and then add ONE key per locale:
  - `en`: `'designer.inspector.usage-scope': 'Editing this asset changes every plan that places it.'`
  - `de`: `'designer.inspector.usage-scope': 'Änderungen an diesem Objekt wirken sich auf jeden Plan aus, der es platziert.'` (no second person, so the Sie/du rule does not arise)
  - the component then draws it as a `<p class="rp-designer-usage-impact">` above the heading; the
    CSS rule for that class was written and withdrawn with it and is in this branch's history at the
    pre-withdrawal revision.
  - *the cheaper alternative, if headroom is not worth an extraction now*: put the key in
    `{en,de}/assetDuplicate.ts`, which is **already** imported and spread (through `en/editor.ts`),
    costs the aggregators zero lines, and is AD13's own table — its header already describes the
    family as "duplicating a definition and showing which plans use one before an impactful change
    (AD13)". That file is integrator-owned and in nobody's wave-6 row, which is why I did not touch
    it.
- *This is a hypothesis about the cheaper alternative*: I verified that `assetDuplicateEn` is spread
  into `en/editor.ts` and that `editorEn` is spread into `en.ts` (so a key added there reaches
  `StringKey` with no aggregator edit), by reading both files. I did **not** compile or lint a
  version with the key actually placed there.

**No other change request.** Nothing else outside my lease turned out to be needed —
`assetLibraryDeps.ts` was in my lease and did not need editing at all, because the extraction sits
behind `guardAssetDuplication`'s unchanged signature.

## Data and integration implications

Schema/migration change: **none**. No durable field, no schema version, no migration — C09 untouched,
exactly as the ruling states.

Relevant renderer/export/revision consumers: **none**. This is a read; it draws no geometry and
touches no outline, mark or placement path.

Undo/no-op/conflict/failure coverage: the block dispatches no command, so there is no undo entry, no
history and no conflict. Its FAILURE coverage is the four states, three of which are failure-shaped
(refused, unknown-because-ungated, incomplete) and all three are asserted.

Identity/unit/quantity/calibration invariants: untouched. The only id crossing a boundary is the
leaf's `assetId`, asserted to reach the query unchanged.

Shared root/runtime/locales wiring still required: **none for what ships.** The composition is
complete and driven end to end through the composed plugin. The locale pair above is the only
outstanding item and it is an enhancement, not a gap in the wiring.

Rollback/recovery considerations: reverting the commit removes a read-only block and one bundle
member. Nothing persisted, nothing to migrate back.

## Things I am not sure about

- **The `h4`.** The designer's inspector sections all use `<h3 class="rp-designer-panel-title
  rp-designer-section-title">`. I used an `h4` deliberately, because this block is part of the asset
  block rather than a sibling of it and an `h3` would end that block before its own controls — and
  because `AssetUsageScope.vue` draws an `h4` too. `tests/harness/accessibility*.test.ts` passes with
  it (heading order included), but that suite cannot see how it LOOKS, and nobody has looked.
- **The unbound arm.** `DesignerUsageScope` injects and draws nothing when no `AssetDesignerContext`
  is provided. I chose that over the alternative (draw the refusal sentence) because absence means
  "not inside a designer leaf", not "a read failed" — and because the alternative would have added
  markup to four other suites' bare mounts, which I did not want to do in files whose subject is
  something else. A reviewer may reasonably prefer the louder arm. The production side is held by
  `AssetDesignerView` providing the context unconditionally plus the second half of the
  draws-nothing case, not by construction.
- **Where the block sits.** Under the asset's name, above Edit dimensions / Start from preset /
  Open library / Use in plan. My reasoning is in the mount comment. It is a judgement about reading
  order that no gate can grade and that a capture would settle in ten seconds.
- **The harness fixture's two plans.** I chose two so a capture measures a LIST's spacing rather than
  one row's. Nobody has captured it.

## Reviewer and integrator acceptance

Reviewer outcome and findings:
Integrated commit:
Post-integration checks/evidence:
Final status: integrated / verified / blocked
