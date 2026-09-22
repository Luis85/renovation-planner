# Task report — W19-B plan usage project name

Outcome: implemented
Owner / worktree / branch: W19-B · `.worktrees/ad13b` · `w19b-usage-project-name`
Base commit / candidate commit: `3e2bc2032` / recorded in the hand-off
Accepted contract revision: `r1`
Allowed scope and shared-file leases: `application/queries/ListPlansUsingAsset.ts`,
`presentation/library/AssetUsageScope.vue`,
`presentation/designer/inspector/{DesignerUsageScope,DesignerUsagePlans}.vue`,
`presentation/read-models/{assetLibraryQueries,assetDesignerQueries}.ts` **only if the envelope
shape had to be threaded**, `i18n/locales/{en,de}/assetDuplicate.ts` edited in place, and this
card's own tests. `i18n/locales/{en,de}/editor.ts` was NOT touched and no new locale module was
needed.

## READ FIRST — two lease facts a reviewer must check

1. **The two read-model files were NOT needed and are NOT touched.** `assetLibraryQueries.ts` and
   `assetDesignerQueries.ts` pass the `AssetPlanUsage` envelope through by type; adding a field to
   the ROW inside it threads without an edit. The conditional half of the lease went unused.
2. **Two files outside the lease list were edited and the extension is ASSUMED, not granted** —
   `tests/harness/assetDesigner.ts` and `tests/harness/assetLibrary.ts`. `projectName` is a
   REQUIRED field on `PlanAssetUsage`, so every literal constructing a row must carry it or
   `vue-tsc` fails the tree. **The instrument that settles that set is `npx vue-tsc -noEmit`
   (exit 0, whole tree), NOT the grep** — an earlier revision of this line called
   `grep -rn "planName" src/ tests/` *"the complete list"*, which it cannot be: it over-reports
   on unrelated `planName` keys and would miss a spread, a builder or a cast. The grep found the
   files; the compiler is what proves none was missed. These two harness fixtures are the only
   ones outside this card's own test files.
   The edits are data only — one string per row, no behaviour, no assertion — and neither file
   appears in W19-A's lease row. **If the integrator declines the extension, the alternative is a
   tree that does not compile**, so the extension is requested here rather than the change being
   split.

## The design decision, and the losing side

**Taken: the project name goes INSIDE the existing label string, unconditionally.**
`view.asset-library.used-in-plans.plan` becomes `'{name} ({project}) — {count} placement(s)'`
(German `'{name} ({project}) — {count} Platzierung(en)'`), one key, no new element, no new CSS, no
new branch. `(s)` and `(en)` are untouched — **AD18-R7** rules that spelling stays, and the en
header now says so where the next reader stands.

**Why inside the string rather than beside it.** `strings.ts`'s own rule decides it: *"ONE KEY PER
LABEL, never a translated fragment concatenated with a name: word order and the punctuation around
an interpolated name are the translator's to choose."* A second element is exactly that
concatenation — markup would own where the project sits and what separates it from the plan name,
with the punctuation out of the translator's reach. Inside the template, German may respell the
parentheses if it ever needs to.

**The losing side, which is real.** The sibling `AssetInspectorUsedIn.vue` draws its
disambiguator — the project's PATH — as a separate `<span class="rp-al-used__path">` beside the
label, so the separate-element form is this directory's own precedent and would have read as the
consistent choice. It loses on three counts: it needs a new class in `styles/`, which is outside
this card's lease entirely; it breaks the one-key rule above; and it buys nothing on layout,
because a separate element occupies a second line ALWAYS while an inline qualifier occupies one
only when the combined text exceeds the rail.

**Also refused: conditional disclosure** (name the project only when two rows would otherwise be
identical). It adds a branch with two arms to cover against a 98% branch floor; it leaves a lone
`Kitchen` row unqualified, so a user reading one row still cannot tell which project it belongs
to; and the rule would have to be re-derived by every later reader of two panels that build the
label independently.

**Correction, fix round — that paragraph argued past a precedent I did not know was there, and
the reviewer is right to say so.** Conditional disclosure is not a mechanism this tree lacks: it
is exactly what `ListRequirementsReferencing.withPathsWhereAmbiguous` already pays for, at TWO
levels (a folder, escalating to the note's own path where a folder does not separate the rows
either), and it is the reason the sibling has a path to draw at all. So the honest statement of
the trade is narrower than the one above: conditional disclosure is a REAL option with a working
precedent one file away, and it loses here on the branch budget, on the lone-row case and on
needing a project LOCATION lookup this query does not hold — not on being a shape this repository
avoids. The decision stands; the argument for it is now the one that survives reading the
neighbour.

## Changed files and reason

| File | Purpose | Within lease? |
|---|---|---|
| `src/application/queries/ListPlansUsingAsset.ts` | `PlanAssetUsage` gains `readonly projectName: string`; `collect` gains a `projectName` parameter and `execute` passes `project.entity.name`, which it already holds in its loop. Interface docblock states why both `projectId` and `projectName` are carried and that `projectId` is still named by no template | Yes |
| `src/presentation/i18n/locales/en/assetDuplicate.ts` | `used-in-plans.plan` gains the `{project}` hole; header gains one paragraph on why the project is inside the key and not beside it, and cites AD18-R7 over the `(s)` paragraph so the next reader does not re-open it | Yes — edited in place |
| `src/presentation/i18n/locales/de/assetDuplicate.ts` | Same hole, same position. `Platzierung(en)` unchanged | Yes — edited in place |
| `src/presentation/library/AssetUsageScope.vue` | One line: `project: plan.projectName` in the `tr(...)` params | Yes |
| `src/presentation/designer/inspector/DesignerUsageScope.vue` | Same one line | Yes |
| `src/presentation/designer/inspector/DesignerUsagePlans.vue` | Docblock only — its `rows` prop sentence said the label interpolates *"a plan name and a placement count"*, which this change falsifies. Corrected in the same edit, with the one-key reason | Yes |
| `tests/application/queries/listPlansUsingAsset.test.ts` | Four existing row shapes gain `projectName`; two project names lifted to `PROJECT`/`ANNEXE` constants; one new case for two plans sharing a name across two projects | Yes — this card's test |
| `tests/presentation/designer/designerUsageScope.test.ts` | Fixture gains `projectName`; existing ready-state case gains the `project` param; new `twoPlansNamedAlike` fixture and a case asserting LITERAL row text | Yes — this card's test |
| `tests/presentation/library/assetUsageDuplicate.test.ts` | Fixture gains `projectName`; the hard-coded row text updated; new case asserting LITERAL row text on the library panel | Yes — this card's test |
| `tests/harness/assetDesigner.ts` | Two fixture rows gain `projectName` (`Flat renovation`, `Garden studio` — names the library harness already uses) | **No — assumed extension, see above** |
| `tests/harness/assetLibrary.ts` | One fixture row gains `projectName: 'Flat renovation'`, which is what `prj-hamburg-b` is already called in that file's `USED_IN` groups | **No — assumed extension, see above** |
| `docs/.../reports/W19-B-usage-project-name.md` | This report | Yes — deliverable 2 of the brief. `LEASES.md` holds `docs/` for the integrator; this file is the card's own report and nothing else under `docs/` is touched |

## Branches introduced, and what drives each

**Zero.** No `if`, no ternary, no `v-if`, no optional field, no default parameter is added in
`src/`. `projectName` is a required field populated unconditionally from a value `execute` already
holds, and the views pass one more parameter to a call they already make. That was a deciding
argument for the unconditional form over conditional disclosure, against a 98% branch floor.

## Acceptance coverage

| Criterion/test ID | Result | Exact evidence | Remaining issue |
|---|---|---|---|
| `src/` finding **B** — `PlanAssetUsage.projectId` reaches no consumer, so two same-named plans render identically | **narrowed, not closed** — corrected at the fix round | `listPlansUsingAsset.test.ts` *"carries each row's own project name, so two plans sharing a name are two different rows"*; `designerUsageScope.test.ts` *"names the project on every row…"*; `assetUsageDuplicate.test.ts` *"names each row's project…"* | **Two residual arms, both now named in `PlanAssetUsage`'s header rather than only here.** (1) Two plans named `Kitchen` in two projects BOTH named `Flat renovation` still render identically — a project name is no more unique than a plan name, and `withPathsWhereAmbiguous` says why: *"`Project.create` trims a name and rejects only an empty one, so a collision is a thing a vault legitimately holds and nothing refuses."* `tests/harness/assetLibrary.ts` already ships that exact pair. Closing it needs a project PATH, which needs the location lookup this query does not hold. (2) `projectId` ITSELF is still named by no template; the charter's words are *"the query must **also** carry a project NAME"*, so the id stays as the row's identity |
| The two panels do not disagree | asserted separately on each | Two cases, one per surface. They build their rows independently, so a fix to one is invisible to the other's suite | — |
| AD18-R7 — `(s)` / `(en)` untouched | held | `git diff` on both locale files shows the plural spelling byte-identical; the en header now cites the ruling | — |
| No new locale module, `editor.ts` untouched | held | `git diff --name-only` lists neither aggregator | — |

## Executed checks

| Command or manual action | Commit / environment | Exit code or observed result | Evidence |
|---|---|---|---|
| `npx vitest run` over the three suites, **src reverted** (the watched red) | working tree, `git checkout -- src/` | **`Test Files 3 failed (3)` · `Tests 7 failed \| 27 passed (34)`** | Named below |
| `npx vitest run` over the same three, src restored | candidate | `Test Files 3 passed (3)` · `Tests 34 passed (34)` | — |
| `npx vitest run tests/presentation/i18n tests/presentation/read-models tests/presentation/library tests/plugin/assetDesignerWiring.test.ts` | candidate | `Test Files 36 passed (36)` · `Tests 470 passed (470)` | — |
| `npx vitest run tests/presentation/designer tests/harness` | candidate | `Test Files 108 passed (108)` · `Tests 1399 passed (1399)` | — |
| `npx vitest run tests/build/localeModuleSentenceCase.test.ts` | candidate | `Test Files 1 passed (1)` · `Tests 81 passed (81)` | The one ESLint-booting gate a locale-text edit can reach |
| `npx vue-tsc -noEmit` | candidate | exit 0, no output | Whole tree, `src/` and `tests/` |
| `npx oxlint <11 changed files>` | candidate | exit 0, nothing printed | Exit code read, not the silence |
| `npx eslint <11 changed files> --max-warnings 0` | candidate | exit 0 | — |
| `grep -rn "projectId" $(grep -rl AssetPlanUsage src/)` | candidate, run AFTER the change | 8 lines, every one in `ListPlansUsingAsset.ts` | The docblock sentence is written from this output |
| `grep -rn "planName" src/ tests/` | candidate | Located the row literals — **not** a proof that it found them all; see the note above the changed-files table | `vue-tsc -noEmit` is the instrument that settles the set |
| `grep -rn "placement(s)\|Platzierung(en)\|used-in-plans\|Used in plans\|{name} — {count}" docs/` | fix round | Three stale records outside `docs/tasks/`, listed below | The sweep at the width the first revision should have used |

### The red, verbatim

Watched by `git checkout -- src/` with the tests in place, then restored by re-applying the saved
`src/` patch:

```
 FAIL  |suite| tests/application/queries/listPlansUsingAsset.test.ts > ListPlansUsingAsset > names only the plans that place the asset, with a count of its placements
 FAIL  |suite| tests/application/queries/listPlansUsingAsset.test.ts > ListPlansUsingAsset > counts a placement held in both the current and the proposed structure once
 FAIL  |suite| tests/application/queries/listPlansUsingAsset.test.ts > ListPlansUsingAsset > names the plans of EVERY project that places the asset, each row carrying its own project
 FAIL  |suite| tests/application/queries/listPlansUsingAsset.test.ts > ListPlansUsingAsset > carries each row’s own project name, so two plans sharing a name are two different rows
 FAIL  |suite| tests/presentation/designer/designerUsageScope.test.ts > the designer’s usage scope > names the project on every row, so two plans sharing a name are two different lines
 FAIL  |suite| tests/presentation/library/assetUsageDuplicate.test.ts > the duplicate panel > shows which plans place the definition before anything is dispatched
 FAIL  |suite| tests/presentation/library/assetUsageDuplicate.test.ts > the duplicate panel > names each row’s project, so two plans sharing a name are two different lines
 Test Files  3 failed (3)
      Tests  7 failed | 27 passed (34)
```

The two new view cases fail with the defect itself printed, which is the point of asserting the
literal text:

```
AssertionError: expected [ 'Kitchen — 2 placement(s)', …(1) ] to deeply equal [ …(2) ]
- Expected
+ Received
  [
-   "Kitchen (Flat refit) — 2 placement(s)",
-   "Kitchen (Annexe conversion) — 2 placement(s)",
+   "Kitchen — 2 placement(s)",
+   "Kitchen — 2 placement(s)",
  ]
```

### A blind spot measured on the way, worth the integrator's attention

**Round-tripping an expectation through `t(...)` cannot see this class of defect, in EITHER
direction, and it was measured twice on this branch.**

- With the `{project}` hole added to the template but the designer's FIXTURE still missing
  `projectName`, the existing case `names the plans that place this asset…` **passed** — because
  `t` leaves an unmatched hole standing, so expected and received were both
  `Kitchen ({project}) — 2 placement(s)`.
- With `src/` reverted and the `project:` parameter already in the test's `t(...)` call, that same
  case **passed again** — the extra parameter is simply ignored against a template with no hole.

So a test that computes its expectation with the same function the component uses agrees with
itself across exactly the change under test. Both new cases spell the expected row LITERALLY for
that reason, and both docblocks say so. This is the fake-too-kind rule pointed at an assertion
helper rather than at a DOM fake.

## Verification not performed

- **`npm run check`, `check:fast`, `test:coverage`, `analyze`** — withheld by the brief. Two gates
  on one machine thrash, and these are the integrator's. **Consequence to read narrowly:** the
  coverage floors and `fallow` are unmeasured here. The branch count added is zero and the
  function count added is zero, so no arm is introduced that a floor could catch; that is an
  argument, not a measurement.
- **The whole suite.** Ran the four regions a `PlanAssetUsage` change can reach —
  `tests/application/queries`, `tests/presentation/{i18n,read-models,library,designer}`,
  `tests/harness`, `tests/plugin/assetDesignerWiring.test.ts`, plus the one locale build gate —
  chosen from `grep -rln "listPlansUsingAsset\|AssetPlanUsage\|used-in-plans" tests/`. Files
  outside those regions were not run.
- **`npm run harness` / `npm run harness-shot`** — no browser in this session, and the brief
  forbids claiming a layout result. See the unrendered risk below.
- **`npm run test-build` / any vault** — not available. Nothing here is a vault-behaviour change:
  the query's port calls, the four panel states and the write path are byte-identical.
- **German rendering** — `de/assetDuplicate.ts` is asserted by `strings.test.ts`'s
  per-key hole-parity case (which passed) and by the sentence-case gate; no German string was read
  on screen.
- **Migration / schema / performance** — none apply; see below.

## Unrendered layout risk — NAMED, not estimated

**The rows get longer and nothing here lays text out.** `AD18-concept-fidelity.md` records the
only measurement that exists: at a **224 px** inspector rail, `Loft conversion — 1 placement(s)`
is **one line** (row box 191 × 16), and the second line appears between **224 and 210 px** (one
line at 191 px, two at 177 px). This change appends a parenthesised project name to every such
row — `Loft conversion (Flat renovation) — 1 placement(s)` — which is roughly double the text, so
**the 224 px row almost certainly becomes two lines and that measurement is superseded**. W10-A's
rail caps then put the rail at **157–224 px across 560–800 px**, where it will be worse.

Three things the integrator should weigh with a browser, none of which this session can answer:

1. Whether the two-line row is acceptable in a panel that already scrolls — W10-A accepted exactly
   that trade for the canvas, on a row one project name shorter.
2. Whether the wrap orphans the em-dash or the `placement(s)` tail the way AD18's bullet described.
3. Whether a narrow rail should wrap the project onto its own line deliberately. That is a
   `styles/` change and is outside this card's lease in both directions — it is **not** blocked by
   the one-key decision, because a `<li>` may wrap wherever CSS says without the markup owning the
   punctuation.

`npm run harness-shot prototype:…`-style entry captures and the fixed `asset-designer` /
`asset-library` shots both draw these panels from the two harness fixtures this card updated
(`asset-designer-narrow` captures at width 460, which is the pane rather than the rail), so the
picture is available to whoever has a browser.

**Do not read those captures as evidence that the disambiguation WORKS.** Neither fixture renders
the collision the field exists for: `assetDesigner.ts` gives two differently-named plans in
differently-named projects, and `assetLibrary.ts`'s usage scope holds a single row. So the
parenthetical photographs as decoration. That is deliberate and is also the WORST case for the
wrap risk above — the longest rows with the least justification on screen — which is the right
picture to measure against. The collision itself is asserted in jsdom by the two new view cases
and nowhere else.

## Data and integration implications

Schema/migration change: **none.** `PlanAssetUsage` is a read-model row, produced per call from
the project and plan repositories and never written to a note or a sidecar. No version number
moves and nothing durable gains a field.

Relevant renderer/export/revision consumers: **none.** The five `src/` importers of the
`AssetPlanUsage` envelope are the query, `plugin/guardedAssetLibrary.ts`, the two panels and the
two read-model modules; no export path, thumbnail or revision mechanism reads it.

Undo/no-op/conflict/failure coverage: **untouched.** This query is read-only and dispatches no
command. All four drawn states — loading, refused, ready, ready-with-`unreadable` — and the
`indexScanCompleted()` gate are byte-identical; their cases still pass.

Identity/unit/quantity/calibration invariants: **untouched.** No coordinate, unit, quantity or
money value is read or written. `projectId` remains the row's identity and is unchanged.

Shared root/runtime/locales wiring still required: **none.** Both locale modules were edited in
place and are already spread into their aggregators; no key was added, so the Asset library key
count pinned in `strings.test.ts` is unmoved and `{en,de}/editor.ts` needed no line.

Rollback/recovery considerations: reverting the six `src/` files restores the previous label
exactly. The field is not persisted anywhere, so there is no data to migrate back.

## Records outside this card's lease that now disagree with the tree

Reported rather than edited — `docs/` is the integrator's this wave, and these are the citations a
later reader would resolve the wrong way.

**The first revision of this list swept `docs/tasks/` and called it `docs/`, which is the same
defect this card exists to fix, one directory wider.** Re-run at the right width at the fix round
(the command is in the checks table), it prints **two more**, and the first of them is the one
that would have cost a human an hour:

- **`docs/tests/cases/Take an asset from the library into a plan.md`, step 3** — states the
  expected row as *plan name* — *n* placement(s). It now reads *plan name* (*project name*) —
  *n* placement(s), so **a human walking that case in a vault would report a pass as a failure**.
  Found by the reviewer, not by me. **DO NOT let this ship unedited**; the integrator holds
  `docs/` and the fix is one cell.
- **`docs/user-experience/archive/asset-library-overview-DESIGN-SPEC.md`, Amendment 6** — its key
  inventory reads *"`.plan` (interpolated: `{name}`, `{count}`)"*, which is now `{name}`,
  `{project}`, `{count}`. **The KEY COUNT it pins (87 → 100) is unaffected** — no key was added —
  and that document is the authority every `src/presentation/library/` section number cites, so
  the stale half is the interpolation list alone. Neither the reviewer nor the first revision
  named this one.

Nothing else outside `docs/tasks/` matched. One adjacent hit was read and is **NOT** caused by
this card: `docs/using-asset-designer.md` says *"The designer does not tell you which plans those
are… The designer's Inspector shows the asset's name, its dimensions and its own controls, and no
usage list."* That was already false before this commit — `DesignerUsageScope.vue` draws exactly
such a list in the designer's Inspector, which is AD13-R1's whole subject — and this change
neither created nor worsened it. Recorded so the next sweep does not attribute it here.

The five under `docs/tasks/`, unchanged from the first revision:

- `docs/tasks/asset-designer-expansion/execution/state.json`, the "FOURTH `src/` finding" entry —
  describes the defect in the present tense.
- `docs/tasks/asset-designer-expansion/reports/AD15-validation-matrix.md`, row **F10** — *"both
  usage panels draw plan name and placement count only and two plans both named `Kitchen` in
  different projects render identically. That is a recorded `src/` finding"*. The finding is now
  closed; the row's own `passed` grade is unaffected.
- `docs/tasks/asset-designer-expansion/reports/W16-B-two-project-scope.md` — its evidence table
  pins `'{name} — {count} placement(s)'` as the current template and its prose derives the defect
  from it. That is a historical report and reads correctly as one; naming it here so a grep for
  the old template string resolves.
- `docs/tasks/asset-designer-expansion/reports/AD18-concept-fidelity.md` — the 224/210 px wrap
  measurement, superseded as described above.
- `docs/tasks/asset-designer-expansion/contracts/DECISIONS.md`, *"The three `src/` findings"* —
  **B** is now taken; **A** and **C** are untouched by this card.

## Reviewer and integrator acceptance

Reviewer outcome and findings:
Integrated commit:
Post-integration checks/evidence:
Final status: integrated / verified / blocked

Only the integrator/reviewer fills final acceptance. A worker's completion statement is not this
field.
