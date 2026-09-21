# Task report — W12-A (the unreachable guard in `DesignerInspector.vue`)

Outcome: implemented
Owner / worktree / branch: W12-A · `.worktrees/ad10` · `w12a-unreachable-guard`
Base commit / candidate commit: `82838abe3` / the commit that carries this file
Accepted contract revision: `r1`
Allowed scope and shared-file leases: EDIT `src/presentation/designer/inspector/DesignerInspector.vue` and
`tests/presentation/designer/assetDimensions.test.ts`; EDIT any EXISTING test file or harness fixture this
change turns red; CREATE any test file under `tests/`. **Nothing outside that was needed** — no existing
test or fixture went red, so none was edited, and no new test file was created (see *The deletion has no
watched-red, deliberately*).

## Changed files and reason

| File | Purpose | Within lease? |
|---|---|---|
| `src/presentation/designer/inspector/DesignerInspector.vue` | Delete the unreachable first term of `showUnscaledDimensions`; replace the docblock that defended it; correct the shared complexity paragraph above it, whose operator count and "neither changes what draws" the deletion falsified | yes |
| `tests/presentation/designer/assetDimensions.test.ts` | Correct the stale *"`DesignerInspector` was the ONLY reader of `dimensionsUnscaled` in the tree"* claim | yes |
| `docs/tasks/asset-designer-expansion/reports/W12-A-unreachable-guard.md` | This report | yes (own report) |

## Acceptance coverage

| Criterion/test ID | Result | Exact evidence | Remaining issue |
|---|---|---|---|
| The first term is deleted | done | `const showUnscaledDimensions = computed(() => props.design.dimensionsUnscaled);` | none |
| The defending docblock is replaced, not left standing | done | The new block states the producing invariant, names where it is pinned, and names what no check here reaches | none |
| The docblock's cited sibling files still exist | checked | The old block cited `designerInspector`, `assetDimensions` and `designerReferencePanels`; all three exist under `tests/presentation/designer/`. The new block cites only `tests/application/queries/getAssetDesign.test.ts`, which exists | none |
| The claimed pin is real and was watched failing | done | Verbatim red below | ONE of the three assertions reds under this break — see the note, which is why the docblock cites a case by name rather than "three places" |
| The stale "only" is fixed from a grep run AFTER the change | done | Verbatim grep below | none |
| Complexity does not regress on this file | checked | `npx eslint` on the file exits 0 | not a whole-tree measurement; `npm run check` is the integrator's |

## Executed checks

| Command or manual action | Commit / environment | Exit code or observed result | Evidence |
|---|---|---|---|
| `npx vitest run tests/application/queries/getAssetDesign.test.ts`, with `GetAssetDesign` deliberately broken | working tree, break only | **1 failed, 18 passed** | verbatim below |
| `git checkout src/application/queries/GetAssetDesign.ts`, then `git diff --stat` and `git status --short` | working tree | both silent; `dimensionsUnscaled: shape?.footprintPending ?? false,` restored at its own line | nothing of the break survives |
| `npx vitest run tests/presentation/designer/{designerInspector,assetDimensions,designerReferencePanels}.test.ts` | candidate | **3 files, 70 tests passed** | the same 70 the old docblock had measured |
| `npx vitest run tests/presentation/designer/{designerSelectionInspector,designerStyles,designerTraceChecklist,designerInspectorTabs}.test.ts` | candidate | **4 files, 89 tests passed** | every other file naming `rp-designer-unscaled`, `showUnscaledDimensions` or `dimensions.unscaled`, found with `grep -rln` over `tests/ styles/ src/` |
| `npx oxlint` on both changed files | candidate | exit 0, no output — oxlint prints nothing on a clean run, so the exit code is the result | — |
| `npx eslint` on both changed files | candidate | exit 0 | this file's cognitive-complexity history (session eight turned CI red on its template at 17 against `maxCognitive` 15); run rather than assumed |

### The watched-red, verbatim

`src/application/queries/GetAssetDesign.ts` was edited from `?? false` to `?? true` on the
`dimensionsUnscaled` assignment — the one break that produces the state the new docblock calls
impossible: a `true` flag on a design with no shape, and therefore with no `dimensions`. Then:

```
 RUN  v4.1.11 D:/Projects/renovation-planner/.claude/worktrees/renovation-planner-asset-designer-bc5539/.worktrees/ad10

 ❯ |suite| tests/application/queries/getAssetDesign.test.ts (19 tests | 1 failed) 73ms
     × answers null dimensions rather than zeros when there is no footprint 10ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

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
    195|  });
    196|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯


 Test Files  1 failed (1)
      Tests  1 failed | 18 passed (19)
   Start at  08:35:51
   Duration  6.86s (transform 2.26s, setup 0ms, import 5.83s, tests 73ms, environment 0ms)
```

**ONE of the three assertions reds under this break, not three, and this report says so rather than
letting the whole set read as the evidence.** The brief's *"asserted at three places"* is accurate as
a count of assertions on the FIELD; only one of them asserts the IMPLICATION the new docblock rests
on. The other two — *keeps a measured outline measured when its background is replaced*, and the
five-row `it.each` — every row seeds a shape, so `shape?.footprintPending` answers and the `??`
default never fires in them. The shapeless design is the only state in which `dimensionsUnscaled`
could part from `dimensions`, which is exactly why that case is the one that goes red, and it
asserts `dimensions` null and `dimensionsUnscaled` false on the SAME DTO — the implication itself,
in one case. The new docblock therefore cites that case by name.

### The grep the corrected sentence was written from, verbatim, run AFTER the change

```
$ grep -rn "dimensionsUnscaled" src/
src/application/queries/GetAssetDesign.ts:52:	readonly dimensionsUnscaled: boolean;
src/application/queries/GetAssetDesign.ts:156:			dimensionsUnscaled: shape?.footprintPending ?? false,
src/presentation/designer/inspector/DesignerReferenceStatus.vue:91: * `GetAssetDesign`'s own `dimensionsUnscaled` docblock refuses for both of its readings.
src/presentation/designer/inspector/DesignerSelectionInspector.vue:207:			return props.design.dimensionsUnscaled ? [] : sizeFields(selection);
src/presentation/designer/inspector/DesignerInspector.vue:134: * The unscaled warning rides on `dimensionsUnscaled` ALONE, and a `dimensions !== null` beside
src/presentation/designer/inspector/DesignerInspector.vue:138: * returns an `err`, so no DTO at all, when that measurement refuses — while `dimensionsUnscaled`
src/presentation/designer/inspector/DesignerInspector.vue:145: * `dimensions` null and `dimensionsUnscaled` false on one DTO — the shapeless design being the
src/presentation/designer/inspector/DesignerInspector.vue:155:const showUnscaledDimensions = computed(() => props.design.dimensionsUnscaled);
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

**Seventeen lines is not seventeen readers, and separating them is the whole exercise.** Every hit
was read:

- **Producer, not a reader** — `GetAssetDesign.ts:52` (the DTO's own declaration) and `:156` (the
  assignment).
- **Reads the value** — `DesignerSelectionInspector.vue:207`, `DesignerInspector.vue:155`,
  `DesignerUsePlan.vue:60`, `AssetDesignerRoot.vue:178` (`gridStep`) and `:269` (`editDimensions`),
  `AssetInspectorShape.vue:161`. **Six read sites across five modules.**
- **Prose that merely names the field** — `DesignerReferenceStatus.vue:91`,
  `DesignerInspector.vue:134`, `:138` and `:145` (this card's own new docblock — the grep counting
  the documentation it was run to fix is precisely the miscount the lease warned about),
  `DesignerUsePlan.vue:33` and `:34`, `AssetDesignerRoot.vue:252`, `dialog-store.ts:132`,
  `en.ts:780`.

The sentence written into `assetDimensions.test.ts` names the modules and names the command, and
says outright that the line count is not a reader count. It deliberately states **no figure**,
because a figure in prose is a figure nothing re-runs. The figures above are in this report, which
is dated by construction.

## Verification not performed

Named rather than left blank. All of these are the integrator's or CI's under the brief:

- **`npm run check`** — not run. Reserved to the integrator; the machine has 7.8 GB of shared RAM
  and two gates at once thrash rather than queue (`CLAUDE.md`, *Two gates at once do not cost 2x*).
- **`npm run check:fast`** — not run, same reason; it is a full-suite `vitest run`.
- **`npm run test:coverage`, and any `coverage-final.json` read** — not run. Coverage is CI's.
  **What is reasoning and not a measurement**: the deleted `&&` was a two-arm branch whose
  false-from-the-first-term arm was unreachable, so it could never be covered; removing it can only
  take an uncovered branch out of `DesignerInspector.vue`. The branch floor is 98 and this moves the
  number the safe way — but that argument is not a coverage run and must not be read as one.
- **`npm run build` / `vue-tsc -noEmit`** — not run; not on the brief's permitted list. The change
  deletes a boolean conjunct and rewrites comments, introducing no new name, type or narrowing, so
  no type-level risk is identified — but nothing here CHECKED that, and the `build` leg is where it
  is checked.
- **`npm run analyze`** — not run; the integrator's. Nothing was exported, un-exported or made
  private, and no file was added or removed from the import graph.
- **`npm run harness`, `npm run harness-shot`, `npm run test-build`** — not run. No rendered-layout
  claim is made anywhere in this report. A rendered check would also be near-worthless for this
  card: the only state whose drawing changes is one `GetAssetDesign` cannot produce.
- **Obsidian, in a vault** — not run, and not available to this card.
- **The whole suite** — not run. What was run is the three files the old docblock named, plus every
  other file under `tests/`, `styles/` and `src/` that `grep -rln` finds naming
  `rp-designer-unscaled`, `showUnscaledDimensions` or `dimensions.unscaled`. That is wider than the
  brief asked for and it is still not the suite.

### The deletion has no watched-red, deliberately, and none was invented

The brief is right and this card did not work around it. An unreachable arm cannot be made to fail.
A test that appeared to watch this deletion red would have to hand-build an `AssetDesignDto` with
`dimensionsUnscaled: true` beside `dimensions: null` — precisely the state `GetAssetDesign`
excludes — so the case would pin a fiction, and would be the first thing deleted by whoever next
changed the DTO. **The watched-red belongs to the SENTENCE**, and it is above.

The new docblock says as much in its last paragraph rather than leaving a wider claim standing: the
guarantee is the query's and not this component's, and a hand-built DTO can still draw the warning
beside no figure. That is the narrowed sentence the repository's rule asks for, and its ugliness is
the information.

## Data and integration implications

Schema/migration change: none.
Relevant renderer/export/revision consumers: none. `showUnscaledDimensions` feeds one `v-if` on
`.rp-designer-unscaled` in this component and nothing else; the `<dl>` above it keeps its own
`v-if="design.dimensions !== null"`, which is untouched.
Undo/no-op/conflict/failure coverage: unaffected — this computed dispatches nothing.
Identity/unit/quantity/calibration invariants: the calibration-adjacent one is the subject, and it
is unchanged in the code that OWNS it. `GetAssetDesign` is untouched in the candidate; the break
above was reverted and the working tree is clean of it.
Shared root/runtime/locales wiring still required: none. No locale key, stylesheet, prop, mount or
registration changed, which is why nothing outside the lease was needed.
Rollback/recovery considerations: the candidate is a one-line behaviour change plus comments;
reverting the commit restores the previous guard exactly.

### One finding OUTSIDE the lease, reported rather than taken

**The same false "only" sentence lives in `src/presentation/designer/AssetDesignerRoot.vue`**, in
`editDimensions`'s docblock (the grep prints its neighbourhood as `:252`): *"Nothing anywhere said
so: `DesignerInspector` was the only reader of that flag in the whole tree."* That file is not in
W12-A's lease and was not touched. It is the same claim this card was dispatched to fix in
`assetDimensions.test.ts` — and it sits in the very function that test case drives, so fixing one
copy and leaving the other means the package disagrees with itself in two places rather than one,
with the surviving copy being the one a reader of `editDimensions` meets first.

Precise integration change request: in that docblock, replace the clause with one that names the
grep and claims no category — for example *"Nothing anywhere said so. The flag has several other
readers (`grep -rn "dimensionsUnscaled" src/`); what none of them does is offer its number back as a
form DEFAULT, which is this function's own hazard."* That last clause is a claim about
`editDimensions` alone, checkable by reading the five reader modules, and it re-asserts no "only"
over the tree.

### One observation, deliberately NOT taken

`showUnscaledDimensions` now carries no boolean operator at all, so the complexity argument that
created it no longer applies to it, and the template could read `v-if="design.dimensionsUnscaled"`
with the computed deleted. It is kept, for a reason now stated in the shared docblock above it: the
name is where the explanation for having no second term lives, and a bare property read in the
template would leave the next reader nowhere to find out why — which is the same reader who would
otherwise re-add the term. Deleting it would also move this template's cognitive measurement in an
unmeasured direction on a file with a red-CI history, for one saved line. The shared paragraph above
the two computeds was corrected in the same edit, because both *"these two carried four of them
between them"* and *"Neither changes what draws"* stopped being true with this deletion.

## Reviewer and integrator acceptance

Reviewer outcome and findings:
Integrated commit:
Post-integration checks/evidence:
Final status:

Only the integrator/reviewer fills final acceptance. A worker's completion statement is not this field.
