# Plan Editor Review Findings — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the 41 issue notes the dedicated code review of the plan editor foundation branch left under `docs/issues/` (commit `bc6ca060`), on the open branch `claude/plan-editor-foundation-read-path` (PR #66), by fixing the behaviour and test defects they name, ruling on the four contract conflicts, correcting the documents whose claims outran their checks, and deferring the one note no agent can close.

**Architecture:** No new entity, schema key or vault write. Every code fix stays inside the seams the increment already drew: `AddMenu.vue`/`PlanEditorRoot.vue` for the Add menu, `escapeRouting.ts`/`runtime.ts` for Cancel, `RenderState`/`SelectTool`/`EditorSurface.vue` for hover, `ResponsiveEditorShell.vue`/`WorkspaceStore` for layout, `warnings.ts`/`PersistentWarningStrip.vue` for warnings, `StatusBar.vue`/`ProjectStore.ts` for hydration truth, `scripts/harness-shot.mjs` for captures. Contract conflicts are DECIDED first (Task 0) and recorded as rulings; a code task never silently flips a ruling the branch was built on (CLAUDE.md, "The plan editor foundation's first increment has landed").

**Tech Stack:** TypeScript, Vue 3 + Pinia, Konva via vue-konva, Obsidian 1.13.0 API, vitest + jsdom + axe-core, playwright-core for captures, ESLint + oxlint.

**Spec:** [`docs/superpowers/specs/2026-09-02-plan-editor-foundation-read-path-design.md`](../specs/2026-09-02-plan-editor-foundation-read-path-design.md) — the authority when a note and the code disagree about intent; then `CLAUDE.md` ("Claims, and the checks under them", "Testing", and the plan-editor-foundation section). The 41 notes are the requirements; each note's `## What closes it` is its acceptance criterion.

## Global Constraints

- **`npm run check` before every commit**, in the FOREGROUND with a long timeout (`timeout: 600000`), nothing else running. Two known artifacts: a single 5000 ms timeout in a `src/`-walking test, and a 60 s `beforeAll` timeout in ESLint-booting `tests/build/*` files under default parallelism — re-run the file alone before believing either; a green re-run alone plus a clean second full run is the standard.
- **Baseline at `bc6ca060`:** 383 files / 5380 tests; coverage 99.34 / 98.26 / 99.10 / 99.54 (statements / branches / functions / lines) against floors 99 / 98 / 99 / 99. **Functions has about two units of headroom, branches about eleven.** Every new function and every new arm ships with the test that reaches it, in the same task. A guard whose other arm no test can take is not free — restructure so the arm does not exist (CLAUDE.md, "an UNREACHABLE guard is not free").
- **Layer bans are lint rules.** `presentation → application → domain → core`; `presentation/dialogs/` may not import `application/`. Nothing here touches `application/` or below.
- **No user-facing string literal.** Every new key lands in `src/presentation/i18n/locales/en/editor.ts` AND `de/editor.ts` in the same edit (`de/editor.ts` is `Record<keyof typeof editorEn, string>`, so a key missing on either side is a build error). German addresses the user formally (Sie). Sentence case in English (linted; a capitalised word mid-sentence fails the build).
- **No colour literal in `styles/`**; Obsidian variables only. **`max-lines` is 400** for every `src/**` file and `styles/*.css` partial.
- **TDD, watched red.** The test a note says is missing or vacuous is written FIRST and watched fail at its assertion (not at a missing selector). Where a task says "mutation-check", apply the mutation, run the file, observe red, revert — and say so in the report.
- **Write files with Write/Edit, never PowerShell** (`Set-Content`/`Out-File` write a BOM). **Stage explicit paths**; never `git add -A .` or `commit -a`.
- **Anything whose symptom is spacing, wrapping, overflow or alignment is verified by `npm run harness-shot` and READING the PNG** with the Read tool, not by a jsdom assertion alone. The pinned Chromium is at `C:\Users\LuisMendez\AppData\Local\ms-playwright\chromium-1234\chrome-win64\chrome.exe`; if `scripts/chromium.mjs` does not find it, set `RP_CHROMIUM_EXECUTABLE` to that path.
- **Every task closes its notes**: frontmatter `status: Done`, `started: 2026-09-04`, `finished: 2026-09-04`, and a dated `## What closed it` section naming the commit (short SHA) and the holding test per criterion, in the shape `docs/issues/A prototype's own spacing is checked by nobody.md` already uses. Document edits stage by explicit path.
- **Rulings go in the ledger** (`.superpowers/sdd/2026-09-04-plan-editor-review-findings/progress.md`) as `Ruling: <what> — <why> — <cost if wrong>`. The twenty rulings below are pre-written; the executor copies them into the ledger at setup and adds any the run produces.
- **Models:** `sonnet` for implementers and task reviewers; `opus` for Task 3 and Task 6 (they touch `EditorSurface.vue` / `ResponsiveEditorShell.vue`) and for the final whole-branch review; never `haiku`.

---

## Triage

Buckets: **Code** (closing change under `src/`, `styles/` or `tests/`), **Record** (closing change under `docs/` only), **Contract** (a spec/contract sentence and the code disagree — decided by a ruling, then closed by amending the document, or moved to Code where the code is wrong), **Not now** (out of this increment's reach; `status` stays `New`, gains a dated `## Decision`).

| # | Note (`docs/issues/`) | Priority | Bucket | Task |
|---|---|---|---|---|
| 1 | A Cancel button with a drafted room leaves the creation task active | high | Code | T2 |
| 2 | A deleted hover target keeps the target cursor active | high | Code | T3 |
| 3 | A handle hover renders the body-selection cursor | high | Code | T3 |
| 4 | A missing hydration can keep a stale flag set | medium | Code | T4 |
| 5 | A resize-driven overlay close strands focus on body | high | Code | T6 |
| 6 | An Add choice activates before the menu closes | high | Code | T1 |
| 7 | Escape closes Add only while focus remains inside the menu | high | Code | T1 |
| 8 | Project-hydration fakes ignore the requested project ID | high | Code | T9 |
| 9 | Selection clearing is silent while the constrained Inspector is closed | high | Code | T8 |
| 10 | The Add menu sends wheel gestures to the canvas | high | Code | T1 |
| 11 | The Add menu survives the canvas that anchored it | high | Code | T1 |
| 12 | The Add-menu pointer tests omit pointerup | high | Code | T1 |
| 13 | The Escape contract clears selection before a Select drag is abandoned | medium | Contract (R1) | T0 |
| 14 | The Escape contract requires a second cancellation with no draft to cancel | medium | Contract (R2) → one test assertion | T0 |
| 15 | The Inspector's two unavailable lists are separate navigation models | medium | Record (R17) | T12 |
| 16 | The approved slice contract omits two Editor-foundation PBIs | medium | Record (R18) | T12 |
| 17 | The completed floor-summary task promises a stale aggregate no model can represent | medium | Record | T12 |
| 18 | The completed implementation plan leaves every tracking box open | medium | Record | T12 |
| 19 | The constrained-overlay contract both requires and refuses a focus trap | medium | Contract (R3) → one Tab test | T0 (ruling), T6 (test) |
| 20 | The cross-surface identity test starts after selection | high | Code | T9 |
| 21 | The exact-once Add test never counts activations | high | Code | T1 |
| 22 | The fake ResizeObserver hides removal of the mount-time measurement | high | Code | T9 |
| 23 | The fixed-shot inventory test omits two merged captures | high | Code | T10 |
| 24 | The hover-click agreement test never clicks | high | Code | T9 |
| 25 | The implementation-plan diff contains trailing whitespace | low | Record | T12 |
| 26 | The manual keymap claim points to a step that never invokes the keymap | medium | Record | T12 |
| 27 | The migration amendment counts a pre-merge tree | medium | Record | T12 |
| 28 | The overlap-order test repeats the same candidate order | high | Code | T9 |
| 29 | The partial-summary test never checks the area count | high | Code | T9 |
| 30 | The plan-editor manual case has never run in a vault | medium | **Not now** (R19) | T12 |
| 31 | The smoke-test census omits the newest case | medium | Record | T12 |
| 32 | The status bar reports an unset scale before any plan has loaded | high | Code (R9) | T4 |
| 33 | The toolbar-key retirement contract conflicts with the Asset Designer | medium | Contract (R6) → Code | T0 (ruling), T11 |
| 34 | The two full-panel toggle actions have no production caller | medium | Code (R11) | T6 |
| 35 | The unsupported-width copy pluralizes one room as rooms | high | Code (R12) | T7 |
| 36 | The unsupported-width summary presents a partial room count as complete | high | Code (R12) | T7 |
| 37 | The warning live-region contract and implementation describe different semantics | medium | Contract (R4) → one DOM test | T0 (ruling), T5 (test) |
| 38 | The warning model cannot carry its contract's severity | high | Code (R5, scoped) | T5 |
| 39 | Three plan-editor captures can complete before their intended state appears | high | Code (R14) | T10 |
| 40 | Unsupported layout can preserve an interrupted canvas gesture | high | Code | T6 |
| 41 | Unsupported width has no horizontal-overflow check | medium | Code (R13) | T10 |

Not among the 41: `Ten captures land in a folder nothing opens.md` was AMENDED by `bc6ca060` (its count corrected to twenty), not added. It asks for a contact sheet, which is a Task rather than a review finding; it stays as it is (R20). Task 10's new shot takes the count to twenty-one, and that task adds one more dated line to it.

## Rulings (pre-written; copied into the ledger at setup)

- **R1** Ruling: spec §6.3 is amended to the implemented Escape precedence — pan swallows; ANY active tool with a draft cancels the draft (Select's drag included); a non-Select tool without a draft returns to Select; Select with a selection clears it — because a selection cleared out from under a hand still dragging is worse than an abandoned drag, and code, test (`escapeRouting.test.ts` "Select mid-drag cancels the drag before it would clear the selection") and the Selection PBI amendment already agree — cost if wrong: a contract-driven refactor would have to re-derive the safer order from a test rather than from the spec.
- **R2** Ruling: a no-draft temporary tool returns through `setTool('select')` alone, whose deactivation IS the cancellation boundary; §6.3 drops "`cancelGesture()` and" from that arm, and `escapeRouting.test.ts` asserts `cancelGesture` is NOT called there — because `hasDraft()` has already answered `false` and `ToolManager.setActiveTool` runs the outgoing tool's `cancel()`/`deactivate()`, so a second call would be a second answer — cost if wrong: a future tool that distinguishes cancel from deactivate must add the call and re-derive the equivalence at this arm, which the test will name.
- **R3** Ruling: the constrained Layers overlay and Inspector drawer do NOT trap focus; M16's "trap focus only while open" sentence is amended to "restore focus on close and do not trap it — the canvas stays reachable by Tab", and §5.5 stops attributing a trap to M16 — because the Inspector PBI criterion 7 ("does not trap focus"), both components and the canvas-stays-reachable design already agree, and a modal trap would need inertness and cycling nobody designed — cost if wrong: a keyboard user can Tab out of an open overlay onto the canvas, which is the intended modeless behaviour; a later modal decision is a redesign of both panels.
- **R4** Ruling: the persistent-warning live region is the CONTAINER (`.rp-warning-strip[role="status"]`, rendered unconditionally), never a per-item role; §5.1's row is narrowed to say so — because a region that exists before its first content announces reliably (`docs/components/Toast.md`'s own rule) and per-item regions would risk nested/duplicate announcements — cost if wrong: two simultaneous warnings are announced as one region update rather than two; if assistive-technology evidence ever demands per-item regions, the test written here is replaced by its opposite.
- **R5** Ruling: `EditorWarning` gains `severity: 'warning' | 'error'` (the spec §5.1 field), rendered as a per-item MARK AND WORD (`data-rp-severity` plus a translated label), with `stale` and `background-missing` as `warning` and `unreadable-zones` and `background-unreadable` as `error`; accessible heading, busy state and actions stay UNBUILT and recorded, because no warning has an action to be busy over and a busy flag with no producer is a self-declared shape — cost if wrong: a later retry action adds fields to a model that already has a severity axis; the severity split (data may be out of date vs a read refused) is a taste call a reviewer may move.
- **R6** Ruling: the Asset Designer's three borrowed strings become `designer.toolbar.pan`, `designer.toolbar.undo`, `designer.toolbar.redo`; `editor.toolbar.*` is deleted from both locales; spec §5.2/§8/§10 are narrowed to the Plan Editor toolbar keys the increment actually retired; a test refuses the literal `editor.toolbar.` anywhere under `src/` — because ownership of a key namespace must be expressible by a test, and three German words are cheaper than an ambiguous owner — cost if wrong: two identical "Undo" translations in the locale tables.
- **R7** Ruling: the banner's Cancel is NOT Escape. Cancel LEAVES the task — clear any draft, then return to Select — while Escape steps back through the nearest interaction; `createCancelActiveTask` stops routing through `routeEscape`, and the "the banner's Cancel and Escape are the same routine" evidence in `Run one temporary creation task from Add` and the PBI is rewritten — because PBI criterion 7 and main-flow step 6 require cancellation to return to Select, and a control labelled Cancel that keeps the mode active is the live-control-that-misleads shape — cost if wrong: a user who wanted only to clear the draft and keep drawing presses Escape instead, or Add → Room again.
- **R8** Ruling: the hover's target kind is a SECOND field on `RenderState`, `hoveredTargetKind: 'body' | 'handle' | null`, written beside `hoveredObjectId` by `SelectTool.pointerMove` and cleared wherever the id is — because the layer's existing reads of the id stay untouched and a kind is what the cursor needs — cost if wrong: two fields that must move together, held together by the three sites that write them and the retirement watcher.
- **R9** Ruling: the status bar WITHHOLDS the scale sentence unless `ProjectStore.status === 'ready'` (a plan is loaded); no new "unknown" string — because "not set" is a fact about a loaded plan, and an unknown-scale word would be a fourth state nobody asked to read — cost if wrong: the measurements region is one span shorter while loading; if a reader wants an explicit unknown, it is one key and one arm.
- **R10** Ruling: a resize that closes an open overlay by growing to `full` moves focus to the persistent REGION the overlay stood in for — the `.rp-editor-layers` aside or the `.rp-editor-inspector` aside, each given `tabindex="-1"` and a `data-rp-region` — never to its first control — because the region always exists in `full` (no fallback arm), Tab from it lands on the region's first control, and the rail button the Escape path focuses is removed by the same transition — cost if wrong: one extra Tab for a keyboard user versus focusing the first control directly.
- **R11** Ruling: `toggleLayersPanel`, `toggleInspectorPanel`, `layersPanelOpen` and `inspectorPanelOpen` are DELETED, with their test-only callers; the shell renders both full-mode panels unconditionally — because spec §5.6 built no View menu and no production control calls them, and test-only callers make dead flexibility look used — cost if wrong: the increment that builds a panel toggle re-adds two refs and two actions, with a control to reach them.
- **R12** Ruling: the unsupported-width body is THREE keys chosen at the caller — `.one`, `.other`, `.partial` — with `.partial` carrying no count at all; no plural support is added to `tr` — because one count with three sentences is smaller than a pluralisation mechanism for the first count that needs one, and a partial count the sentence cannot qualify is omitted rather than presented as complete (the note's own second option) — cost if wrong: a fourth count somewhere else re-opens the `tr` plural question, which is recorded rather than solved here.
- **R13** Ruling: the 320 px horizontal-overflow check lives in `npm run harness-shot` as a `measure` on a new fixed shot `plan-editor-unsupported`, read in the browser and judged by a pure Node function, and the run exits 1 on a finding — because jsdom lays nothing out and the capture script is the one instrument here that can read `scrollWidth`; it stays outside `npm run check` like every capture — cost if wrong: a regression is caught only when somebody runs the captures, which is already true of every layout defect this repository has found.
- **R14** Ruling: `plan-editor-dark`/`-light` wait on `.rp-floor-inspector` (present only once hydration is `ready` AND nothing is selected — the state those shots name); `plan-editor-narrow` waits on a selector LIST, `.rp-plan-canvas` and `.rp-editor-shell[data-layout="constrained"] .rp-panel-rail`; `waitUntilReady` accepts `string | string[]` for fixed shots — because a wrapper attached before hydration is a valid PNG of the wrong state — cost if wrong: a capture that legitimately shows a selected or loading state under those names now fails, which is the point.
- **R15** Ruling: the "return to the floor" announcement (§6.6) moves out of `EntityInspector` into a shell-level `SelectionGuidance.vue`, mounted by `PlanEditorRoot` in the warnings region beside `PersistentWarningStrip`, so its watcher and `role="status"` region survive every layout mode; §6.6 is amended from "`EntityInspector` has one `role="status"`" to name the shell-level region — because the constrained drawer unmounts the Inspector and a watcher that is not mounted hears nothing — cost if wrong: the guidance sentence is drawn in the warnings region instead of the Inspector column for the moment it is visible.
- **R16** Ruling on the Add menu, four halves: (a) `activate` emits `close` BEFORE calling the entry (§7.2's order); (b) the ROOT owns Escape while the menu is open — a capture-phase `keydown` on `PlanEditorRoot`'s element closes the menu and stops the event, and `AddMenu.onKeydown` loses its own Escape branch; (c) the menu retires itself on `focusout` to a Node outside the menu and the anchor — a `null` relatedTarget (focus left the window) keeps it, the same Alt+Tab reasoning the pan override records; (d) `wheel` is stopped at `.rp-plan-overlay` beside the three pointer stops; (e) the root retires `addMenuOpen`/`addButton` when `PlanCanvas` unmounts (`@vue:unmounted`) — because §6.3 says the root owns this precedence and no document-global handler may close another leaf's menu — cost if wrong: (b) makes Escape unreachable for a standalone-mounted menu with no root, which no production tree has.
- **R17** Ruling: `The Inspector's two unavailable lists are separate navigation models` closes DOCUMENTARILY — the `Assemble shared homeowner-question Inspector navigation` amendment stops claiming criterion 7 met and says one closed vocabulary feeds two presentation models, and criterion 7 stays open — because the approved design (§5.1, §6.7) is explicitly two lists and inventing a descriptor registry before any route exists is design work outside a review-fix increment — cost if wrong: the first available section's author must decide which list owns it, which the amendment now says out loud.
- **R18** Ruling: `Inspect a selected wall` and `Plan editor and canvas` are added to spec §1's "Not advanced here" set with a scope sentence each, and the approval task's closing evidence says 13 of 13; NO parser-backed docs gate is added — because CLAUDE.md lists a `docs/` register gate as deliberately absent with its own trigger, and the note's `rg` command is the review-time check — cost if wrong: the next PBI added under `Editor foundation` can again go unmapped until a reviewer greps.
- **R19** Ruling: `The plan-editor manual case has never run in a vault` is NOT NOW — because closing it means a human opening Obsidian, which no agent here can do; the note gets a dated `## Decision` naming what reopens it (a walk of `docs/tests/cases/Open a floor and select a room.md` after `npm run test-build`, recorded in its Runs table) — cost if wrong: none; the note stays visible in the backlog.
- **R20** Ruling: `Ten captures land in a folder nothing opens` is outside this plan (amended, not added, by `bc6ca060`; it asks for a contact sheet, a Task) and gains one dated line when Task 10 makes the count twenty-one — cost if wrong: none.

---

## File Structure

| Task | Files created | Files modified |
|---|---|---|
| T0 | — | spec §1, §5.1, §5.2, §5.5, §6.3, §6.6, §8, §10; `M16-constrained-workspace.md`; `docs/requirements/Selection.md`; `docs/tasks/Return selection to the safe floor state.md`; `docs/tasks/Approve the Editor foundation slice contract.md`; issue notes 13, 14 (frontmatter + closing sections; note 14's test lands in the same task) |
| T1 | — | `src/presentation/editor/add/AddMenu.vue`, `src/presentation/editor/PlanEditorRoot.vue`, `src/presentation/editor/surface/EditorSurface.vue` (one `@wheel.stop` — the only line touched there), `tests/presentation/editor/add/addMenu.test.ts`, `tests/presentation/editor/add/creationCatalogue.test.ts`, `tests/presentation/editor/shell/responsiveShell.test.ts`; notes 6, 7, 10, 11, 12, 21; PBI `Start one creation task from Add`; task `Run one temporary creation task from Add` |
| T2 | — | `src/presentation/editor/runtime.ts`, `tests/presentation/editor/shell/temporaryToolBanner.test.ts`; note 1; PBI `Start one creation task from Add`; task `Run one temporary creation task from Add` |
| T3 | — | `src/presentation/editor/tools/render-state.ts`, `src/presentation/editor/tools/select-tool.ts`, `src/presentation/editor/runtime.ts`, `src/presentation/editor/surface/EditorSurface.vue`, `styles/editor-cursors.css`, `tests/presentation/editor/runtime.test.ts`, `tests/presentation/editor/canvasNavigation.test.ts`, `tests/presentation/editor/tools/selectTool.test.ts`; notes 2, 3; PBI `Selection`; task `Compose predictive and contextual Select surfaces` |
| T4 | — | `src/presentation/editor/shell/StatusBar.vue`, `src/presentation/stores/ProjectStore.ts`, `tests/presentation/editor/shell/statusBar.test.ts`, `tests/presentation/stores/stores.test.ts`; notes 4, 32; PBI `Open a floor plan in the Obsidian editor shell`; task `Build full and compact editor status bars` |
| T5 | — | `src/presentation/editor/shell/warnings.ts`, `src/presentation/editor/shell/PersistentWarningStrip.vue`, `styles/editor-layout.css` (or the partial that declares `.rp-warning-strip`), `locales/en/editor.ts`, `locales/de/editor.ts`, `tests/presentation/editor/shell/warnings.test.ts`, `tests/presentation/editor/shell.test.ts`; notes 37, 38; task `Render independent simultaneous persistent warnings`; PBI `Open a floor plan…` |
| T6 | — | `src/presentation/editor/shell/ResponsiveEditorShell.vue`, `src/presentation/editor/shell/PropertyLayerPanel.vue`, `src/presentation/editor/shell/EntityInspector.vue`, `src/presentation/editor/shell/FloorInspector.vue` (docblock), `src/presentation/stores/WorkspaceStore.ts`, `src/presentation/editor/surface/EditorSurface.vue`, `tests/presentation/editor/shell/responsiveShell.test.ts`, `tests/presentation/editor/shell.test.ts`, `tests/presentation/stores/stores.test.ts`; notes 5, 19 (test half), 34, 40; PBIs `Layers`, `Inspect a selected room`, `Open a floor plan…`; tasks `Keep layer controls usable in constrained leaves`, `Enforce shared editor component and state boundaries` |
| T7 | — | `src/presentation/editor/shell/UnsupportedWidthNotice.vue`, `locales/en/editor.ts`, `locales/de/editor.ts`, `tests/presentation/editor/shell/responsiveShell.test.ts`, `docs/tests/cases/Open a floor and select a room.md` (step 10 copy check); notes 35, 36; task `Keep the editor truthful across failure and narrow layouts`; PBIs `Open a floor plan…`, `View rooms in the Standard Plan View` |
| T8 | `src/presentation/editor/shell/SelectionGuidance.vue` | `src/presentation/editor/shell/EntityInspector.vue`, `src/presentation/editor/PlanEditorRoot.vue`, `styles/editor-inspector.css`, `tests/presentation/editor/shell/floorInspector.test.ts`, `tests/presentation/editor/shell/responsiveShell.test.ts`; note 9; PBI `Selection`; task `Present the truthful floor summary and selection guidance` |
| T9 | — | `tests/helpers/layout.ts`, `tests/helpers/editor.ts`, `tests/helpers/planFixtures.ts`, `tests/harness/planEditor.ts`, `src/presentation/editor/layers/InteractionLayer.vue` (one `name`), `tests/presentation/editor/shell/responsiveShell.test.ts`, `tests/presentation/stores/stores.test.ts`, `tests/presentation/editor/shell/roomInspector.test.ts`, `tests/presentation/editor/selection/resolveSelectionTarget.test.ts`, `tests/presentation/read-models/spatialRecords.test.ts`, `tests/presentation/editor/tools/selectTool.test.ts`; notes 8, 20, 22, 24, 28, 29; PBIs `Inspect a selected room`, `Selection`; tasks `Render the selected room Inspector overview`, `Resolve overlapping selection targets deterministically`, `Present the truthful floor summary…`, `Compose predictive…` |
| T10 | `scripts/captureMeasures.mjs`, `tests/build/captureMeasures.test.ts` | `scripts/harness-shot.mjs`, `scripts/captureReadiness.mjs`, `tests/build/captureReadiness.test.ts`, `tests/build/harness-shot.test.ts`; notes 23, 39, 41; `Ten captures land in a folder nothing opens.md` (one line); task `Keep the editor truthful…`; PBI `Open a floor plan…` |
| T11 | — | `src/presentation/designer/DesignerToolbar.vue`, `locales/en/editor.ts`, `locales/de/editor.ts`, `locales/en.ts` (two comments), `tests/presentation/designer/designerToolbar.test.ts`, `tests/presentation/designer/assetDesignerRoot.test.ts`, `tests/presentation/designer/designerTools.test.ts`, `tests/presentation/i18n/strings.test.ts`; note 33 |
| T12 | — | spec §1; `docs/tasks/Approve the Editor foundation slice contract.md`; `docs/tasks/Present the truthful floor summary and selection guidance.md`; `docs/tasks/Assemble shared homeowner-question Inspector navigation.md`; `docs/tasks/Establish the editor migration and compatibility contract.md`; `docs/tasks/Operate the Add menu by pointer and keyboard.md`; `docs/tests/cases/Open a floor and select a room.md`; `docs/tests/suites/Smoke Test the Editor.md`; `docs/superpowers/plans/2026-09-02-plan-editor-foundation-read-path.md`; notes 15, 16, 17, 18, 25, 26, 27, 30, 31 |

---

### Task 0: the contract rulings, written into the documents

**Files:**
- Modify: `docs/superpowers/specs/2026-09-02-plan-editor-foundation-read-path-design.md` (§1 "Not advanced here", §5.1 `PersistentWarningStrip` row, §5.2, §5.5, §6.3, §6.6, §8, §10 build row)
- Modify: `docs/user-experience/renovation-planner-editor-specs/screens/M16-constrained-workspace.md:58`
- Modify: `docs/requirements/Selection.md` (the 2026-09-03 deviation paragraph), `docs/tasks/Return selection to the safe floor state.md`
- Modify: `src/presentation/editor/escapeRouting.ts` (docblock only: the "Two deviations" paragraph becomes "Two decisions §6.3 now records")
- Test: `tests/presentation/editor/escapeRouting.test.ts` (one assertion, note 14)
- Close: notes 13, 14. Notes 19, 33, 37 get their ruling recorded in a dated `## Decision` section here but close in T6, T11, T5 respectively (their frontmatter stays `New` until then).

**Interfaces:** Produces the amended sentences every later task's docs edits quote. Consumes nothing.

- [ ] **Step 1: Amend §6.3 (R1, R2).** Replace the sentence beginning "The rule becomes, in order:" through "else nothing." with:

```markdown
The rule is, in order: an open Add menu or overlay closes (the root owns those and handles the
key before the canvas sees it); else a running pan swallows it (existing); else ANY active tool
holding a draft — `DrawPolygonTool`'s vertex buffer, `CalibrateTool`'s placed point, or
`SelectTool`'s drag in flight — cancels that draft and stays put (`EditorTool.hasDraft()`), so a
selection is never cleared out from under a hand still dragging; else an active non-Select tool
with nothing drawn returns to Select through `setTool('select')` alone, whose deactivation of
the outgoing tool IS the cancellation boundary (no separate `cancelGesture()` call — `hasDraft()`
has already answered `false`); else with Select active and a selection: clear it; else nothing.
Clicking empty canvas already clears (`SelectTool.pointerDown` with `null` hit).

*Amended 2026-09-04.* The first version nested the draft test under "an active non-select tool"
and called both `cancelGesture()` and a return to Select on the no-draft arm. The code shipped the
order above deliberately (`escapeRouting.ts`, `escapeRouting.test.ts`'s "Select mid-drag cancels
the drag before it would clear the selection") and this section now says what the code does.
```

- [ ] **Step 2: Amend §5.5 (R3).** Replace "Neither traps focus; the canvas behind them stays reachable by Tab, which is what M16 asks for ("trap focus only while open" is read as: focus does not escape to the page, and jsdom cannot see that either way, so the manual case checks it)." with:

```markdown
Neither traps focus: the canvas behind them stays reachable by Tab. M16's accessibility list
used to read "overlay panels trap focus only while open"; the Inspector PBI's criterion 7
requires the opposite ("does not trap focus"), both components implement no trap, and M16 was
amended on 2026-09-04 to match. `responsiveShell.test.ts` presses Tab out of each open panel
onto the canvas; whether Electron honours the focus return is the manual case's step 9.
```

- [ ] **Step 3: Amend M16 line 58** from "- Overlay panels trap focus only while open and restore it on close." to "- Overlay panels restore focus to the rail button on close and do not trap it while open; the canvas stays reachable by Tab (amended 2026-09-04 — the Inspector PBI requires no trap and the shipped panels implement none)."

- [ ] **Step 4: Amend §5.1's `PersistentWarningStrip` row (R4, R5).** Replace "Renders every active warning, each its own `role="status"` element, in a fixed order." with "Renders every active warning, in a fixed order, inside ONE unconditional `role="status"` container — never a per-item live region, so the region exists before its first content (amended 2026-09-04). Each item carries its `severity` as a mark and a word; heading, busy state and actions are not in this increment's model."

- [ ] **Step 5: Amend §6.6 (R15).** Replace "`EntityInspector` has one `role="status"` element that receives" with "A shell-level `SelectionGuidance` region (mounted by the root beside the warning strip, so it is present in every layout mode — amended 2026-09-04, the Inspector is unmounted while the constrained drawer is closed) has one `role="status"` element that receives".

- [ ] **Step 6: Narrow §5.2, §8 and §10 (R6).** §5.2: after "are deleted." add "Only the PLAN EDITOR's toolbar keys are meant: the Asset Designer keeps a real toolbar and owns its own `designer.toolbar.*` keys (amended 2026-09-04; three keys it had borrowed from this namespace are renamed)." §8: "Keys retired with the toolbar are deleted from both." → "The Plan Editor toolbar's keys are deleted from both; no `editor.toolbar.*` key survives in either locale, and `strings.test.ts` refuses the prefix." §10 build row: "`editor.toolbar.*` keys gone" → "no `editor.toolbar.*` key in either locale and no reference under `src/`".

- [ ] **Step 7: Amend §1 (R18).** Append to the "Not advanced here" paragraph: "Inspect a selected wall (no wall entity exists; this increment's Room Inspector is the frame a wall Inspector will reuse), Plan editor and canvas (the pre-existing scheduling PBI; nothing here advances its criteria). Amended 2026-09-04: the first draft mapped 11 of the 13 PBIs whose frontmatter parent is `[[Editor foundation]]`; `rg -l '^parent: "\[\[Editor foundation\]\]"$' docs/requirements` is the review-time check."

- [ ] **Step 8: Write the failing assertion (note 14).** In `tests/presentation/editor/escapeRouting.test.ts` change the no-draft case to:

```ts
	it('a drawing tool WITHOUT a draft returns to Select through setTool alone — deactivation is the cancellation boundary', () => {
		const d = deps({ activeToolId: 'draw-polygon' });
		expect(routeEscape(d)).toBe('returned-to-select');
		expect(d.setTool).toHaveBeenCalledWith('select');
		// §6.3 as amended 2026-09-04 (R2): no second cancellation on this arm.
		expect(d.cancelGesture).not.toHaveBeenCalled();
	});
```

Run: `npx vitest run tests/presentation/editor/escapeRouting.test.ts` — expected GREEN already (the code never called it). This assertion is a PIN, not a red-first test; say so in the report. Mutation-check: add `deps.cancelGesture();` before `deps.setTool('select')` in `routeEscape` → the case must fail; revert.

- [ ] **Step 9: Update `escapeRouting.ts`'s docblock** — the "Two deviations from spec §6.3, recorded rather than silently taken" paragraph becomes "Two decisions §6.3 records since 2026-09-04 (they were deviations until the spec was amended to them)"; keep (a) and (b) as the reasoning.

- [ ] **Step 10: Update the Selection PBI and the `Return selection…` task.** In `docs/requirements/Selection.md`, the paragraph beginning "**2026-09-03** — `routeEscape` … deviates from §6.3 on purpose" gains a trailing sentence: "**2026-09-04** — §6.3 was amended to this order; it is the contract now, not a deviation." In `docs/tasks/Return selection to the safe floor state.md`'s Closing evidence, after criterion 2's list add: "The no-draft arm's single `setTool('select')` is pinned by 'a drawing tool WITHOUT a draft returns to Select through setTool alone' (2026-09-04)." Remove the two notes' wikilinks from the PBI's trailing list.

- [ ] **Step 11: Record the four rulings in notes 19, 33, 37** as a dated `## Decision` section each (R3, R6, R4+R5 respectively, verbatim from the Rulings list), leaving `status: New`.

- [ ] **Step 12: Close notes 13 and 14.** Frontmatter `status: Done`, `started: 2026-09-04`, `finished: 2026-09-04`; `## What closed it` (dated 2026-09-04): note 13 — "§6.3 amended to the implemented order (R1); holding test `escapeRouting.test.ts` 'Select mid-drag cancels the drag before it would clear the selection'"; note 14 — "§6.3 amended (R2); holding assertion `expect(d.cancelGesture).not.toHaveBeenCalled()` in 'a drawing tool WITHOUT a draft returns to Select through setTool alone'". Name the commit SHA after committing (amend the section in the same commit is impossible; write `see commit <sha>` in the NEXT task's commit if needed, or commit docs then a fixup — prefer: commit code+docs, read `git rev-parse --short HEAD`, and let the commit message itself be the reference by quoting the note title; the `## What closed it` section names the test and the commit's subject line).

- [ ] **Step 13: `npm run check`, then commit.**

```bash
git add docs/superpowers/specs/2026-09-02-plan-editor-foundation-read-path-design.md "docs/user-experience/renovation-planner-editor-specs/screens/M16-constrained-workspace.md" docs/requirements/Selection.md "docs/tasks/Return selection to the safe floor state.md" src/presentation/editor/escapeRouting.ts tests/presentation/editor/escapeRouting.test.ts "docs/issues/The Escape contract clears selection before a Select drag is abandoned.md" "docs/issues/The Escape contract requires a second cancellation with no draft to cancel.md" "docs/issues/The constrained-overlay contract both requires and refuses a focus trap.md" "docs/issues/The toolbar-key retirement contract conflicts with the Asset Designer.md" "docs/issues/The warning live-region contract and implementation describe different semantics.md"
git commit -m "docs(spec): rule on the four contract conflicts the review found, and pin the no-draft Escape arm"
```

---

### Task 1: the Add menu — order, Escape ownership, focus boundary, wheel, unmount, and the tests that hold them

**Files:**
- Modify: `src/presentation/editor/add/AddMenu.vue`
- Modify: `src/presentation/editor/PlanEditorRoot.vue`
- Modify: `src/presentation/editor/surface/EditorSurface.vue` — ONE line: `@wheel.stop` on `.rp-plan-overlay` (this is the only reason this task touches the file; a sonnet implementer is allowed for it because the change is one attribute beside three identical ones)
- Test: `tests/presentation/editor/add/addMenu.test.ts`, `tests/presentation/editor/add/creationCatalogue.test.ts`, `tests/presentation/editor/shell/responsiveShell.test.ts`
- Close: notes 6, 7, 10, 11, 12, 21. Amend `docs/requirements/Start one creation task from Add.md` (criteria 3, 4, 5 evidence) and `docs/tasks/Run one temporary creation task from Add.md` (criterion 1 evidence → the counting case).

**Interfaces:**
- Consumes: `runtimeOf(harness)` (`tests/helpers/editor.ts`), `mountPlanEditorCanvas`, `settle`, `resizeTo` (`tests/helpers/layout.ts`), `click`/`pointer` (`tests/helpers/planEditorRig.ts`).
- Produces: `press(el: Element)` helper inside `addMenu.test.ts` (pointerdown → pointerup → click); `AddMenu` no longer handles Escape itself; `PlanEditorRoot` has `onRootKeydown` (capture) and `retireAddMenu`.

Acceptance criteria, verbatim from the notes:

- (6) "Emit close before invoking the available entry. Add a standalone `AddMenu` test with a provided runtime whose `setTool` throws; after the activation rejects, the component must already have emitted exactly one close event. A second assertion should observe that the close callback runs before `setTool`, so a final-state-only implementation cannot pass." — test: `addMenu.test.ts` › standalone › 'emits close before it calls the entry, and exactly once, even when the entry throws'.
- (7) "Put the menu-open Escape precedence at the owning root and retire the menu when focus leaves its interaction boundary, without introducing a document-global handler that closes menus in other editor leaves. Add a mounted-tree test that moves focus from a menu item to another control in the same editor, presses Escape, and requires only the menu to close while tool, draft and selection remain unchanged." — tests: 'focus leaving the menu for another control in the same editor retires it, and nothing else moves' and 'Escape while the menu is open is the root's, and a drafted polygon under the canvas survives it'.
- (10) "Stop wheel propagation at the overlay or Add-menu boundary while leaving the event's default scroll behavior available to the menu. Add a mounted-tree test that dispatches a cancelable wheel event over the overflowing menu and requires an unchanged viewport and `defaultPrevented === false`; removing the wheel stop must make that test fail." — test: 'a wheel over the menu scrolls the menu, never the plan'.
- (11) "Retire the Add-menu state when its canvas subtree unmounts and discard the stale anchor. The smallest discriminating test opens Add, resizes to unsupported, resizes back to full, and requires the menu to remain closed, `aria-expanded` to be false and a subsequent Add press to open against the newly mounted button." — test: `responsiveShell.test.ts` › 'an open Add menu does not survive the canvas being unmounted below the floor width'.
- (12) "Use one pointer helper that sends a real `pointerdown`/`pointerup`/`click` sequence for the menu, anchor and Select-button cases. Register a pointer-up observer on the canvas boundary and assert that it receives zero releases from those overlay controls; … Mutation-check by removing only `@pointerup.stop`; the delivery-count assertion must fail while the press assertions remain green." — tests: the three rewritten pointer cases plus 'no press or release from the menu, the anchor or Select ever reaches the canvas boundary'.
- (21) "Drive `AddMenu` with a countable runtime seam and assert one `setTool('draw-polygon')` call and one close emission for one Enter or click gesture. At minimum, add a count assertion to the catalogue spy, but retain a menu-level count so duplicate routing above the catalogue is also caught. Mutation-check by calling `activateFocused()` twice and requiring the test to fail." — tests: 'Enter on Room starts exactly one tool…' (rewritten to count) and `creationCatalogue.test.ts` `toHaveBeenCalledTimes(1)`.

- [ ] **Step 1: Write the failing tests.** Add to `addMenu.test.ts` (imports: `useEditorStore` from `src/presentation/stores/EditorStore`, `click`, `pointer` from `tests/helpers/planEditorRig`):

```ts
/** A real primary press as a mouse delivers it: down, up, then the click that follows both. */
async function press(target: Element): Promise<void> {
	target.dispatchEvent(new PointerEvent('pointerdown', { button: 0, buttons: 1, pointerId: 1, bubbles: true }));
	target.dispatchEvent(new PointerEvent('pointerup', { button: 0, buttons: 0, pointerId: 1, bubbles: true }));
	target.dispatchEvent(new MouseEvent('click', { button: 0, bubbles: true }));
	await settle();
}

it('Enter on Room starts exactly one tool and emits exactly one close', async () => {
	const harness = await mountPlanEditorCanvas();
	await openAdd(harness);
	await settle();
	const runtime = runtimeOf(harness);
	const setTool = vi.spyOn(runtime, 'setTool');
	const menu = harness.wrapper.findComponent(AddMenu);

	menu.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
	await settle();

	expect(setTool).toHaveBeenCalledTimes(1);
	expect(setTool).toHaveBeenCalledWith('draw-polygon');
	expect(menu.emitted('close')).toHaveLength(1);
	expect(harness.wrapper.find('[role="menu"]').exists()).toBe(false);
});

it('a wheel over the menu scrolls the menu, never the plan', async () => {
	const harness = await mountPlanEditorCanvas();
	await openAdd(harness);
	await settle();
	const before = { ...useEditorStore(harness.pinia).viewport };

	const wheel = new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true });
	harness.wrapper.find('.rp-add-menu').element.dispatchEvent(wheel);
	await settle();

	// `defaultPrevented === false` is what leaves the browser free to scroll the menu's own
	// overflow; an unchanged viewport is what says the canvas never heard it.
	expect(wheel.defaultPrevented).toBe(false);
	expect({ ...useEditorStore(harness.pinia).viewport }).toEqual(before);
});

it('no press or release from the menu, the anchor or Select ever reaches the canvas boundary', async () => {
	const harness = await mountPlanEditorCanvas();
	const releases: string[] = [];
	const presses: string[] = [];
	harness.canvasEl.addEventListener('pointerup', (e) => releases.push((e.target as Element).className));
	harness.canvasEl.addEventListener('pointerdown', (e) => presses.push((e.target as Element).className));
	await openAdd(harness);
	await settle();

	await press(harness.wrapper.find('.rp-add-menu__search').element);
	await press(harness.wrapper.find('button[data-rp-action="add"]').element); // toggles closed
	await openAdd(harness);
	await settle();
	await press(harness.wrapper.find('button[data-rp-action="select"]').element);

	expect(presses).toEqual([]);
	expect(releases).toEqual([]);
});

it('focus leaving the menu for another control in the same editor retires it, and nothing else moves', async () => {
	const harness = await mountPlanEditorCanvas();
	useSelectionStore(harness.pinia).select(['zone-kitchen' as never]);
	await openAdd(harness);
	await settle();
	expect(document.activeElement?.getAttribute('data-rp-entry')).toBe('room');

	(harness.wrapper.find('button[data-rp-action="select"]').element as HTMLElement).focus();
	await settle();

	expect(harness.wrapper.find('[role="menu"]').exists()).toBe(false);
	expect(harness.wrapper.find('button[data-rp-action="add"]').attributes('aria-expanded')).toBe('false');
	expect(runtimeOf(harness).activeToolId.value).toBe('select');
	expect(useSelectionStore(harness.pinia).selectedIds).toEqual(['zone-kitchen']);
});

it('a focusout with no destination (the window lost focus) keeps the menu open', async () => {
	const harness = await mountPlanEditorCanvas();
	await openAdd(harness);
	await settle();

	document.activeElement?.dispatchEvent(new FocusEvent('focusout', { relatedTarget: null, bubbles: true }));
	await settle();

	expect(harness.wrapper.find('[role="menu"]').exists()).toBe(true);
});

it('Escape while the menu is open is the root\'s, and a drafted polygon under the canvas survives it', async () => {
	const harness = await mountPlanEditorCanvas();
	const runtime = runtimeOf(harness);
	runtime.setTool('draw-polygon');
	click(harness.canvasEl, 300, 300); // one vertex placed
	await settle();
	expect(runtime.renderState.polygonSketch?.vertices).toHaveLength(1);
	await openAdd(harness);
	await settle();

	// Delivered to the CANVAS element, not the menu: without root ownership this is exactly the
	// keystroke `EditorSurface.onKeyDown` routes through `routeEscape`, which would cancel the draft.
	harness.canvasEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
	await settle();

	expect(harness.wrapper.find('[role="menu"]').exists()).toBe(false);
	expect(runtime.activeToolId.value).toBe('draw-polygon');
	expect(runtime.renderState.polygonSketch?.vertices).toHaveLength(1);
});
```

In the standalone `describe`, add:

```ts
it('emits close before it calls the entry, and exactly once, even when the entry throws', async () => {
	const order: string[] = [];
	const setTool = vi.fn<(id: ToolId | null) => void>(() => {
		order.push('setTool');
		throw new Error('activation faulted');
	});
	const runtime = { setTool } as unknown as EditorRuntime;
	const wrapper = mount(AddMenu, {
		props: { anchor: null },
		attrs: { onClose: () => order.push('close') },
		attachTo: document.body,
		global: {
			provide: { [EDITOR_RUNTIME as symbol]: runtime },
			config: { errorHandler: () => undefined }, // the throw is the fixture, not the finding
		},
	});
	await nextTick();

	wrapper.find('.rp-add-menu').element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
	await nextTick();

	expect(order).toEqual(['close', 'setTool']);
	expect(wrapper.emitted('close')).toHaveLength(1);
	wrapper.unmount();
});
```

Rewrite the two existing pointer cases ('a press inside the menu does not close it…' and 'pressing Select while the Add menu is open…') to use `press(...)` instead of a bare `pointerdown` plus `trigger('click')`. Change the first case's title to drop "and closes on Escape" if you move the Escape assertion into the root case; keep the Escape-with-selection case, dispatching Escape on the menu element still works because the root's capture listener sees it first.

In `creationCatalogue.test.ts` (lines ~24-29), after `toHaveBeenCalledWith('draw-polygon')` add `expect(setTool).toHaveBeenCalledTimes(1);`.

In `responsiveShell.test.ts` add:

```ts
it('an open Add menu does not survive the canvas being unmounted below the floor width', async () => {
	const harness = await mountPlanEditorCanvas();
	open = harness;
	await harness.wrapper.find('button[data-rp-action="add"]').trigger('click');
	await settle();
	expect(harness.wrapper.find('[role="menu"]').exists()).toBe(true);

	resizeTo(harness.rootEl, 320, 800);
	await settle();
	resizeTo(harness.rootEl, 1280, 800);
	await settle();

	expect(harness.wrapper.find('[role="menu"]').exists()).toBe(false);
	const add = harness.wrapper.find('button[data-rp-action="add"]');
	expect(add.attributes('aria-expanded')).toBe('false');

	await add.trigger('click');
	await settle();
	expect(harness.wrapper.find('[role="menu"]').exists()).toBe(true);
	// The anchor is the NEW button — Escape returns focus to an element still in the document.
	harness.wrapper.find('.rp-add-menu').element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
	await settle();
	expect(document.activeElement).toBe(add.element);
	expect(document.activeElement?.isConnected).toBe(true);
});
```

- [ ] **Step 2: Run and watch red.** `npx vitest run tests/presentation/editor/add tests/presentation/editor/shell/responsiveShell.test.ts` — expected: the order test fails at `expect(order).toEqual(['close','setTool'])` (order is `['setTool']` today since the throw skips the emit); the wheel test fails at `defaultPrevented`; the boundary test fails at `releases` (and `presses` stays `[]`, which proves the two halves are independent); the focusout test fails at `menu exists`; the root-Escape test fails at `vertices` (draft cancelled); the unmount test fails at the first `menu exists` after resize; the count test is GREEN today (pin — say so) and is mutation-checked in Step 5.

- [ ] **Step 3: Implement.** `AddMenu.vue`:
  - `activate`: `emit('close'); entry.activate(runtime);` (swap the two lines; update the one-line docblock: "Close first, then activate — §7.2's order, so a faulting activation never leaves the menu as the top surface").
  - `onKeydown`: delete the `if (event.key === 'Escape') { emit('close'); return; }` branch; the header's sentence "so Escape closes this menu and is never seen by `EditorSurface.onKeyDown`" becomes "Escape is the ROOT's (`PlanEditorRoot.onRootKeydown`, capture phase, §6.3): it closes this menu before any element below the root hears the key; `.stop` here keeps the arrow and Enter keys out of the canvas".
  - Add `onFocusOut(event: FocusEvent)`: `const next = event.relatedTarget; if (!(next instanceof Node)) return; if ((menuRoot.value as HTMLElement).contains(next) || props.anchor?.contains(next) === true) return; emit('close');` with a docblock: a `null` destination is the window losing focus (Alt+Tab), which must not close the menu — the same reasoning `PanOverride` records for a held key; the anchor is excluded so a press on Add toggles rather than close-then-reopen. Bind `@focusout="onFocusOut"` on `.rp-add-menu`.
  - `PlanEditorRoot.vue`: add `function onRootKeydown(event: KeyboardEvent): void { if (!addMenuOpen.value || event.key !== 'Escape') return; event.stopPropagation(); event.preventDefault(); addMenuOpen.value = false; }` and `function retireAddMenu(): void { addMenuOpen.value = false; addButton.value = null; }`; bind `@keydown.capture="onRootKeydown"` on the root `<div ref="root" class="renovation-plan-editor">` and `@vue:unmounted="retireAddMenu"` on `<PlanCanvas>`. If `eslint-plugin-vue` refuses `@vue:unmounted`, use `watch(() => status.value === 'ready' && useWorkspaceStore().layoutMode !== 'unsupported', (mounted) => { if (!mounted) retireAddMenu(); })` instead and say which one shipped.
  - `EditorSurface.vue`: add `@wheel.stop` to the `.rp-plan-overlay` div beside its three pointer stops; extend that div's comment with one sentence: "`wheel` too (2026-09-04): the Add menu is scrollable, and a wheel over its overflow used to pan or zoom the plan."

- [ ] **Step 4: Run green.** Same command as Step 2, then `npx vitest run tests/presentation/editor tests/harness/accessibility.test.ts`.

- [ ] **Step 5: Mutation-checks** (each: apply, run the file, observe red at the named assertion, revert; record all four in the report):
  - remove `@pointerup.stop` only → boundary test red at `releases`, `presses` still `[]`;
  - remove `@wheel.stop` → wheel test red;
  - in `activateFocused` call `activate(entry)` twice → count test red at `toHaveBeenCalledTimes(1)`;
  - delete `onRootKeydown`'s body → root-Escape test red at `vertices`.

- [ ] **Step 6: Documents.** PBI `Start one creation task from Add`: criterion 4 evidence → 'Enter on Room starts exactly one tool and emits exactly one close' plus the catalogue count; criterion 5 → the root-Escape case and the focus-boundary case; add "criterion 3's close half no longer depends on where focus rests (2026-09-04)". Task `Run one temporary creation task from Add`: criterion 1 evidence → the counting case. Remove the six notes' wikilinks from the PBI's trailing list. Close notes 6, 7, 10, 11, 12, 21 (frontmatter + `## What closed it` naming each holding test).

- [ ] **Step 7: `npm run check`; commit.**

```bash
git add src/presentation/editor/add/AddMenu.vue src/presentation/editor/PlanEditorRoot.vue src/presentation/editor/surface/EditorSurface.vue tests/presentation/editor/add/addMenu.test.ts tests/presentation/editor/add/creationCatalogue.test.ts tests/presentation/editor/shell/responsiveShell.test.ts "docs/requirements/Start one creation task from Add.md" "docs/tasks/Run one temporary creation task from Add.md" "docs/issues/An Add choice activates before the menu closes.md" "docs/issues/Escape closes Add only while focus remains inside the menu.md" "docs/issues/The Add menu sends wheel gestures to the canvas.md" "docs/issues/The Add menu survives the canvas that anchored it.md" "docs/issues/The Add-menu pointer tests omit pointerup.md" "docs/issues/The exact-once Add test never counts activations.md"
git commit -m "fix(add-menu): close before activate, root-owned Escape, focus boundary, wheel and unmount retirement — with tests that count"
```

---

### Task 2: the banner's Cancel leaves the task

**Files:**
- Modify: `src/presentation/editor/runtime.ts` (`createCancelActiveTask`)
- Test: `tests/presentation/editor/shell/temporaryToolBanner.test.ts`
- Close: note 1. Amend `docs/requirements/Start one creation task from Add.md` (criterion 7 cancel half) and `docs/tasks/Run one temporary creation task from Add.md` (criterion 3 evidence and the "same routine" sentence); `docs/tasks/Show an active creation-task banner with complete controls.md` criterion 5 sentence.

**Interfaces:** Consumes `ToolManager.cancelGesture()`, `setTool`. Produces `EditorRuntime.cancelActiveTask` with the new meaning (unchanged signature).

Acceptance (note 1): "Make the banner's explicit Cancel path clear any draft and then return to Select, without changing Escape's separately specified precedence unless that contract is deliberately revised. Change the drafted-room banner test to require `activeToolId === 'select'`, a null sketch and an absent banner. Amend the PBI and [[Run one temporary creation task from Add]] closing evidence so they no longer cite the current keep-active assertion."

- [ ] **Step 1: Rewrite the test** (second case in `temporaryToolBanner.test.ts`):

```ts
it('Cancel returns to Select whether or not a draft exists, and a drafted room is discarded with it', async () => {
	const harness = await mountPlanEditorCanvas();
	const runtime = runtimeOf(harness);
	runtime.setTool('draw-polygon');
	await settle();
	await harness.wrapper.find('.rp-task-banner button').trigger('click');
	expect(runtime.activeToolId.value).toBe('select');
	expect(harness.wrapper.find('.rp-task-banner').exists()).toBe(false);

	runtime.setTool('draw-polygon');
	click(harness.canvasEl, 100, 100); // one vertex placed
	await settle();
	expect(runtime.renderState.polygonSketch).not.toBeNull();
	await harness.wrapper.find('.rp-task-banner button').trigger('click');
	await settle();

	// Cancel LEAVES the task (PBI criterion 7, main flow step 6); Escape is the key that steps
	// back one interaction at a time. The two are different questions since 2026-09-04 (R7).
	expect(runtime.activeToolId.value).toBe('select');
	expect(runtime.renderState.polygonSketch).toBeNull();
	expect(harness.wrapper.find('.rp-task-banner').exists()).toBe(false);
});

it('Cancel under Select is a no-op: nothing to leave, and the selection is untouched', async () => {
	const harness = await mountPlanEditorCanvas();
	const runtime = runtimeOf(harness);
	useSelectionStore(harness.pinia).select(['zone-kitchen' as never]);
	runtime.cancelActiveTask();
	expect(runtime.activeToolId.value).toBe('select');
	expect(useSelectionStore(harness.pinia).selectedIds).toEqual(['zone-kitchen']);
});
```

- [ ] **Step 2: Watch red.** `npx vitest run tests/presentation/editor/shell/temporaryToolBanner.test.ts` — expected FAIL at `expect(runtime.activeToolId.value).toBe('select')` after the drafted Cancel (reads `'draw-polygon'`).

- [ ] **Step 3: Implement.** Replace `createCancelActiveTask`:

```ts
/**
 * Task 18's Cancel button. NOT `routeEscape` (R7, 2026-09-04): Escape steps back through the
 * nearest interaction — a draft first, then the tool, then the selection — while Cancel means
 * LEAVE THIS TASK, which is what the PBI's criterion 7 and its main flow step 6 say a
 * cancellation does. So it discards whatever the tool holds and returns to Select in one gesture,
 * and it never touches the selection, which no cancellation of a creation task is about.
 * Under Select (or with no tool) there is no task to leave, and it does nothing.
 */
function createCancelActiveTask(
	toolManager: ToolManager,
	activeToolId: Ref<ToolId | null>,
	setTool: (id: ToolId | null) => void,
): () => void {
	return (): void => {
		const tool = activeToolId.value;
		if (tool === null || tool === 'select') return;
		toolManager.cancelGesture();
		setTool('select');
	};
}
```

Update the call site (`createCancelActiveTask(toolManager, activeToolId, setTool)`); the `selection` argument goes. Check `max-lines` on `runtime.ts` (it is near the cap; the shorter function helps).

- [ ] **Step 4: Run green**, then `npx vitest run tests/presentation/editor`.

- [ ] **Step 5: Documents.** `Run one temporary creation task from Add.md`: criterion 3 evidence → 'Cancel returns to Select whether or not a draft exists, and a drafted room is discarded with it'; replace "the banner's Cancel and Escape are the same routine, not two" with "the banner's Cancel LEAVES the task and Escape steps back one interaction — two questions, ruled apart on 2026-09-04 (R7)". PBI `Start one creation task from Add`: criterion 7's cancel half cites the new case. `Show an active creation-task banner…` criterion 5 sentence: "Cancel retires the banner by returning to Select, discarding any draft". Close note 1.

- [ ] **Step 6: `npm run check`; commit** (`fix(banner): Cancel leaves the creation task — clear the draft and return to Select`).

---

### Task 3: hover kind and hover retirement — `opus`

**Files:**
- Modify: `src/presentation/editor/tools/render-state.ts` (`hoveredTargetKind`), `src/presentation/editor/tools/select-tool.ts` (three write sites), `src/presentation/editor/runtime.ts` (`registerSelectionRetirement` gains `renderState`), `src/presentation/editor/surface/EditorSurface.vue` (`cursorClass`), `styles/editor-cursors.css` (`.rp-plan-canvas-grab`)
- Test: `tests/presentation/editor/runtime.test.ts`, `tests/presentation/editor/canvasNavigation.test.ts`, `tests/presentation/editor/tools/selectTool.test.ts`
- Close: notes 2, 3. Amend `docs/requirements/Selection.md` ("The cursor does not distinguish a body from a handle" → met), `docs/tasks/Compose predictive and contextual Select surfaces.md` (criterion 2 evidence).

**Interfaces:**
- Produces: `RenderState.hoveredTargetKind: 'body' | 'handle' | null` (reset with the id); cursor classes `rp-plan-canvas-target` (body) and `rp-plan-canvas-grab` (handle).

Acceptance: (2) "Retire `renderState.hoveredObjectId` in the same successful-hydrate watcher when the ID is absent from the new zone map. Extend the retirement test by seeding both a selected and hovered ID, hydrating without that zone, and asserting both the hover ID and target cursor class are gone; keep the surviving-ID direction beside it." (3) "Preserve the resolver's target kind in transient render state and map body to pointer, handle to grab, and null to the resting cursor. Add one cursor test that hovers the selected room near a vertex and expects grab, then moves into its body and expects pointer; mutating either branch to the shared class must fail it."

- [ ] **Step 1: Tests first.** In `canvasNavigation.test.ts`, beside 'promises what a Select click would take…' (the `editor()` rig; zone-a's screen footprint is (198,198)-(488,388) at the default camera — verify by reading that file's comment):

```ts
it('says grab over a vertex handle of the selected room and pointer over its body', async () => {
	const { harness, canvas } = await editor();
	actionButton(harness, 'Select').click();
	await settle();
	click(canvas, 300, 300); // select zone-a
	await settle();

	pointer(canvas, 'pointermove', 199, 199); // within the grab radius of the (198,198) vertex
	await settle();
	expect(cursorClasses(canvas)).toEqual(['rp-plan-canvas-grab']);

	pointer(canvas, 'pointermove', 300, 300);
	await settle();
	expect(cursorClasses(canvas)).toEqual(['rp-plan-canvas-target']);

	pointer(canvas, 'pointermove', 900, 900);
	await settle();
	expect(cursorClasses(canvas)).toEqual([]);
	harness.unmount();
});
```

In `runtime.test.ts`, replace the retirement case:

```ts
it('a selected AND hovered zone that disappears from the next hydrate is retired from both, and the cursor stops promising it', async () => {
	const harness = await mountPlanEditorCanvas();
	const runtime = runtimeOf(harness);
	const projectStore = useProjectStore();
	useSelectionStore().select(['zone-kitchen' as never]);
	runtime.renderState.hoveredObjectId = 'zone-kitchen';
	runtime.renderState.hoveredTargetKind = 'body';
	await settle();
	expect(harness.canvasEl.classList.contains('rp-plan-canvas-target')).toBe(true);

	await projectStore.hydrate(fakeQueries(FIXTURE_PLAN, [FIXTURE_ZONES[1]]), FIXTURE_PLAN.id);
	await settle();

	expect(useSelectionStore().selectedIds).toEqual([]);
	expect(runtime.renderState.hoveredObjectId).toBeNull();
	expect(runtime.renderState.hoveredTargetKind).toBeNull();
	expect(harness.canvasEl.classList.contains('rp-plan-canvas-target')).toBe(false);
	harness.unmount();
});
```

Keep 'keeps a selected id that survives the next hydrate untouched' and add to it: seed `hoveredObjectId = 'zone-kitchen'` and assert it survives too.

In `selectTool.test.ts`, extend 'deactivate clears a predicted hover too' and 'starting a gesture clears the predicted hover' to also assert `hoveredTargetKind` is `'body'` while hovering and `null` after.

- [ ] **Step 2: Watch red** (`hoveredTargetKind` does not exist — TypeScript in vitest transpiles, so the red is at the assertions: the cursor test fails at `['rp-plan-canvas-grab']` (reads `target`), the retirement test at `hoveredObjectId toBeNull`).

- [ ] **Step 3: Implement.**
  - `render-state.ts`: `hoveredTargetKind: 'body' | 'handle' | null = null;` with a docblock (R8: a second field so the id's readers move nothing; both written together at every site); reset it in `reset()`.
  - `select-tool.ts`: everywhere `hoveredObjectId = null` also `hoveredTargetKind = null` (lines ~127, 135, 149); in `pointerMove`'s hover arm: `context.renderState.hoveredObjectId = target === null ? null : target.id; context.renderState.hoveredTargetKind = target === null ? null : target.kind;`.
  - `runtime.ts`: `registerSelectionRetirement(projectStore, selection, renderState)`; in the watcher, after the selection survivors: `if (renderState.hoveredObjectId !== null && !zones.has(renderState.hoveredObjectId)) { renderState.hoveredObjectId = null; renderState.hoveredTargetKind = null; }`. Docblock: §6.5's retirement covers the hover too — the two predictive channels (outline and cursor) must not disagree after a delete.
  - `EditorSurface.vue` `cursorClass`: replace the `rp-plan-canvas-target` branch with `if (activeToolId.value === 'select' && renderState.hoveredObjectId !== null) { return renderState.hoveredTargetKind === 'handle' ? 'rp-plan-canvas-grab' : 'rp-plan-canvas-target'; }`.
  - `styles/editor-cursors.css`: add `.rp-plan-canvas-grab { cursor: grab; }` beside `.rp-plan-canvas-target`, with the same explanatory shape.

- [ ] **Step 4: Run green** (`npx vitest run tests/presentation/editor`), then **mutation-check**: change the handle branch to return `'rp-plan-canvas-target'` → cursor test red; delete the hover retirement lines → retirement test red at `hoveredObjectId`. Revert both.

- [ ] **Step 5: Documents.** Selection PBI: delete the "The cursor does not distinguish a body from a handle" Remains bullet and add to Met: "the cursor says grab over a handle and pointer over a body (`canvasNavigation.test.ts`, 2026-09-04); a hovered id the vault no longer holds is retired with the selection (`runtime.test.ts`)". Task `Compose predictive…`: criterion 2 evidence → the new cursor case; delete the "ONE class … answers for both" sentence. Close notes 2, 3.

- [ ] **Step 6: `npm run check`; commit** (`fix(select): the cursor tells a handle from a body, and a deleted hover target is retired with the selection`).

---

### Task 4: hydration truths — the scale sentence and the stale flag

**Files:**
- Modify: `src/presentation/editor/shell/StatusBar.vue`, `src/presentation/stores/ProjectStore.ts`
- Test: `tests/presentation/editor/shell/statusBar.test.ts`, `tests/presentation/stores/stores.test.ts`
- Close: notes 4, 32. Amend `docs/tasks/Build full and compact editor status bars.md` (criterion 5 evidence) and the `Open a floor plan…` PBI's trailing note list.

Acceptance: (32) "Make scale presentation depend on hydration status as well as calibration. Withhold the scale sentence, or render an explicitly unknown/unavailable state, unless the project store is ready with a plan. Do not relabel null as uncalibrated. Add status-bar cases for a never-settling load, `ok(null)`, and a failed read. Each must prove that the uncalibrated sentence is absent while the existing loaded uncalibrated fixture still shows it." (4) "Include `stale` in `HydrationMissingRefs` and set it to false in `markMissing`… Add one store test that hydrates successfully, fails a keep-previous refresh to establish `stale === true`, then returns `ok(null)` from either the plan or project read and asserts `status === 'missing'`, `plan === null`, and `stale === false`."

- [ ] **Step 1: Tests.** `statusBar.test.ts` (imports `mountPlanEditor`, `fakeQueries`, `FIXTURE_ZONES`, `err`, `ok` from `src/core/result/Result`):

```ts
describe('the scale sentence is a fact about a LOADED plan', () => {
	it('is withheld while the read has not settled', async () => {
		const harness = await mountPlanEditor({
			queries: { ...fakeQueries(FIXTURE_PLAN, FIXTURE_ZONES), getPlan: () => new Promise(() => undefined) },
		});
		expect(harness.wrapper.find('.rp-editor-scale').exists()).toBe(false);
		harness.unmount();
	});
	it('is withheld for a plan that does not resolve', async () => {
		const harness = await mountPlanEditor({ plan: null });
		expect(harness.wrapper.find('.rp-editor-scale').exists()).toBe(false);
		harness.unmount();
	});
	it('is withheld after a failed read', async () => {
		const harness = await mountPlanEditor({
			queries: {
				...fakeQueries(FIXTURE_PLAN, FIXTURE_ZONES),
				getPlan: () => Promise.resolve(err({ category: 'Persistence', code: 'plan.read-failed', message: 'boom' } as const)),
			},
		});
		expect(harness.wrapper.find('.rp-editor-scale').exists()).toBe(false);
		harness.unmount();
	});
});
```

(Verify `mountPlanEditor` does not await the query itself — it `settle()`s; read `tests/helpers/editor.ts:260-356`. If a never-settling promise hangs the mount, drive `ProjectStore.status = 'loading'` directly after mounting a ready editor instead and say so.) The existing 'says the scale is not set for an uncalibrated plan' stays as the contrast.

`stores.test.ts`, after 'a failed project re-read keeps the previous contents too':

```ts
it('a plan that goes missing after a stale re-read blanks the stale flag with the content', async () => {
	const store = useProjectStore();
	await store.hydrate(fakeQueries(FIXTURE_PLAN, FIXTURE_ZONES), FIXTURE_PLAN.id);
	await store.hydrate(
		{ ...fakeQueries(FIXTURE_PLAN, FIXTURE_ZONES), getProject: () => Promise.resolve(err(READ_FAILED)) },
		FIXTURE_PLAN.id,
		{ keepPreviousOnFailure: true },
	);
	expect(store.stale).toBe(true);

	await store.hydrate(fakeQueries(null, []), FIXTURE_PLAN.id);

	expect(store.status).toBe('missing');
	expect(store.plan).toBeNull();
	expect(store.stale).toBe(false);
});
```

- [ ] **Step 2: Watch red** at `.rp-editor-scale exists → false` (three cases) and `stale toBe(false)`.

- [ ] **Step 3: Implement.** `StatusBar.vue`: `const { plan, status } = storeToRefs(useProjectStore());` and

```ts
/**
 * Task 20's scale state, WITHHELD unless a plan is loaded (R9, 2026-09-04). "Not set" is a fact
 * about a loaded plan; while the read is in flight the system does not know, and after a
 * missing or failed read there is no plan whose scale could be reported — so `null` here means
 * the span is not drawn, never that `null` was relabelled "uncalibrated".
 */
const scaleText = computed(() => {
	const loaded = status.value === 'ready' ? plan.value : null;
	if (loaded === null) return null;
	return tr(loaded.calibration ? 'editor.status.scale.calibrated' : 'editor.status.scale.uncalibrated');
});
```

Template: `<span v-if="scaleText !== null" class="rp-editor-scale">{{ scaleText }}</span>`. `ProjectStore.ts`: add `readonly stale: Ref<boolean>` to `HydrationMissingRefs`, `refs.stale.value = false;` in `markMissing`, and pass `stale` in `missingRefs`; extend `markMissing`'s docblock: "and `stale`, because a flag saying the content on screen is out of date is false once there is no content on screen."

- [ ] **Step 4: Run green**; check the constrained status-bar case still finds `.rp-editor-scale` (it mounts a ready plan).

- [ ] **Step 5: Documents.** `Build full and compact editor status bars.md`: criterion 5 evidence gains "the scale sentence is withheld while loading, missing or failed (`statusBar.test.ts`, 2026-09-04)". Close notes 4, 32; remove both wikilinks from the `Open a floor plan…` PBI list.

- [ ] **Step 6: `npm run check`; commit** (`fix(editor): the status bar withholds the scale until a plan is loaded, and a missing plan clears the stale flag`).

---

### Task 5: warnings carry a severity, and the live region is the container

**Files:**
- Modify: `src/presentation/editor/shell/warnings.ts`, `src/presentation/editor/shell/PersistentWarningStrip.vue`, the `styles/` partial declaring `.rp-warning-strip` (find with `grep -rn "rp-warning-strip" styles/`), `src/presentation/i18n/locales/en/editor.ts`, `de/editor.ts`
- Test: `tests/presentation/editor/shell/warnings.test.ts`, `tests/presentation/editor/shell.test.ts`
- Close: notes 37, 38. Amend `docs/tasks/Render independent simultaneous persistent warnings.md` (criterion 3: severity met; heading/busy/actions still open — say so) and the PBI list.

**Interfaces:** Produces `WarningSeverity = 'warning' | 'error'`, `EditorWarning.severity` (required), `data-rp-severity` on each item, keys `editor.warning.severity.warning` / `.error`.

Acceptance: (38) "Define the smallest closed warning presentation model that carries the task's real states… Add a component test with two simultaneous warnings of different severities and actions. Assert each warning keeps its own heading, semantic severity marker, busy/disabled state, and callable action when the other updates. A fixture containing only ids and messages must no longer type-check." — SCOPED by R5 to severity (heading/busy/actions have no producer; recorded as open in the task amendment and in the note's `## What closed it`). (37) "for the current model, exactly one unconditional `.rp-warning-strip[role="status"]` and zero item status roles, before and after two warnings arrive independently."

- [ ] **Step 1: Tests.** `warnings.test.ts`:

```ts
it('carries a severity on every warning: out-of-date content is a warning, a refused read is an error', () => {
	const warnings = editorWarnings({ stale: true, unreadableZones: 2, backgroundStatus: 'unreadable' });
	expect(warnings.map((w) => [w.id, w.severity])).toStrictEqual([
		['stale', 'warning'],
		['unreadable-zones', 'error'],
		['background-unreadable', 'error'],
	]);
	expect(editorWarnings({ stale: false, unreadableZones: 0, backgroundStatus: 'missing' })[0]?.severity).toBe('warning');
});

it('refuses a warning with no severity at compile time', () => {
	// @ts-expect-error — `severity` is required (R5); a fixture of ids and messages alone no longer type-checks.
	const bare: EditorWarning = { id: 'stale', messageKey: 'editor.refresh-failed' };
	expect(bare.id).toBe('stale');
});
```

`shell.test.ts`, in 'the persistent warning strip':

```ts
it('keeps each warning\'s own severity mark and word when the other one clears', async () => {
	const harness = await mountCanvas({ unreadableZones: 1 });
	const store = useProjectStore(harness.pinia);
	store.stale = true;
	await settle();

	const marks = () => harness.wrapper.findAll('.rp-warning-strip__item').map((item) => [
		item.attributes('data-rp-warning'), item.attributes('data-rp-severity'), item.find('.rp-warning-strip__severity').text(),
	]);
	expect(marks()).toStrictEqual([
		['stale', 'warning', t('en', 'editor.warning.severity.warning')],
		['unreadable-zones', 'error', t('en', 'editor.warning.severity.error')],
	]);

	store.stale = false;
	await settle();
	expect(marks()).toStrictEqual([['unreadable-zones', 'error', t('en', 'editor.warning.severity.error')]]);
});

it('is ONE unconditional live region, and no item is one — before and after two warnings arrive', async () => {
	const harness = await mountCanvas();
	const regions = () => harness.wrapper.findAll('[role="status"]').filter((el) => el.classes().includes('rp-warning-strip'));
	const itemRoles = () => harness.wrapper.findAll('.rp-warning-strip__item [role], .rp-warning-strip__item[role]');
	expect(regions()).toHaveLength(1);
	expect(itemRoles()).toHaveLength(0);

	const store = useProjectStore(harness.pinia);
	store.stale = true;
	store.unreadableZones = 2;
	await settle();

	expect(harness.wrapper.findAll('.rp-warning-strip__item')).toHaveLength(2);
	expect(regions()).toHaveLength(1);
	expect(itemRoles()).toHaveLength(0);
});
```

(If `unreadableZones` is not writable from a test, mount with `{ unreadableZones: 2 }` and flip `stale` only.)

- [ ] **Step 2: Watch red** (`severity` undefined; `.rp-warning-strip__severity` absent). The live-region case is a PIN (green today) — say so; its mutation is Step 4.

- [ ] **Step 3: Implement.** `warnings.ts`: `export type WarningSeverity = 'warning' | 'error';` add `readonly severity: WarningSeverity;` to `EditorWarning`; each `push` gains `severity` per R5, with a docblock naming the axis ("`warning`: what is on screen may be incomplete or out of date; `error`: a read refused, so something the user owns is not on screen"). `PersistentWarningStrip.vue`: `const SEVERITY_LABEL: Record<WarningSeverity, StringKey> = { warning: 'editor.warning.severity.warning', error: 'editor.warning.severity.error' };` and

```html
<p v-for="w in warnings" :key="w.id" class="rp-warning-strip__item" :class="`rp-warning-strip__item--${w.severity}`" :data-rp-warning="w.id" :data-rp-severity="w.severity">
	<span class="rp-warning-strip__severity">{{ tr(SEVERITY_LABEL[w.severity]) }}</span>
	{{ tr(w.messageKey, w.params) }}
</p>
```

Header: keep the container-live-region paragraph and add "R4/R5 (2026-09-04): the region stays on the container; every item carries its severity as a mark and a word — `docs/components/Toast.md`'s 'both, always, never one'. Heading, busy state and actions are not in the model: no warning has an action yet, and a field with no producer is a self-declared shape." Locale: `'editor.warning.severity.warning': 'Warning'`, `'editor.warning.severity.error': 'Error'`; German `'Warnung'`, `'Fehler'`. CSS (variables only): `.rp-warning-strip__severity { font-weight: var(--bold-weight); margin-right: var(--size-4-1); } .rp-warning-strip__item--error { border-left: 2px solid var(--text-error); } .rp-warning-strip__item--warning { border-left: 2px solid var(--text-warning); }` (adjust to the partial's existing shape; `tests/build/styles.test.ts` and `prototype-styles` must stay green).

- [ ] **Step 4: Run green; mutation-check** — put `role="status"` on the item `<p>` → the live-region case red at `itemRoles()`; remove `severity` from the `stale` push → build red at `vue-tsc` (report the error text).

- [ ] **Step 5: Documents.** Task `Render independent simultaneous persistent warnings.md`: criterion 3's SEVERITY clause met (`shell.test.ts` 'keeps each warning's own severity mark and word…'); heading, busy, actions still open, with "no warning has an action; the increment that adds a retry supplies the producer" (2026-09-04); criterion 6's announcement clause: one container region, pinned by 'is ONE unconditional live region…'. Close notes 37 and 38 (note 38's `## What closed it` says explicitly: severity closed; heading/busy/actions NOT built, and why).

- [ ] **Step 6: `npm run check`; commit** (`feat(warnings): every persistent warning carries a severity as a mark and a word; the live region stays the container`).

---

### Task 6: the responsive shell — focus after a resize close, an interrupted gesture at unmount, the deleted toggles, and the Tab test — `opus`

**Files:**
- Modify: `src/presentation/editor/shell/ResponsiveEditorShell.vue`, `src/presentation/editor/shell/PropertyLayerPanel.vue` (`tabindex="-1" data-rp-region="layers"`), `src/presentation/editor/shell/EntityInspector.vue` (`tabindex="-1" data-rp-region="inspector"`), `src/presentation/editor/shell/FloorInspector.vue` (docblock line 24 mentions `inspectorPanelOpen`), `src/presentation/stores/WorkspaceStore.ts`, `src/presentation/editor/surface/EditorSurface.vue` (`onBeforeUnmount`)
- Test: `tests/presentation/editor/shell/responsiveShell.test.ts`, `tests/presentation/editor/shell.test.ts` ('collapsing a panel' describe deleted), `tests/presentation/stores/stores.test.ts` ('toggles each panel independently' deleted)
- Close: notes 5, 19, 34, 40. Amend PBIs `Layers` (Remains: resize focus → met), `Inspect a selected room` (same residue line), `Open a floor plan…`; tasks `Keep layer controls usable in constrained leaves` (criterion 3 both halves), `Enforce shared editor component and state boundaries` (criterion 4 evidence names the simplified store).

**Interfaces:**
- Consumes: `resizeTo`, `pointer`, `click`, `runtimeOf(harness).toolManager.gestureInFlight`, `worldToScreen` (`src/presentation/editor/viewport/Viewport.ts`) for a kitchen screen point.
- Produces: `WorkspaceStore` without `layersPanelOpen`/`inspectorPanelOpen`/`toggleLayersPanel`/`toggleInspectorPanel`; `[data-rp-region="layers"|"inspector"]` on the two persistent asides; `EditorSurface` releasing interrupted inputs on unmount.

Acceptance: (5) "Keep the resize decision in the shell long enough to retain which overlay owned focus, then, after the full layout renders, move focus to an explicit surviving target in the corresponding persistent Layers or Inspector region. Add one discriminating case beside `responsiveShell.test.ts:125-143` that focuses each open overlay, resizes to full, and asserts the designated surviving target is `document.activeElement`." (40) "Before unsupported layout destroys `EditorSurface`, abandon only the interrupted press/release gesture and clear its camera ownership while preserving any completed multi-click draft… Add a responsive-shell test that starts a real tool gesture, resizes to 320px, returns to a supported width, and proves both that `gestureInFlight` is false and that the next complete pointer gesture commits normally. A drawing-tool variant must also prove that vertices completed before the interrupted press survive." (34) "delete the two toggle actions, their test-only scenarios, and any booleans that become constant as a result… the compiler and shell render tests should instead prove the simplified store and both full panels still compose." (19, test half) "add a keyboard test that opens each constrained panel, presses Tab through its controls, and proves the selected policy… A no-trap test must demonstrate focus can leave for the canvas."

- [ ] **Step 1: Tests** in `responsiveShell.test.ts`:

```ts
it.each([
	['the layers overlay', 'layers', '.rp-overlay-panel', 'layers'],
	['the inspector drawer', 'details', '.rp-inspector-drawer', 'inspector'],
])('growing back to full while %s is open moves focus to the persistent region it stood in for', async (_n, rail, panel, region) => {
	const harness = await mountPlanEditorCanvas();
	open = harness;
	resizeTo(harness.rootEl, 460, 800);
	await settle();
	await harness.wrapper.find(`button[data-rp-rail="${rail}"]`).trigger('click');
	await settle();
	expect(harness.wrapper.find(panel).element.contains(document.activeElement)).toBe(true);

	resizeTo(harness.rootEl, 1280, 800);
	await settle();

	expect(harness.wrapper.find(panel).exists()).toBe(false);
	expect(document.activeElement).toBe(harness.wrapper.find(`[data-rp-region="${region}"]`).element);
	expect(document.activeElement).not.toBe(document.body);
});

it.each([
	['the layers overlay', 'layers', '.rp-overlay-panel'],
	['the inspector drawer', 'details', '.rp-inspector-drawer'],
])('%s does not trap focus: Tab walks out of it onto the canvas (R3)', async (_n, rail, panel) => {
	const harness = await mountPlanEditorCanvas();
	open = harness;
	resizeTo(harness.rootEl, 460, 800);
	await settle();
	await harness.wrapper.find(`button[data-rp-rail="${rail}"]`).trigger('click');
	await settle();
	// jsdom performs no Tab traversal; the ordered list of focusables is what the browser walks.
	const focusables = [...harness.wrapper.element.querySelectorAll<HTMLElement>('button, input, [tabindex="0"]')];
	const inside = focusables.filter((el) => harness.wrapper.find(panel).element.contains(el));
	const last = inside.at(-1) as HTMLElement;
	const after = focusables[focusables.indexOf(last) + 1];
	last.focus();
	after.focus(); // the next Tab stop
	expect(harness.wrapper.find(panel).element.contains(document.activeElement)).toBe(false);
	expect(harness.wrapper.find(panel).exists()).toBe(true); // leaving does not close it
	expect(harness.wrapper.find('.rp-plan-canvas').element.contains(after) || after.closest('.rp-editor-shell') !== null).toBe(true);
});

it('an interrupted Select drag is abandoned when the canvas unmounts below the floor, and the next click selects normally', async () => {
	const harness = await mountPlanEditorCanvas();
	open = harness;
	const runtime = runtimeOf(harness);
	const editor = useEditorStore();
	const inKitchen = worldToScreen({ x: 2000, y: 1500 }, editor.viewport, STAGE_PIXELS); // see EditorSurface for the third argument
	pointer(harness.canvasEl, 'pointerdown', inKitchen.x, inKitchen.y);
	pointer(harness.canvasEl, 'pointermove', inKitchen.x + 40, inKitchen.y + 40);
	expect(runtime.toolManager.gestureInFlight).toBe(true);

	resizeTo(harness.rootEl, 320, 800);
	await settle();
	expect(runtime.toolManager.gestureInFlight).toBe(false);
	resizeTo(harness.rootEl, 1280, 800);
	await settle();

	const canvas = harness.wrapper.find('.rp-plan-canvas').element as HTMLElement;
	useSelectionStore().clear();
	click(canvas, inKitchen.x, inKitchen.y);
	await settle();
	expect(useSelectionStore().selectedIds.map(String)).toEqual(['zone-kitchen']);
});

it('a drawing tool keeps its placed vertices across the unmount; only the interrupted press is abandoned', async () => {
	const harness = await mountPlanEditorCanvas();
	open = harness;
	const runtime = runtimeOf(harness);
	runtime.setTool('draw-polygon');
	click(harness.canvasEl, 600, 600);
	pointer(harness.canvasEl, 'pointerdown', 700, 600); // a press whose release never comes
	expect(runtime.toolManager.gestureInFlight).toBe(true);

	resizeTo(harness.rootEl, 320, 800);
	await settle();
	resizeTo(harness.rootEl, 1280, 800);
	await settle();

	expect(runtime.toolManager.gestureInFlight).toBe(false);
	expect(runtime.activeToolId.value).toBe('draw-polygon');
	expect(runtime.renderState.polygonSketch?.vertices).toHaveLength(1);
});
```

(Look up how `EditorSurface.vue` names the pixel-ratio constant it passes to `screenToWorld` — `STAGE_PIXELS` — and import `worldToScreen` from `src/presentation/editor/viewport/Viewport.ts`; confirm the kitchen's screen point lands inside the 1280×800 stage; the Select drag on the kitchen must exceed `CLICK_EPSILON_PX` so `gestureInFlight` is a real drag.)

- [ ] **Step 2: Watch red** — focus cases at `activeElement toBe(region)` (reads `<body>`); the unmount cases at `gestureInFlight toBe(false)` after the 320 resize. The Tab cases are PINS (green today); mutation in Step 5.

- [ ] **Step 3: Implement.**
  - `WorkspaceStore.ts`: delete `layersPanelOpen`, `inspectorPanelOpen`, `toggleLayersPanel`, `toggleInspectorPanel`, their two `reset()` lines and their four return entries; update the header ("which shell regions are open" → "the layout mode and overlay state (M16)") and `reset()`'s docblock ("Both panels open" → drop).
  - `ResponsiveEditorShell.vue`: the two `v-if="layoutMode === 'full' && layersPanelOpen"` / `inspectorPanelOpen` become `v-if="layoutMode === 'full'"`; drop the two refs from `storeToRefs`. Add:

```ts
/**
 * Which persistent region inherits focus when a GROWTH closes an overlay (R10). Decided BEFORE
 * `setLayoutMode`, which clears `overlay` in the same call, and applied after the next render,
 * when the region exists. `closeOverlay` cannot serve here: the rail button it focuses is removed
 * by this very transition, which is how a keyboard user used to land on `<body>`.
 */
function regionInheritingFocus(next: LayoutMode): 'layers' | 'inspector' | null {
	if (layoutMode.value !== 'constrained' || next !== 'full' || overlay.value === 'none') return null;
	return overlay.value;
}

function measure(): void {
	const next = layoutModeFor((root.value as HTMLElement).clientWidth);
	const region = regionInheritingFocus(next);
	workspace.setLayoutMode(next);
	if (region === null) return;
	void nextTick(() => {
		((root.value as HTMLElement).querySelector(`[data-rp-region="${region}"]`) as HTMLElement).focus();
	});
}
```

  - `PropertyLayerPanel.vue`: `<aside class="rp-editor-layers" tabindex="-1" data-rp-region="layers">`; `EntityInspector.vue`: `<aside class="rp-editor-inspector" tabindex="-1" data-rp-region="inspector">`. Docblock on each: programmatically focusable so a resize that closes the overlay it also draws inside has a surviving target (R10); `-1` keeps it out of the Tab order. Run `tests/harness/accessibility.test.ts` — `tabindex="-1"` on a landmark is fine for axe; if `aria-label` + `tabindex` trips a rule, report it.
  - `FloorInspector.vue` line 24: reword the `inspectorPanelOpen` mention.
  - `EditorSurface.vue`: extract from `onBlur` the four lines `swallowedPointers.clear(); panOverride.cancel(); syncPanPhase(); editor.abandonPan(); toolManager.cancelInterruptedGesture();` into `function releaseInterruptedInputs(): void` (keep `onBlur`'s ordering: re-issue first, then this, then `lastStagePoint = null`), and call it from `onBeforeUnmount` before the observer disconnect, followed by `editor.setPointer(null)` (the canvas is gone, so a coordinate readout would be a claim about a pointer over nothing). Docblock: the surface can be unmounted mid-gesture — `unsupported` width — and the leaf-scoped `ToolManager` would otherwise keep `gestureInFlight` true into the remount; the same door as focus loss, so `abandonGesture` and not `cancel`, and a multi-click draft survives.
  - Delete `describe('collapsing a panel')` in `shell.test.ts` and 'toggles each panel independently' in `stores.test.ts`; grep `tests/` for any other reader (`grep -rn "layersPanelOpen\|inspectorPanelOpen\|togglePanel" tests src`).

- [ ] **Step 4: Run green** (`npx vitest run tests/presentation/editor tests/presentation/stores tests/harness`), then `npm run analyze` for fallow (the store lost members; nothing new should be reported).

- [ ] **Step 5: Mutation-checks**: call `closeOverlay(region)` instead of focusing the region → focus case red (activeElement is body, rail gone); remove `releaseInterruptedInputs()` from `onBeforeUnmount` → both gesture cases red; put a `keydown` Tab trap on `OverlayPanel` (refocus its first control on Tab from the last) — the Tab case cannot see a keydown trap since it moves focus directly; instead mutate the test's own expectation to confirm it discriminates: assert `contains(activeElement) === true` and watch it go red. Record.

- [ ] **Step 6: Documents.** `Keep layer controls usable in constrained leaves.md`: criterion 3 met for BOTH closes (the Escape case and 'growing back to full … moves focus to the persistent region'); `Layers` PBI: delete the resize-focus Remains bullet, add to Met; `Inspect a selected room` PBI: delete "The resize-driven drawer close leaves focus on `<body>`"; `Enforce shared editor component and state boundaries.md`: criterion 4 evidence: "`WorkspaceStore` carries `layoutMode` and `overlay` and nothing with no production caller (the two panel toggles were deleted 2026-09-04, spec §5.6)"; `Open a floor plan…` PBI: remove the four notes' wikilinks. Close notes 5, 19, 34, 40 (note 19's `## What closed it` cites R3, the M16/§5.5 amendments from Task 0 and the Tab cases).

- [ ] **Step 7: `npm run check`; commit** (`fix(shell): focus survives a growth that closes an overlay, an unmounted canvas abandons its gesture, and the dead panel toggles are gone`).

---

### Task 7: the unsupported-width sentence — one room, many rooms, or a count it cannot vouch for

**Files:**
- Modify: `src/presentation/editor/shell/UnsupportedWidthNotice.vue`, `src/presentation/i18n/locales/en/editor.ts`, `de/editor.ts`
- Test: `tests/presentation/editor/shell/responsiveShell.test.ts`
- Close: notes 35, 36. Amend `docs/tasks/Keep the editor truthful across failure and narrow layouts.md` (the "1 rooms" sentence), PBIs `Open a floor plan…` (Remains bullet) and `View rooms in the Standard Plan View` (note list); check `docs/tests/cases/Open a floor and select a room.md` step 10 still quotes a sentence the `.other` key produces.

**Interfaces:** keys `editor.unsupported-width.body.one` (`{floor}`), `.other` (`{floor}`, `{rooms}`), `.partial` (`{floor}`); the old `editor.unsupported-width.body` is deleted.

Acceptance: (35) "Add singular and plural locale keys and choose between them from the room count at the caller… Replace the current substring assertion with exact user-visible body assertions for one and two rooms in both locales." (36) "render from `summary.roomCount` and preserve its `partial` state in the sentence, or omit the count when the sentence cannot carry that qualification… extends `responsiveShell.test.ts` with `unreadable > 0` and asserts that the unsupported-width body does not present the readable count as an unqualified complete total."

- [ ] **Step 1: Tests.** Replace the substring assertions in 'below the floor width replaces the canvas…' with `expect(notice.find('.rp-unsupported-width__body').text()).toBe('Ground floor has 1 room. Widen the pane or focus this tab to edit.');` and add:

```ts
it('inflects the room count: two rooms read as rooms, in both locales', async () => {
	const second = { ...FIXTURE_ZONES[0], id: 'zone-pantry', name: 'Pantry' };
	const harness = await mountPlanEditorCanvas({ zones: [FIXTURE_ZONES[0], second] });
	open = harness;
	resizeTo(harness.rootEl, 320, 800);
	await settle();
	expect(harness.wrapper.find('.rp-unsupported-width__body').text()).toBe('Ground floor has 2 rooms. Widen the pane or focus this tab to edit.');
	expect(t('de', 'editor.unsupported-width.body.one', { floor: 'Erdgeschoss' })).toBe('Erdgeschoss hat 1 Raum. Vergrößern Sie den Bereich oder fokussieren Sie diesen Tab, um zu bearbeiten.');
	expect(t('de', 'editor.unsupported-width.body.other', { floor: 'Erdgeschoss', rooms: '2' })).toBe('Erdgeschoss hat 2 Räume. Vergrößern Sie den Bereich oder fokussieren Sie diesen Tab, um zu bearbeiten.');
});

it('does not present a partial room count as complete', async () => {
	const harness = await mountPlanEditorCanvas({ unreadableZones: 2 });
	open = harness;
	resizeTo(harness.rootEl, 320, 800);
	await settle();
	const body = harness.wrapper.find('.rp-unsupported-width__body').text();
	expect(body).toBe(t('en', 'editor.unsupported-width.body.partial', { floor: 'Ground floor' }));
	expect(body).not.toMatch(/has \d+ rooms?\./);
});
```

- [ ] **Step 2: Watch red** (`'Ground floor has 1 rooms. …'` today; the partial case shows the plain count).

- [ ] **Step 3: Implement.** Locale (en): delete `'editor.unsupported-width.body'`; add `'editor.unsupported-width.body.one': '{floor} has 1 room. Widen the pane or focus this tab to edit.'`, `'editor.unsupported-width.body.other': '{floor} has {rooms} rooms. Widen the pane or focus this tab to edit.'`, `'editor.unsupported-width.body.partial': 'Not every record on {floor} could be read, so its room count is unknown. Widen the pane or focus this tab to edit.'`; German: `'{floor} hat 1 Raum. Vergrößern Sie den Bereich oder fokussieren Sie diesen Tab, um zu bearbeiten.'`, `'{floor} hat {rooms} Räume. Vergrößern Sie den Bereich oder fokussieren Sie diesen Tab, um zu bearbeiten.'`, `'Nicht jeder Eintrag auf {floor} konnte gelesen werden, daher ist die Zahl der Räume unbekannt. Vergrößern Sie den Bereich oder fokussieren Sie diesen Tab, um zu bearbeiten.'`. Component:

```ts
/** Three sentences for one count (R12): a partial count is OMITTED rather than presented as complete. */
const body = computed(() => {
	const s = summary.value;
	if (s === null) return null;
	if (s.roomCount.state === 'partial') return tr('editor.unsupported-width.body.partial', { floor: s.floor.name });
	if (s.rooms.length === 1) return tr('editor.unsupported-width.body.one', { floor: s.floor.name });
	return tr('editor.unsupported-width.body.other', { floor: s.floor.name, rooms: String(s.rooms.length) });
});
```

Template: `<p v-if="body !== null" class="rp-unsupported-width__body">{{ body }}</p>`. Rewrite the header paragraph about `rooms.length` vs `roomCount.value`: the STATE is read (partial withholds the count) and the number still comes from `rooms.length` so no `unavailable` arm has to be narrowed past. Confirm `tests/presentation/i18n/strings.test.ts`'s per-key hole test passes (`{floor}` on both sides of every key).

- [ ] **Step 4: Run green**; `grep -rn "unsupported-width.body'" src tests docs` for stragglers.

- [ ] **Step 5: Documents.** Task `Keep the editor truthful…`: delete the "1 rooms" sentence from the closing evidence and add "the body inflects for one room and withholds a partial count (2026-09-04, `responsiveShell.test.ts`)". PBIs: `Open a floor plan…` — delete the "`Ground floor has 1 rooms`" Remains bullet and the two wikilinks; `View rooms…` — remove note 36's wikilink. Manual case step 10: "Ground floor has 3 rooms." is still what `.other` prints — leave, but add "(a one-room floor reads 'has 1 room'; a floor with unreadable records says its count is unknown)". Close notes 35, 36.

- [ ] **Step 6: `npm run check`; commit** (`fix(shell): the unsupported-width sentence inflects one room and withholds a partial count`).

---

### Task 8: the return-to-floor announcement lives at shell level

**Files:**
- Create: `src/presentation/editor/shell/SelectionGuidance.vue`
- Modify: `src/presentation/editor/shell/EntityInspector.vue` (remove the watcher, the ref and the `<p role="status">`), `src/presentation/editor/PlanEditorRoot.vue` (mount `<SelectionGuidance />` in `#warnings` before the strip), `styles/editor-inspector.css` (`.rp-inspector-guidance` → `.rp-selection-guidance`, moved to the partial that lays out the warnings region if that is where it should sit)
- Test: `tests/presentation/editor/shell/floorInspector.test.ts` (the guidance describe moves to `responsiveShell.test.ts` or stays, selector renamed), `tests/presentation/editor/shell/responsiveShell.test.ts`
- Close: note 9. Amend `docs/tasks/Present the truthful floor summary and selection guidance.md` (criteria 5/6 evidence) and the `Selection` PBI list.

Acceptance (9): "Move the transition watcher and its persistent live region to a shell level that remains mounted in every supported layout, leaving `EntityInspector` responsible only for visible Inspector content. Add a constrained-layout test that closes the drawer, changes selection from one ID to none, and observes the guidance once from the still-mounted status region, then proves an unrelated refresh does not announce it again."

- [ ] **Step 1: Test** in `responsiveShell.test.ts`:

```ts
it('announces the return to the floor once even while the constrained drawer is closed, and not again on a refresh', async () => {
	const harness = await mountPlanEditorCanvas();
	open = harness;
	resizeTo(harness.rootEl, 460, 800);
	await settle();
	expect(harness.wrapper.find('.rp-inspector-drawer').exists()).toBe(false); // the Inspector is unmounted here
	useSelectionStore().select(['zone-kitchen' as never]);
	await settle();

	useSelectionStore().clear();
	await nextTick();
	expect(harness.wrapper.find('.rp-selection-guidance[role="status"]').text()).toBe(t('en', 'editor.inspector.floor.guidance'));

	harness.changePlan();
	await settle();
	expect(harness.wrapper.find('.rp-selection-guidance').text()).toBe('');
});
```

Rename the selector in `floorInspector.test.ts`'s guidance case to `.rp-selection-guidance` (it keeps proving the full-layout half).

- [ ] **Step 2: Watch red** (no `.rp-selection-guidance` element).

- [ ] **Step 3: Implement.** `SelectionGuidance.vue` = the watcher and `<p class="rp-selection-guidance" role="status">{{ guidance }}</p>` lifted verbatim from `EntityInspector.vue` (keep its timing docblock; add R15's paragraph: mounted by the root in the warnings region so it exists in every layout — the constrained drawer unmounts the Inspector, and a watcher that is not mounted hears nothing). `EntityInspector.vue` loses the watcher, `guidance`, the `<p>` and the two imports; its header sentence about §6.6 points at `SelectionGuidance.vue`. `PlanEditorRoot.vue`: `<template #warnings><SelectionGuidance /><PersistentWarningStrip :warnings="warnings" /></template>`. CSS: rename the rule; ensure an empty `<p>` collapses (`:empty { display: none }` or `min-height: 0`) so the warnings region gains no blank row — verify by capture in Task 10's run (the `plan-editor-*` shots include this region).

- [ ] **Step 4: Run green**, including `tests/harness/accessibility.test.ts` (one `role="status"` moved; no duplicates).

- [ ] **Step 5: Documents.** `Present the truthful floor summary…`: criteria 5/6 evidence adds the constrained case; `Selection` PBI: remove note 9's wikilink. Close note 9.

- [ ] **Step 6: `npm run check`; commit** (`fix(shell): the return-to-floor announcement is mounted in every layout, not only while the Inspector is`).

---

### Task 9: the instruments — fakes that discriminate, and tests whose bodies match their names

**Files:**
- Modify: `tests/helpers/layout.ts` (a `clientWidthFor` prototype override helper), `tests/helpers/editor.ts` (`EditorHarnessOptions.skipShellSizing`), `tests/helpers/planFixtures.ts` (`fakeQueries.getProject` honours the id), `tests/harness/planEditor.ts` (`harnessDeps().queries.getProject` honours the id), `src/presentation/editor/layers/InteractionLayer.vue` (`name: 'selection-outline'` on the selected `VLine`)
- Test: `tests/presentation/editor/shell/responsiveShell.test.ts`, `tests/presentation/stores/stores.test.ts`, `tests/presentation/editor/shell/roomInspector.test.ts`, `tests/presentation/editor/selection/resolveSelectionTarget.test.ts`, `tests/presentation/read-models/spatialRecords.test.ts`, `tests/presentation/editor/tools/selectTool.test.ts`
- Close: notes 8, 20, 22, 24, 28, 29. Amend: `Inspect a selected room` PBI (criterion 1 evidence → the click-driven case), `Render the selected room Inspector overview` (criterion 1), `Resolve overlapping selection targets deterministically` (criterion 1 wording and evidence), `Selection` PBI (criteria 1, 2, 3 evidence), `Present the truthful floor summary…` (criterion 2 evidence), `Compose predictive…` (criterion 1 evidence), `Unify canvas and list selection by stable ID` (criterion 1).

Acceptance, verbatim: (22) "Add a mount case that establishes a non-zero shell width before mount and verifies the mode before any `resizeTo` callback, or provide a focused fake mode that can drive the mount-time path without also firing the observer." (8) "Make the shared fakes respect the requested project id, and assert the `getProject` argument in the store hydration case so the wrong-field mutation fails." (20) "Drive one real primary click on Kitchen through the mounted canvas, then assert in one case that the resulting `SelectionStore` ID is `zone-kitchen`, a named solid selection outline is present, the matching Room-list row carries that stable ID and reads pressed, and the Room Inspector's `data-rp-id` is the same value. Give the selected line a stable test name such as `selection-outline`." (28) "Align the criterion with the adopted semantic z-order: the same ordered input must be stable, and reversing the order must select the newly topmost body. Replace the duplicate call with that discriminating reverse-order assertion." (29) "`expect(summary.areaCount).toEqual({ state: 'partial', value: 1, unreadable: 2 })`." (24) "In one overlapping-candidate fixture, hover the point, capture the predicted ID, then send a real primary click grammar (`pointerDown` plus `pointerUp`) at the same point and assert the selected ID equals that prediction."

- [ ] **Step 1: Tests.**

`responsiveShell.test.ts`:

```ts
it('derives its first layout from the mounted root\'s real width, before any observer callback', async () => {
	const restore = clientWidthFor((el) => (el.classList.contains('rp-editor-shell') ? 460 : 0));
	try {
		const harness = await mountPlanEditor({ skipShellSizing: true });
		open = harness;
		expect(harness.rootEl.dataset.layout).toBe('constrained');
	} finally {
		restore();
	}
});
```

`tests/helpers/layout.ts`:

```ts
/**
 * Make `clientWidth` answer `width(el)` for every element until `restore()` — the one way to give
 * a component's root a width BEFORE its `onMounted` reads it, since the element does not exist to
 * `resizeTo` until then. jsdom declares the getter on `Element.prototype`; verify with
 * `Object.getOwnPropertyDescriptor`.
 */
export function clientWidthFor(width: (el: Element) => number): () => void {
	const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'clientWidth') as PropertyDescriptor;
	Object.defineProperty(Element.prototype, 'clientWidth', { configurable: true, get(this: Element) { return width(this); } });
	return () => Object.defineProperty(Element.prototype, 'clientWidth', descriptor);
}
```

`tests/helpers/editor.ts`: `readonly skipShellSizing?: boolean` on `EditorHarnessOptions`, honoured where `sizedShellRoot` is called (`rootEl` still found; `resizeTo` skipped). Mutation-check: delete `measure()` from `ResponsiveEditorShell`'s `onMounted` → this case red (`'full'`, the store default); revert.

`stores.test.ts`:

```ts
it('asks for the PLAN\'s project, by the id the plan carries', async () => {
	const store = useProjectStore();
	const getProject = vi.fn(fakeQueries(FIXTURE_PLAN, FIXTURE_ZONES).getProject);
	await store.hydrate({ ...fakeQueries(FIXTURE_PLAN, FIXTURE_ZONES), getProject }, FIXTURE_PLAN.id);
	expect(getProject).toHaveBeenCalledTimes(1);
	expect(getProject).toHaveBeenCalledWith(FIXTURE_PLAN.projectId);
	expect(store.project?.name).toBe('Willow House');
});
```

`planFixtures.ts`: `getProject: (id) => Promise.resolve(ok(id === FIXTURE_PROJECT.id ? FIXTURE_PROJECT : null))`; `tests/harness/planEditor.ts`: `getProject: (id) => Promise.resolve(ok(id === HARNESS_PROJECT.id ? structuredClone(HARNESS_PROJECT) : null))` and rewrite the comment that says the fake ignores the id. Mutation-check: `queries.getProject(planId)` in `ProjectStore.hydrate` → the case red (`missing`, and `toHaveBeenCalledWith` red).

`roomInspector.test.ts` — replace 'heading, canvas selection and Inspector share one id…':

```ts
it('one real click on Kitchen: store, named outline, pressed list row and Inspector all carry zone-kitchen', async () => {
	harness = await mountPlanEditorCanvas();
	const editor = useEditorStore();
	const inKitchen = worldToScreen({ x: 2000, y: 1500 }, editor.viewport, STAGE_PIXELS);
	click(harness.canvasEl, inKitchen.x, inKitchen.y);
	await settle();

	expect(useSelectionStore().selectedIds.map(String)).toEqual(['zone-kitchen']);
	expect(interactionLayer(harness.stage).find('.selection-outline')).toHaveLength(1);
	const pressed = harness.wrapper.findAll('.rp-room-list__row').filter((row) => row.attributes('aria-pressed') === 'true');
	expect(pressed.map((row) => row.attributes('data-rp-id'))).toEqual(['zone-kitchen']);
	const room = harness.wrapper.find('.rp-room-inspector');
	expect(room.attributes('data-rp-id')).toBe('zone-kitchen');
	expect(room.find('h3').text()).toBe('Kitchen');
	expect(room.text()).toContain(t('en', 'editor.zone-type.Room'));
	expect(room.text()).toContain('Ground floor');
});
```

Wait — the room list is inside `FloorInspector`, which is replaced by `RoomInspector` once a room is selected; read `RoomSummaryList.vue` to see whether the list is still mounted with a selection (line 48 `aria-pressed`). If the list is NOT mounted while a room is selected, assert the pressed row via a second mount path (`EntityInspector` shows `RoomInspector` only) — then the pressed-row clause is asserted in `roomSummaryList.test.ts`'s existing 'marks the row matching the current selection pressed' and this case cites it; say which. Add `data-rp-id="record.id"` to the row if absent. `InteractionLayer.vue`: `name: 'selection-outline'` on the selected `VLine` (the hover line already carries `name: 'hover-outline'`). Mutation-checks: bypass the canvas write (comment out `context.selection.select([...])` in `SelectTool.pointerDown`) → red at `selectedIds`; suppress the selected line (`v-if="false"`) → red at `find('.selection-outline')`.

`resolveSelectionTarget.test.ts` — replace the duplicate-order case:

```ts
it('is a function of z-order: the same ordered list answers the same, and reversing it makes the other body topmost', () => {
	const at = { x: 700, y: 700 };
	expect(resolveSelectionTarget({ ...base, worldPoint: at })).toEqual(resolveSelectionTarget({ ...base, worldPoint: at }));
	expect(resolveSelectionTarget({ ...base, candidates: [above, below], worldPoint: at })).toEqual({ kind: 'body', id: 'below' });
});
```

`spatialRecords.test.ts`: add `expect(summary.areaCount).toEqual({ state: 'partial', value: 1, unreadable: 2 });` to 'marks every count partial…'. Mutation-check: make `areaCount` `counted(areas.length, 0)` → red.

`selectTool.test.ts` — rewrite 'a hover with no gesture predicts the same target a click there would take':

```ts
it('a hover with no gesture predicts the same target a click there would take', () => {
	const candidates = [{ id: 'zone-below', points: squarePoints(0, 0) }, { id: 'zone-above', points: squarePoints(50, 50) }];
	const h = harness();
	const tool = build(h, candidates);
	tool.activate(h.context);

	tool.pointerMove(eventAt(120, 120)); // inside both; the topmost body is the prediction
	const predicted = h.context.renderState.hoveredObjectId;
	expect(predicted).toBe('zone-above');

	tool.pointerDown(eventAt(120, 120));
	tool.pointerUp(eventAt(120, 120));
	expect(h.context.selection.selectedIds.map(String)).toEqual([predicted]);

	tool.pointerMove(eventAt(9999, 9999));
	expect(h.context.renderState.hoveredObjectId).toBeNull();
});
```

(Check `squarePoints`' size so (120,120) is inside both squares; adjust.) Mutation-check: make `pointerDown` pick `candidates[0]` for a body hit → red at `selectedIds`.

- [ ] **Step 2: Run each file, watch the red ones red** (mount case: `'full'`; store case: green today — a pin, mutation-checked; identity: red at `.selection-outline` (unnamed today); overlap: red at `'below'`; area count: green today — pin, mutation-checked; hover-click: green today — pin, mutation-checked). Report which were pins.

- [ ] **Step 3: Implement the four small `src`/helper changes** named above; run the six files green, then `npx vitest run tests/presentation tests/harness`.

- [ ] **Step 4: Documents.** Task `Resolve overlapping…`: criterion 1 rewritten to "The same ordered candidate list resolves identically; z-order (bottom first) is the input, and reversing it selects the newly topmost body" with the new case as evidence; `Selection` PBI criterion 2 evidence names it, criterion 1 names the click-driven case, criterion 3 the rewritten hover-click case; `Inspect a selected room` and `Render the selected room Inspector overview` criterion 1 → the click-driven case; `Unify canvas and list selection…` criterion 1 likewise; `Present the truthful floor summary…` criterion 2 evidence: "including `areaCount`"; `Compose predictive…` criterion 1 → the rewritten hover-click case. Remove the six wikilinks. Close notes 8, 20, 22, 24, 28, 29.

- [ ] **Step 5: `npm run check`; commit** (`test(editor): fakes that respect the id and the width, and six cases whose bodies now hold what their names claim`).

---

### Task 10: captures that wait for the state they name, an inventory derived from the source, and a 320 px overflow measurement

**Files:**
- Create: `scripts/captureMeasures.mjs`, `tests/build/captureMeasures.test.ts`
- Modify: `scripts/harness-shot.mjs`, `scripts/captureReadiness.mjs`, `tests/build/captureReadiness.test.ts`, `tests/build/harness-shot.test.ts`
- Close: notes 23, 39, 41. One dated line in `docs/issues/Ten captures land in a folder nothing opens.md` (twenty-one). Amend `docs/tasks/Keep the editor truthful…` (criterion 4's "without horizontal scrolling" half → held by `harness-shot`'s measure, outside `check`) and the `Open a floor plan…` PBI (Remains bullet + links).

Acceptance: (39) "Give the resting shots a readiness selector that appears only after hydration, and make the narrow shot wait for a constrained-layout element or attribute in addition to the ready editor. Extend `tests/build/harness-shot.test.ts` to assert that dark and light name a hydrated floor-state selector and that narrow additionally names `.rp-editor-shell[data-layout="constrained"] .rp-panel-rail`; mutations back to `PLAN_EDITOR_VIEW` must fail those assertions." (23) "Update the inventory assertion and its stated count to include both price-section captures, then keep the list derived from or checked against the actual `SHOTS` set." (41) "Measure the real rendered unsupported shell at 320px… compares the relevant shell's `scrollWidth` with `clientWidth`; a fixed 320px capture may accompany it… The discriminating browser test must fail after adding a child wider than the unsupported container and pass when `scrollWidth <= clientWidth`. Keep the existing 460px capture."

- [ ] **Step 1: Tests.** `tests/build/captureMeasures.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { overflowFinding } from '../../scripts/captureMeasures.mjs';

describe('overflowFinding', () => {
	it('is null when the shell fits its width', () => {
		expect(overflowFinding('plan-editor-unsupported', { scrollWidth: 320, clientWidth: 320 })).toBeNull();
	});
	it('names the shot and both widths when the shell scrolls sideways', () => {
		expect(overflowFinding('plan-editor-unsupported', { scrollWidth: 412, clientWidth: 320 })).toBe(
			'[plan-editor-unsupported] .rp-editor-shell scrolls horizontally: scrollWidth 412 > clientWidth 320',
		);
	});
	it('reports a shell that was not there to measure', () => {
		expect(overflowFinding('plan-editor-unsupported', null)).toBe('[plan-editor-unsupported] no .rp-editor-shell to measure');
	});
});
```

`tests/build/harness-shot.test.ts`: replace 'still defines the eighteen fixed shots…' with

```ts
it('defines exactly the twenty-one fixed shots, derived from the SHOTS source rather than remembered', () => {
	const source = readFileSync(SCRIPT, 'utf8');
	const shotsBlock = source.slice(source.indexOf('const SHOTS = ['), source.indexOf('];', source.indexOf('const SHOTS = [')));
	const named = [...shotsBlock.matchAll(/name: '([a-z-]+)'/g)].map((m) => m[1]);
	expect(named).toEqual([
		'dark', 'light', 'phone', 'project-detail', 'project-detail-prices', 'project-detail-narrow', 'project-detail-prices-narrow',
		'plan-editor-dark', 'plan-editor-light', 'plan-editor-selected', 'plan-editor-add-menu', 'plan-editor-narrow', 'plan-editor-unsupported',
		'asset-designer-dark', 'asset-designer-light', 'asset-designer-narrow',
		'index-dark', 'index-light', 'index-focus', 'index-focus-current', 'index-failure',
	]);
});

it('waits for the hydrated floor state on the resting plan-editor shots, and for the rail as well on the narrow one', () => {
	const source = readFileSync(SCRIPT, 'utf8');
	expect(source).toMatch(/name: 'plan-editor-dark'[^}]*selector: FLOOR_STATE/);
	expect(source).toMatch(/name: 'plan-editor-light'[^}]*selector: FLOOR_STATE/);
	expect(source).toMatch(/name: 'plan-editor-narrow'[^}]*selector: \[PLAN_CANVAS, '\.rp-editor-shell\[data-layout="constrained"\] \.rp-panel-rail'\]/);
	expect(source).toContain("const FLOOR_STATE = '.rp-floor-inspector'");
});

it('measures the unsupported shell for horizontal overflow at 320 px, through the importable overflowFinding', () => {
	const source = readFileSync(SCRIPT, 'utf8');
	expect(source).toMatch(/name: 'plan-editor-unsupported'[^}]*width: 320/);
	expect(source).toMatch(/name: 'plan-editor-unsupported'[^}]*selector: '\.rp-editor-shell\[data-layout="unsupported"\] \.rp-unsupported-width'/);
	expect(source).toMatch(/name: 'plan-editor-unsupported'[^}]*measure: '\.rp-editor-shell'/);
	expect(source).toContain("from './captureMeasures.mjs'");
});
```

Update the existing narrow assertion (`selector: PLAN_EDITOR_VIEW` for `plan-editor-narrow`) to the list. `tests/build/captureReadiness.test.ts`: add 'waits on every selector of a list for a fixed shot' with the fake page recording `waitForSelector` calls (two selectors → two calls, resolves when both do).

- [ ] **Step 2: Watch red** (all new cases red: names, selectors, measure absent; `captureMeasures.mjs` missing).

- [ ] **Step 3: Implement.**
  - `scripts/captureMeasures.mjs`:

```js
/** What the page is asked, serialised into the browser by `page.evaluate` — self-contained. */
export function shellMetrics(selector) {
	const el = document.querySelector(selector);
	return el === null ? null : { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
}

/** Judged in Node, so the rule is unit-testable and the page code stays a plain read. */
export function overflowFinding(name, metrics) {
	if (metrics === null) return `[${name}] no .rp-editor-shell to measure`;
	if (metrics.scrollWidth <= metrics.clientWidth) return null;
	return `[${name}] .rp-editor-shell scrolls horizontally: scrollWidth ${metrics.scrollWidth} > clientWidth ${metrics.clientWidth}`;
}
```

  - `scripts/captureReadiness.mjs` `waitUntilReady`: `if (entry === undefined) { const list = Array.isArray(selector) ? selector : [selector]; await Promise.all(list.map((s) => page.waitForSelector(s, { state: 'attached' }))); return; }`.
  - `scripts/harness-shot.mjs`: `const FLOOR_STATE = '.rp-floor-inspector';` `const PLAN_CANVAS = '.rp-plan-canvas';` dark/light `selector: FLOOR_STATE`; narrow `selector: [PLAN_CANVAS, '.rp-editor-shell[data-layout="constrained"] .rp-panel-rail']`; new shot after narrow:

```js
	// The UNSUPPORTED layout at 320 px — the one width the 460 shot cannot show — and the one
	// capture that MEASURES rather than only draws: M16 refuses a horizontal scrollbar here, and
	// jsdom lays nothing out, so `measure` reads the shell's scrollWidth against its clientWidth
	// in the real browser and fails the run on a sideways scroll (R13, 2026-09-04).
	{
		name: 'plan-editor-unsupported',
		query: '?view=plan-editor&theme=light',
		selector: '.rp-editor-shell[data-layout="unsupported"] .rp-unsupported-width',
		width: 320,
		measure: '.rp-editor-shell',
	},
```

    `captureOne` destructures `measure`; after the screenshot: `if (measure !== undefined) { const finding = overflowFinding(name, await page.evaluate(shellMetrics, measure)); if (finding !== null) errors.push(finding); }`. Update the header comments that say "twelve"/"the ten fixed" to a count-free sentence.
  - Verify `tests/harness/page.ts`/`mountPlanEditorHarness` renders at 320 (the shell's observer reads the real viewport width; `viewportFor(320)`).

- [ ] **Step 4: Run the captures and READ them.** `npm run harness-shot` (set `RP_CHROMIUM_EXECUTABLE=C:\Users\LuisMendez\AppData\Local\ms-playwright\chromium-1234\chrome-win64\chrome.exe` only if the resolver refuses). Expected exit 0, twenty-one PNGs. Read with the Read tool: `harness-shots/plan-editor-unsupported.png` (headline, one-room sentence, Focus this tab, no sideways clipping), `plan-editor-narrow.png` (rail present, canvas drawn), `plan-editor-dark.png` and `-light.png` (floor summary visible, nothing selected; the new empty selection-guidance region adds no blank row — Task 8). Report what each shows in a sentence.

- [ ] **Step 5: Mutation-check the browser measurement.** Temporarily add `<div style="width: 900px">overflow probe</div>` inside `UnsupportedWidthNotice.vue`'s root (lint will complain about the inline style — this is uncommitted), run `npm run harness-shot`, expect exit 1 with `[plan-editor-unsupported] .rp-editor-shell scrolls horizontally: …`; revert; run again, expect 0. Then mutate `plan-editor-dark`'s selector back to `PLAN_EDITOR_VIEW` → `harness-shot.test.ts` red; revert.

- [ ] **Step 6: Documents.** `Keep the editor truthful…`: criterion 4's second half → "held by `npm run harness-shot`'s `plan-editor-unsupported` measure (scrollWidth ≤ clientWidth at 320 px), outside `npm run check` like every capture, and by the 320 px picture read by eye (2026-09-04)"; `Open a floor plan…` PBI: delete the "No measurement of horizontal scrolling below 400px" bullet and note 41's wikilink; `Ten captures…`: append "**2026-09-04:** twenty-one, `plan-editor-unsupported` added; the sheet is still unbuilt." Close notes 23, 39, 41.

- [ ] **Step 7: `npm run check`; commit** (`test(harness-shot): wait for the state each plan-editor shot names, derive the inventory from SHOTS, and measure the 320 px shell for horizontal overflow`).

---

### Task 11: the Asset Designer owns its toolbar words

**Files:**
- Modify: `src/presentation/designer/DesignerToolbar.vue`, `src/presentation/i18n/locales/en/editor.ts`, `de/editor.ts`, `src/presentation/i18n/locales/en.ts` (two comments naming `editor.toolbar.*`), `tests/presentation/designer/designerToolbar.test.ts`, `assetDesignerRoot.test.ts`, `designerTools.test.ts`
- Test: `tests/presentation/i18n/strings.test.ts`
- Close: note 33 (its ruling R6 was recorded in Task 0).

Acceptance (33): "Rename the three borrowed strings to designer-owned keys and narrow the design contract… Add a source/build test that rejects `editor.toolbar.*` references outside historical prose and asserts `DesignerToolbar` uses designer-owned pan, undo, and redo keys. Pair it with the existing toolbar interaction test so renaming copy cannot disconnect the controls."

- [ ] **Step 1: Test** in `strings.test.ts`:

```ts
describe('the Plan Editor toolbar is retired (spec §5.2, R6)', () => {
	it('declares no editor.toolbar.* key in either locale', () => {
		expect(Object.keys(en).filter((key) => key.startsWith('editor.toolbar.'))).toEqual([]);
		expect(Object.keys(de).filter((key) => key.startsWith('editor.toolbar.'))).toEqual([]);
	});
	it('names editor.toolbar. nowhere under src/, and the designer uses its own keys', () => {
		const hits = walk(join(REPO, 'src')).filter((file) => readFileSync(file, 'utf8').includes('editor.toolbar.'));
		expect(hits.map((file) => repoRelative(file))).toEqual([]);
		for (const key of ['designer.toolbar.pan', 'designer.toolbar.undo', 'designer.toolbar.redo']) {
			expect(en[key as StringKey]).toBeDefined();
			expect(de[key as StringKey]).toBeDefined();
		}
	});
});
```

(Reuse the `walk` helper shape from `tests/build/spec-files.test.ts`, or import `REPO`, `repoRelative` from `tests/helpers/repo`.)

- [ ] **Step 2: Watch red** (three keys exist; `DesignerToolbar.vue` and both locale files hit).

- [ ] **Step 3: Implement.** Rename in `DesignerToolbar.vue` (`'designer.toolbar.pan'`, `.undo`, `.redo`); in `en/editor.ts` delete the three `editor.toolbar.*` lines and add `'designer.toolbar.pan': 'Pan'`, `'designer.toolbar.undo': 'Undo'`, `'designer.toolbar.redo': 'Redo'` (place them with the other `designer.toolbar.*` keys — find them with `grep -n "designer.toolbar" src/presentation/i18n/locales/en/*.ts src/presentation/i18n/locales/en.ts`); German `'Verschieben'`, `'Rückgängig'`, `'Wiederholen'`. Rewrite the two `en.ts` comments (lines ~549, ~578) that describe the borrowing. Update the three designer tests' key names. `en/editor.ts`'s header "the shell (toolbar, …)" → "(context bar, …)".

- [ ] **Step 4: Run green** (`npx vitest run tests/presentation/i18n tests/presentation/designer`), then the whole suite via `npm run check`.

- [ ] **Step 5: Close note 33** (`## What closed it`: the rename, the spec narrowing from Task 0, the two `strings.test.ts` cases). Remove its wikilink from the `Open a floor plan…` PBI.

- [ ] **Step 6: Commit** (`refactor(i18n): the asset designer owns designer.toolbar.pan/undo/redo; no editor.toolbar.* key survives`).

---

### Task 12: the records — documents whose claims outran their checks, and the one deferral

**Files:** `docs/tasks/Approve the Editor foundation slice contract.md`; `docs/tasks/Present the truthful floor summary and selection guidance.md`; `docs/tasks/Assemble shared homeowner-question Inspector navigation.md`; `docs/tasks/Establish the editor migration and compatibility contract.md`; `docs/tasks/Operate the Add menu by pointer and keyboard.md`; `docs/tests/cases/Open a floor and select a room.md`; `docs/tests/suites/Smoke Test the Editor.md`; `docs/superpowers/plans/2026-09-02-plan-editor-foundation-read-path.md`; `docs/requirements/Inspect a selected room.md`, `View rooms in the Standard Plan View.md`, `Start one creation task from Add.md` (wikilink lists); notes 15, 16, 17, 18, 25, 26, 27, 30, 31.

Acceptance, verbatim per note:

- (16) "Add both missing PBIs to the §1 table or its explicit 'Not advanced here' set… and correct the task's closing evidence if either is deliberately outside the contract." — §1 was amended in Task 0; here: `Approve the Editor foundation slice contract.md` closing evidence gains "§1 maps all 13 PBIs whose frontmatter parent is `[[Editor foundation]]` — 7 in the table, 6 in 'Not advanced here' (two of them added 2026-09-04: Inspect a selected wall, Plan editor and canvas); the review-time check is `rg -l '^parent: "\[\[Editor foundation\]\]"$' docs/requirements`. No docs gate is added (CLAUDE.md, 'Deliberately absent')."
- (17) "narrow the criterion to the three aggregate states the model represents and state separately that floor-level staleness is an additive global warning. Update Closing evidence to map those two promises independently." — criterion 2 → "Supported zero, unavailable and unreadable (partial) are distinct for every aggregate; floor-level staleness is an additive global warning, never an aggregate state"; closing evidence's last paragraph rewritten to map both.
- (15, R17) — `Assemble shared…` amendment: criterion 7 UNMET, not met: "one closed unavailable-section vocabulary (`INSPECTOR_SECTIONS`) feeds TWO presentation models (`HomeownerQuestionNav`'s and `LinkedContentList`'s private `ROWS`), which is the approved design's own two-list structure (§5.1, §6.7). The first available section decides which list owns it; a shared descriptor registry is that increment's work, not this one's (2026-09-04)."
- (27) — replace "all six migration tables are still empty" with "every registered migration table is empty — `rg -n '_MIGRATIONS: (readonly )?Migration\[\] = \[\];' src/infrastructure/persistence/migration` prints one line per table and every one ends `= [];` (seven at `bc6ca060`, stated as a rule rather than a count) — so `MigrationRunner` remains unproven on a real chain."
- (26) — manual case: add step 11 `obsidian`: "With Add open, press `Ctrl+P` (`Cmd+P` on macOS)" / passes when "Obsidian's command palette opens ON TOP of the menu (or the shortcut is swallowed — record which); dismissing the palette returns focus to the menu item that had it, and Escape then closes the menu with focus back on Add" / catches "the host keymap and `AddMenu`'s `@keydown.stop` disagreeing about who owns the key — jsdom models no `Scope` stack". Rewrite lines 37-42 to point at step 11, not step 6; `Operate the Add menu…` closing evidence: "Step 11 of [[Open a floor and select a room]] is the instrument" (was step 6).
- (31) — after step 11 exists, re-run BOTH census greps from the suite document (lines ~130-131), record total, case count and the five tier counts; change "twelve cases whose steps are a table" to the measured count; add a dated paragraph in the shape the section already uses ("proved itself a SIXTH time"). Do not copy the note's 274/15 — measure.
- (18) — the plan: tick every `- [ ]` whose deliverable is in the tree at `bc6ca060` (spot-check by `ls` for each task's Files block; the PR description records every wave shipped); add under the header "**Reconciled 2026-09-04** against `bc6ca060`: all 25 tasks executed; Task 5 (the rebase gate) was run by the orchestrator; nothing was withdrawn." Where a step's named artefact does NOT exist, leave it unticked and say so beside it.
- (25) — remove the trailing space at line 498 (`grep -c "designer's\" $" …` is the line); confirm `git diff --check d06d4822..HEAD -- docs/superpowers/plans/2026-09-02-plan-editor-foundation-read-path.md` prints nothing.
- (30, R19) — `## Decision` dated 2026-09-04: "Not now. Closing this means a person opening the vault built by `npm run test-build` and walking the eleven steps; no agent here can. It reopens when the Runs table gains a row. Status stays New."

- [ ] **Step 1:** Make every edit above with Edit (verify the whitespace with `git diff --check`).
- [ ] **Step 2:** Close notes 15, 16, 17, 18, 25, 26, 27, 31 (frontmatter + `## What closed it`); note 30 gets `## Decision` only. Remove closed notes' wikilinks from the PBI trailing lists.
- [ ] **Step 3: `npm run check`** (docs only, but the suite reads `docs/tests/cases` for the census? — no; `committedFixtures.test.ts` reads `tests/fixtures`. Run it anyway; it is the rule.) Commit with explicit paths (`docs(review): correct the records the review found overclaiming, and defer the vault walk`).

---

## Self-review

**Note coverage.** Every one of the 41 notes appears in the triage table exactly once with a task; every task's acceptance quotes its notes' `## What closes it`; the four contract conflicts (13, 14, 19, 33, 37 — five notes, four contracts plus the second Escape arm) each have a ruling in Task 0 before the task that depends on it (T6 for 19, T11 for 33, T5 for 37). The deferral (30) has its ruling (R19) and a Decision section.

**Placeholder scan.** Every test step carries code; every implementation step names the function, the field or the attribute and its docblock's argument; the three lookups an implementer must make are stated as lookups with the command that answers them (`STAGE_PIXELS`' name in `EditorSurface.vue`; whether `RoomSummaryList` stays mounted with a selection; `squarePoints`' size in `selectTool.test.ts`).

**Type consistency.** `hoveredTargetKind` (T3) is the name T9's `selectTool.test.ts` edits leave alone; `data-rp-region` (T6) is what T6's own test queries; `WarningSeverity`/`data-rp-severity`/`.rp-warning-strip__severity` (T5) match between `warnings.ts`, the strip and both tests; `skipShellSizing`/`clientWidthFor` (T9) match between helper and case; `FLOOR_STATE`/`PLAN_CANVAS`/`measure`/`overflowFinding`/`shellMetrics` (T10) match between script and tests; `.rp-selection-guidance` (T8) is what both test files query; `editor.unsupported-width.body.one/.other/.partial` (T7) match component, locales and tests; `designer.toolbar.pan/undo/redo` (T11) match component, locales and the i18n test.

**Coverage.** New functions with a caller in `tests/`: `onRootKeydown`, `retireAddMenu`, `onFocusOut` (T1); `regionInheritingFocus`, `releaseInterruptedInputs` (T6); `SelectionGuidance`'s watcher (T8); `clientWidthFor` (T9, a helper — helpers are not under `src/` coverage); `overflowFinding`, `shellMetrics` (T10, `scripts/`, not under coverage — `shellMetrics` runs only in the browser, which the capture run exercises). New arms: `scaleText`'s `null` (T4, three cases), `body`'s three keys (T7, three cases), `severity` per id (T5), `hoveredTargetKind === 'handle'` (T3), `regionInheritingFocus`'s three early returns (T6: exercised by every ordinary resize plus the two focus cases), `onFocusOut`'s three returns (T1: window-blur case, focus-inside case via arrow keys moving focus between items, anchor case via the toggle case). Deleted: two store actions and two refs (T6) — functions coverage gains two units.
