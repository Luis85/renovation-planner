# Task report — W12-A (the unreachable guard in `DesignerInspector.vue`)

Outcome: implemented (candidate, plus a fix round of seven coordinator items — all prose except item 5, which adds one test case under an explicit lease extension)
Owner / worktree / branch: W12-A · `.worktrees/ad10` · `w12a-unreachable-guard`
Base commit / candidate commit: `82838abe3` / candidate `078e3dc84`, fix round the commit that carries this file
Accepted contract revision: `r1`
Allowed scope and shared-file leases: EDIT `src/presentation/designer/inspector/DesignerInspector.vue` and
`tests/presentation/designer/assetDimensions.test.ts`; EDIT any EXISTING test file or harness fixture this
change turns red; CREATE any test file under `tests/`. **Two lease extensions were granted explicitly at the
fix round** and are recorded as granted: `tests/application/queries/getAssetDesign.test.ts` (item 5) and
`tests/presentation/designer/designerInspector.test.ts` (item 7). Nothing else was needed or taken.
`src/presentation/designer/AssetDesignerRoot.vue` was named as NOT this card's and was not touched.

## Changed files and reason

| File | Purpose | Within lease? |
|---|---|---|
| `src/presentation/designer/inspector/DesignerInspector.vue` | Delete the unreachable first term of `showUnscaledDimensions`; replace the docblock that defended it; correct the shared complexity paragraph above it, whose operator count and "neither changes what draws" the deletion falsified. Fix round: narrow *"any DTO this component can be handed"* to *"any DTO that query PRODUCES"* (item 4), and cite BOTH pinning cases now that both conjuncts are checked (item 5) | yes |
| `tests/presentation/designer/assetDimensions.test.ts` | Replace the stale *"`DesignerInspector` was the ONLY reader of `dimensionsUnscaled` in the tree"* claim. Fix round: the replacement's own opening clause said that sentence was FALSE; it was true when written, and the clause is rewritten (item 1) | yes |
| `tests/application/queries/getAssetDesign.test.ts` | Fix round item 5, under an explicit lease extension: one new case pinning the half of the implication that had been resting on a return type | granted at the fix round |
| `tests/presentation/designer/designerInspector.test.ts` | Fix round item 7, under an explicit lease extension: `buildDesign`'s *"though none below needs it"*, which two cases below contradict | granted at the fix round |
| `docs/tasks/asset-designer-expansion/reports/W12-A-unreachable-guard.md` | This report | yes (own report) |

## Acceptance coverage

| Criterion/test ID | Result | Exact evidence | Remaining issue |
|---|---|---|---|
| The first term is deleted | done | `const showUnscaledDimensions = computed(() => props.design.dimensionsUnscaled);` | none |
| The defending docblock is replaced, not left standing | done | The new block states the producing invariant, names the two cases that pin it, and names what no check here reaches | none |
| The docblock's cited files still exist | checked | The old block cited `designerInspector`, `assetDimensions` and `designerReferencePanels`; all three exist. The new block cites `tests/application/queries/getAssetDesign.test.ts` and two case names inside it, all of which exist | none |
| Both conjuncts of the claimed implication are pinned, each watched failing | done | Two verbatim reds below, against two different breaks of the query | none |
| The stale "only" is replaced, written from a grep run AFTER the change | done | Verbatim grep below, re-captured against the final tree | none |
| That replacement does not itself assert something false | done (fix round) | Opening clause rewritten; archaeology verified independently, below | none |
| `buildDesign`'s stale sentence corrected | done (fix round) | Verified false at the commit that wrote it, below | none |
| Complexity does not regress on the SFC | checked | `npx eslint` exits 0 on it | not a whole-tree measurement; `npm run check` is the integrator's |

## Executed checks

| Command or manual action | Commit / environment | Exit code or observed result | Evidence |
|---|---|---|---|
| `npx vitest run tests/application/queries/getAssetDesign.test.ts`, with `?? false` broken to `?? true` | working tree, break only | **1 failed, 18 passed** | verbatim below |
| `npx vitest run tests/application/queries/getAssetDesign.test.ts`, with the derivation guard narrowed to `shape !== null && !shape.footprintPending` | working tree, break only | **1 failed, 19 passed** — the new case, and nothing else | verbatim below |
| `git checkout src/application/queries/GetAssetDesign.ts` after each break, then `git status --short` | working tree | file absent from the status both times; `?? false` and `if (shape !== null) {` both restored at their own lines | nothing of either break survives, and `GetAssetDesign.ts` is not in this branch's diff |
| `npx vitest run` over `getAssetDesign`, `designerInspector`, `assetDimensions`, `designerReferencePanels` | fix round | **4 files, 90 tests passed** | the candidate's 70 plus this file's 20 |
| `npx vitest run` over `designerSelectionInspector`, `designerStyles`, `designerTraceChecklist`, `designerInspectorTabs` | candidate | **4 files, 89 tests passed** | the first three are the remainder of `grep -rln "rp-designer-unscaled\|showUnscaledDimensions\|dimensions.unscaled" tests/`; **`designerInspectorTabs` is NOT in that set** and was run as an extra, beyond what any grep named — see the correction under item 3 |
| `npx oxlint` on all four touched code files | fix round | exit 0, no output — oxlint prints nothing on a clean run, so the exit code is the result | — |
| `npx eslint` on all four touched code files | fix round | exit 0 | the SFC's cognitive-complexity history (session eight turned CI red on this template at 17 against `maxCognitive` 15); run rather than assumed |
| `git log --oneline -S …`, `git grep -n … d852733bd^`, `git grep -n … d672c3c8a` | archaeology | quoted verbatim below | items 1 and 7 |

### The two watched-reds, verbatim

The implication `DesignerInspector` now relies on has two conjuncts, and neither is checkable by the
same break. Both were run against the working tree with the break present and nothing else, and the
query was restored after each.

**(a) `shape === null` implies `dimensionsUnscaled === false`.** Break: `?? false` to `?? true` on
the `dimensionsUnscaled` assignment.

```
 ❯ |suite| tests/application/queries/getAssetDesign.test.ts (19 tests | 1 failed) 73ms
     × answers null dimensions rather than zeros when there is no footprint 10ms

 FAIL  |suite| tests/application/queries/getAssetDesign.test.ts > GetAssetDesign > answers null dimensions rather than zeros when there is no footprint
AssertionError: expected true to be false // Object.is equality

- Expected
+ Received

- false
+ true

 ❯ tests/application/queries/getAssetDesign.test.ts:194:37
    192|   expect(design.shape).toBeNull();
    193|   expect(design.dimensions).toBeNull();
    194|   expect(design.dimensionsUnscaled).toBe(false);
       |                                     ^

 Test Files  1 failed (1)
      Tests  1 failed | 18 passed (19)
```

**(b) a flagged design always carries `dimensions`.** Break: the derivation's guard narrowed from
`if (shape !== null)` to `if (shape !== null && !shape.footprintPending)`.

```
 ❯ |suite| tests/application/queries/getAssetDesign.test.ts (20 tests | 1 failed) 55ms
     × measures dimensions for a PENDING footprint too, so a flagged design always has numbers 9ms

 FAIL  |suite| tests/application/queries/getAssetDesign.test.ts > GetAssetDesign > measures dimensions for a PENDING footprint too, so a flagged design always has numbers
AssertionError: expected null not to be null
 ❯ tests/application/queries/getAssetDesign.test.ts:204:30
    202|
    203|   expect(dto.dimensionsUnscaled).toBe(true);
    204|   expect(dto.dimensions).not.toBeNull();
       |                              ^

 Test Files  1 failed (1)
      Tests  1 failed | 19 passed (20)
```

**Break (b) reds exactly one case and leaves nineteen green**, which is the evidence the new case is
load-bearing rather than a restatement of one already there: `derives dimensions from the footprint`
seeds a NON-pending shape and never notices, and the five `it.each` rows assert the flag alone.

**A correction to the dispatch brief, which the reviewer confirmed.** The brief said the producing
invariant is *"asserted at three places"* in that file. That is an accurate count of assertions on
the FIELD and not of assertions on the implication: the background-replacement case and all five
`it.each` rows seed a shape, so `shape?.footprintPending` answers and the `??` default never fires
in any of them. Conjunct (a) is reachable only through the shapeless case. The docblock therefore
cites cases by NAME rather than repeating a count.

### The grep the corrected sentence was written from, verbatim, re-captured against the final tree

**Re-run and re-pasted at the fix round.** The candidate's report pasted a block captured mid-edit:
four of its hits were off by one line against the tree that shipped, while every figure derived from
it was right. A block labelled verbatim that does not reproduce is the same defect this card exists
to fix, landing in the evidence column, so it is replaced rather than annotated.

```
$ grep -rn "dimensionsUnscaled" src/
src/application/queries/GetAssetDesign.ts:52:	readonly dimensionsUnscaled: boolean;
src/application/queries/GetAssetDesign.ts:156:			dimensionsUnscaled: shape?.footprintPending ?? false,
src/presentation/designer/inspector/DesignerReferenceStatus.vue:91: * `GetAssetDesign`'s own `dimensionsUnscaled` docblock refuses for both of its readings.
src/presentation/designer/inspector/DesignerSelectionInspector.vue:207:			return props.design.dimensionsUnscaled ? [] : sizeFields(selection);
src/presentation/designer/inspector/DesignerInspector.vue:135: * The unscaled warning rides on `dimensionsUnscaled` ALONE, and a `dimensions !== null` beside
src/presentation/designer/inspector/DesignerInspector.vue:139: * returns an `err`, so no DTO at all, when that measurement refuses — while `dimensionsUnscaled`
src/presentation/designer/inspector/DesignerInspector.vue:160:const showUnscaledDimensions = computed(() => props.design.dimensionsUnscaled);
src/presentation/designer/inspector/DesignerUsePlan.vue:33: *   in the first case while `dimensionsUnscaled` IS `footprintPending` (`GetAssetDesign` assigns
src/presentation/designer/inspector/DesignerUsePlan.vue:34: *   it from that field). So `dimensions !== null && !dimensionsUnscaled` is the same predicate the
src/presentation/designer/inspector/DesignerUsePlan.vue:60:const placeable = computed(() => props.design.dimensions !== null && !props.design.dimensionsUnscaled);
src/presentation/designer/AssetDesignerRoot.vue:178:	if (!workspace.gridVisible || current === null || current.dimensionsUnscaled) return null;
src/presentation/designer/AssetDesignerRoot.vue:252: * placeholder pixels into authored millimetres. `dimensionsUnscaled` is exactly the state the
src/presentation/designer/AssetDesignerRoot.vue:269:	const unscaled = current?.dimensionsUnscaled === true;
src/presentation/dialogs/dialog-store.ts:132:	 * `dimensionsUnscaled` is set. Optional, because the ordinary case has nothing to warn
src/presentation/i18n/locales/en.ts:780:	// The warning `dimensionsUnscaled` earns — a traced outline captured before this asset had
src/presentation/library/AssetInspectorShape.vue:161:	return { kind: design.dimensionsUnscaled ? 'unscaled' : 'measured',
```

**Sixteen lines is not sixteen readers, and separating them is the whole exercise.** Every hit was
read:

- **Producer, not a reader** — `GetAssetDesign.ts:52` (the DTO's declaration) and `:156` (the
  assignment).
- **Reads the value** — `DesignerSelectionInspector.vue:207`, `DesignerInspector.vue:160`,
  `DesignerUsePlan.vue:60`, `AssetDesignerRoot.vue:178` (`gridStep`) and `:269` (`editDimensions`),
  `AssetInspectorShape.vue:161`. **Six read sites across five modules.**
- **Prose that merely names the field** — `DesignerReferenceStatus.vue:91`,
  `DesignerInspector.vue:135` and `:139` (this card's own new docblock — the grep counting the
  documentation it was run to fix is exactly the miscount the lease warned about),
  `DesignerUsePlan.vue:33` and `:34`, `AssetDesignerRoot.vue:252`, `dialog-store.ts:132`,
  `en.ts:780`.

The line count moved from seventeen to sixteen between the candidate and the fix round with no
reader added or removed, purely because a docblock was reworded. That is the argument for the
sentence in `assetDimensions.test.ts` naming the command and stating **no figure**. The figures here
are in a report, which is dated by construction.

### Item 1 — the archaeology, verified here rather than taken on the coordinator's word

The coordinator was right and the candidate's replacement sentence was the false one. Verified
independently before acting:

```
$ git log --oneline -S "was the ONLY reader of" -- tests/presentation/designer/assetDimensions.test.ts
d852733bd Stop the dimensions dialog laundering unscaled numbers into millimetres

$ git grep -n "dimensionsUnscaled" d852733bd^ -- src/
d852733bd^:src/application/queries/GetAssetDesign.ts:45:	readonly dimensionsUnscaled: boolean;
d852733bd^:src/application/queries/GetAssetDesign.ts:128:			dimensionsUnscaled: shape?.footprintPending ?? false,
d852733bd^:src/presentation/designer/inspector/DesignerInspector.vue:108:			v-if="dimensions !== null && design.dimensionsUnscaled"
d852733bd^:src/presentation/i18n/locales/en.ts:524:	// The warning `dimensionsUnscaled` earns — a traced outline captured before this asset had
```

Producer twice, one locale comment, **one reader**. The past-tense sentence was exact about the tree
it described. One step further, which pins down why it misleads — the same grep AT `d852733bd`:

```
$ git grep -n "dimensionsUnscaled" d852733bd -- src/ | grep -v "^d852733bd:src/application"
d852733bd:src/presentation/designer/AssetDesignerRoot.vue:184: * placeholder pixels into authored millimetres. `dimensionsUnscaled` is exactly the state the
d852733bd:src/presentation/designer/AssetDesignerRoot.vue:201:	const unscaled = current?.dimensionsUnscaled === true;
d852733bd:src/presentation/designer/inspector/DesignerInspector.vue:108:			v-if="dimensions !== null && design.dimensionsUnscaled"
d852733bd:src/presentation/dialogs/dialog-store.ts:132:	 * `dimensionsUnscaled` is set. Optional, because the ordinary case has nothing to warn
d852733bd:src/presentation/i18n/locales/en.ts:524:	// The warning `dimensionsUnscaled` earns — a traced outline captured before this asset had
```

**It stopped holding inside the very commit that wrote it**, which added `editDimensions`'s own
read. So the defect is ambiguity rather than falsity: a true past-tense claim, in a file nobody
reads alongside its own history, which three separate readers in a row — the hand-off author, the
coordinator, and this card — took as present tense. A sentence three careful readers misread is
badly written whatever its truth value, and that is what the rewritten clause now says. Everything
after the opening clause is unchanged: the modules, the command, "run it rather than trusting this
list", and no figure.

### Item 7 — the same question asked of `buildDesign`, with the opposite answer

The coordinator's rule for item 1 was applied here too rather than assuming this one was false:

```
$ git log --oneline -S "though none below needs it" -- tests/presentation/designer/designerInspector.test.ts
d672c3c8a The designer's inspector: derived dimensions, an honest warning, one editable scalar

$ git grep -n "dimensions: null" d672c3c8a -- tests/presentation/designer/designerInspector.test.ts
d672c3c8a:…designerInspector.test.ts:33: * leaves the fixture's own 1200×800 pair; passing `dimensions: null` is how a case would ask
d672c3c8a:…designerInspector.test.ts:89:		const wrapper = mountInspector({ dimensions: null });
```

**This one WAS false in the commit that wrote it.** One call site existed in that same commit; a
second arrived at `8ea7a0551`. Unlike item 1's sentence, no rewrite can make it a true statement
about any tree. The correction names the two cases, and notes that of the three lines
`grep -n "dimensions: null"` prints today, one is the docblock sentence itself — the same
prose-in-the-grep trap, in the file next door.

## Verification not performed

Named rather than left blank. All of these are the integrator's or CI's under the brief:

- **`npm run check`** — not run. Reserved to the integrator; the machine has 7.8 GB of shared RAM
  and two gates at once thrash rather than queue (`CLAUDE.md`, *Two gates at once do not cost 2x*).
- **`npm run check:fast`** — not run, same reason; it is a full-suite `vitest run`.
- **`npm run test:coverage`, and any `coverage-final.json` read** — not run. Coverage is CI's.
  **What follows is arithmetic and not a measurement, and the candidate's version of this paragraph
  named the wrong mechanism.** Deleting the `&&` does not remove "an uncovered branch"; it removes
  BOTH arms of a two-arm branch, one of which was covered and one of which could not be. The file's
  branch ratio goes from `(c+1)/(t+2)` to `c/t`, which is an improvement only while `c/t ≥ 0.5` —
  comfortably true at a floor of 98, so the direction survives while the stated reason did not. The
  fix round also adds one test case, which can only add coverage. Neither statement is a coverage
  run.
- **`npm run build` / `vue-tsc -noEmit`** — not run; not on the brief's permitted list. The change
  deletes a boolean conjunct, rewrites comments and adds one test case whose every symbol is already
  imported in its file — no new name, type or narrowing is introduced, so no type-level risk is
  identified. Nothing here CHECKED that; the `build` leg is where it is checked.
- **`npm run analyze`** — not run; the integrator's. Nothing was exported, un-exported or made
  private, and no file entered or left the import graph.
- **`npm run harness`, `npm run harness-shot`, `npm run test-build`** — not run. No rendered-layout
  claim is made anywhere in this report. A rendered check would also be near-worthless here: the
  only state whose drawing changes is one `GetAssetDesign` cannot produce.
- **Obsidian, in a vault** — not run, and not available to this card.
- **The whole suite** — not run. What was run is the four files this branch touches plus every other
  file `grep -rln` finds naming `rp-designer-unscaled`, `showUnscaledDimensions` or
  `dimensions.unscaled`, plus `designerInspectorTabs` as an extra. That is wider than the brief
  asked for and it is still not the suite.

### The deletion has no watched-red, deliberately, and none was invented

An unreachable arm cannot be made to fail. A test that appeared to watch this deletion red would
have to hand-build an `AssetDesignDto` with `dimensionsUnscaled: true` beside `dimensions: null` —
precisely the state `GetAssetDesign` excludes — so it would pin a fiction and be the first thing
deleted by whoever next changed the DTO. **The watched-red belongs to the SENTENCE**, and after the
fix round there are two of them, one per conjunct, both above.

The docblock's last paragraph still draws the boundary rather than claiming past it: the guarantee
is the query's, and a hand-built DTO can still draw the warning beside no figure. Item 4's
correction is what makes that a boundary rather than a contradiction — the first sentence now says
*"any DTO that query PRODUCES"*, where it had said *"any DTO this component can be handed"*, which a
hand-built one also is.

## Data and integration implications

Schema/migration change: none.
Relevant renderer/export/revision consumers: none. `showUnscaledDimensions` feeds one `v-if` on
`.rp-designer-unscaled` in this component and nothing else; the `<dl>` above it keeps its own
`v-if="design.dimensions !== null"`, untouched.
Undo/no-op/conflict/failure coverage: unaffected — this computed dispatches nothing.
Identity/unit/quantity/calibration invariants: the calibration-adjacent one is the subject and is
unchanged in the code that OWNS it. `GetAssetDesign.ts` is not in this branch's diff; both breaks
above were reverted and `git status` was checked clean after each.
Shared root/runtime/locales wiring still required: none. No locale key, stylesheet, prop, mount or
registration changed.
Rollback/recovery considerations: a one-line behaviour change, comments, and one added test case;
reverting restores the previous guard exactly.

### Not this card's, and not touched

`src/presentation/designer/AssetDesignerRoot.vue`'s `editDimensions` docblock carries the second
copy of the same past-tense sentence. **The coordinator is taking it as an integrator repair and it
was not touched here.** One note for whoever writes it: the candidate's report characterised that
copy as "false", and item 1's archaeology shows it is not — it is the same true-when-written,
misread-later sentence, entered in the same commit `d852733bd`. Repairing it as though it were false
would put a second wrong sentence where a wrong sentence already was.

### One observation, deliberately NOT taken

`showUnscaledDimensions` now carries no boolean operator, so the complexity argument that created it
no longer applies to it, and the template could read `v-if="design.dimensionsUnscaled"` with the
computed deleted. It is kept, for a reason now stated in the shared docblock above it: the name is
where the explanation for having no second term lives, and a bare property read in the template
would leave the next reader — the one who would otherwise re-add the term — nowhere to find out why.
Deleting it would also move this template's cognitive measurement in an unmeasured direction on a
file with a red-CI history, for one saved line.

## Reviewer and integrator acceptance

Reviewer outcome and findings: APPROVE WITH CONDITIONS, zero code findings. The reviewer confirmed
the deletion is a no-op (`dimensions` set only inside `if (shape !== null)`, the `err` returned when
`dimensionsOf` refuses, no second producer of `AssetDesignDto`, every fixture setting the flag true
carrying non-null dimensions) and confirmed this card's correction to the dispatch brief's "three
places". Seven fix-round items followed, six prose and one (item 5) adding a test case under an
explicit lease extension; all seven are addressed above.
Integrated commit:
Post-integration checks/evidence:
Final status:

Only the integrator/reviewer fills final acceptance. A worker's completion statement is not this field.
