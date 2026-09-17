# Task report — AD09, add a Parts panel for finding and organizing the object

Outcome: **implemented**
Owner / worktree / branch: lead agent (serial; nothing delegated) ·
`.claude/worktrees/renovation-planner-asset-designer-bc5539` · `renovation-planner-asset-designer-bc5539`
Base commit: `455e65ff3` · Candidate commit: see the integration commit below
Accepted contract revision: `r1`
Allowed scope and shared-file leases: AD01 §2 gives AD09 *a new `presentation/designer/parts/`
directory*. Four integrator-owned files were taken under lease because the panel is useless without
them — `AssetDesignerRoot.vue` (the region), `runtime.ts` (the leaf-local view state), and both
locale modules. One AD08-owned file (`designer-select-tool.ts`) and two unassigned ones
(`layers/detailsLayer.ts`, `selection/hitTest.ts`) were edited so the panel's hide and lock controls
do something; AD08 is integrated and no other task is mid-way through any of them.

## Changed files and reason

| File | Purpose | Within lease? |
|---|---|---|
| `src/presentation/designer/parts/partRows.ts` | New. The row model, pure: which rows, in what order | yes — AD09's own directory |
| `src/presentation/designer/parts/partView.ts` | New. Leaf-local hidden / locked / collapsed sets | yes |
| `src/presentation/designer/parts/partNames.ts` | New. What a row is called; `semanticLabel` shared with the selection inspector | yes |
| `src/presentation/designer/parts/DesignerPartsPanel.vue` | New. The list, the keyboard, Show all, the empty state | yes |
| `src/presentation/designer/parts/DesignerPartRow.vue` | New. One row's three shapes | yes |
| `src/presentation/designer/parts/DesignerPartControls.vue` | New. The selected graphic's label field and five actions | yes |
| `src/presentation/designer/parts/DesignerPartGroupRow.vue` | New. A group's disclosure | yes |
| `styles/designer-parts.css`, `styles/index.css`, `styles/designer-narrow.css` | New partial, its import, and the narrow-leaf stacking | yes — new file plus two one-block edits |
| `src/presentation/designer/AssetDesignerRoot.vue` | Mounts `.rp-designer-parts` as the body's first region | **integrator lease** |
| `src/presentation/designer/runtime.ts` | Builds the leaf's `PartView`, hands it to the Select tool | **integrator lease** |
| `src/presentation/i18n/locales/{en,de}/assetSymbols.ts` | Thirteen `designer.parts.*` strings, both locales | **integrator lease** |
| `src/domain/asset/detailEdits.ts` | `updateDetail` takes `label` | AD10's file; AD10 not started |
| `src/presentation/designer/layers/detailsLayer.ts` | `detailOutlines` omits a hidden graphic | unassigned |
| `src/presentation/designer/selection/hitTest.ts` | A press falls through a hidden graphic | AD08's file; AD08 integrated |
| `src/presentation/designer/tools/designer-select-tool.ts` | A locked graphic is selected, never dragged | AD08's file; AD08 integrated |
| `src/presentation/designer/selection/designerSelection.ts` | **Bug fix**: `selectionExists` no longer asks `outlineOf` | AD08's file |
| `src/presentation/designer/inspector/DesignerSelectionInspector.vue` | **Bug fix**: withholds geometry fields for an open graphic; uses the shared `semanticLabel` | unassigned |
| `src/presentation/designer/DesignerCanvas.vue` | Passes the hidden set to `detailOutlines` | unassigned |
| `scripts/editor-area-browser.mjs`, `scripts/editor-usability-{combined,fidelity}-check.mjs` | Closing a pre-existing clone family, on request | outside AD09 — see below |
| `src/infrastructure/obsidian/repositories/ObsidianPlanGeometrySidecar.ts` | Closing the same family's third group | outside AD09 — see below |

## Two defects found on the way, both recorded rather than quietly fixed

**1. A selected OPEN graphic was pruned from the selection on every read-back.**
`selectionExists` asked `outlineOf`, which answers `null` for an open graphic *by design* (AD04) so
that no closed-only edit can reach one. But its only caller is `AssetDesignStore.hydrate` pruning
the selection after a read — a different question — so a part that is on the shape, drawn on the
canvas and listed in this panel silently deselected itself after every write. Unreachable before
AD09, because nothing could select an open graphic. It now asks the shape's own parts.

**2. That fix then crashed `DesignerSelectionInspector` on mount.** With the open graphic counting
as a part that exists, the section mounted for one and `partBox(outlineOf(...) as CurvedPolygon)`
was handed `null`. Its geometry fields — centre, size, rotate-by — are withheld for an open graphic
now; the name, the line and the four ordering actions stay, since none of them asks about an
interior. They come back when AD11 builds an open graphic's own gestures. The crash was **watched**
before the guard was written.

## Acceptance coverage

| Criterion | Result | Exact evidence | Remaining issue |
|---|---|---|---|
| Selecting a row selects the same part on canvas and vice versa | met | `designerPartsPanel.test.ts` "selects the part its row names" (the row calls the same `select`) and "marks the row of every part the canvas has selected" (`aria-pressed`, over AD08's whole selected SET) | — |
| Rename survives a file round-trip while preset semantic identifiers remain unchanged | met | `detailEdits.test.ts` three label cases; `designerPartsPanel.test.ts` "writes a user label and leaves the semantic name alone"; `assetGeometrySidecarDetails.test.ts` "round-trips a rename made through updateDetail, and its removal" | — |
| Editing isolation does not remove content from placement, quantities or export | met | `partView.ts` holds ids and nothing else — no shape, no command, no port; `designerPartsPanel.test.ts` "hides a graphic without writing anything or changing the shape"; `layers.test.ts` "omits a hidden graphic from the configs and leaves every other one alone" | The plan and library consumers are covered structurally (they read the stored shape, which is untouched) rather than by a case that mounts them |
| User can unlock/find a hidden part without hunting on the canvas | met | `designerPartsPanel.test.ts` "keeps a hidden graphic in the list, marked, with Show on its own row", "offers Show all only once something is hidden", "locks a graphic, marks its row and offers Unlock" | — |
| Parts never imply separate procurement units or prices | met | `designerPartsPanel.test.ts` "says a part's name and nothing else — no count, no unit, no price". `AssetDesignDto` carries no price, quantity or unit, so the panel has no such data to show | — |
| Group rows do not create a second rendering order or a Konva layer per row | met | `partRows.test.ts` "heads a group at its topmost member and leaves interleaved members interleaved"; `designerPartsPanel.test.ts` "folds its members away without writing anything or changing what the canvas draws" — the same `detailOutlines` output before and after | — |

### The card's implementation list

1. **A view over the canonical selection contract** — footprint, graphics, groups, clearance,
   placement (anchor and facing) and the reference sheet. `partRows.test.ts` pins the whole order.
2. **User labels without changing stable semantic names, canonical visual ordering.** Rename writes
   `label`; `name` is untouched (C02). Graphics are listed **topmost first** — `details` is a
   bottom-up draw order, so listing it as stored would put the graphic the user sees on top at the
   bottom of the panel and make Bring forward move its row *down*. The array is not reordered; only
   the reading direction is chosen, and `partRows.ts`'s own docblock says so.
3. **Transient edit locks and visibility/isolation in leaf-local UI preferences.** `createPartView`,
   held on the runtime beside `multiSelectionMode` and for the same reason. Nothing persists it.
4. **Keyboard navigation, rename, explicit move forward/back, accessible group expansion.** One tab
   stop with Up/Down/Home/End (WAI-ARIA's roving tabindex); a rename field and five actions under the
   selected row; `aria-expanded` on the group disclosure.
5. **Selection/focus preserved after rename, removal, grouping and refresh; a meaningful empty
   state.** Rows are keyed by part key, so the rename field is the same element across the write's
   re-render; the tab stop falls back when the row that had focus is deleted from under it.

### Coverage of the new code, read rather than inferred from the floor

`npm run test:coverage` passing is not the check — branches sat at **98.01% against a 98% floor**,
which in UNITS is about two branches of margin, and a single untested arm in a slack metric hides
completely. `coverage/coverage-final.json` was read for the CHANGED FILES, which found ten uncovered
arms the summary line could not see. All ten are closed, and **six of them by deleting the code
rather than by testing it** — an unreachable guard is not free, it costs a branch it can never pay
back:

- `PartRow` became a **discriminated union**, so `GraphicRow.detail` is non-null by type. Three
  separate `detail === null` guards — in `rowName`, in the action list and in the rename handler —
  were questions the row model had already answered.
- The selected row's controls and the group's disclosure moved into `DesignerPartControls.vue` and
  `DesignerPartGroupRow.vue`, each taking the non-null thing it needs (`AssetDetail`, `string`).
- `onKeydown`'s two guards became one over the ROW rather than over the key, so an unowned key and an
  out-of-range index land in the same covered place; its empty-list arm could never fire, since the
  list is a `v-else` over a list with rows in it.
- `graphicIds` is read back off `rows` instead of off `shape`, which removes a `shape === null` arm
  that is unreachable for the same reason.

The four that were real gaps got cases: **Send backward** (only Bring forward had one), **ArrowUp and
clamping at both ends**, relabelling an **open** graphic, and a shape whose `groups` property is
absent entirely — which the type permits and `validateAssetShape` never produces, so the case has to
build it by hand to reach the arm at all.

## Executed checks

All on the candidate tree, with `TEMP`/`TMP` pointed at `D:\tmp-claude` — **the C: volume on this
machine has 0 bytes free**, and a child process that cannot write a temp file fails in ways that
look like a source defect.

| Command | Exit | Evidence |
|---|---|---|
| `npx vue-tsc -noEmit` | 0 | |
| `npx oxlint --deny-warnings` | 0 | Two `consistent-function-scoping` findings fixed by hoisting, not by a suppression |
| `npx eslint . --max-warnings 0` | 0 | Found what `check:fast` cannot: Vue formatting in the new SFC, and `selectToolDeps` at six parameters — fixed by bundling the leaf's ephemeral UI into one argument |
| `npm run build` | 0 | `dist/main.js` 1,946.03 kB, `dist/styles.css` 175.44 kB |
| `npm run analyze` | 0 | Complexity 0 above threshold; the four pre-existing clone groups closed — see below |
| `npm run test:coverage` | see the integration commit | |
| Real Obsidian | not run | Unavailable in this environment |

### The `analyze` red was pre-existing, and it is closed here on request

The four clone groups it failed on were in `scripts/editor-usability-combined-check.mjs`,
`scripts/editor-usability-fidelity-check.mjs` and `ObsidianPlanGeometrySidecar.ts` — a different
increment's evidence scripts and a plan sidecar, none of them touched by the Parts panel. Measured
rather than assumed: `455e65ff3` was checked out into a throwaway worktree and the same fallow
binary run against it, which reported **the same four groups before any AD09 change** (the worktree
was removed afterwards; its other findings are artefacts of the missing `node_modules` there).

They were then closed anyway, at the user's explicit request, in two extractions:

- **The two capture scripts** shared a bootstrap, two waits and one measurement. Those are now
  `usabilityHarness`, `settled`, `closeInspectorDrawer` and `taskbarMetrics` in
  `scripts/editor-area-browser.mjs`, which both scripts already imported from. The one real
  difference between the two copies of the measurement — one names a button by the words a user
  reads, the other by its accessible name — is an argument now, passed INTO the page, because the
  body is serialised and cannot close over anything. **No gate runs either script**: they are
  hand-driven evidence tools needing a Chromium this environment cannot resolve, so this extraction
  is held by lint, by the clone report and by `node --check`, and by nothing that executes them.
  That limit is written into the new block's own docblock rather than left for the next reader.
- **`ObsidianPlanGeometrySidecar`** mapped `id`, `bulges`, `labelOffset` and `color` by hand in both
  directions. `carriedObjectFields` is that, generic over the two types that agree about those four.
  Worth closing rather than suppressing: a clone in a MAPPER is what makes "the document that goes
  out is the document that came back" true, so a fifth field added to one side and forgotten on the
  other is silent data loss rather than a type error. The first version of the helper typed
  `labelOffset` as `{ x, y }` and `vue-tsc` refused it — it is a `Vector` (`{ dx, dy }`) on both
  sides, which is the compiler confirming the two copies really were the same shape.

Two of the four COMPLEXITY findings in the first run were mine — both new SFC templates over
fallow's cognitive budget. Fixed by factoring, never suppressed: the row component reads the
`PartView` itself instead of being handed eight inline-guarded booleans, its five action buttons
became one `v-for` over a computed list, and five attribute ternaries moved into computeds. The
other two findings (`editDimensions`, `press`) were CRAP scores against **stale coverage data** and
cleared on their own once the suite had run — worth knowing, because a CRAP finding is not a fact
about the code alone.

## Verification not performed

- **Real Obsidian.** No vault and no Obsidian in this environment. `npm run test-build` was not run,
  and no manual case under `docs/tests/` was walked. The panel's appearance in a themed vault, its
  behaviour in a narrow sidebar leaf and its focus ring against a real theme are unverified.
- **Browser captures.** The pinned Chromium still cannot be installed here (the dirlock described in
  [RESUME.md](RESUME.md)). No capture of the three-region layout at 1280 or at 460 exists, so the
  narrow-leaf stacking rules in `designer-narrow.css` are argued rather than seen. **This is the
  check most likely to find a defect in this task**, because layout is what a capture measures and
  no layout engine in this repository does.
- **Accessibility scan.** `tests/harness/accessibility*.test.ts` scans the harness surfaces; the
  designer's Parts panel is not among its fixed entries, so the roving tabindex and the `aria-pressed`
  / `aria-expanded` pairs are asserted by this task's own component cases and not by axe.
- **`npm run audit`.** Not run; it is its own CI job.

## Data and integration implications

**Schema/migration change:** none. `label` and `groups` were already schema v3 (AD04); this task is
the first thing in the product that writes a label.

**Relevant renderer/export/revision consumers:** the three C10 names them —the authoring canvas
(honours `hidden`, this task), the library mark and plan placement (**both unchanged**, because they
read the stored shape and hiding never reaches it). There is no export subsystem (r1, C10).

**Undo/no-op/conflict/failure coverage:** rename and reorder go through `editShape`, so they join the
leaf's one write chain, dispatch one `SetAssetShape` conditional on the version their step read, and
push one undo entry. Hide, lock, isolate, Show all and collapse dispatch **nothing**. A disabled
order action runs nothing rather than being `:disabled`, so the button keeps focus.

**Identity/unit/quantity/calibration invariants:** `name` is never written from a free-text field;
graphic ids are never recycled, so a hidden or locked id left behind by a deleted graphic cannot come
to mean a different one; the panel shows no measurement at all, so no unscaled number can leak
through it.

**Shared root/runtime/locales wiring still required:** none — all four are in this candidate.

**Rollback/recovery considerations:** reverting this task loses the labels users typed, since nothing
else reads `AssetDetail.label` yet. The sidecar keeps them, and an older build reading schema 3
refuses the file rather than stripping them (`z.literal`), so the data survives the code.

## Reviewer and integrator acceptance

Reviewer outcome and findings: no separate reviewer; everything was executed serially by one agent.
Integrated commit: see the branch.
Post-integration checks/evidence: the table above.
Final status: **integrated**, with the Obsidian and capture verification named above still
outstanding.
