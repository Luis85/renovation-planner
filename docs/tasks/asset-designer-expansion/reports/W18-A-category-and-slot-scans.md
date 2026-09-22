# Task report — W18-A (two category checks that hold for code not yet written)

Outcome: implemented
Owner / worktree / branch: W18-A / `.worktrees/ad13b` / `w18a-category-and-slot-scans`
Base commit / candidate commit: `e21675fc2` / see the single commit on this branch
Accepted contract revision: `contracts/DECISIONS.md` — AD15-R2 (T27's losing side) and the *"Two rows
that were NEVER OPEN"* section's second half
Allowed scope and shared-file leases: new test files under `tests/presentation/designer/`,
`tests/plugin/` and `tests/infrastructure/obsidian/plugin-data/`, plus this report. No `src/` edit and
no edit to an existing test file. Neither was needed; the only `src/` touch was the temporary
key-collision mutation for the red watch below, reverted with `git checkout --`.

## Changed files and reason

| File | Purpose | Within lease? |
|---|---|---|
| `tests/presentation/designer/designerOwnerListeners.test.ts` | Task 1 — the T27 category check: nothing under `src/presentation/designer/` registers a DOM event listener | Yes (new file) |
| `tests/plugin/deviceSlotSeparation.test.ts` | Task 2 — the designer's per-device slot is its own, pinned behaviourally against one adapter | Yes (new file) |
| `docs/tasks/asset-designer-expansion/reports/W18-A-category-and-slot-scans.md` | This report | Yes |

Nothing was written under `tests/infrastructure/obsidian/plugin-data/`: task 2's subject is the pair of
SLOT BUILDERS in `src/plugin/`, not `editorViewPreferencesStore` (which has its own file and is
correct), so the check belongs beside the builders.

## Acceptance coverage

| Criterion/test ID | Result | Exact evidence | Remaining issue |
|---|---|---|---|
| T27 — the note-editor half, as a source-scan category check (AD15-R2's losing side) | Closed as a STRUCTURAL check | `designerOwnerListeners.test.ts`, 11 cases; `registers no DOM event listener anywhere under its own directory` over 67 files | The row's stated layer is *Browser + real host*, so the row itself stays `partial` — AD15-R2 already says a perfect structural check cannot change that grade |
| The scan detects a planted violation | Yes | Five `reports %s` fixture cases (owner `window`, `el.ownerDocument`, `listenOnOwner`, `registerDomEvent`, an element-local one) and three `does not report %s` cases (a comment, a string, a template-bound handler) | — |
| The scan reaches something at all | Yes | `has a file set to scan at all` (>20 files, contains `AssetDesignerRoot.vue`) and `parses an SFC script block rather than its text` (`defineProps` found in the real `inspector/DesignerInspector.vue`) — an SFC whose script block came back empty would certify every `.vue` in the set | — |
| §2.6 *"per device in their own slot, separate from the plan editor's"* | Pinned | `deviceSlotSeparation.test.ts`, 3 cases, both slot builders driven against one KEYED adapter | — |
| `assetDesignerDeviceSlots`' docblock claim (`designer-view` rather than `editor-view`) | Pinned | `store under their own keys, the editor carrying its panel layout beside them` | — |

### Red watched, verbatim

**Task 1** — the src-pointed case temporarily aimed at `src/presentation/editor/surface`, a directory
that does register one (fixtures cannot prove the scan reads real files, and this card may not edit
`src/` to plant a violation):

```
 FAIL  |suite| tests/presentation/designer/designerOwnerListeners.test.ts > the asset designer > registers no DOM event listener anywhere under its own directory
AssertionError: expected [ Array(1) ] to deeply equal []

- Expected
+ Received

- []
+ [
+   "listenOnOwner in src/presentation/editor/surface/EditorSurface.vue",
+ ]
```

Reverted in the same session; the file now reads `expect(scan(DESIGNER)).toEqual([])`.

**Task 2** — `src/plugin/assetDesignerDeps.ts` temporarily changed to build its store at
`` `${pluginId}:editor-view` ``, which is exactly the defect the docblock's prose forbids. All three
cases went red:

```
 FAIL  |suite| tests/plugin/deviceSlotSeparation.test.ts > the asset designer and the Plan Editor > do not read or write each other view preferences
AssertionError: expected { gridVisible: false, …(1) } to deeply equal { gridVisible: true, …(1) }

- Expected
+ Received

  {
-   "gridVisible": true,
+   "gridVisible": false,
    "snappingEnabled": true,
  }

 FAIL  |suite| tests/plugin/deviceSlotSeparation.test.ts > the asset designer and the Plan Editor > keep a designer-only choice out of the editor slot entirely
AssertionError: expected { snappingEnabled: false } to deeply equal {}

- Expected
+ Received

- {}
+ {
+   "snappingEnabled": false,
+ }

 FAIL  |suite| tests/plugin/deviceSlotSeparation.test.ts > the asset designer and the Plan Editor > store under their own keys, the editor carrying its panel layout beside them
AssertionError: expected [ 'renovation-planner:editor-view' ] to deeply equal [ 'renovation-planner:designer-view' ]

- Expected
+ Received

  [
-   "renovation-planner:designer-view",
+   "renovation-planner:editor-view",
  ]
```

Reverted with `git checkout -- src/plugin/assetDesignerDeps.ts`; `git status --short -- src` then
printed nothing.

A third red was watched and is worth recording because it is a repository hazard rather than a
mistake: the first version of `deviceSlotSeparation.test.ts` ran in NODE and was refused by
`scripts/vitest-no-ssr-sfc.mjs` — *"`…/src/presentation/editor/PlanEditorRoot.vue` was compiled in SSR
shape"* — because `planEditorDeps.ts` reaches that SFC. It carries `// @vitest-environment jsdom` for
that reason although it mounts nothing; the plugin's other remedy is a `src/` move this card may not
make.

## Executed checks

| Command or manual action | Commit / environment | Exit code or observed result | Evidence |
|---|---|---|---|
| `npx vitest run tests/plugin/deviceSlotSeparation.test.ts tests/presentation/designer/designerOwnerListeners.test.ts` | candidate, Windows, node 22 | 0 | `Test Files  2 passed (2)` / `Tests  14 passed (14)` |
| `npx vitest run tests/presentation/designer/designerOwnerListeners.test.ts` (alone) | candidate | 0 | `Test Files  1 passed (1)` / `Tests  11 passed (11)` |
| `npx vitest run tests/plugin/deviceSlotSeparation.test.ts` (alone) | candidate | 0 | `Test Files  1 passed (1)` / `Tests  3 passed (3)` |
| `npx oxlint <both new files>` | candidate | 0 (prints nothing when clean) | exit code read explicitly |
| `npx vue-tsc -noEmit` | candidate | 0, no output | `tests/**` is in `tsconfig.json`'s `include`, so both new files were checked |
| `grep -rn "addEventListener" src/presentation/designer/` | candidate | exit 1, zero hits | the card's premise, verified before the check was written |
| Reachability probe (throwaway, deleted): `reachableFrom('src/presentation/designer/AssetDesignerView.ts', repoTree, ['src/presentation/'])` | candidate | 232 files, 167 outside the directory, 6 of them registering a listener | the measurement behind choosing the DIRECTORY as the file set; recorded in the test's header |

## Verification not performed

- **`npm run check`, `npm run check:fast`, `npm run test:coverage`, `npm run analyze`, `npm run
  build`** — refused by the card on a shared 7.8 GB machine with other cards running. `eslint .` is
  therefore unrun on both new files (oxlint and `vue-tsc` are not a substitute for it: the layer bans,
  the write boundary and both text bans live only in ESLint), and so are the coverage floors and
  fallow. CI runs the full gate on the PR.
- **The rest of the suite** — only the two new files were run. Neither imports anything the suite
  mutates and neither writes to disk, but "no other file was affected" is an argument here rather than
  a measurement.
- **Browser / real-host layers.** Nothing here is a browser or vault check. T27's row stays `partial`
  for exactly that reason (AD15-R2), and no manual case was run in a vault: a source scan cannot
  observe a keystroke crossing from a Markdown leaf, and this card added no surface to look at.
- **`npm run harness` / `npm run harness-shot`** — nothing here draws; no capture was taken or owed.
- **What the task-1 scan structurally cannot see**, named in its header and repeated here so the
  reviewer does not read it wider: a listener door reached under another name (an alias, a computed
  member, a helper elsewhere that registers on its caller's behalf and is not in `LISTENER_DOORS`); an
  SFC `<template>`, which is not parsed at all; anything installed at RUNTIME by a dependency; and a
  component OUTSIDE `src/presentation/designer/` that the designer mounts and that listens on its own
  — the file set is the directory, not the composed tree, and the probe above is why.
- **What the task-2 pin cannot see**: it drives the two BUILDERS, so a third surface that built a
  preferences store at one of these keys by hand is outside it, as is whether the composition root
  calls either builder (`assetDesignerWiring.test.ts` / `planEditorWiring.test.ts` own that).

## Data and integration implications

Schema/migration change: none. Both files are tests.
Relevant renderer/export/revision consumers: none.
Undo/no-op/conflict/failure coverage: not applicable — no command, no reversible path.
Identity/unit/quantity/calibration invariants: untouched.
Shared root/runtime/locales wiring still required: none.
Rollback/recovery considerations: deleting either file loses a check and nothing else. The per-device
keys these pin are user-visible state in `App.loadLocalStorage`: renaming either silently discards
every user's remembered View-menu choice on that device, which is what the key case exists to make a
deliberate act.

## Reviewer and integrator acceptance

Reviewer outcome and findings:
Integrated commit:
Post-integration checks/evidence:
Final status: integrated / verified / blocked
