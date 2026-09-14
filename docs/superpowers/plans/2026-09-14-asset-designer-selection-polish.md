# Asset designer selection: follow-ups and polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close PR #205's five measured follow-ups and the deferred review minors that still reproduce, then run a capture-led polish, simplification and discoverability pass over the asset designer's selection and part editing.

**Architecture:** No new layer or module family. Fixes land where each defect lives: the designer canvas's mark gate, the selection inspector, the designer root's status hint, the harness designer mount, the select tool and `editShape`'s write chain. Part C's capture and critique (Task 1) and code review (Task 9) produce findings the controller adds to this plan as numbered tasks before they run.

**Tech Stack:** TypeScript, Vue 3 SFCs, Pinia, Konva via vue-konva, vitest 4 (jsdom per file), Playwright-core for captures, Obsidian plugin API.

**Spec:** [`docs/superpowers/specs/2026-09-13-asset-designer-symbols-design.md`](../specs/2026-09-13-asset-designer-symbols-design.md) — Decisions 9–11, Amendment 1, and **Amendment 2** (added with this plan: the pending-field rule, the Select Shift hint, focus after an inspector write, the silent skip for a key on a part already gone, and one write chain for every designer gesture).

**Stacked on:** PR #205 (`claude/asset-designer-part-editing`, open). This branch is `claude/asset-designer-selection-polish`; its PR is based on #205's branch until #205 merges, then `origin/main` is merged in and the PR retargeted to `main`.

## Global Constraints

Copied from the PR 2 plan (`2026-09-13-asset-designer-symbols-pr2.md`) and extended. Every task's requirements include this section.

- **Layers:** `presentation → application → domain → core`; `infrastructure → application ports → domain → core`. No `vue`, `pinia`, `konva` or `obsidian` in `core/`, `domain/`, `application/`. `presentation/dialogs/` may not import application, infrastructure, plugin or `core/events`.
- **Nothing writes to the vault outside `infrastructure/`.**
- **Budgets (ESLint, blank lines and comments not counted):** `src/**` ≤ 400 lines per file, ≤ 100 lines per function, complexity ≤ 16, max-params 5; `tests/**` ≤ 450 lines per file. `src/presentation/i18n/locales/en.ts` and `de.ts` sit at ~397/400 — **add no keys there**; every new key goes in `src/presentation/i18n/locales/en/assetSymbols.ts` and `src/presentation/i18n/locales/de/assetSymbols.ts` (the `de` record is typed `Record<keyof typeof assetSymbolsEn, string>`, so a missing German string is a build error). `src/presentation/designer/runtime.ts` is 468 raw lines — count ESLint's figure before adding to it. Style partials are ≤ 400 RAW lines (`scripts/styles-assemble.mjs`).
- **Every user-visible string in `en` AND `de`.** English UI text is sentence case (lint-enforced; `sentence-case-locale-module` refuses a capitalised "Shift" mid-sentence). German avoids du-form imperatives and names the key "Umschalttaste" (`de/editor.ts`).
- **No hard-coded colours in CSS** — Obsidian CSS variables only. Styles live in `styles/*.css` partials, never in a shipped `.vue` `<style>` block. Canvas colours come from `ThemeTokens`.
- **No inline styles**, no `innerHTML`, no global `app`.
- **No new dependencies.**
- **Geometry conventions:** millimetres; y grows DOWN the screen; outlines wound top-left → top-right → bottom-right → bottom-left, with which a positive bulge bows outward.
- **One gesture = one `SetAssetShape` dispatch = one undo entry, applied whole or refused whole.** A domain refusal is reported through `reportInvalidInput` (or shown in the inspector) and dispatches NOTHING. Every dispatch goes through the leaf's mapped `toolDispatcher` / `EditorContext.commandDispatcher`, never a command's own `execute`. `CommandHistory.runNow` pushes an undo entry for ANY ok result, `ok('no-write')` included — so nothing that reaches `run` may answer `no-write`.
- **Every selection DRAG passes `expected` = the `geometryVersion` of the design it pressed on** (spec Amendment 1), so a peer write since the press refuses it (PBI extension 4b).
- **A selection writes nothing.** Selecting, changing mode and hovering never dispatch.
- **Plan editor behaviour does not change** unless a task says so. `src/presentation/editor/tools/select-tool.ts`, `src/presentation/editor/**/escapeRouting.ts` and the shared `CONSTRAINING_TOOLS` list in `src/presentation/editor/snapping/editorSnapping.ts` are OFF LIMITS without a controller ruling. `tests/presentation/editor/shell.test.ts` asserts the plan status bar shows no constrain hint under Select.
- **`src/application/commands/asset/SetAssetShape.ts` must not contain the word "undo"** anywhere (comments included).
- **Fallow:** every new export must have a `src/` consumer (a test-only consumer is an `unused-exports` finding); no copied logic blocks. Run `npx fallow dead-code` and `npx fallow dupes` before EVERY commit; both must report nothing new.
- **Coverage floors are 99/99/99/98, counted per branch arm.** Write the test for every arm with the code; do not add a guard no test can reach — delete it instead.
- **Inner loop per task:** `npm run check:fast -- <test paths>` (oxlint + `vue-tsc -noEmit` + vitest on the paths). It omits ESLint and oxlint does not read `.vue`, so before each commit also run `npx eslint <every src/test/script file you touched>`. Do **not** run the full `npm run check` locally — CI runs it on the PR. Run commands in the FOREGROUND with a generous timeout (up to 600000 ms); a backgrounded command never wakes you. If a vitest case times out, re-run with `npm run check:fast -- <paths> --testTimeout=20000` before believing it.
- **A task that widens a shared contract** (`assetDesignStore`'s members, `DesignerToolDeps`, `EditorContext`, `ToolId`, `RenderState`, the designer runtime's returned members, `DESIGNER_TOOL_LABELS`) also runs `npm run check:fast -- tests/presentation tests/helpers tests/harness` before committing.
- **TDD:** write the test, run it and watch it FAIL for the stated reason, then implement. If an expectation in this plan is wrong, STOP and report it — never edit the expectation to match the code.
- **IDE diagnostic blocks that appear mid-edit are usually stale.** Trust `vue-tsc` output.
- **If `node_modules` in the worktree is empty, run `npm ci` first.**
- **No `git stash`. No subagents.**
- **Commits** end with the trailer `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` (this overrides any model name you would otherwise write).
- **Captures:** `npm run harness-shot` uses the pinned Chromium (present on this machine). A capture counts as checked only when its PNG has been OPENED and looked at; say which were opened. `-- --width=460` is the sidebar width; the `--` is load-bearing.
- **Rig geometry trap:** at `designerRig`'s camera (10 mm per px, 80 mm grab radius) `justInsideBottom(TANK)` sits inside the selected bowl's box-handle grab radius, so a press there resizes the bowl. Pick a second press target clear of the selection's handles.

---

## Rulings on the measured follow-ups (made before planning)

Measured against `724dc13d` by reading the code and, for Part B, by throwaway probe tests (deleted). Each line: what was ruled — why — what it costs if wrong.

### Part A — PR #205's follow-ups (all five reproduce)

- **A1 anchor/facing ring under a non-Select tool** — FIX (Task 2): the canvas keeps the marks when the tool is Select OR the selection is not an outline. — The ring is the anchor's and facing's only selection mark; the outline selection already keeps its accent outline under every tool. — If wrong: a ring advertises a grab region another tool does not honour; one condition reverts it.
- **A2 pending detail/anchor fields** — FIX (Task 3), rule = **HIDE** the millimetre fields of a pending part (detail centre and size, anchor position) and show one line saying why; keep rotate-by, angle, name, line, ordering, duplicate and delete. — The footprint already hides its fields and the dimensions dialog withholds numbers for the same reason: a field beside a warning still invites typed millimetres that calibration later rescales. — If wrong: a user cannot correct a pending part by number until they calibrate; the canvas still moves it.
- **A3 Shift hint under Select** — FIX (Task 4): a designer-only hint computed in `AssetDesignerRoot.vue`, never an entry in the shared `CONSTRAINING_TOOLS`. Folded with Part C item 4 (a hint for the active mode, and tooltips on the mode buttons) because both live in the same computed and the same test file. — `select` is an id both surfaces share, and the plan status bar pins no constrain hint under Select. — If wrong: Task 1's critique amends the wording; the mechanism stays.
- **A4 focus after Duplicate or Delete** — FIX (Task 5): the inspector `<aside>` becomes a surviving focus target (`tabindex="-1"`), and the selection section hands focus to it before it unmounts, for both Delete and Duplicate. — It is the plan editor's `EntityInspector`/`NewRoomInspector` precedent, one rule for both actions. — If wrong: a keyboard user duplicating twice presses Tab once more to reach the copy's Duplicate button.
- **A5 unframed preset captures** — FIX (Task 1): the harness applies Shift+1 whenever `?preset=` is given, with the selection step optional, and marks the view framed so a capture waits for the fit. — Same fit `selectInHarness` already uses. — If wrong: only captures change.

### Part B — deferred minors from PR 2's reviews

- **B1 releases outside `editShape`'s chain** — REPRODUCES in the mounted rig: a second drag, an arrow tap, or a drag after a draw, pressed before the first write's read-back lands, reads the pre-write version and is refused as `asset-geometry.revision-conflict` (save badge `save-error`, no notice, gesture lost; nothing overwritten). A draw's automatic return to Select cannot hit (the tool switches only after its write resolves). The vault-side window (sidecar write + read-back) cannot be timed here. — FIX (Task 8): ONE write chain per designer leaf that the select tool's release, the draw tools' release and `editShape` all enqueue through, each step reading the design when it runs; and the select tool HOLDS a press that arrives while that chain is busy, replaying it once the chain drains so the press reads — and the drag is conditional on — the design the user was looking at. — Keeps "the version at the press" literal for a drag (spec Amendment 1). — If wrong: the refusal was already safe, so the cost of the fix being unneeded is ~40 lines of serialisation; the cost of it being wrong is a held press that feels late on a slow vault.
- **B2 queued key on a deleted part** — FIX (Task 7): nudge and Delete skip silently when the part they captured no longer exists when their step runs; the inspector keeps its refusal alert. — The plan editor's `nudge.ts` skips silently for the same reason: the press was right when made and the canvas already shows the part gone. — If wrong: a user never learns a queued key did nothing; the canvas shows why.
- **B3 `assetDesignStore.select()` clears a preview it did not draw** — FIX (Task 6): delete the clear. Measured: no caller relies on it (tool switch, Escape, hydrate pruning and the draw tool each clear their own). — If wrong: a stale preview could stand after a selection change; the settling commit's generation guard still clears it.
- **B4 press-time bend abandon clears an unmoved preview** — RULE OUT: `EditorSurface` feeds the tool only primary releases and focus loss cancels an interrupted gesture, so no leftover bend exists in production. — If wrong: one flash of the stored shape while an earlier commit is in flight.
- **B5 mode switch mid-bend** — RULE OUT: the mode buttons are DOM controls outside the stage, unreachable by mouse mid-drag; keyboard focus moves cancel the gesture; there are no mode hotkeys. Only a second pointer reaches it, and the write is still the bend the user dragged. — If wrong: the wrong handle set draws for the rest of one drag.
- **B6 draw preview flattened at move-time zoom** — RULE OUT: wheel, zoom keys and fit are all refused while a tool gesture is in flight (`gestureInFlight`), and edge scrolling only pans. Storing it unflattened would widen a `RenderState` field three plan-editor writers share. — If wrong: a circle facets until the next pointer move.
- **B7 release point not previewed** — FIX (Task 6): `pointerUp` previews the release shape before committing, as `CurveTool.pointerUp` already does. — If wrong: nothing visible; the jump is sub-frame on real hardware.
- **B8 `dragTarget` recomputation** — RULE OUT, measured: 0.046 ms per move on the toilet; at 1000 details 4.9 ms per move, of which snap candidates are 0.26 ms and the validated `draggedShape` 4.3 ms. — If wrong: an asset with hundreds of details stutters, and the target is `validateAssetShape`, not `dragTarget`.
- **B9 peer-refusal rig case asserts only the end state** — FIX (Task 6): it also asserts the save badge reads `save-error` and no notice was raised (the write-boundary route the user sees). The reporter call is already pinned at unit level by `designerSelectTool.test.ts`'s `rig.rejected`. — If wrong: nothing ships differently.
- **B10 harness selection knob untested** — FIX (Task 1): a jsdom test of the preset, select, mode and framing knobs in the `tests/harness/detailPlanKnob.test.ts` pattern. — If wrong: nothing ships differently.

### Planning rulings

- Task 1 carries A5 and B10 because they are the capture work's own preconditions, and Part C item 1 says the capture pass runs first.
- Tasks added from Task 1's critique and Task 9's review are appended to this plan (Task 10 onward) in a committed amendment before they run; the docs, changelog and re-capture task is appended LAST.

---

## Drafting notes, and the controller's rulings on them

The tasks were drafted by two drafters against `724dc13d`. Their notes follow verbatim, each with a ruling.

### Tasks 1–5

No PLANNING CONFLICT. Every ruling held against the code at `724dc13d`. Three refinements are recorded inside the tasks (none contradicts a ruling):

- **A5 (Task 1):** the Shift+1 fit now WAITS for the design and the canvas's first measured size before it runs. Without that it can fit into a 0 × 0 stage. It used to run on a bare `setTimeout(0)`. The mark is named `data-rp-harness-ready` rather than "framed", because `&camera=default` marks the view ready without framing it.
- **A3/C4 (Task 4):** no status hint for Edit points or Bend edges. Every status-bar hint on both surfaces names a modifier or a standing state, never a gesture, and neither mode reads a modifier. The gesture goes into the mode buttons' tooltips instead.
- **Task 1 (c), the pending state:** `&pending` sets the pending FLAGS only. The harness refuses a background document (`tests/harness/planEditor.ts` header, §55), so no uncalibrated sheet is drawn behind the pending design.

**Verification (throwaway probes, all deleted; `git status --short` shows none of mine).** Each test below was run against today's code (red) and against a patched copy of the module it changes (green, swapped in with `vi.mock`). The implementations were then linted at their real paths through `npx eslint --stdin --stdin-filename <path>`, and all were clean. The new locale strings passed `sentence-case-locale-module` in both `en` and `de`. `vue-tsc` reported nothing in the patched copies beyond the locale keys the probes deliberately did not add.

Budget instrument used throughout (it prints ESLint's own `max-lines` count):

```bash
npx eslint --rule '{"max-lines":["error",{"max":1,"skipBlankLines":true,"skipComments":true}]}' <files>
```

---

- Ruling: all three refinements accepted — each narrows a ruling to what the code allows without contradicting it — if wrong, the critique (Task 1) or the review (Task 9) reopens it.

### Tasks 6–9

PLANNING CONFLICT: Task 8's brief lists "an Escape abandons a held press" and "a peer write during a held press still refuses the replayed drag" as FAILING tests. Neither can fail at `724dc13d`: with no hold, Escape cancels the live drag (bowl ends +100 either way) and the stale press is refused anyway (same end state). Drafted as GUARDS, each verified red by probe against a named mutant of the Task 8 implementation (M1: `dropGesture` leaves the hold → bowl +200; M2: the release is made conditional on the version the store holds at release → the peer's facing is overwritten). The peer case needs a `settle()` after the peer write before the release; without it M2 stayed green (measured), because the store had not yet taken the peer's refresh.

PLANNING CONFLICT: Ruling B1 names three writers (the select tool's release, `detailWrite`, `editShape`). The smallest correct chain queues the tools' `EditorContext.commandDispatcher` itself, which puts EVERY dispatch a designer tool makes on the chain — trace footprint/clearance, set anchor/facing, calibrate — plus `commitHeight`, which shares `toolDispatcher`. Trace detail cannot be reached any other way: it is the plan editor's shared `DrawPolygonTool`, which dispatches through `context.commandDispatcher.run`, and wrapping its command's `execute` to enqueue would deadlock (the step would wait on the history queue that is running it). The extra writers only change ordering. Every existing designer suite passed against it by probe (22 files; the one failure was the pin Task 6 flips).

PLANNING CONFLICT (minor): the brief says Task 6 narrows "the two docblocks" describing the preview clear. Only `designer-select-tool.ts`'s header describes it. `DesignerCanvas.vue:119-123` defers to that header ("`DesignerSelectTool`'s header names what else can clear a preview in that window") and stays true, so Task 6 does not touch `DesignerCanvas.vue`. That also keeps it out of Task 2's file.

- Ruling: the two Task 8 guards stay as guards; the implementer watches each go red against its named mutant (M1, M2) instead of against today's code — a guard that no mutant turns red would certify nothing — if wrong, two cases protect nothing and Task 9's review should say so.
- Ruling: the chain queues the tools' `EditorContext.commandDispatcher`, so every designer write (trace, anchor, facing, calibrate, height, detail, select, keys, inspector) is serialised — ordering is the only change, and trace detail cannot join any other way without a deadlock — if wrong, a slow write delays an unrelated tool's write by one read-back.
- Ruling: Task 6 leaves `DesignerCanvas.vue` untouched — its docblock defers to the select tool's header and stays true — no cost.

---

### Task 1: Harness framing, knob tests and the capture-and-critique pass

Closes A5 and B10, and runs Part C items 1 and 2. **It changes no product code under `src/`.**

**Files:**
- Modify: `tests/harness/itemKnob.ts` (export `pointer`)
- Modify: `tests/harness/assetDesigner.ts` (whole file below)
- Modify: `tests/harness/page.ts:5-7` (header) and `:249-254` (the designer mount)
- Create: `tests/harness/assetDesignerSelectKnob.test.ts`
- Modify: `scripts/harness-shot.mjs` (the `DESIGNER_READY` constant; the 8 preset-bearing designer rows; 19 new rows after `asset-designer-select-anchor`)
- Modify: `tests/build/harness-shot.test.ts:544-555` (the sorted name list)
- Modify: `tests/build/harness-shot-designer.test.ts` (whole file below)
- Create (git-ignored, never committed): `.superpowers/sdd/2026-09-14-asset-designer-selection-polish/task-1-critique.md` (`.gitignore:70` `/.superpowers/`, checked with `git check-ignore -v`)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces:
  - `mountAssetDesignerHarness(root: HTMLElement, presetId: string | null = null, knobs: { readonly select?: string; readonly mode?: string; readonly draw?: string; readonly camera?: string; readonly pending?: boolean } = {}): MountedAssetDesigner`. The third parameter was `{ select; mode } | null`, and its only caller is `page.ts`.
  - The view mark `view.contentEl.dataset.rpHarnessReady`, as the attribute `data-rp-harness-ready`.
  - URL knobs, honoured only beside `&preset=`:
    - `&draw=draw-rect|draw-circle|trace-detail`
    - `&camera=default`
    - `&pending`
  - `export function pointer(canvas: HTMLElement, type: string, x: number, y: number): void` from `tests/harness/itemKnob.ts`.
  - Shot names `asset-designer-select-*`, `asset-designer-pending*`, `asset-designer-draw-*` (listed in Step 3).
  - `task-1-critique.md` with numbered findings, which the controller turns into Tasks 10+.

**What the harness could and could not reach (measured before writing the knobs):**
- `page.ts` already reads `?lang=` (`applyLanguage`, before the mount) and `?theme=`, and `harness-shot.mjs` rows already take `width`. The German and sidebar-width shots therefore need no new knob.
- **A draw tool mid-gesture IS reachable.** `tests/harness/itemKnob.ts` already dispatches a press and a move with no release on the shared `EditorSurface`, and `plan-editor-item-drag` photographs it. A held draw writes nothing: `DrawDetailTool` writes on release, and a trace writes only on its closing click.
- **An uncalibrated sheet is NOT reachable.** `BackgroundRenderModel.loadBackground` needs `getAbstractFileByPath` to answer a `TFile`, and the harness vault answers `null`, which draws the "background missing" notice. `tests/harness/planEditor.ts`'s header refuses a harness background outright (§55). So `&pending` sets flags only, and the canvas is blank behind the design.
- **`&camera=default`** exists because Part C's critique asks for handle legibility at the default camera AND a zoomed one. After A5 every preset capture is framed, so without the knob no capture would show the unframed camera.

- [ ] **Step 1: Write the failing knob test**

Create `tests/harness/assetDesignerSelectKnob.test.ts`:

```ts
/**
 * @vitest-environment jsdom
 *
 * The asset designer harness's knobs (`tests/harness/assetDesigner.ts`, read from the URL by `page.ts`):
 * `&select=` and `&mode=`, `&pending`, `&draw=` and `&camera=default` beside `&preset=`, and the Shift+1
 * fit every preset takes. Every preset-bearing fixed shot in `scripts/harness-shot.mjs` waits on the
 * `data-rp-harness-ready` mark `driveHarness` sets last, so this file is what makes that mark mean the
 * knobs landed rather than merely that a timer ran.
 *
 * The canvas is sized as `designerRig` sizes it — jsdom lays nothing out, and a fit into 0 × 0 frames
 * nothing — and the leaf's Pinia is reached the way the harness itself reaches it.
 */
import Konva from 'konva';
import { afterEach, expect, it, vi } from 'vitest';
import type { App } from 'vue';
import { mountAssetDesignerHarness } from './assetDesigner';
import { useAssetDesignStore } from '../../src/presentation/designer/stores/assetDesignStore';
import { useSaveStateStore } from '../../src/presentation/editor/save-state/save-state-store';
import { useEditorStore } from '../../src/presentation/stores/EditorStore';
import { tr } from '../../src/presentation/i18n/strings';
import { installCanvas } from '../helpers/canvas';
import { installResizeObserver, placeAt, resizeTo } from '../helpers/layout';
import { settle, settleUntil } from '../helpers/settle';

const mounted: Array<ReturnType<typeof mountAssetDesignerHarness>> = [];
afterEach(async () => {
	for (const { view } of mounted.splice(0)) await view.onClose();
	vi.restoreAllMocks();
	document.body.innerHTML = '';
});

async function mountKnobs(presetId: string | null, knobs: Parameters<typeof mountAssetDesignerHarness>[2] = {}) {
	installCanvas();
	installResizeObserver();
	const harness = mountAssetDesignerHarness(document.body, presetId, knobs);
	mounted.push(harness);
	const { view } = harness;
	await settleUntil(() => view.contentEl.querySelector('.rp-plan-canvas') !== null, 'the designer canvas');
	const canvas = view.contentEl.querySelector<HTMLElement>('.rp-plan-canvas') as HTMLElement;
	placeAt(canvas, 0, 0, 800, 600);
	resizeTo(canvas, 800, 600);
	const host = view.contentEl.querySelector('.renovation-asset-designer-view') as HTMLElement & { __vue_app__: App };
	const pinia = host.__vue_app__.config.globalProperties.$pinia;
	return { view, canvas, pinia, store: useAssetDesignStore(pinia), editor: useEditorStore(pinia) };
}

const ready = (view: { contentEl: HTMLElement }): boolean => view.contentEl.dataset.rpHarnessReady !== undefined;

/** The mark, then one flush so the DOM shows what the knobs wrote to the stores. */
async function landed(view: { contentEl: HTMLElement }): Promise<void> {
	await settleUntil(() => ready(view), 'the designer knobs to land');
	await settle();
}

it('&select= and &mode= select that part in that mode under the real Select button, then mark the view ready', async () => {
	const { view, store } = await mountKnobs('toilet', { select: 'detail-2', mode: 'points' });
	await landed(view);

	expect(store.selection).toEqual({ kind: 'detail', id: 'detail-2' });
	expect(store.mode).toBe('points');
	const pressed = [...view.contentEl.querySelectorAll('.rp-designer-tools > button[aria-pressed="true"]')].map((button) => button.textContent?.trim());
	expect(pressed).toEqual([tr('designer.toolbar.select')]);
	expect(view.contentEl.querySelector('.rp-designer-selection-modes [aria-pressed="true"]')?.textContent?.trim()).toBe(tr('designer.selection.mode.points'));
});

it('reads an unknown &mode= as Transform, and draws no mode control for the anchor', async () => {
	const { view, store } = await mountKnobs('toilet', { select: 'anchor', mode: 'bogus' });
	await landed(view);

	expect(store.selection).toEqual({ kind: 'anchor' });
	expect(store.mode).toBe('transform');
	expect(view.contentEl.querySelector('.rp-designer-selection-modes')).toBeNull();
});

/** A shapeless fixture has no part to select: the knobs are honoured only beside a preset. */
it('honours no knob without a preset: nothing is selected and the view is never marked', async () => {
	const { view, store } = await mountKnobs(null, { select: 'detail-2', mode: 'points' });
	await settleUntil(() => store.design !== null, 'the shapeless fixture');
	await settle();
	await settle();

	expect(store.selection).toBeNull();
	expect(ready(view)).toBe(false);
});

/**
 * A second Shift+1 is the instrument: a fit that already ran against the measured canvas leaves the
 * camera where it is, while a fit that never ran — or ran into 0 × 0 — would move it now.
 */
it('frames a preset exactly as Shift+1 does, and &camera=default keeps the view it opened with', async () => {
	const framed = await mountKnobs('curved-table');
	await landed(framed.view);
	const fitted = framed.editor.viewport;
	framed.canvas.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1', shiftKey: true, bubbles: true, cancelable: true }));
	expect(framed.editor.viewport).toEqual(fitted);

	const opened = await mountKnobs('curved-table', { camera: 'default' });
	await landed(opened.view);
	expect(opened.editor.viewport).not.toEqual(fitted);
});

it('&pending marks every part of the preset as captured before a scale existed', async () => {
	const { view, store } = await mountKnobs('toilet', { pending: true });
	await landed(view);

	expect(store.design?.shape?.footprintPending).toBe(true);
	expect(store.design?.shape?.anchorPending).toBe(true);
	expect(store.design?.shape?.clearancePending).toBe(true);
	expect(store.design?.shape?.details.map((detail) => detail.pending)).toEqual([true, true]);
	expect(store.design?.dimensionsUnscaled).toBe(true);
});

it.each(['draw-rect', 'draw-circle'] as const)('&draw=%s holds its drag, so the preview is drawn and nothing is written', async (draw) => {
	const { view, editor, pinia } = await mountKnobs('toilet', { draw });
	await landed(view);

	expect(editor.activeToolId).toBe(draw);
	expect((Konva.stages.at(-1) as Konva.Stage).findOne('.detail-preview')).toBeDefined();
	// Every harness write refuses, so a release that slipped through would flip the badge.
	expect(useSaveStateStore(pinia).state).not.toBe('save-error');
});

it('&draw=trace-detail leaves three vertices placed and the outline open', async () => {
	const { view, editor, pinia } = await mountKnobs('toilet', { draw: 'trace-detail' });
	await landed(view);

	expect(editor.activeToolId).toBe('trace-detail');
	expect(((Konva.stages.at(-1) as Konva.Stage).findOne('.gesture-sketch') as Konva.Group).find('Circle')).toHaveLength(3);
	expect(useSaveStateStore(pinia).state).not.toBe('save-error');
});

it('refuses a &draw= tool it does not know, loudly, and still marks the view', async () => {
	const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
	const { view, editor } = await mountKnobs('toilet', { draw: 'wiggle' });
	await landed(view);

	expect(error).toHaveBeenCalledWith(expect.stringContaining('wiggle'));
	expect(editor.activeToolId).toBeNull();
});
```

- [ ] **Step 2: Write the failing shot pins**

Replace `tests/build/harness-shot-designer.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import { query, shot, shots } from '../helpers/harnessShotFixtures';

/**
 * The asset designer's fixed shots, pinned on what makes each different from a sibling. Split out of
 * `harness-shot.test.ts` — which still holds the whole table in both directions — when these pins
 * pushed that file past the 450-line test budget; both read the one parsed table in
 * `tests/helpers/harnessShotFixtures.ts`.
 */
const READY = '[data-rp-harness-ready]';
const designerShots = (): string[] => [...shots.keys()].filter((name) => name.startsWith('asset-designer-'));

describe('the asset designer shots', () => {
	/**
	 * The asset designer's sidebar-width shot (Task B10's own toolbar-overflow fix) — pinned the
	 * same way `project-detail-narrow` is, so a width or route dropped from either shot fails HERE
	 * rather than being noticed only by re-running the ad-hoc capture that found the defect in the
	 * first place. `width: 460` is the property that makes this shot different from
	 * `asset-designer-dark`; losing it would silently photograph the same wide layout twice under
	 * two names, which is the exact failure `resolveShots` refuses for a blank entry argument.
	 */
	it('takes the asset designer at a sidebar width, through the route that opens it', () => {
		expect(shot('asset-designer-narrow')).toMatchObject({ query: '?view=asset-designer', width: 460 });
	});

	it('seeds the designer with a preset through the harness knob', () => {
		expect(shot('asset-designer-preset-toilet')).toMatchObject({ query: '?view=asset-designer&preset=toilet' });
	});

	/**
	 * The selection captures (symbols spec, Testing: "each selection mode"). `&select=` is honoured
	 * only beside `&preset=`, so a shot that lost its preset would photograph an empty designer and
	 * still pass the name check; each shot also waits on a mark that exists only once the knob landed.
	 */
	it('takes each selection mode and the anchor through the knobs that reach them', () => {
		const four = ['asset-designer-select-transform', 'asset-designer-select-points', 'asset-designer-select-bend', 'asset-designer-select-anchor'];

		expect(four.filter((name) => query(name).get('view') === 'asset-designer' && query(name).has('preset'))).toEqual(four);
		expect(query('asset-designer-select-transform').get('select')).toBe('detail-2');
		expect(query('asset-designer-select-transform').get('mode')).toBeNull();
		expect(query('asset-designer-select-points').get('mode')).toBe('points');
		expect(query('asset-designer-select-bend').get('mode')).toBe('bend');
		expect(query('asset-designer-select-bend').get('theme')).toBe('light');
		expect(query('asset-designer-select-anchor').get('select')).toBe('anchor');
	});

	/**
	 * The view element is attached at MOUNT, before the harness has framed, selected or drawn anything,
	 * so a preset shot waiting on it alone photographed the unframed designer — which the four preset
	 * shots did (selection polish, follow-up A5). Every shot that opens a preset waits on the mark
	 * `driveHarness` sets last.
	 */
	it('waits on the harness-ready mark in every shot that opens a preset', () => {
		const presets = designerShots().filter((name) => query(name).has('preset'));
		expect(presets.length).toBeGreaterThan(0);
		expect(presets.filter((name) => ![shot(name).selector].flat().includes(READY))).toEqual([]);
	});

	/**
	 * The capture-and-critique pass's states (selection polish, Task 1), each pinned on the knobs that make
	 * it differ from a sibling: a shot that lost its `theme`, `lang`, `camera`, `pending` or `draw` would
	 * photograph a sibling's state under its own name and exit 0. `null` pins a knob ABSENT.
	 */
	it.each([
		['asset-designer-select-transform-light', { select: 'detail-2', mode: null, theme: 'light' }],
		['asset-designer-select-points-light', { select: 'footprint', mode: 'points', theme: 'light' }],
		['asset-designer-select-bend-dark', { preset: 'curved-table', select: 'footprint', mode: 'bend', theme: null }],
		['asset-designer-select-anchor-light', { select: 'anchor', theme: 'light' }],
		['asset-designer-select-footprint', { select: 'footprint', mode: null, theme: null }],
		['asset-designer-select-footprint-light', { select: 'footprint', mode: null, theme: 'light' }],
		['asset-designer-select-clearance', { select: 'clearance', theme: null }],
		['asset-designer-select-clearance-light', { select: 'clearance', theme: 'light' }],
		['asset-designer-select-facing', { select: 'facing', theme: null }],
		['asset-designer-select-facing-light', { select: 'facing', theme: 'light' }],
		['asset-designer-select-narrow', { select: 'detail-2', lang: null }],
		['asset-designer-select-narrow-de', { select: 'detail-2', lang: 'de' }],
		['asset-designer-select-transform-unframed', { select: 'detail-2', camera: 'default' }],
		['asset-designer-pending', { select: 'detail-2', pending: '' }],
		['asset-designer-pending-anchor-light', { select: 'anchor', pending: '', theme: 'light' }],
		['asset-designer-draw-rect', { draw: 'draw-rect', select: null, theme: null }],
		['asset-designer-draw-rect-light', { draw: 'draw-rect', select: null, theme: 'light' }],
		['asset-designer-draw-circle', { draw: 'draw-circle', select: null }],
		['asset-designer-draw-trace-detail', { draw: 'trace-detail', select: null }],
	] as const)('reaches %s through the knobs %o', (name, knobs) => {
		const asked = query(name);
		expect(asked.get('view')).toBe('asset-designer');
		expect(asked.has('preset')).toBe(true);
		for (const [knob, value] of Object.entries(knobs)) expect(asked.get(knob), `${name} ${knob}`).toBe(value);
	});

	it('takes exactly the two selected-inspector shots at a sidebar width', () => {
		expect(designerShots().filter((name) => name.startsWith('asset-designer-select') && shot(name).width === 460)).toEqual(['asset-designer-select-narrow', 'asset-designer-select-narrow-de']);
	});
});
```

In `tests/build/harness-shot.test.ts`, inside `it('defines exactly the fixed shots this file lists, in both directions'`, replace the eleven `asset-designer-*` entries (`:545-555`) with these thirty, in this order. It is the `toSorted()` order, verified by probe:

```ts
			'asset-designer-dark',
			'asset-designer-draw-circle',
			'asset-designer-draw-rect',
			'asset-designer-draw-rect-light',
			'asset-designer-draw-trace-detail',
			'asset-designer-light',
			'asset-designer-narrow',
			'asset-designer-pending',
			'asset-designer-pending-anchor-light',
			'asset-designer-preset-curved-table',
			'asset-designer-preset-sofa',
			'asset-designer-preset-toilet',
			'asset-designer-preset-tree',
			'asset-designer-select-anchor',
			'asset-designer-select-anchor-light',
			'asset-designer-select-bend',
			'asset-designer-select-bend-dark',
			'asset-designer-select-clearance',
			'asset-designer-select-clearance-light',
			'asset-designer-select-facing',
			'asset-designer-select-facing-light',
			'asset-designer-select-footprint',
			'asset-designer-select-footprint-light',
			'asset-designer-select-narrow',
			'asset-designer-select-narrow-de',
			'asset-designer-select-points',
			'asset-designer-select-points-light',
			'asset-designer-select-transform',
			'asset-designer-select-transform-light',
			'asset-designer-select-transform-unframed',
```

- [ ] **Step 3: Run the tests to watch them fail**

Run: `npx vitest run tests/harness/assetDesignerSelectKnob.test.ts --testTimeout=20000`

Expected: `Tests  8 failed | 1 passed (9)`, each failure `Error: Timed out after 4000ms waiting for: the designer knobs to land`. The no-preset case passes before and after; it pins the guard. (`npm run check:fast` stops earlier, at `vue-tsc`: `TS2353: Object literal may only specify known properties, and 'camera' does not exist in type '{ readonly select: string; readonly mode: string; }'`. That is the same reason, seen by the compiler.)

Run: `npx vitest run tests/build/harness-shot-designer.test.ts tests/build/harness-shot.test.ts`

Expected FAIL:
- `defines exactly the fixed shots this file lists, in both directions` (the list lacks the new names);
- `waits on the harness-ready mark in every shot that opens a preset`, with `AssertionError: expected [ …(8) ] to deeply equal []`;
- all 19 `reaches … through the knobs` cases, with `Error: no shot named asset-designer-…`;
- `takes exactly the two selected-inspector shots at a sidebar width`.

- [ ] **Step 4: Export the pointer helper**

In `tests/harness/itemKnob.ts`, change `function pointer(canvas: HTMLElement, type: string, x: number, y: number): void {` to:

```ts
export function pointer(canvas: HTMLElement, type: string, x: number, y: number): void {
```

(Its docblock-less neighbours stay as they are. It is exported because `assetDesigner.ts` dispatches the same pointers, and `page.ts` already reaches both modules for fallow.)

- [ ] **Step 5: Rewrite the designer harness**

Replace `tests/harness/assetDesigner.ts` with:

```ts
import { createAssetId } from '../../src/domain/asset/AssetId';
import { dimensionsOf, type AssetShape } from '../../src/domain/asset/AssetShape';
import { ASSET_PRESETS } from '../../src/domain/asset/presets/catalogue';
import { defaultValues } from '../../src/domain/asset/presets/presetGeometry';
import { AssetDesignerView } from '../../src/presentation/designer/AssetDesignerView';
import type { AssetDesignerDeps } from '../../src/presentation/designer/AssetDesignerContext';
import type { AssetDesignDto } from '../../src/application/queries/GetAssetDesign';
import { unavailableAssetDesignerCommands } from '../../src/presentation/designer/designerCommands';
import type { BackgroundPicker } from '../../src/presentation/designer/ports';
import type { BackgroundVault } from '../../src/presentation/editor/layers/background/BackgroundRenderModel';
import type { Logger } from '../../src/application/ports/Logger';
import type { ObservationToken } from '../../src/application/ports/versioning';
import type { App } from 'vue';
import { ok } from '../../src/core/result/Result';
import { tr } from '../../src/presentation/i18n/strings';
import type { StringKey } from '../../src/presentation/i18n/locales/en';
import { useAssetDesignStore } from '../../src/presentation/designer/stores/assetDesignStore';
import { DESIGNER_TOOL_LABELS } from '../../src/presentation/designer/tools/registerDesignerTools';
import { useEditorStore } from '../../src/presentation/stores/EditorStore';
import type { DesignerSelection, SelectionMode } from '../../src/presentation/designer/selection/designerSelection';
import { installObsidianDom } from '../helpers/dom';
// `../helpers/settle` and not `../helpers/editor`, for the reason `itemKnob.ts` gives: this reaches a real browser.
import { settleUntil } from '../helpers/settle';
import { FakeLeaf } from '../helpers/workspace';
import { pointer } from './itemKnob';

/**
 * The REAL Asset Designer, mounted outside Obsidian for LOOKING at — `npm run harness`
 * with `?view=asset-designer`, and Task B10's own axe scan, which mounts through this exact
 * function so a screenshot and a semantics check agree on what "the mounted designer" means.
 * `planEditor.ts`'s shape for the plugin's third workspace view.
 *
 * **No shape and no background**, which is `selectAssetDesignerEmptyState`'s `noBackground`
 * entry — the empty state this task exists to grade — and the picker is BOUND rather than
 * `null`: `AssetDesignerRoot`'s overlay withholds `noBackground`'s action label whenever
 * `context.picker === null` (slice 14's Amendment 1 — a live control that does nothing must
 * not render), so a `null` picker here would photograph and scan a buttonless nag rather than
 * the button-carrying state Task B10's own axe case has to prove present. Nothing on this page
 * ever presses it; `pick()` answering `null` (a cancelled pick) is the honest inert answer.
 *
 * Every WRITE refuses with `settings.unrecovered`, the same honest stand-in `planEditor.ts`'s
 * `harnessDeps` uses — the buttons render and a gesture fails like any other failed write
 * rather than pretending to persist against a vault this page does not have.
 */

// Module-private: unlike `planEditor.ts`'s `HARNESS_PLAN`/`HARNESS_ZONES`/`harnessDeps`, nothing
// outside this file needs these three individually yet — there is no `fixture.ts`-style
// per-component mount of the designer's own world to hand them to. `mountAssetDesignerHarness`
// is the one door out; export the rest again the day a second caller needs one.
const HARNESS_ASSET_ID = createAssetId();

const HARNESS_VERSION = { revision: 1, observed: 'harness-asset-design' as ObservationToken };

const HARNESS_ASSET_DESIGN: AssetDesignDto = {
	assetId: HARNESS_ASSET_ID,
	name: 'Kitchen island',
	height: null,
	background: null,
	calibration: null,
	shape: null,
	dimensions: null,
	clearanceExtent: null,
	dimensionsUnscaled: false,
	noteVersion: HARNESS_VERSION,
	geometryVersion: HARNESS_VERSION,
};

/** Never resolves to a real reference — see the header for why `null` is the honest answer. */
const inertPicker: BackgroundPicker = {
	pick: () => Promise.resolve(null),
};

const inertLogger: Logger = {
	debug: () => undefined,
	info: () => undefined,
	warn: () => undefined,
	error: () => undefined,
};

/**
 * The state an uncalibrated spec sheet leaves: a TRACED footprint and every detail, the clearance and the
 * anchor awaiting a scale — `validateAssetShape` refuses a typed footprint marked pending, so the origin
 * moves with the flag.
 */
function awaitingScale(shape: AssetShape): AssetShape {
	return {
		...shape,
		footprintOrigin: 'traced',
		footprintPending: true,
		clearancePending: shape.clearance !== null,
		anchorPending: true,
		details: shape.details.map((detail) => ({ ...detail, pending: true })),
	};
}

/**
 * `?preset=<id>` seeds the fixture with that preset at its defaults, so a capture draws curves and
 * details instead of the empty state (asset designer symbols spec, Testing). An unknown id is the
 * shapeless fixture.
 *
 * `&pending` seeds `awaitingScale`'s version of it, so the inspector's unscaled warnings can be
 * photographed. The SHEET itself is not drawn: this page has no vault and refuses a background document
 * (`planEditor.ts`'s header, §55), so the canvas is blank behind the design. `dimensionsUnscaled` follows
 * the footprint's flag exactly as `GetAssetDesign` derives it.
 */
function designFor(presetId: string | null, pending: boolean): AssetDesignDto {
	const preset = ASSET_PRESETS.find((item) => item.id === presetId);
	if (preset === undefined) return HARNESS_ASSET_DESIGN;
	const built = preset.build(defaultValues(preset));
	if (!built.ok) return HARNESS_ASSET_DESIGN;
	const shape = pending ? awaitingScale(built.value) : built.value;
	const measured = dimensionsOf(shape.footprint);
	return { ...HARNESS_ASSET_DESIGN, shape, dimensions: measured.ok ? measured.value : null, dimensionsUnscaled: shape.footprintPending };
}

function assetDesignerHarnessDeps(presetId: string | null, pending: boolean): AssetDesignerDeps {
	return {
		// A fresh DTO per call, not the constant — `planEditor.ts`'s `getPlan` carries the same
		// rule: the real query builds its DTO from a note it just read, and handing back the
		// module object would let a mutation through Pinia's reactive state edit the fixture.
		queries: { getAssetDesign: () => Promise.resolve(ok(structuredClone(designFor(presetId, pending)))) },
		commands: unavailableAssetDesignerCommands(),
		logger: inertLogger,
		picker: inertPicker,
		// A vault with nothing in it, which is the honest stand-in rather than a thin one: the
		// fixture's `background` is `null`, so `loadBackground` never reaches a member of this.
		// `planEditor.ts`'s own harness vault is the same three inert answers for the same
		// reason. The day this page fixtures a real sheet, this is what has to grow one.
		vault: {
			getAbstractFileByPath: () => null,
			getResourcePath: () => '',
			readBinary: () => Promise.resolve(new ArrayBuffer(0)),
		} as unknown as BackgroundVault,
		// The harness holds a fixed fixture and publishes no domain events; both change doors on
		// the Plan Editor's harness page are inert for the identical reason.
		indexScanCompleted: () => true,
		onDesignChanged: () => () => undefined,
		// No theme switching in the harness page: the palette it resolves at setup is the one it
		// keeps. A source that never fires, rather than one omitted, because the member is
		// required precisely so no surface can forget to answer the question.
		onThemeChange: () => () => undefined,
		// And no file events either: the harness draws a fixed fixture in a page with no Obsidian
		// and therefore no vault to fire them. The `background` in that fixture is `null`, so the
		// layer this feeds has nothing to reload. Present rather than omitted, for the reason the
		// theme door above gives.
		onVaultFileChanged: () => () => undefined,
	};
}

export interface MountedAssetDesigner {
	leafEl: HTMLElement;
	view: AssetDesignerView;
}

/** `&select=` spells a part as `partKey` does, minus the `detail:` prefix a URL has no need for. */
function harnessSelection(select: string): DesignerSelection {
	return select === 'footprint' || select === 'clearance' || select === 'anchor' || select === 'facing'
		? { kind: select }
		: { kind: 'detail', id: select };
}

/** The draw tools `&draw=` can hold mid-gesture. */
const DRAW_KNOB_TOOLS = ['draw-rect', 'draw-circle', 'trace-detail'] as const;

/** A box and a circle, each pressed and moved at fractions of the canvas box and never released. */
const HELD_DRAGS = {
	'draw-rect': [[0.4, 0.38], [0.6, 0.62]],
	'draw-circle': [[0.5, 0.5], [0.58, 0.5]],
} as const;

/** Three clicks and no closing one: an open outline, which writes nothing until it is closed. */
const TRACED_VERTICES = [[0.4, 0.4], [0.6, 0.4], [0.6, 0.6]] as const;

/** Presses the REAL toolbar button with that label, in whatever language `?lang=` set. */
function pressTool(view: AssetDesignerView, label: StringKey): void {
	Array.from(view.contentEl.querySelectorAll<HTMLButtonElement>('.rp-designer-tools button'))
		.find((candidate) => candidate.textContent?.trim() === tr(label))
		?.click();
}

/**
 * `&draw=<tool>` presses that tool and leaves its gesture UNFINISHED, so a capture shows the preview a user
 * steers by. The pointers are `itemKnob.ts`'s. An unknown tool is refused on the console — which
 * `harness-shot` records as a failure — rather than photographing a designer with no gesture under a draw
 * shot's name.
 */
function drawInHarness(view: AssetDesignerView, canvas: HTMLElement, draw: string): void {
	const tool = DRAW_KNOB_TOOLS.find((candidate) => candidate === draw);
	if (tool === undefined) {
		console.error(`the &draw knob wants one of ${DRAW_KNOB_TOOLS.join(', ')}; got "${draw}"`);
		return;
	}
	pressTool(view, DESIGNER_TOOL_LABELS[tool]);
	if (tool === 'trace-detail') {
		for (const [x, y] of TRACED_VERTICES) {
			pointer(canvas, 'pointerdown', x, y);
			pointer(canvas, 'pointerup', x, y);
		}
		return;
	}
	const [from, to] = HELD_DRAGS[tool];
	pointer(canvas, 'pointerdown', from[0], from[1]);
	pointer(canvas, 'pointermove', to[0], to[1]);
}

/**
 * What every `?preset=` capture waits on. It waits first for the leaf's mount, then for TWO things before
 * touching anything: the design, which the leaf reads after it mounts, and the canvas's first measured
 * size (`EditorStore.stageSize`), without which `Shift+1` fits into 0 × 0 and frames nothing a capture can
 * use. A bare `setTimeout(0)` promised neither.
 *
 * Then, in order:
 * - `&select=`/`&mode=`, through the REAL Select button and the leaf's own store;
 * - `Shift+1` on the canvas, the user's own fit — an opened asset keeps its origin-centred view, which
 *   clips a curved table and draws a toilet a few pixels wide — unless `&camera=default` asks for exactly
 *   that view;
 * - `&draw=`, LAST, because a gesture in flight refuses a fit (`keyDoors.ts`).
 *
 * Last of all it sets `data-rp-harness-ready` on the view: the mark `scripts/harness-shot.mjs`'s preset
 * shots wait on, since the view element itself is attached at mount, before any of this. The leaf's Pinia
 * is reached through the Vue app `AssetDesignerView` mounts on its host element. Harness-only: no
 * production seam exists for this, and none is added.
 */
async function driveHarness(
	view: AssetDesignerView,
	knobs: { readonly select?: string; readonly mode?: string; readonly draw?: string; readonly camera?: string },
): Promise<void> {
	const host = (): (HTMLElement & { __vue_app__: App }) | null => view.contentEl.querySelector('.renovation-asset-designer-view');
	await settleUntil(() => host() !== null, 'the designer mount');
	const pinia = (host() as HTMLElement & { __vue_app__: App }).__vue_app__.config.globalProperties.$pinia;
	const store = useAssetDesignStore(pinia);
	const editor = useEditorStore(pinia);
	await settleUntil(() => store.design !== null && editor.stageSize.width > 0, 'the ?preset design on a measured canvas');
	if (knobs.select !== undefined) {
		pressTool(view, 'designer.toolbar.select');
		store.select(harnessSelection(knobs.select));
		const mode: SelectionMode = knobs.mode === 'points' || knobs.mode === 'bend' ? knobs.mode : 'transform';
		store.setMode(mode);
	}
	const canvas = view.contentEl.querySelector('.rp-plan-canvas') as HTMLElement;
	if (knobs.camera !== 'default') {
		canvas.dispatchEvent(new KeyboardEvent('keydown', { key: '!', code: 'Digit1', shiftKey: true, bubbles: true }));
	}
	if (knobs.draw !== undefined) drawInHarness(view, canvas, knobs.draw);
	view.contentEl.dataset.rpHarnessReady = '';
}

/**
 * `knobs` are `page.ts`'s `&select=`, `&mode=`, `&draw=`, `&camera=` and `&pending`, honoured only beside a
 * preset: a shapeless fixture has no part to select or draw beside, and a capture of one would photograph
 * a state nobody could reach.
 */
export function mountAssetDesignerHarness(
	root: HTMLElement,
	presetId: string | null = null,
	knobs: { readonly select?: string; readonly mode?: string; readonly draw?: string; readonly camera?: string; readonly pending?: boolean } = {},
): MountedAssetDesigner {
	// Obsidian's DOM prototype extensions. Installed first, because the mount below uses them.
	installObsidianDom();
	root.empty();

	const leafEl = root.createDiv('rp-harness-leaf');
	const view = new AssetDesignerView(new FakeLeaf() as never, assetDesignerHarnessDeps(presetId, knobs.pending === true));
	leafEl.appendChild(view.containerEl);

	// State first, then open — the restored-leaf order `mountPlanEditorHarness` uses. `void`
	// rather than awaited: the page entry cannot await, and both do their work synchronously
	// before resolving.
	void view.setState({ assetId: HARNESS_ASSET_ID }, {} as never);
	void view.onOpen();
	// `void`: a wait that times out rejects, which the page reports as an error and `harness-shot` fails on.
	if (presetId !== null) void driveHarness(view, knobs);

	return { leafEl, view };
}
```

- [ ] **Step 6: Read the new knobs in `page.ts`**

In the header docblock (`:6-7`), replace `` `&preset=<id>` seeding a preset and, beside it, `&select=<part>` and `&mode=<mode>` selecting one part in one mode `` with:

```ts
 * (Task B10) opens the asset designer the same way — `&preset=<id>` seeding a preset and, beside
 * it, `&select=<part>` and `&mode=<mode>` selecting one part in one mode, `&draw=<tool>` holding a draw
 * tool mid-gesture, `&camera=default` skipping the fit and `&pending` marking the design unscaled — `?view=asset-library` (Task 17) opens the
```

Replace the designer branch (`:249-254`):

```ts
			: wantsAssetDesigner
				? mountAssetDesignerHarness(
					document.body,
					params.get('preset'),
					params.has('select') ? { select: params.get('select') ?? '', mode: params.get('mode') ?? 'transform' } : null,
				).view
```

with:

```ts
			: wantsAssetDesigner
				? mountAssetDesignerHarness(document.body, params.get('preset'), {
						select: params.get('select') ?? undefined,
						mode: params.get('mode') ?? undefined,
						draw: params.get('draw') ?? undefined,
						camera: params.get('camera') ?? undefined,
						pending: params.has('pending'),
					}).view
```

- [ ] **Step 7: Add the rows to `scripts/harness-shot.mjs`**

After `const ASSET_DESIGNER_VIEW = '.renovation-asset-designer-view';` add:

```js
// The mark `tests/harness/assetDesigner.ts`'s `driveHarness` sets once a `?preset=` capture's knobs have
// landed — the fit, the selection, the held draw. The view element above is attached at MOUNT, before any
// of that, so a shot waiting on it alone could photograph the unframed designer (selection polish, A5).
const DESIGNER_READY = '[data-rp-harness-ready]';
```

Replace the four `asset-designer-preset-*` rows with:

```js
	{ name: 'asset-designer-preset-curved-table', query: '?view=asset-designer&preset=curved-table', selector: [ASSET_DESIGNER_VIEW, DESIGNER_READY] },
	{ name: 'asset-designer-preset-sofa', query: '?view=asset-designer&preset=sofa', selector: [ASSET_DESIGNER_VIEW, DESIGNER_READY] },
	{ name: 'asset-designer-preset-toilet', query: '?view=asset-designer&preset=toilet', selector: [ASSET_DESIGNER_VIEW, DESIGNER_READY] },
	{ name: 'asset-designer-preset-tree', query: '?view=asset-designer&preset=tree', selector: [ASSET_DESIGNER_VIEW, DESIGNER_READY] },
```

In each of the four `asset-designer-select-{transform,points,bend,anchor}` rows, insert `DESIGNER_READY` as the second selector (`selector: [ASSET_DESIGNER_VIEW, DESIGNER_READY, …the existing marks…]`). After the `asset-designer-select-anchor` row's closing `},` add:

```js
	// The capture-and-critique pass (selection polish, Task 1): each mode in the scheme its shot above does
	// not take, and the three parts those four leave out — the footprint in Transform, the clearance, the
	// facing — in both, because whether a handle reads against the ground is a contrast question and one
	// scheme is half an answer.
	{ name: 'asset-designer-select-transform-light', query: '?view=asset-designer&preset=toilet&select=detail-2&theme=light', selector: [ASSET_DESIGNER_VIEW, DESIGNER_READY, '.rp-designer-selection-modes [aria-pressed="true"]', '.rp-designer-selection[data-kind="detail"]'] },
	{ name: 'asset-designer-select-points-light', query: '?view=asset-designer&preset=toilet&select=footprint&mode=points&theme=light', selector: [ASSET_DESIGNER_VIEW, DESIGNER_READY, '.rp-designer-selection-modes [aria-pressed="true"]', '.rp-designer-selection[data-kind="footprint"]'] },
	{ name: 'asset-designer-select-bend-dark', query: '?view=asset-designer&preset=curved-table&select=footprint&mode=bend', selector: [ASSET_DESIGNER_VIEW, DESIGNER_READY, '.rp-designer-selection-modes [aria-pressed="true"]', '.rp-designer-selection[data-kind="footprint"]'] },
	{ name: 'asset-designer-select-anchor-light', query: '?view=asset-designer&preset=toilet&select=anchor&theme=light', selector: [ASSET_DESIGNER_VIEW, DESIGNER_READY, '.rp-designer-selection[data-kind="anchor"]'] },
	{ name: 'asset-designer-select-footprint', query: '?view=asset-designer&preset=toilet&select=footprint', selector: [ASSET_DESIGNER_VIEW, DESIGNER_READY, '.rp-designer-selection-modes [aria-pressed="true"]', '.rp-designer-selection[data-kind="footprint"]'] },
	{ name: 'asset-designer-select-footprint-light', query: '?view=asset-designer&preset=toilet&select=footprint&theme=light', selector: [ASSET_DESIGNER_VIEW, DESIGNER_READY, '.rp-designer-selection-modes [aria-pressed="true"]', '.rp-designer-selection[data-kind="footprint"]'] },
	{ name: 'asset-designer-select-clearance', query: '?view=asset-designer&preset=toilet&select=clearance', selector: [ASSET_DESIGNER_VIEW, DESIGNER_READY, '.rp-designer-selection-modes [aria-pressed="true"]', '.rp-designer-selection[data-kind="clearance"]'] },
	{ name: 'asset-designer-select-clearance-light', query: '?view=asset-designer&preset=toilet&select=clearance&theme=light', selector: [ASSET_DESIGNER_VIEW, DESIGNER_READY, '.rp-designer-selection-modes [aria-pressed="true"]', '.rp-designer-selection[data-kind="clearance"]'] },
	{ name: 'asset-designer-select-facing', query: '?view=asset-designer&preset=toilet&select=facing', selector: [ASSET_DESIGNER_VIEW, DESIGNER_READY, '.rp-designer-selection[data-kind="facing"]'] },
	{ name: 'asset-designer-select-facing-light', query: '?view=asset-designer&preset=toilet&select=facing&theme=light', selector: [ASSET_DESIGNER_VIEW, DESIGNER_READY, '.rp-designer-selection[data-kind="facing"]'] },
	// A detail's inspector section at a sidebar leaf's width, in English and in German — the longest labels
	// (`Anzuwendende Drehung in Grad`, `Eine Ebene nach vorne`) are what wraps or overflows first.
	{ name: 'asset-designer-select-narrow', query: '?view=asset-designer&preset=toilet&select=detail-2', selector: [ASSET_DESIGNER_VIEW, DESIGNER_READY, '.rp-designer-selection[data-kind="detail"]'], width: 460 },
	{ name: 'asset-designer-select-narrow-de', query: '?view=asset-designer&preset=toilet&select=detail-2&lang=de', selector: [ASSET_DESIGNER_VIEW, DESIGNER_READY, '.rp-designer-selection[data-kind="detail"]'], width: 460 },
	// The same Transform selection at the camera an opened asset keeps (`&camera=default`), where the toilet
	// is a few dozen pixels across — the other end of the handle-legibility question from the framed shots.
	{ name: 'asset-designer-select-transform-unframed', query: '?view=asset-designer&preset=toilet&select=detail-2&camera=default', selector: [ASSET_DESIGNER_VIEW, DESIGNER_READY, '.rp-designer-selection-modes [aria-pressed="true"]', '.rp-designer-selection[data-kind="detail"]'] },
	// A design captured before a scale existed (`&pending`): the inspector's unscaled warnings. The spec sheet
	// itself is not drawn — the harness refuses a background document (`tests/harness/planEditor.ts`, §55).
	{ name: 'asset-designer-pending', query: '?view=asset-designer&preset=toilet&pending&select=detail-2', selector: [ASSET_DESIGNER_VIEW, DESIGNER_READY, '.rp-designer-selection[data-kind="detail"]', '.rp-designer-unscaled'] },
	{ name: 'asset-designer-pending-anchor-light', query: '?view=asset-designer&preset=toilet&pending&select=anchor&theme=light', selector: [ASSET_DESIGNER_VIEW, DESIGNER_READY, '.rp-designer-selection[data-kind="anchor"]', '.rp-designer-unscaled'] },
	// Each draw tool mid-gesture (`&draw=`): a box and a circle held mid-drag, a detail traced three vertices
	// in. Nothing on the DOM marks a Konva preview, so these wait on the ready mark alone, which is set only
	// after the pointers have been dispatched.
	{ name: 'asset-designer-draw-rect', query: '?view=asset-designer&preset=toilet&draw=draw-rect', selector: [ASSET_DESIGNER_VIEW, DESIGNER_READY] },
	{ name: 'asset-designer-draw-rect-light', query: '?view=asset-designer&preset=toilet&draw=draw-rect&theme=light', selector: [ASSET_DESIGNER_VIEW, DESIGNER_READY] },
	{ name: 'asset-designer-draw-circle', query: '?view=asset-designer&preset=toilet&draw=draw-circle', selector: [ASSET_DESIGNER_VIEW, DESIGNER_READY] },
	{ name: 'asset-designer-draw-trace-detail', query: '?view=asset-designer&preset=toilet&draw=trace-detail', selector: [ASSET_DESIGNER_VIEW, DESIGNER_READY] },
```

(`.rp-designer-unscaled` is already drawn today by `DesignerInspector`'s footprint warning whenever `dimensionsUnscaled`, so both pending shots are satisfiable before Task 3.)

- [ ] **Step 8: Run the tests to watch them pass**

Run: `npm run check:fast -- tests/harness/assetDesignerSelectKnob.test.ts tests/build/harness-shot-designer.test.ts tests/build/harness-shot.test.ts tests/harness/harnessSurfaces.test.ts`

Expected: oxlint and vue-tsc clean. For vitest: `Tests  9 passed (9)` for the knob file, and every case in the three other files passes.

Run: `npx vitest run tests/harness/accessibility.test.ts -t "asset designer" --testTimeout=20000`

Expected: PASS. The empty-state mount passes no preset, so no knob runs.

- [ ] **Step 9: Lint and budgets**

Run: `npx eslint tests/harness/assetDesigner.ts tests/harness/page.ts tests/harness/itemKnob.ts tests/harness/assetDesignerSelectKnob.test.ts tests/build/harness-shot-designer.test.ts tests/build/harness-shot.test.ts`

Expected: no output.

Run: `npx oxlint --deny-warnings scripts/harness-shot.mjs`

Expected: no findings.

Budgets. Measured before the task; after = with this task's code, measured in the probe where a file existed:

| File | Linter | Before | After | Cap |
| --- | --- | --- | --- | --- |
| `scripts/harness-shot.mjs` | oxlint | 374 | 394 | 400 |
| `tests/build/harness-shot.test.ts` | ESLint | 392 | 411 | 450 |
| `tests/build/harness-shot-designer.test.ts` | ESLint | 20 | ≈ 60 | 450 |
| `tests/harness/assetDesigner.ts` | ESLint | 108 | ≈ 150 | 450 |
| `tests/harness/page.ts` | ESLint | 92 | ≈ 95 | 450 |

`scripts/harness-shot.mjs` has six lines of headroom left after this task, so a later task adding shots must look there first. Re-measure with the instrument at the top of this file.

- [ ] **Step 10: Fallow**

Run: `npx fallow dead-code` and then `npx fallow dupes`.

Expected: nothing naming a file this task touched. `pointer` now has a consumer (`assetDesigner.ts`, reached from `page.ts`); the knobs type is written inline, so it names no private type.

- [ ] **Step 11: Commit**

```bash
git add tests/harness/itemKnob.ts tests/harness/assetDesigner.ts tests/harness/page.ts tests/harness/assetDesignerSelectKnob.test.ts scripts/harness-shot.mjs tests/build/harness-shot.test.ts tests/build/harness-shot-designer.test.ts
git commit -m "$(cat <<'EOF'
test(harness): frame every designer preset capture, test the knobs, add the polish captures

The preset shots waited only on the view element, attached at mount, so they photographed the
unframed designer. driveHarness now waits for the design and a measured canvas, applies Shift+1
for any preset (selection optional), and marks the view data-rp-harness-ready last; every
preset-bearing shot waits on it. New knobs &draw=, &camera=default and &pending reach the states
the capture-and-critique pass photographs; assetDesignerSelectKnob.test.ts drives all of them.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 12: Take the captures**

Run in the FOREGROUND with a 600000 ms timeout: `npm run harness-shot`

Expected: a `wrote harness-shots/<name>.png` line per shot, including all thirty `asset-designer-*` names from Step 2, and exit 0. A `[name] …` error line is a failed shot. Read the message:
- a wait that timed out on `[data-rp-harness-ready]` means `driveHarness` rejected; the page error line above it says which wait;
- `the &draw knob wants one of …` is a mistyped shot.

If the command does not finish within the tool's timeout, run it again backgrounded and read its output file when it exits. Do not poll with `pgrep`, which Git Bash lacks.

- [ ] **Step 13: Open every designer capture and note what looks wrong**

Open each file with the Read tool. A capture counts only once opened. There are thirty:

- **Resting state:** `asset-designer-dark`, `-light`, `-narrow`
- **Presets:** `asset-designer-preset-curved-table`, `-sofa`, `-toilet`, `-tree`
- **Selection modes:** `asset-designer-select-transform`, `-transform-light`, `-transform-unframed`, `-points`, `-points-light`, `-bend`, `-bend-dark`
- **Selected parts:** `asset-designer-select-anchor`, `-anchor-light`, `-footprint`, `-footprint-light`, `-clearance`, `-clearance-light`, `-facing`, `-facing-light`
- **Narrow inspector:** `asset-designer-select-narrow`, `-narrow-de`
- **Pending:** `asset-designer-pending`, `-pending-anchor-light`
- **Draw previews:** `asset-designer-draw-rect`, `-draw-rect-light`, `-draw-circle`, `-draw-trace-detail`

For each, write down against its name:
- spacing and alignment in the toolbar, mode group, inspector section and status region;
- wrapping and overflow — `-narrow`, `-narrow-de`, and the German mode labels `Punkte bearbeiten` and `Kanten biegen` beside the tools;
- clipped labels;
- contrast: handle stroke against fill and against the canvas ground, the accent outline, the dashed draw preview, `--text-warning` on `--background-secondary`;
- hit size of the mode buttons and inspector buttons;
- handle legibility at the framed camera (every shot) against the unframed one (`-transform-unframed`): can the nine Transform handles be told apart, and do they overlap the part;
- whether the preset shots are now framed. This is the A5 check: the curved table must not be clipped.

Also note the Shift hint's absence under Select. Task 4 fixes it, so it is expected in these captures.

- [ ] **Step 14: Critique with the impeccable skill**

Invoke the `impeccable` skill (Skill tool) for a critique. Hand it the opened captures and these five subjects:
1. the designer toolbar (`DesignerToolbar.vue`);
2. the mode control (`DesignerSelectionModes.vue`);
3. the selection marks (`layers/selectionLayer.ts`: ring, box, vertex and edge handles, accent outline);
4. the inspector section (`inspector/DesignerSelectionInspector.vue` and `styles/designer-selection.css`);
5. the draw previews (`layers/DesignerGestureLayer.vue`, `editor/layers/GestureSketch.vue`).

Also ask it to look at the inspector's own focus behaviour, which no capture can show: Bring forward and Send backward disable the focused button at the end of the order.

- [ ] **Step 15: Write the numbered findings**

Create `.superpowers/sdd/2026-09-14-asset-designer-selection-polish/task-1-critique.md` (create the directory if needed). The file holds one heading and one entry per finding, numbered from 1:

```markdown
# Task 1 critique — asset designer selection polish

## 1. <one-line title>

- **What:** <the defect, in one or two sentences>
- **Shown by:** <capture name(s), or "not capturable — <why>">
- **Severity:** <blocker | major | minor | polish>
- **Proposed change:** <the concrete change, within repo rules: Obsidian CSS variables only (canvas colours through `ThemeTokens`), no inline styles, sentence-case English, en AND de strings in `locales/{en,de}/assetSymbols.ts`, accessible names unchanged or improved, keyboard reach, style partials ≤ 400 raw lines, `src` files ≤ 400 ESLint lines — and the file(s) it touches>
```

Record a finding only if a capture or the skill's critique supports it. Record "nothing wrong" for a subject rather than omitting it. Where Tasks 2–5 already fix a finding (the ring under a non-Select tool, pending fields, the Select hint and tooltips, focus after Duplicate or Delete), cite the task instead of proposing a change.

Run: `git status --short`

Expected: the critique file does not appear. `/.superpowers/` is ignored, so it is not committed.

---

### Task 2: Keep the anchor and facing ring under every tool

Follow-up A1.

**Files:**
- Modify: `src/presentation/designer/DesignerCanvas.vue:59-66` (imports) and `:139-147` (the `marks` computed and its docblock)
- Test: `tests/presentation/designer/layers.test.ts`, directly after the case `draws a selected detail’s outline and its nine Transform handles under Select, and only the outline under another tool` (`:485-505`)

**Interfaces:**
- Consumes: `isOutlineSelection(selection: DesignerSelection | null): selection is OutlinePart` from `src/presentation/designer/selection/designerSelection.ts` (exists).
- Produces: nothing new. The canvas keeps its selection marks when the tool is Select OR the selection is not an outline.

- [ ] **Step 1: Write the failing test**

Insert after the case ending at `:505` (the file already imports `designerRig`, `useAssetDesignStore`, `t` and `settle`; `WITH_DETAILS` is its `AssetShape` fixture at `:73`):

```ts
	/**
	 * The anchor's and the facing's ring is that selection's ONLY mark — neither has an outline to restroke
	 * — so it stays under every tool, as an outline selection's accent restroke does (follow-up A1).
	 */
	it.each([['anchor'], ['facing']] as const)('keeps the %s ring under Draw rectangle, its only selection mark', async (kind) => {
		const designer = await designerRig({ shape: WITH_DETAILS });
		designer.toolbarButton(t('en', 'designer.toolbar.select')).click();
		useAssetDesignStore(designer.pinia).select({ kind });
		await settle();

		expect(designer.stage.find('.asset-selection-handle')).toHaveLength(1);
		expect(designer.stage.findOne('.asset-selection-outline')).toBeUndefined();

		designer.toolbarButton(t('en', 'designer.toolbar.draw-rect')).click();
		await settle();

		expect(designer.stage.find('.asset-selection-handle')).toHaveLength(1);
		designer.unmount();
	});
```

- [ ] **Step 2: Run it to watch it fail**

Run: `npm run check:fast -- tests/presentation/designer/layers.test.ts`

Expected: FAIL, 2 failed. Both `keeps the anchor ring…` and `keeps the facing ring…` fail with `AssertionError: expected [] to have a length of 1 but got +0`, at the assertion after Draw rectangle.

- [ ] **Step 3: Implement**

In `DesignerCanvas.vue`, add beside the other `./selection` and `./layers` imports:

```ts
import { isOutlineSelection } from './selection/designerSelection';
```

Replace `:139-147`:

```ts
/**
 * Handles and the anchor/facing ring only under Select, the one tool that grabs them: under another
 * tool a drawn handle is a control that does nothing. The accent outline stays, so a user drawing
 * still sees what is selected.
 */
const marks = computed(() => {
	const drawn = selectionMarks(shape.value, selection.value, mode.value, tokens.value, worldPerPixel.value);
	return activeToolId.value === 'select' ? drawn : { outline: drawn.outline, handles: [] };
});
```

with:

```ts
/**
 * An outline's handles only under Select, the one tool that grabs them: under another tool a drawn handle
 * is a control that does nothing. What stays is what SHOWS the selection — an outline's accent restroke,
 * and the anchor's or the facing's ring, which is that selection's only mark (follow-up A1). With nothing
 * selected `selectionMarks` draws nothing, so that case needs no arm here.
 */
const marks = computed(() => {
	const drawn = selectionMarks(shape.value, selection.value, mode.value, tokens.value, worldPerPixel.value);
	return activeToolId.value === 'select' || !isOutlineSelection(selection.value) ? drawn : { outline: drawn.outline, handles: [] };
});
```

- [ ] **Step 4: Run it to watch it pass**

Run: `npm run check:fast -- tests/presentation/designer/layers.test.ts tests/presentation/designer/selectionLayer.test.ts`

Expected: PASS, every case including the neighbouring "only the outline under another tool" case.

- [ ] **Step 5: Lint, budgets, fallow**

Run: `npx eslint src/presentation/designer/DesignerCanvas.vue tests/presentation/designer/layers.test.ts`

Expected: no output.

Budgets (ESLint lines): `DesignerCanvas.vue` 162 → 163 of 400; `layers.test.ts` 345 → ≈ 358 of 450.

Run: `npx fallow dead-code` then `npx fallow dupes`. Expected: nothing naming these files.

- [ ] **Step 6: Commit**

```bash
git add src/presentation/designer/DesignerCanvas.vue tests/presentation/designer/layers.test.ts
git commit -m "$(cat <<'EOF'
fix(designer): keep the anchor and facing ring under every tool

The ring is the only mark an anchor or facing selection has, so dropping it under a non-Select
tool left the selection shown nowhere on the canvas. Outline handles still draw only under Select.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

**Captures this changes:** none of the fixed shots. Every anchor and facing shot is taken under Select, and no shot holds a non-Select tool with the anchor or facing selected. The captures stay as Task 1 took them.

---

### Task 3: Hide a pending part's millimetre fields

Follow-up A2.

**Files:**
- Modify: `src/presentation/designer/inspector/DesignerSelectionInspector.vue`:
  - header docblock `:3-7`;
  - `fields` and `selectedDetails` `:129-152` (move `selectedDetails` above `fields`, add `pendingPart`);
  - template, after the `<h3>` at `:209-211`
- Modify: `src/presentation/i18n/locales/en/assetSymbols.ts` (one key, before `} as const;`)
- Modify: `src/presentation/i18n/locales/de/assetSymbols.ts` (one key, before `};`)
- Test: `tests/presentation/designer/designerSelectionInspector.test.ts`, inside `describe('what the inspector offers for each kind of part')`, after the footprint case at `:140-149`

**Interfaces:**
- Consumes: `AssetDetail.pending` (`src/domain/asset/AssetDetail.ts:24`), `AssetShape.anchorPending` (`src/domain/asset/AssetShape.ts:26`).
- Produces:
  - locale key `designer.selection.unscaled`;
  - in `DesignerSelectionInspector.vue`, a computed `pendingPart`: true for the anchor when `anchorPending`, and for a detail when that detail is pending;
  - the inspector section draws `<p class="rp-designer-unscaled">` exactly when `pendingPart` holds.

Task 5 edits the same component, and its code is written against this task's result.

- [ ] **Step 1: Write the failing tests**

Insert after the case ending at `:149` (it uses the file's own `mountFor`, `numberFields`, `buttons`, `nameField`, `TOILET`, `BOWL`, `mount`, `assetDesign`, `vi`, `ShapeEdit`, `DispatchResult`, `DesignerSelection` and `t`):

```ts
	/**
	 * A pending detail's or anchor's numbers are placeholder pixels too, which calibration later multiplies
	 * (spec Amendment 2) — so its millimetre fields are withheld as a pending footprint's are, one line says
	 * why, and everything that is not a length stays.
	 */
	it('offers only Rotation for a pending detail, keeps its name, line and actions, and says why', () => {
		const pendingBowl = { ...TOILET, details: TOILET.details.map((detail) => (detail.id === 'detail-2' ? { ...detail, pending: true } : detail)) };
		const { wrapper } = mountFor(BOWL, pendingBowl);

		expect(numberFields(wrapper)).toEqual({ 'rotate-by': '0' });
		expect(buttons(wrapper)).toEqual(['bring-forward', 'send-backward', 'duplicate', 'delete']);
		expect(nameField(wrapper)).toBe(t('en', 'designer.detail.bowl'));
		expect(wrapper.find('[name="detail-line"]').exists()).toBe(true);
		expect(wrapper.find('.rp-designer-unscaled').text()).toBe(t('en', 'designer.selection.unscaled'));
	});

	it('offers no position for a pending anchor, and says why', () => {
		const { wrapper } = mountFor({ kind: 'anchor' }, { ...TOILET, anchorPending: true });

		expect(numberFields(wrapper)).toEqual({});
		expect(wrapper.find('.rp-designer-unscaled').text()).toBe(t('en', 'designer.selection.unscaled'));
	});

	/** Every arm that is NOT pending: the flag read is the SELECTED part's, never a neighbour's. */
	it.each([
		['a detail', BOWL, TOILET],
		['a detail beside a pending one', BOWL, { ...TOILET, details: TOILET.details.map((detail) => (detail.id === 'detail-1' ? { ...detail, pending: true } : detail)) }],
		['the anchor', { kind: 'anchor' }, TOILET],
		['the facing of a design whose anchor is pending', { kind: 'facing' }, { ...TOILET, anchorPending: true }],
	] as const)('keeps every field and draws no unscaled line for %s', (_name, selection, shape) => {
		const { wrapper } = mountFor(selection, shape);

		expect(Object.keys(numberFields(wrapper)).length).toBeGreaterThan(selection.kind === 'detail' ? 1 : 0);
		expect(wrapper.find('.rp-designer-unscaled').exists()).toBe(false);
	});

	/** The footprint arm is unchanged: its warning is `DesignerInspector`'s Dimensions block, not a second line here. */
	it('leaves the pending footprint as it was: no size fields and no unscaled line in the section', () => {
		const wrapper = mount(DesignerSelectionInspector, {
			props: {
				design: assetDesign({ shape: { ...TOILET, footprintOrigin: 'traced', footprintPending: true }, dimensionsUnscaled: true }),
				selection: { kind: 'footprint' },
				editShape: vi.fn<(edit: ShapeEdit) => Promise<DispatchResult>>(),
				select: vi.fn<(next: DesignerSelection | null) => void>(),
			},
		});

		expect(numberFields(wrapper)).toEqual({});
		expect(buttons(wrapper)).toEqual(['fit-to-details']);
		expect(wrapper.find('.rp-designer-unscaled').exists()).toBe(false);
	});
```

- [ ] **Step 2: Run them to watch them fail**

Run: `npx vitest run tests/presentation/designer/designerSelectionInspector.test.ts --testTimeout=20000`

Expected FAIL, 2 failed:
- `offers only Rotation for a pending detail…` with `AssertionError: expected { 'centre-x': '0', …(4) } to deeply equal { 'rotate-by': '0' }`;
- `offers no position for a pending anchor…` with `AssertionError: expected { Object (position-x, position-y) } to deeply equal {}`.

The five not-pending cases pass already; they pin the arms the change must not disturb. (`npm run check:fast` stops earlier, at `vue-tsc` `TS2345`, because `'designer.selection.unscaled'` is not yet a `StringKey`.)

- [ ] **Step 3: Add the strings**

`src/presentation/i18n/locales/en/assetSymbols.ts`, before `} as const;`:

```ts
	// A pending detail's or anchor's millimetre fields are withheld (spec Amendment 2); this says why, under the section heading.
	'designer.selection.unscaled': 'This part was captured before a scale existed, so its measurements are hidden until the asset is calibrated.',
```

`src/presentation/i18n/locales/de/assetSymbols.ts`, before `};`:

```ts
	'designer.selection.unscaled': 'Dieser Teil wurde erfasst, bevor ein Maßstab vorlag; seine Maße bleiben ausgeblendet, bis das Objekt kalibriert ist.',
```

(`Maßstab vorlag` follows `designer.inspector.dimensions.unscaled` in `de.ts`; `Objekt` is the German locale's word for an asset.)

- [ ] **Step 4: Implement**

In `DesignerSelectionInspector.vue`'s header docblock, replace the first paragraph's opening (`:3-7`):

```ts
 * The inspector for ONE selected part (asset designer symbols spec, "Inspector for the selection",
 * and Amendment 1): a detail's name, line, centre, size and a rotate-by field, with ordering,
 * duplicate and delete; the footprint's size (withheld while it is pending, whose numbers are
 * placeholder pixels) and Fit to details; the clearance's delete; the anchor's position; the facing's
 * angle.
```

with:

```ts
 * The inspector for ONE selected part (asset designer symbols spec, "Inspector for the selection",
 * and Amendments 1 and 2): a detail's name, line, centre, size and a rotate-by field, with ordering,
 * duplicate and delete; the footprint's size and Fit to details; the clearance's delete; the anchor's
 * position; the facing's angle. A PENDING part's lengths — a footprint's size, a detail's centre and size,
 * the anchor's position — are placeholder pixels, so they are withheld.
```

Replace the block from `const fields = computed(` through the end of `selectedDetails` (`:129-152`). Today it reads:

```ts
const fields = computed((): readonly NumberField[] => {
	const selection = props.selection;
	switch (selection.kind) {
		case 'detail':
			return detailFields(selection);
		case 'footprint':
			// A pending footprint's numbers are placeholder pixels; the Dimensions block below says so.
			return props.design.dimensionsUnscaled ? [] : sizeFields(selection);
		case 'clearance':
			return [];
		case 'anchor':
			return anchorFields();
		default: {
			// Exhaustive at compile time: a new kind of selection reaches this line and fails to narrow.
			const _facing: 'facing' = selection.kind;
			return [{ name: 'angle', label: 'designer.selection.angle', value: (shape.value.facing * 180) / Math.PI, edit: (value) => (current) => setFacing(current, radians(value)) }];
		}
	}
});

/** The selected detail as a one-item list, so the template's closures see it without a narrowing to lose. */
const selectedDetails = computed(() =>
	shape.value.details.filter((item) => props.selection.kind === 'detail' && item.id === props.selection.id),
);
```

Replace it with:

```ts
/** The selected detail as a one-item list, so the template's closures see it without a narrowing to lose. */
const selectedDetails = computed(() =>
	shape.value.details.filter((item) => props.selection.kind === 'detail' && item.id === props.selection.id),
);

/**
 * A detail or the anchor captured before a scale existed (spec Amendment 2): its numbers are placeholder
 * pixels that calibration later multiplies, so a millimetre typed beside them would be rescaled too. Its
 * length fields are withheld as a pending footprint's are, and one line says why. Rotation stays — it
 * commutes with calibration's uniform scale — and so do the name, the line and every action.
 *
 * The footprint is not asked here: its warning is `DesignerInspector`'s Dimensions block. The facing has
 * no pending flag, and `selectedDetails` is empty for every kind but a detail.
 */
const pendingPart = computed(() =>
	props.selection.kind === 'anchor' ? shape.value.anchorPending : selectedDetails.value.some((item) => item.pending),
);

const fields = computed((): readonly NumberField[] => {
	const selection = props.selection;
	switch (selection.kind) {
		case 'detail':
			return pendingPart.value ? detailFields(selection).filter((field) => field.name === 'rotate-by') : detailFields(selection);
		case 'footprint':
			// A pending footprint's numbers are placeholder pixels; the Dimensions block below says so.
			return props.design.dimensionsUnscaled ? [] : sizeFields(selection);
		case 'clearance':
			return [];
		case 'anchor':
			return pendingPart.value ? [] : anchorFields();
		default: {
			// Exhaustive at compile time: a new kind of selection reaches this line and fails to narrow.
			const _facing: 'facing' = selection.kind;
			return [{ name: 'angle', label: 'designer.selection.angle', value: (shape.value.facing * 180) / Math.PI, edit: (value) => (current) => setFacing(current, radians(value)) }];
		}
	}
});
```

In the template, directly after the section's `</h3>`:

```html
		<p
			v-if="pendingPart"
			class="rp-designer-unscaled"
		>
			{{ tr('designer.selection.unscaled') }}
		</p>
```

(`.rp-designer-unscaled` is `styles/designer.css:246`: `--text-warning`, small, the style the footprint's warning already wears. No CSS changes.)

- [ ] **Step 5: Run them to watch them pass**

Run: `npm run check:fast -- tests/presentation/designer/designerSelectionInspector.test.ts tests/presentation/designer/designerInspector.test.ts`

Expected: oxlint and vue-tsc clean; every case passes (the probe measured 7/7 for the new cases).

- [ ] **Step 6: Lint, budgets, fallow**

Run: `npx eslint src/presentation/designer/inspector/DesignerSelectionInspector.vue src/presentation/i18n/locales/en/assetSymbols.ts src/presentation/i18n/locales/de/assetSymbols.ts tests/presentation/designer/designerSelectionInspector.test.ts`

Expected: no output. `sentence-case-locale-module` passes both strings, measured through `eslint --stdin`.

Budgets:
- `DesignerSelectionInspector.vue` 223 → ≈ 228 ESLint lines of 400;
- `designerSelectionInspector.test.ts` 262 → ≈ 300 of 450;
- `en/assetSymbols.ts` 96 → 98 raw; `de/assetSymbols.ts` 93 → 94 raw.

`en.ts` and `de.ts` are untouched.

Run: `npx fallow dead-code` then `npx fallow dupes`. Expected: nothing naming these files.

- [ ] **Step 7: Commit**

```bash
git add src/presentation/designer/inspector/DesignerSelectionInspector.vue src/presentation/i18n/locales/en/assetSymbols.ts src/presentation/i18n/locales/de/assetSymbols.ts tests/presentation/designer/designerSelectionInspector.test.ts
git commit -m "$(cat <<'EOF'
fix(designer): withhold a pending part's millimetre fields and say why

A pending detail's centre and size and a pending anchor's position are placeholder pixels that
calibration later multiplies, so a millimetre typed there would be rescaled. The inspector hides
them as it already hides a pending footprint's size, keeps rotation, name, line and actions, and
shows one line explaining why.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

**Captures this changes:** `asset-designer-pending` (the detail section loses Horizontal/Vertical centre, Width and Depth, and gains the line) and `asset-designer-pending-anchor-light` (the anchor section loses both position fields and gains the line).

---

### Task 4: A Select hint per mode, and mode-button tooltips

Covers A3 and Part C item 4.

**Files:**
- Modify: `src/presentation/designer/AssetDesignerRoot.vue`:
  - imports `:49-59`;
  - the docblock and computed at `:127-141`;
  - the status span at `:506-510`
- Modify: `src/presentation/designer/DesignerSelectionModes.vue` (docblock `:2-18`, `MODES` `:26-30`, `:title` `:46`)
- Modify: `src/presentation/i18n/locales/en/assetSymbols.ts` (four keys)
- Modify: `src/presentation/i18n/locales/de/assetSymbols.ts` (four keys)
- Test: `tests/presentation/designer/designerToolbar.test.ts`: two new cases in `describe('the shift hint')` (`:219-239`) and a new `describe('the selection mode buttons')` after it

**Interfaces:**
- Consumes: `constrainsAngle(id)` (`editor/snapping/editorSnapping.ts`, unchanged and NOT extended), `isOutlineSelection`, `useAssetDesignStore().selection` and `.mode`.
- Produces:
  - locale keys `designer.hint.shift-transform`, `designer.selection.mode.transform.tip`, `designer.selection.mode.points.tip`, `designer.selection.mode.bend.tip`;
  - `AssetDesignerRoot`'s `hintKey: ComputedRef<StringKey | null>`, which replaces `showsConstraintHint`;
  - each mode button's `title` is its tip; its text, and so its accessible name, is unchanged.

**What was measured to decide the scope:**
- **What Shift does under designer Select** (`designer-select-tool.ts:229-235` passes it only into `draggedShape`):
  - Transform box handle: keeps proportions (`selectionDrag.ts` `boxResize`, "both factors become whichever strays further from 1");
  - rotate handle: snaps the rotation (`snapRotation`);
  - facing drag: snaps the bearing, in any mode;
  - body drag, vertex drag, bend and anchor drag: nothing (`CurveTool.ts` has no Shift).
- **The status-bar hint vocabulary** on both surfaces is `editor.hint.constrain-angle` (a modifier), `editor.hint.pan` (a modifier or button) and `editor.hint.paused` (a standing state) (`StatusBar.vue:136-154`). None describes a gesture. Edit points and Bend edges take no modifier, so a hint there would break that vocabulary. **Decision: no status hint for Edit points or Bend edges.** Their gestures go into the mode buttons' tooltips, where the control that picks the mode lives. The hint stays one span, `.rp-designer-hint`.
- **The tooltip mechanism** in both designer toolbars is the `title` attribute (`DesignerToolbar.vue:72,83,92`, `DesignerSelectionModes.vue:46`). `setTooltip` and `data-tooltip-position` appear nowhere under `src/presentation`. With visible text content, `title` becomes the accessible DESCRIPTION, and the name stays the text, so the exact-list toolbar tests are unaffected.
- **Plan editor files are not touched.** `tests/presentation/editor/shell.test.ts:121-140` (no constrain hint under plan Select) is run as a guard.

- [ ] **Step 1: Write the failing tests**

In `tests/presentation/designer/designerToolbar.test.ts`, add to the imports:

```ts
import { useAssetDesignStore } from '../../../src/presentation/designer/stores/assetDesignStore';
import { toiletShape } from '../../helpers/assetShapes';
```

Inside `describe('the shift hint', () => {`, after `is absent in camera mode, where no key would do anything`, add:

```ts
	/**
	 * Under Select the hint says what Shift does to the gesture the selection offers (spec Amendment 2),
	 * decided in `AssetDesignerRoot` and never by adding `select` to the shared constrain list — `select` is
	 * the plan editor's id too, and its status bar pins no constrain hint under Select. Transform on an
	 * outline: Shift keeps proportions and snaps the rotation. The facing: Shift constrains its angle.
	 * Edit points, Bend edges, the anchor and no selection: Shift does nothing, so nothing is said.
	 */
	it('says what Shift does under Select, for the part and the mode selected', async () => {
		const rig = await designerRig({ shape: toiletShape() });
		const hint = () => rig.wrapper.find('.rp-designer-hint');
		const store = useAssetDesignStore(rig.pinia);

		await press(rig, 'designer.toolbar.select');
		expect(hint().exists()).toBe(false);

		store.select({ kind: 'detail', id: 'detail-2' });
		await settle();
		expect(hint().text()).toBe(t('en', 'designer.hint.shift-transform'));

		store.setMode('points');
		await settle();
		expect(hint().exists()).toBe(false);

		store.setMode('bend');
		await settle();
		expect(hint().exists()).toBe(false);

		store.select({ kind: 'facing' });
		await settle();
		expect(hint().text()).toBe(t('en', 'editor.hint.constrain-angle'));

		store.select({ kind: 'anchor' });
		await settle();
		expect(hint().exists()).toBe(false);
		rig.unmount();
	});

	it('gives no Select hint under another tool, whatever is selected', async () => {
		const rig = await designerRig({ shape: toiletShape() });
		const hint = () => rig.wrapper.find('.rp-designer-hint');
		useAssetDesignStore(rig.pinia).select({ kind: 'detail', id: 'detail-2' });

		await press(rig, 'designer.toolbar.set-anchor');
		expect(hint().exists()).toBe(false);
		await press(rig, 'designer.toolbar.trace-detail');
		expect(hint().text()).toBe(t('en', 'editor.hint.constrain-angle'));
		await press(rig, 'designer.toolbar.pan');
		expect(hint().exists()).toBe(false);
		rig.unmount();
	});
```

After that `describe` block closes, add:

```ts
/**
 * A mode's gesture is invisible until tried: which handles a mode draws says nothing about what dragging
 * them does. Each mode button's tooltip names it — the `title` both designer toolbars already use — while
 * its text stays the accessible name the exact-list cases above read.
 */
describe('the selection mode buttons', () => {
	it('name the gesture each mode offers in a tooltip, and keep the mode as their accessible name', async () => {
		const rig = await designerRig({ shape: toiletShape() });
		await press(rig, 'designer.toolbar.select');
		useAssetDesignStore(rig.pinia).select({ kind: 'detail', id: 'detail-2' });
		await settle();

		const modes = rig.wrapper.findAll('.rp-designer-selection-modes button').map((button) => [button.text(), button.attributes('title')]);
		expect(modes).toEqual([
			[t('en', 'designer.selection.mode.transform'), t('en', 'designer.selection.mode.transform.tip')],
			[t('en', 'designer.selection.mode.points'), t('en', 'designer.selection.mode.points.tip')],
			[t('en', 'designer.selection.mode.bend'), t('en', 'designer.selection.mode.bend.tip')],
		]);
		rig.unmount();
	});
});
```

- [ ] **Step 2: Run them to watch them fail**

Run: `npx vitest run tests/presentation/designer/designerToolbar.test.ts --testTimeout=20000`

Expected FAIL, 2 failed:
- `says what Shift does under Select…` with `Error: Cannot call text on an empty DOMWrapper.` (no hint once the detail is selected);
- `name the gesture each mode offers in a tooltip…` with `AssertionError: expected [ [ 'Transform', 'Transform' ], …(2) ] to deeply equal [ [ 'Transform', …(1) ], …(2) ]`.

`gives no Select hint under another tool…` passes already; it pins arms that must survive. (`npm run check:fast` stops earlier, at `vue-tsc`, on the four new keys.)

- [ ] **Step 3: Add the strings**

`en/assetSymbols.ts`, before `} as const;` (after Task 3's key):

```ts
	// Under Select with an outline in Transform: a box handle keeps proportions and the rotate handle snaps (`selectionDrag.ts`).
	// Key first, as `editor.hint.constrain-angle` is: `sentence-case-locale-module` refuses a capitalised `Shift` mid-sentence.
	'designer.hint.shift-transform': 'Shift keeps proportions and snaps the rotation',
	// The mode buttons' tooltips name the gesture each mode offers; the button text stays the accessible name.
	'designer.selection.mode.transform.tip': 'Drag the part to move it, a square handle to resize it or the round handle to rotate it',
	'designer.selection.mode.points.tip': 'Drag a corner to move it; it snaps to the corners of the other parts and to the anchor',
	'designer.selection.mode.bend.tip': 'Drag the handle in the middle of an edge to curve that edge',
```

`de/assetSymbols.ts`, before `};`:

```ts
	'designer.hint.shift-transform': 'Umschalttaste erhält die Proportionen und rastet die Drehung ein',
	'designer.selection.mode.transform.tip': 'Den Teil ziehen, um ihn zu verschieben, einen eckigen Griff, um ihn zu skalieren, oder den runden Griff, um ihn zu drehen',
	'designer.selection.mode.points.tip': 'Eine Ecke ziehen, um sie zu verschieben; sie rastet an den Ecken der anderen Teile und am Ankerpunkt ein',
	'designer.selection.mode.bend.tip': 'Den Griff in der Mitte einer Kante ziehen, um diese Kante zu biegen',
```

(The tooltips were checked against the code:
- Transform draws eight SQUARE box handles and one ROUND rotate handle (`selectionLayer.ts` `mark` style; `handles.ts`).
- Edit points' vertex drag snaps to the footprint's and other details' vertices and to the anchor, never to the dragged part's own or to the clearance's (`snapCandidates.ts`).
- Bend edges' handles sit at each edge's midpoint (`handles.ts` `arcPoint(…, 0.5)`).
- The German avoids du-form imperatives, and `Umschalttaste` matches `de/editor.ts:269`.)

- [ ] **Step 4: Implement the hint**

In `AssetDesignerRoot.vue`, add to the imports:

```ts
import type { StringKey } from '../i18n/locales/en';
import { isOutlineSelection } from './selection/designerSelection';
```

Replace the docblock and computed at `:127-141`:

```ts
/**
 * The Shift constraint, advertised while a tool that takes it is active — asked of the ONE list
 * that holds that question (`editor/snapping/editorSnapping.ts`), which `StatusBar` asks for the
 * plan editor.
 *
 * A modifier is invisible: no control shows it and no menu lists it, which is the standing cost
 * of the convention every drawing tool in the field uses. This is the cheapest honest
 * mitigation — present while the gesture it applies to is available, gone the moment it is not
 * — and most of this surface's tools take it, so its absence would leave the constraint
 * mentioned nowhere on this surface at all.
 *
 * It sits in the status region rather than in the toolbar for `StatusBar`'s reason: the toolbar
 * says what you can DO, and this says what is true of the thing you are doing.
 */
const showsConstraintHint = computed(() => constrainsAngle(runtime.activeToolId.value));
```

with:

```ts
/**
 * What Shift does right now, or `null` when it does nothing. A tool that takes the angle constraint is
 * asked of the ONE list that holds that question (`editor/snapping/editorSnapping.ts`), which `StatusBar`
 * asks for the plan editor.
 *
 * **Select is answered HERE and never added to that list** (spec Amendment 2): `select` is the plan
 * editor's id too, and its status bar pins no constrain hint under Select. Under the designer's Select,
 * Shift is read only by `draggedShape`: a Transform box handle keeps proportions and its rotate handle
 * snaps, and a facing drag snaps its bearing in any mode. A body, vertex, bend or anchor drag ignores it, so
 * Edit points, Bend edges, the anchor and no selection say nothing — the modes' own gestures are named in
 * their buttons' tooltips (`DesignerSelectionModes.vue`), not here.
 *
 * A modifier is invisible: no control shows it and no menu lists it, which is the standing cost
 * of the convention every drawing tool in the field uses. This is the cheapest honest
 * mitigation — present while the gesture it applies to is available, gone the moment it is not.
 *
 * It sits in the status region rather than in the toolbar for `StatusBar`'s reason: the toolbar
 * says what you can DO, and this says what is true of the thing you are doing.
 */
const hintKey = computed<StringKey | null>(() => {
	const id = runtime.activeToolId.value;
	if (constrainsAngle(id)) return 'editor.hint.constrain-angle';
	if (id !== 'select') return null;
	const selected = selection.value;
	if (selected?.kind === 'facing') return 'editor.hint.constrain-angle';
	return isOutlineSelection(selected) && designStore.mode === 'transform' ? 'designer.hint.shift-transform' : null;
});
```

Replace the status span (`:507-510`):

```html
			<span
				v-if="showsConstraintHint"
				class="rp-designer-hint"
			>{{ tr('editor.hint.constrain-angle') }}</span>
```

with:

```html
			<span
				v-if="hintKey !== null"
				class="rp-designer-hint"
			>{{ tr(hintKey) }}</span>
```

- [ ] **Step 5: Implement the tooltips**

In `DesignerSelectionModes.vue`, add a paragraph to the docblock before its closing `*/`:

```ts
 *
 * **Each button's `title` names the gesture its mode offers** — which handles a mode draws says nothing
 * about what dragging them does — using the `title` tooltip both designer toolbars already use. The button's
 * TEXT stays its accessible name; a `title` beside visible text is read as its description.
```

Replace `MODES`:

```ts
const MODES: readonly { readonly id: SelectionMode; readonly label: StringKey; readonly tip: StringKey }[] = [
	{ id: 'transform', label: 'designer.selection.mode.transform', tip: 'designer.selection.mode.transform.tip' },
	{ id: 'points', label: 'designer.selection.mode.points', tip: 'designer.selection.mode.points.tip' },
	{ id: 'bend', label: 'designer.selection.mode.bend', tip: 'designer.selection.mode.bend.tip' },
];
```

and change `:title="tr(mode.label)"` to:

```html
			:title="tr(mode.tip)"
```

- [ ] **Step 6: Run them to watch them pass, plus the plan editor's guard**

Run: `npm run check:fast -- tests/presentation/designer/designerToolbar.test.ts tests/presentation/designer/designerDrawDetails.test.ts tests/presentation/designer/assetDesignerRoot.test.ts tests/presentation/editor/shell.test.ts tests/harness/accessibilityDesignerSelection.test.ts`

Expected: oxlint and vue-tsc clean; every case passes, including:
- `designerDrawDetails.test.ts`'s "advertises the Shift constraint…";
- `shell.test.ts`'s plan-editor case with no constrain hint under Select;
- the axe scan of a selected detail.

- [ ] **Step 7: Lint, budgets, fallow**

Run: `npx eslint src/presentation/designer/AssetDesignerRoot.vue src/presentation/designer/DesignerSelectionModes.vue src/presentation/i18n/locales/en/assetSymbols.ts src/presentation/i18n/locales/de/assetSymbols.ts tests/presentation/designer/designerToolbar.test.ts`

Expected: no output. `sentence-case-locale-module` passes all four strings in both locales, measured.

Budgets:
- `AssetDesignerRoot.vue` 269 → ≈ 277 ESLint lines of 400;
- `DesignerSelectionModes.vue` 32 → 32;
- `designerToolbar.test.ts` 123 → ≈ 172 of 450;
- locale files `en` → 104 raw, `de` → 98 raw.

Run: `npx fallow dead-code` then `npx fallow dupes`. Expected: nothing naming these files.

- [ ] **Step 8: Commit**

```bash
git add src/presentation/designer/AssetDesignerRoot.vue src/presentation/designer/DesignerSelectionModes.vue src/presentation/i18n/locales/en/assetSymbols.ts src/presentation/i18n/locales/de/assetSymbols.ts tests/presentation/designer/designerToolbar.test.ts
git commit -m "$(cat <<'EOF'
feat(designer): say what Shift does under Select, and name each mode's gesture

Under Select the status hint now reads "Shift keeps proportions and snaps the rotation" for an
outline in Transform and the constrain-angle hint for the facing, decided in AssetDesignerRoot
rather than in the shared CONSTRAINING_TOOLS list the plan editor also reads. The mode buttons'
tooltips name each mode's gesture; their accessible names are unchanged.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

**Captures this changes:**
- The status region gains "Shift keeps proportions and snaps the rotation" in every Transform-on-an-outline select shot: `asset-designer-select-transform`, `-transform-light`, `-transform-unframed`, `-footprint`, `-footprint-light`, `-clearance`, `-clearance-light`, `-narrow`, `-narrow-de` (German string) and `asset-designer-pending`.
- It gains "Shift constrains the angle" in `asset-designer-select-facing` and `-facing-light`.
- `-points`, `-points-light`, `-bend`, `-bend-dark`, the anchor shots and the draw shots are unchanged. `trace-detail` already showed the constrain hint.
- The tooltips do not appear in any capture: `harness-shot` hovers nothing.

---

### Task 5: Focus survives Duplicate and Delete in the inspector

Follow-up A4.

**Files:**
- Modify: `src/presentation/designer/inspector/DesignerInspector.vue:116-123` (the template comment, and the `<aside>` gains `tabindex="-1"`)
- Modify: `src/presentation/designer/inspector/DesignerSelectionInspector.vue`: the `vue` import, a `root` ref and an `onBeforeUnmount` hand-off after `refusal`, and `ref="root"` on the `<section>`. This is written against Task 3's result.
- Modify: `styles/designer-selection.css` (a `:focus-visible` ring for the aside, appended)
- Test: `tests/presentation/designer/designerSelectionInspector.test.ts`: imports; one case in `describe('what the inspector offers for each kind of part')`; one `it.each` in `describe('the inspector in the mounted designer')` (`:347-366`)
- Test: `tests/harness/accessibilityDesignerSelection.test.ts` (one axe case)

**Interfaces:**
- Consumes: `sameSelection` from `selection/designerSelection.ts` (exists); `settleUntil` from `tests/helpers/editor.ts` (re-exported from `settle.ts`); `HARNESS_SCAN_MS` and `runOptions` from `tests/harness/axeOptions.ts`.
- Produces:
  - `.rp-designer-inspector > aside` is programmatically focusable (`tabindex="-1"`, not a Tab stop);
  - when `DesignerSelectionInspector`'s section unmounts with focus inside it, focus moves to that aside on the next tick.

- [ ] **Step 1: Write the failing tests**

In `tests/presentation/designer/designerSelectionInspector.test.ts`, change two imports:

```ts
import { sameSelection, type DesignerSelection } from '../../../src/presentation/designer/selection/designerSelection';
```

```ts
import { settle, settleUntil } from '../../helpers/editor';
```

Inside `describe('what the inspector offers for each kind of part')`, after `draws nothing for a part the shape lacks`, add:

```ts
	/** The section draws nothing for a part the shape lacks, so its unmount has no element to ask about focus. */
	it('unmounts a section drawn for a part the shape lacks without reaching for focus', () => {
		const { wrapper } = mountFor({ kind: 'detail', id: 'detail-9' });

		expect(() => wrapper.unmount()).not.toThrow();
	});
```

Inside `describe('the inspector in the mounted designer')`, after the existing case, add:

```ts
	/**
	 * Spec Amendment 2: Delete prunes the selection and Duplicate selects the copy, and either unmounts the
	 * section under the very button that was pressed — so focus goes to the inspector rather than to the
	 * page, and the next Tab continues from there. Clearance Delete is the other Delete in the section.
	 */
	it.each([
		['delete', BOWL],
		['delete', { kind: 'clearance' }],
		['duplicate', BOWL],
	] as const)('hands focus to the inspector after %s on %o', async (name, selection) => {
		const rig = await designerRig({ shape: TOILET });
		try {
			const store = useAssetDesignStore(rig.pinia);
			store.select(selection);
			await settle();
			const button = rig.wrapper.find(`.rp-designer-selection [name="${name}"]`).element as HTMLButtonElement;
			button.focus();
			button.click();
			await settleUntil(() => !sameSelection(store.selection, selection), `${name} to land`);
			await settle();

			expect(document.activeElement).toBe(rig.wrapper.find('.rp-designer-inspector aside').element);
		} finally {
			rig.unmount();
		}
	});
```

In `tests/harness/accessibilityDesignerSelection.test.ts`, change `import { settle } from '../helpers/editor';` to `import { settle, settleUntil } from '../helpers/editor';`, and append:

```ts
/** After Delete hands focus to the inspector (spec Amendment 2): the focused `tabindex="-1"` landmark scans clean. */
it('reports no violations once Delete has handed focus to the inspector', { timeout: HARNESS_SCAN_MS }, async () => {
	const rig = await designerRig({ shape: toiletShape() });
	try {
		const store = useAssetDesignStore(rig.pinia);
		store.select({ kind: 'detail', id: 'detail-2' });
		await settle();
		const button = rig.wrapper.find('.rp-designer-selection [name="delete"]').element as HTMLButtonElement;
		button.focus();
		button.click();
		await settleUntil(() => store.selection === null, 'the delete to land');
		await settle();

		expect(document.activeElement).toBe(rig.wrapper.find('.rp-designer-inspector aside').element);
		const results = await axe.run(rig.wrapper.element as HTMLElement, runOptions);

		expect(results.violations).toEqual([]);
	} finally {
		rig.unmount();
	}
});
```

- [ ] **Step 2: Run them to watch them fail**

Run: `npm run check:fast -- tests/presentation/designer/designerSelectionInspector.test.ts tests/harness/accessibilityDesignerSelection.test.ts`

Expected FAIL, 4 failed: the three `hands focus to the inspector after …` cases and `reports no violations once Delete has handed focus…`. Each fails with `AssertionError: expected <body><div>…(1)</div></body> to be <aside aria-label="Inspector">…</aside> // Object.is equality`.

`unmounts a section drawn for a part the shape lacks…` passes both before and after. It exists to drive the hand-off's `null`-section arm, which the coverage floor counts.

- [ ] **Step 3: Make the aside a surviving target**

In `DesignerInspector.vue`, replace the comment and opening tag at `:116-123`:

```html
	<!--
		No class here: this `<aside>` is the whole content of `AssetDesignerRoot.vue`'s
		`.rp-designer-inspector` div (padding, background, border-left already there, and no
		sibling this element needs to stand out from), so an own class would style nothing and
		the widened `libraryComponentStyles.test.ts` scan would keep flagging it undeclared. Kept
		as a landmark for its `aria-label`, dropped as a class.
	-->
	<aside :aria-label="tr('designer.inspector')">
```

with:

```html
	<!--
		No class here: this `<aside>` is the whole content of `AssetDesignerRoot.vue`'s
		`.rp-designer-inspector` div (padding, background, border-left already there, and no
		sibling this element needs to stand out from), so an own class would style nothing and
		the widened `libraryComponentStyles.test.ts` scan would keep flagging it undeclared. Kept
		as a landmark for its `aria-label`, dropped as a class.

		`tabindex="-1"` makes it a surviving focus TARGET and not a Tab stop (spec Amendment 2):
		`DesignerSelectionInspector` hands focus here when Delete or Duplicate unmounts the button
		that had it — the plan editor's `EntityInspector` aside, for the same reason.
	-->
	<aside
		tabindex="-1"
		:aria-label="tr('designer.inspector')"
	>
```

- [ ] **Step 4: Hand focus over when the section unmounts**

In `DesignerSelectionInspector.vue`, change the Vue import:

```ts
import { computed, nextTick, onBeforeUnmount, ref } from 'vue';
```

After `const refusal = ref<AppError | null>(null);` add:

```ts
/** The section's own element; `null` only while `exists` is false and the section renders nothing. */
const root = ref<HTMLElement | null>(null);

/**
 * **A browser drops focus to `<body>` when the focused control unmounts** (spec Amendment 2), and both
 * inspector actions that change the selection unmount this section under the button that was pressed:
 * Delete's write prunes the selection, and Duplicate selects the copy, which re-keys the section. So focus
 * goes to the inspector's `<aside>` — `tabindex="-1"`, a surviving target and not a Tab stop — and the next
 * Tab continues from the inspector rather than from the top of the pane. `NewRoomInspector`'s hand-off on
 * the plan editor, on the next tick for the same reason: the aside outlives this section.
 *
 * `closest` answers `null` for a section mounted outside the inspector, and focus elsewhere leaves focus
 * alone; a section that drew nothing (`root` is `null`) has nothing to ask.
 */
onBeforeUnmount(() => {
	const section = root.value;
	const aside = section !== null && section.contains(document.activeElement) ? section.closest<HTMLElement>('aside') : null;
	if (aside !== null) void nextTick(() => aside.focus());
});
```

In the template, add `ref="root"` to the section:

```html
	<section
		v-if="exists"
		ref="root"
		class="rp-designer-selection"
		:data-kind="selection.kind"
	>
```

- [ ] **Step 5: Show a keyboard user where focus went**

No focus style exists today for either inspector aside: `grep -rn "rp-editor-inspector.*focus" styles/` finds only the lock toggle. Obsidian's global `:focus { outline: none }` removes the default ring (`styles/designer.css`'s toolbar comment). A keyboard user who presses Delete must be able to see where focus landed, and `:focus-visible` keeps the ring off a mouse user's click. Append to `styles/designer-selection.css`:

```css
/*
 * The inspector itself takes focus when Delete or Duplicate removes the control that had it (spec
 * Amendment 2) — a hand-off TARGET with `tabindex="-1"`, not a Tab stop. The accent ring every designer
 * control wears, for the contrast reason `designer.css`'s toolbar `:focus-visible` comment measures, inset
 * so the panel's own scroll box does not clip it. `:focus-visible` keeps it off a mouse user's click.
 */
.rp-designer-inspector > aside:focus-visible {
	outline: 2px solid var(--interactive-accent);
	outline-offset: -2px;
}
```

- [ ] **Step 6: Run them to watch them pass**

Run: `npm run check:fast -- tests/presentation/designer/designerSelectionInspector.test.ts tests/harness/accessibilityDesignerSelection.test.ts tests/presentation/designer/designerInspector.test.ts tests/presentation/designer/assetDesignerRoot.test.ts`

Expected: oxlint and vue-tsc clean; every case passes (the probe measured 5/5 for the new cases).

Run: `npm run build`

Expected: exit 0. This is the stylesheet assembler's check: a partial within 400 raw lines, no colour literal.

- [ ] **Step 7: Lint, budgets, fallow**

Run: `npx eslint src/presentation/designer/inspector/DesignerInspector.vue src/presentation/designer/inspector/DesignerSelectionInspector.vue tests/presentation/designer/designerSelectionInspector.test.ts tests/harness/accessibilityDesignerSelection.test.ts`

Expected: no output.

Budgets:
- `DesignerInspector.vue` 128 → ≈ 128 ESLint lines of 400;
- `DesignerSelectionInspector.vue` ≈ 228 (after Task 3) → ≈ 236 of 400;
- `designerSelectionInspector.test.ts` ≈ 300 → ≈ 325 of 450;
- `accessibilityDesignerSelection.test.ts` 19 → ≈ 37 of 450;
- `styles/designer-selection.css` 61 → 72 raw lines of 400.

Run: `npx fallow dead-code` then `npx fallow dupes`. Expected: nothing naming these files.

- [ ] **Step 8: Commit**

```bash
git add src/presentation/designer/inspector/DesignerInspector.vue src/presentation/designer/inspector/DesignerSelectionInspector.vue styles/designer-selection.css tests/presentation/designer/designerSelectionInspector.test.ts tests/harness/accessibilityDesignerSelection.test.ts
git commit -m "$(cat <<'EOF'
fix(designer): keep keyboard focus in the inspector after Duplicate or Delete

Both actions unmount the section under the pressed button, dropping focus to the body. The
inspector aside is now a tabindex="-1" hand-off target, the section focuses it on unmount when
focus was inside, and a :focus-visible accent ring shows a keyboard user where focus went.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

**Captures this changes:** none. No URL reaches the focus hand-off, because `harness-shot` presses nothing in the inspector, and the ring draws only after a keyboard-driven Delete or Duplicate. The remaining focus gap — Bring forward or Send backward disabling the focused button at the end of the order — is out of this task's scope. Task 1's critique is asked to judge it.

### Task 6: Preview fixes and the peer-refusal pins

Rulings B3, B7 and B9. **Verified red and green by probe** (throwaway copies at `724dc13d`, deleted). The one exception is the B9 assertions: they pass today by design, because they pin the route a refusal already takes.

**Files:**
- Modify: `src/presentation/designer/stores/assetDesignStore.ts:92-97` (`select`)
- Modify: `src/presentation/designer/tools/designer-select-tool.ts:82-88` (header docblock), `:190-195` (`pointerUp`)
- Test: `tests/presentation/designer/assetDesignStoreSelection.test.ts:44-50` (flip the pin)
- Test: `tests/presentation/designer/designerSelection.test.ts` (imports; a new case in `describe('dragging a selected part')` after its first case; two assertions in the peer case, lines 105-123). The `describe('the mode control')` block is not touched.
- Test: `tests/presentation/designer/tools/designerSelectTool.test.ts:119-122` (the preview count), and a new case in `describe('moving a part')`

**Interfaces:**
- Consumes: nothing from Tasks 1–5.
- Produces: `useAssetDesignStore().select(next)` no longer writes `preview`. `DesignerSelectTool.pointerUp` calls `setPreview` with the release shape before it commits. No signature changes.

- [ ] **Step 1: Flip the store pin**

In `tests/presentation/designer/assetDesignStoreSelection.test.ts`, replace:

```ts
	it('drops an in-flight preview whenever a selection is chosen', () => {
		const store = useAssetDesignStore();
		store.setPreview(toiletShape());
		expect(store.preview).not.toBeNull();
		store.select(null);
		expect(store.preview).toBeNull();
	});
```

with:

```ts
	/**
	 * A preview belongs to the gesture that drew it, which clears it itself — a drag's commit once its
	 * write has settled. A click landing while that write is in flight must not wipe it, or the canvas
	 * jumps back to the stored shape until the refresh lands.
	 */
	it('leaves a preview it did not draw when a selection is chosen', () => {
		const store = useAssetDesignStore();
		const drawn = toiletShape();
		store.setPreview(drawn);
		store.select(null);
		expect(store.preview).toBe(drawn);
	});
```

- [ ] **Step 2: Add the mounted preview case and the B9 assertions**

In `tests/presentation/designer/designerSelection.test.ts`, add these three imports beside the existing ones:

```ts
import { useSaveStateStore } from '../../../src/presentation/editor/save-state/save-state-store';
import { activateNotices } from '../../../src/presentation/notices/notify';
import { Notice } from '../../helpers/obsidian-mock';
```

Insert this case directly after `it('moves the bowl in one write that one Undo takes back', …)`:

```ts
	/**
	 * A click made while a drag's write is still in flight must not clear the drag's preview: the design
	 * is still the pre-write one, so the canvas would draw the bowl back where it started until the
	 * refresh lands. The drag's own commit clears the preview once its write has settled.
	 */
	it('leaves a drag’s preview standing when a click lands before its write does', async () => {
		const rig = await designerRig({ shape: TOILET });
		await press(rig, 'designer.toolbar.select');
		const moved = { x: IN_BOWL.x + 100, y: IN_BOWL.y };

		drag(rig, IN_BOWL, moved);
		click(rig, moved);
		expect(useAssetDesignStore(rig.pinia).preview).not.toBeNull();

		await settle();
		expect(useAssetDesignStore(rig.pinia).preview).toBeNull();
		expectNear(await detailPoints(rig, 'detail-2'), BOWL.points.map((point) => ({ x: point.x + 100, y: point.y })));
		rig.unmount();
	});
```

Replace the whole peer case (`it('refuses a drag made against a design a peer rewrote mid-gesture', …)`) with:

```ts
	it('refuses a drag made against a design a peer rewrote mid-gesture', async () => {
		const rig = await designerRig({ shape: TOILET });
		await press(rig, 'designer.toolbar.select');
		click(rig, IN_BOWL);
		await settle();
		// After the mount, which installs the DOM the notice queue draws into.
		activateNotices();
		const notices = Notice.shown.length;

		const peerWrite = rig.peer.setFacing.execute({ assetId: rig.assetId, facing: 0 });
		pointer(rig, 'pointerdown', IN_BOWL);
		pointer(rig, 'pointermove', { x: IN_BOWL.x + 50, y: IN_BOWL.y });
		pointer(rig, 'pointermove', { x: IN_BOWL.x + 100, y: IN_BOWL.y });
		expectOk(await peerWrite);
		pointer(rig, 'pointerup', { x: IN_BOWL.x + 100, y: IN_BOWL.y });
		await settle();

		const shape = (await rig.document()).shape;
		expect(shape?.facing).toBe(0);
		expectNear(await detailPoints(rig, 'detail-2'), BOWL.points);
		// What the user is shown: a write-boundary refusal goes to the save indicator and to no notice
		// beside it (`reportDispatchFailure`). That the tool REPORTED it is `designerSelectTool.test.ts`'s
		// `rig.rejected` case — this reporter shows nothing for this code, so no DOM assertion can see it.
		expect(useSaveStateStore(rig.pinia).state).toBe('save-error');
		expect(Notice.shown).toHaveLength(notices);
		rig.unmount();
	});
```

- [ ] **Step 3: Update the unit preview count deliberately, and add the release-point case**

In `tests/presentation/designer/tools/designerSelectTool.test.ts`, inside `it('moves a dragged detail in one write, conditional on the version the press read', …)`, replace:

```ts
		// Previewed while it ran, and the preview cleared only once the write had settled.
		expect(rig.previews).toHaveLength(3);
		expect(rig.previews[1]).not.toBeNull();
		expect(rig.previews[2]).toBeNull();
```

with:

```ts
		// Previewed while it ran — the release point too, before it was committed (ruling B7) — and the
		// preview cleared only once the write had settled.
		expect(rig.previews).toHaveLength(4);
		expect(rig.previews[1]).not.toBeNull();
		expect(rig.previews[3]).toBeNull();
```

Add this case after it, in the same `describe('moving a part')`:

```ts
	/** `CurveTool.pointerUp`'s rule: the release point is previewed before it is committed, so the canvas shows what is written. */
	it('previews the release point before committing it', async () => {
		const rig = selectToolRig();
		rig.tool.activate(rig.harness.context);

		rig.tool.pointerDown(pointerAt(IN_BOWL.x, IN_BOWL.y));
		rig.tool.pointerMove(pointerAt(IN_BOWL.x + 50, IN_BOWL.y));
		rig.tool.pointerUp(pointerAt(IN_BOWL.x + 100, IN_BOWL.y));
		await flushGesture();

		expect(rig.written).toHaveLength(1);
		expect(rig.previews.filter((preview) => preview !== null).at(-1)).toEqual(rig.written[0]?.shape);
		expect(rig.previews.at(-1)).toBeNull();
	});
```

- [ ] **Step 4: Run the tests and watch them fail**

Run: `npx vitest run tests/presentation/designer/assetDesignStoreSelection.test.ts tests/presentation/designer/designerSelection.test.ts tests/presentation/designer/tools/designerSelectTool.test.ts --testTimeout=20000`

Expected: `Tests  4 failed | 31 passed (35)`. Verified red by probe:
- `leaves a preview it did not draw…` fails with `AssertionError: expected null to be { footprint: …(2), …(8) }`.
- `leaves a drag’s preview standing…` fails with `AssertionError: expected null not to be null`.
- `moves a dragged detail…` fails with `expected [ …(3) ] to have a length of 4 but got 3`.
- `previews the release point…` fails with `expected { footprint: { …(2) }, …(8) } to deeply equal { footprint: { …(2) }, …(8) }`: the last preview is the +50 move, the write is +100.
- The peer case PASSES. Its new assertions pin the route the refusal already takes (probe 9).

- [ ] **Step 5: Delete the clear in `select`**

In `src/presentation/designer/stores/assetDesignStore.ts`, replace:

```ts
	/** Choosing a DIFFERENT part resets the mode to Transform; re-choosing the selected part keeps it (Amendment 1). */
	function select(next: DesignerSelection | null): void {
		if (!sameSelection(selection.value, next)) mode.value = 'transform';
		selection.value = next;
		preview.value = null;
	}
```

with:

```ts
	/**
	 * Choosing a DIFFERENT part resets the mode to Transform; re-choosing the selected part keeps it (Amendment 1).
	 * `preview` is left alone: it belongs to the gesture that drew it, which clears it itself.
	 */
	function select(next: DesignerSelection | null): void {
		if (!sameSelection(selection.value, next)) mode.value = 'transform';
		selection.value = next;
	}
```

- [ ] **Step 6: Preview the release point, and narrow the tool's header**

In `src/presentation/designer/tools/designer-select-tool.ts`, `pointerUp`, replace:

```ts
		if (!this.passedEpsilon(drag, event.worldPoint)) return;
		this.release(drag.context, this.shapeAt(drag, event), drag.version);
```

with:

```ts
		if (!this.passedEpsilon(drag, event.worldPoint)) return;
		// The release point is previewed before it is committed, as `CurveTool.pointerUp` does, so the
		// canvas shows the shape being written rather than the last move's.
		const next = this.shapeAt(drag, event);
		this.preview(next);
		this.release(drag.context, next, drag.version);
```

`preview` skips an invalid result, and `release` still clears the preview for one. In the class docblock, replace:

```ts
 * at its press would strand the earlier preview on the canvas. The guard covers `commit` alone: the
 * store's `select` (a press on a part or on empty canvas) and a press abandoning a leftover bend both
 * clear the preview too, and a write still in flight then shows the stored shape until its refresh.
```

with:

```ts
 * at its press would strand the earlier preview on the canvas. The guard covers `commit` alone: a
 * press abandoning a leftover bend, `cancel` and a tool switch clear the preview too, and a write still
 * in flight then shows the stored shape until its refresh. Selecting does not: the store's `select`
 * leaves a preview it did not draw.
```

Leave `src/presentation/designer/DesignerCanvas.vue` as it is. Its docblock at `:119-123` points at this header, which stays accurate.

- [ ] **Step 7: Run the tests and watch them pass**

Run: `npm run check:fast -- tests/presentation/designer/assetDesignStoreSelection.test.ts tests/presentation/designer/designerSelection.test.ts tests/presentation/designer/tools/designerSelectTool.test.ts`

Expected: oxlint and `vue-tsc` report nothing, then `Test Files  3 passed (3)` and `Tests  35 passed (35)`. Verified green by probe. The whole designer suite against this change was also green (22 files), apart from the pin flipped in Step 1.

- [ ] **Step 8: Lint, fallow, budgets**

Run: `npx eslint src/presentation/designer/stores/assetDesignStore.ts src/presentation/designer/tools/designer-select-tool.ts tests/presentation/designer/assetDesignStoreSelection.test.ts tests/presentation/designer/designerSelection.test.ts tests/presentation/designer/tools/designerSelectTool.test.ts`
Expected: no output, exit 0.

Run: `npx fallow dead-code` then `npx fallow dupes`
Expected: no finding that names a file this task touched.

Budgets (ESLint counts, blank lines and comments skipped):
- `assetDesignStore.ts`: 71 → 70 of 400.
- `designer-select-tool.ts`: 215 → 218 of 400; `pointerUp` 16 lines, complexity 5.
- Test files stay far under 450 raw: `designerSelection.test.ts` about 225, `designerSelectTool.test.ts` about 392.

- [ ] **Step 9: Commit**

```bash
git add src/presentation/designer/stores/assetDesignStore.ts src/presentation/designer/tools/designer-select-tool.ts tests/presentation/designer/assetDesignStoreSelection.test.ts tests/presentation/designer/designerSelection.test.ts tests/presentation/designer/tools/designerSelectTool.test.ts
git commit -m "$(cat <<'EOF'
fix(designer): keep a preview select() did not draw, and preview the release point

The store's select() cleared any in-flight preview, so a click during a
drag's write drew the pre-write shape until the refresh landed; the
drag's commit already clears its own. The select tool now previews the
release shape before committing it, as CurveTool does. The peer-refusal
rig case also pins what the user sees: save-error and no notice.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

**Captures:** none. Both fixes change what stands for a moment while a write is in flight, and no fixed shot or entry capture records that.

---

### Task 7: A queued key on a part already gone does nothing

Ruling B2 and spec Amendment 2's silent skip. **Verified red and green by probe.**

**Files:**
- Modify: `src/presentation/designer/selection/editShape.ts` (the `EditShape` type and its docblock; the `null` arm in `createEditShape`)
- Modify: `src/presentation/designer/designerKeys.ts` (imports; header sentence; `duplicateAndSelect`'s parameter type; new `whileItExists`; `deleteSelection`; `nudgeSelection`)
- Test: `tests/presentation/designer/selection/editShape.test.ts` (one new case)
- Test: `tests/presentation/designer/designerKeys.test.ts` (`actionsOver` takes a shape; one new case)
- Test: `tests/presentation/designer/designerKeyboard.test.ts` (imports; one new mounted case in `describe('Delete')`)

**Interfaces:**
- Consumes: nothing from Task 6.
- Produces, in `selection/editShape.ts`:
  - `export type ShapeEdit = (shape: AssetShape) => Result<AssetShape, ValidationError>;`
  - `export type EditShape = (edit: (shape: AssetShape) => ReturnType<ShapeEdit> | null) => Promise<DispatchResult>;`. An edit answering `null` resolves `ok('no-write')` and is never dispatched.
- Produces, in `designerKeys.ts`: `duplicateAndSelect(editShape: (edit: ShapeEdit) => Promise<DispatchResult>, id: string, select: (next: DesignerSelection) => void): Promise<DispatchResult>`. The parameter is NARROWER than `EditShape`, so `DesignerSelectionInspector.vue`'s `props.editShape` (typed over a non-null edit) still type-checks when passed in. Verified by a `vue-tsc` type probe: both that prop and `runtime.editShape` are accepted, and `DesignerInspector.vue`'s prop still accepts `runtime.editShape`. Neither inspector file changes.
- The inspector's refusal alert is untouched: its edits never answer `null`.

This task widens a member the runtime returns (`editShape`'s type), so the Global Constraints' wide `check:fast` applies (Step 6).

- [ ] **Step 1: Write the failing unit cases**

In `tests/presentation/designer/selection/editShape.test.ts`, add after the first case:

```ts
	it('writes nothing, and resolves no-write, for an edit with nothing to do on the shape it is handed', async () => {
		const recorder = writes();

		const result = await createEditShape(() => ({ shape: TOILET, geometryVersion: DESIGN_VERSION }), recorder.write)(() => null);

		expect(result).toEqual(ok('no-write'));
		expect(recorder.calls).toEqual([]);
	});
```

In `tests/presentation/designer/designerKeys.test.ts`, replace `actionsOver` and `shapeOf` with:

```ts
function actionsOver(selection: DesignerSelection | null, answer: DispatchResult = ok('wrote'), tool: ToolId | null = 'select', shape: AssetShape = TOILET) {
	const selected: (DesignerSelection | null)[] = [];
	const edited: (Result<AssetShape, ValidationError> | null)[] = [];
	const actions = selectionKeyActions(
		{
			selection,
			select: (next) => {
				selected.push(next);
			},
		},
		(edit) => {
			edited.push(edit(shape));
			return Promise.resolve(answer);
		},
		{ value: tool },
	);
	return { actions, selected, edited };
}

function shapeOf(result: Result<AssetShape, ValidationError> | null | undefined): AssetShape | undefined {
	return result?.ok === true ? result.value : undefined;
}
```

Then add at the end of `describe('selectionKeyActions')`:

```ts
	/**
	 * Amendment 2: a key captures its part at the press, and a Delete or an undo queued ahead of it can
	 * remove that part before its step runs. The edit then answers `null` — nothing to do — which
	 * `editShape` resolves as `no-write` without dispatching, so nothing is said and nothing is written.
	 * The anchor is never gone, which `nudges an outline or the anchor…` above already drives.
	 */
	it('skips a nudge or a delete whose part is gone by the time its step runs', async () => {
		const detail = actionsOver({ kind: 'detail', id: 'detail-9' });
		const clearance = actionsOver({ kind: 'clearance' }, ok('wrote'), 'select', { ...TOILET, clearance: null });

		await detail.actions.nudgeSelection({ dx: 10, dy: 0 });
		await detail.actions.deleteSelection();
		await clearance.actions.deleteSelection();
		await clearance.actions.nudgeSelection({ dx: 10, dy: 0 });

		expect([...detail.edited, ...clearance.edited]).toEqual([null, null, null, null]);
	});
```

- [ ] **Step 2: Write the failing mounted case**

In `tests/presentation/designer/designerKeyboard.test.ts`, add these imports:

```ts
import { activateNotices } from '../../../src/presentation/notices/notify';
import { Notice } from '../../helpers/obsidian-mock';
```

Add at the end of `describe('Delete')`:

```ts
	/**
	 * Amendment 2's silent skip, mounted: a second Delete and an arrow pressed before the first Delete's
	 * refresh prunes the selection both find the bowl gone when their steps run. Neither says anything
	 * and neither writes — one Undo brings the bowl back and leaves nothing to undo.
	 */
	it('skips, silently, a Delete and an arrow queued behind the Delete that removed their part', async () => {
		const rig = await designerRig({ shape: TOILET });
		await selectAt(rig, justInsideBottom(BOWL));
		// After the mount, which installs the DOM the notice queue draws into.
		activateNotices();
		Notice.shown.length = 0;

		key(rig.canvasEl, { key: 'Delete' });
		key(rig.canvasEl, { key: 'Delete' });
		key(rig.canvasEl, { key: 'ArrowRight' });
		await settle();

		expect(Notice.shown).toHaveLength(0);
		expect((await rig.document()).shape?.details.map((detail) => detail.id)).toEqual(['detail-1']);
		await press(rig, 'designer.toolbar.undo');
		expect(await bowlPoints(rig)).toEqual(BOWL.points);
		expect(rig.toolbarButton(t('en', 'designer.toolbar.undo')).disabled).toBe(true);
		rig.unmount();
	});
```

- [ ] **Step 3: Run the tests and watch them fail**

Run: `npx vitest run tests/presentation/designer/selection/editShape.test.ts tests/presentation/designer/designerKeys.test.ts tests/presentation/designer/designerKeyboard.test.ts --testTimeout=20000`

Expected: `Tests  3 failed | 42 passed (45)`. Verified red by probe:
- `writes nothing, and resolves no-write, for an edit with nothing to do…` fails with `TypeError: Cannot read properties of null (reading 'ok')`. `vue-tsc` would also refuse the `() => null` edit until Step 4 widens the type, which is why this step runs vitest directly.
- `skips a nudge or a delete whose part is gone…` fails with `expected [ Array(4) ] to deeply equal [ null, null, null, null ]`.
- `skips, silently, a Delete and an arrow…` fails with `expected [ Array(1) ] to have a length of +0 but got 1`: today the arrow's `moveOutline` refuses `asset.part-not-found` and `notifyIfRefused` toasts it.

- [ ] **Step 4: Let an edit answer "nothing to do"**

In `src/presentation/designer/selection/editShape.ts`, replace:

```ts
/**
 * One whole-shape edit of the leaf's current design (symbols spec, Amendment 1): a pure edit from
 * `shapeEdits.ts`/`detailEdits.ts`, dispatched as ONE `SetAssetShape` conditional on the version the
 * leaf read, or not dispatched at all.
 *
```

with:

```ts
/** A pure whole-shape edit from `shapeEdits.ts`/`detailEdits.ts`: the edited shape, or why not. */
export type ShapeEdit = (shape: AssetShape) => Result<AssetShape, ValidationError>;

/**
 * One whole-shape edit of the leaf's current design (symbols spec, Amendment 1): a pure edit, dispatched
 * as ONE `SetAssetShape` conditional on the version the leaf read, or not dispatched at all.
 *
 * An edit may answer `null` for "nothing to do on the shape I was handed" (Amendment 2): a key whose
 * part a queued Delete already removed. That resolves `no-write` and dispatches nothing, so it pushes no
 * undo entry. `CommandHistory` pushes one for ANY ok result a command answers, which is why this check
 * lives here and never inside a command.
 *
```

Replace:

```ts
export type EditShape = (edit: (shape: AssetShape) => Result<AssetShape, ValidationError>) => Promise<DispatchResult>;
```

with:

```ts
export type EditShape = (edit: (shape: AssetShape) => ReturnType<ShapeEdit> | null) => Promise<DispatchResult>;
```

In `createEditShape`, replace:

```ts
			const next = edit(current.shape);
			if (!next.ok) return err(next.error);
```

with:

```ts
			const next = edit(current.shape);
			if (next === null) return ok('no-write');
			if (!next.ok) return err(next.error);
```

- [ ] **Step 5: Skip a nudge or a Delete whose part is gone**

In `src/presentation/designer/designerKeys.ts`, replace the imports:

```ts
import type { DispatchResult } from '../../application/commands/DispatchOutcome';
```

```ts
import type { DesignerSelection } from './selection/designerSelection';
import type { EditShape } from './selection/editShape';
```

with:

```ts
import type { DispatchResult } from '../../application/commands/DispatchOutcome';
import type { AssetShape } from '../../domain/asset/AssetShape';
```

```ts
import { selectionExists, type DesignerSelection } from './selection/designerSelection';
import type { EditShape, ShapeEdit } from './selection/editShape';
```

In the file's header docblock, replace:

```ts
 * `selectionKeyActions(...).nudgeSelection`. Every edit is one `editShape`, so one conditional write
 * and one undo entry, and every refusal goes through `notifyIfRefused`.
```

with:

```ts
 * `selectionKeyActions(...).nudgeSelection`. Every edit is one `editShape`, so one conditional write
 * and one undo entry, and every refusal goes through `notifyIfRefused` — except a nudge or a Delete whose
 * part is already gone when its step runs, which is skipped and says nothing (`whileItExists`).
```

Replace:

```ts
export async function duplicateAndSelect(
	editShape: EditShape,
	id: string,
```

with:

```ts
export async function duplicateAndSelect(
	editShape: (edit: ShapeEdit) => Promise<DispatchResult>,
	id: string,
```

Insert directly above the docblock that begins `/**\n * The three edits a selection key dispatches`:

```ts
/**
 * A key's edit, skipped when the part it captured at the press is gone by the time its step runs — a
 * Delete or an undo queued ahead of it removed it. `null` is `editShape`'s "nothing to do": the press
 * was right when made and the canvas already shows the part gone, so there is nothing to say (the plan
 * editor's `nudge.ts` rule). The inspector does not take this door; its alert sits beside a part still drawn.
 */
function whileItExists(selection: DesignerSelection, edit: ShapeEdit): (shape: AssetShape) => ReturnType<ShapeEdit> | null {
	return (shape) => (selectionExists(shape, selection) ? edit(shape) : null);
}
```

In `selectionKeyActions`, replace:

```ts
			if (selection?.kind === 'detail') return notifyIfRefused(editShape((shape) => deleteDetail(shape, selection.id)));
			if (selection?.kind === 'clearance') return notifyIfRefused(editShape(removeClearance));
```

with:

```ts
			if (selection?.kind === 'detail') return notifyIfRefused(editShape(whileItExists(selection, (shape) => deleteDetail(shape, selection.id))));
			if (selection?.kind === 'clearance') return notifyIfRefused(editShape(whileItExists(selection, removeClearance)));
```

and replace:

```ts
			return notifyIfRefused(
				editShape((shape) =>
					selection.kind === 'anchor'
						? moveAnchor(shape, { x: shape.anchor.x + by.dx, y: shape.anchor.y + by.dy })
						: moveOutline(shape, selection, by),
				),
			);
```

with:

```ts
			return notifyIfRefused(
				editShape(
					whileItExists(selection, (shape) =>
						selection.kind === 'anchor'
							? moveAnchor(shape, { x: shape.anchor.x + by.dx, y: shape.anchor.y + by.dy })
							: moveOutline(shape, selection, by),
					),
				),
			);
```

Ctrl+D is deliberately NOT wrapped. The ruling scopes the skip to nudge and Delete, and a duplicate of a part gone still refuses through its notice (keys) or its alert (inspector).

- [ ] **Step 6: Run the tests and watch them pass**

Run: `npm run check:fast -- tests/presentation/designer/selection/editShape.test.ts tests/presentation/designer/designerKeys.test.ts tests/presentation/designer/designerKeyboard.test.ts`
Expected: oxlint and `vue-tsc` report nothing, then `Tests  45 passed (45)`. Verified green by probe.

Run (a runtime member's type was widened): `npm run check:fast -- tests/presentation tests/helpers tests/harness`
Expected: every test file passes. Against this change the designer part was probe-verified: `designerSelectionInspector.test.ts` 31, `designerInspector.test.ts` 15, `designerKeys.test.ts` 24, `designerKeyboard.test.ts` 12 all green.

- [ ] **Step 7: Lint, fallow, budgets**

Run: `npx eslint src/presentation/designer/selection/editShape.ts src/presentation/designer/designerKeys.ts tests/presentation/designer/selection/editShape.test.ts tests/presentation/designer/designerKeys.test.ts tests/presentation/designer/designerKeyboard.test.ts`
Expected: no output, exit 0.

Run: `npx fallow dead-code` then `npx fallow dupes`
Expected: no finding that names a file this task touched. `ShapeEdit` is consumed by `designerKeys.ts` in `src/`, so it is not an `unused-exports` finding.

Budgets (ESLint counts):
- `designerKeys.ts`: 88 → 94 of 400; `selectionKeyActions` 34 → 36; `whileItExists` 3.
- `editShape.ts`: 23 → about 25 of 400; `createEditShape` 18.

- [ ] **Step 8: Commit**

```bash
git add src/presentation/designer/selection/editShape.ts src/presentation/designer/designerKeys.ts tests/presentation/designer/selection/editShape.test.ts tests/presentation/designer/designerKeys.test.ts tests/presentation/designer/designerKeyboard.test.ts
git commit -m "$(cat <<'EOF'
fix(designer): skip a queued key whose part is already gone

A nudge or Delete captures its part at the press; a Delete queued ahead
of it can remove that part before its step runs, and the refusal was
toasted as asset.part-not-found. The edit now answers null (nothing to
do), which editShape resolves as no-write without dispatching, so no
notice, no write and no empty undo entry. The inspector's alert is
unchanged.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

**Captures:** none.

---

### Task 8: One write chain for every designer gesture

Ruling B1 and spec Amendment 2. **Verified red and green by probe**, with the exceptions stated per step:
- `designerWriteChain.test.ts`: each case was verified as the same pointer and key stream. The file below was not run in exactly this form, because its helpers (`pressAndMove`, `release`, `tap`, `expectBowlMoved`) were reshaped afterwards to stay clear of `fallow dupes`. The implementer's red step is the check for that file.
- The two guard cases were verified against mutants, as stated at the top of this file.

**The decision, measured.** Can `withStateRefresh`'s own queue be the chain, with a step reading `design()` inside a queued `execute`? No. A probe showed that `withStateRefresh(history, …).run({ execute: () => ok('no-write') })` leaves `history.canUndo === true`. So a step that finds nothing to do (Task 7's `null`, a shapeless design) would have to answer from inside `execute` and push an empty undo entry. The Select tool's hold also needs to ask "is a write queued?" and "when has it drained?". `RefreshedHistory` is shared with the plan editor and answers neither. A chain owned by the runtime is the smaller correct answer: `createWriteChain` (22 lines) plus `designWrites` (14), with `buildRuntime` unchanged at 99 of 100. `detailWrite` still reads the design inside its command's `execute`, which is safe there. A draw's step never has "nothing to do": every failure at step time is a refusal.

**Files:**
- Modify: `src/presentation/designer/selection/editShape.ts` (whole file below: `createWriteChain`; `createEditShape` takes `enqueue` first)
- Modify: `src/presentation/designer/tools/designer-select-tool.ts` (deps `writing`/`settled`; `Held`; the `held` field; `pointerDown`/`pointerMove`/`pointerUp`; `hasDraft`; `dropGesture`; `hold`/`replayWhenSettled`; header docblock)
- Modify: `src/presentation/designer/tools/registerDesignerTools.ts` (imports; `detailWrite` becomes `detailOn` plus a lazy `detailWrite`)
- Modify: `src/presentation/designer/runtime.ts` (import; `selectToolDeps`; new `designWrites`; three lines in `buildRuntime`; the `editShape` docblock in `DesignerRuntime`)
- Modify: `tests/helpers/designerSelection.ts` (`writing`/`settled` options)
- Modify: `tests/presentation/designer/tools/drawDetailTool.test.ts` (`traceRig`'s `selectTool` gains the two members)
- Modify: `tests/presentation/designer/selection/editShape.test.ts` (whole file below)
- Create: `tests/presentation/designer/tools/designerSelectHold.test.ts`
- Create: `tests/presentation/designer/tools/detailWrite.test.ts`
- Create: `tests/presentation/designer/designerWriteChain.test.ts`

**Interfaces:**
- Consumes: Task 7's `ShapeEdit`/`EditShape` (an edit may answer `null`) and Task 6's release preview in `pointerUp`.
- Produces, in `selection/editShape.ts`:
  - `createWriteChain(): { readonly enqueue: <T>(step: () => Promise<T>) => Promise<T>; readonly writing: () => boolean; readonly settled: () => Promise<void> }`
  - `createEditShape(enqueue: <T>(step: () => Promise<T>) => Promise<T>, design: () => { readonly shape: AssetShape | null; readonly geometryVersion: EntityVersion } | null, write: (shape: AssetShape, expected: EntityVersion) => Promise<DispatchResult>): EditShape`
- Produces, in `DesignerSelectToolDeps`: `readonly writing: () => boolean; readonly settled: () => Promise<void>;`. Both are required, so every object literal of this type gains them: `selectToolDeps` in `runtime.ts`, `selectToolRig` in `tests/helpers/designerSelection.ts`, and `traceRig` in `drawDetailTool.test.ts`.
- Produces, in `SelectToolRigOptions`: `readonly writing?: () => boolean; readonly settled?: () => Promise<void>;`, defaulting to never-writing.
- Unchanged: `DesignerRuntime`'s members and their types (`editShape` is still an `EditShape`), `DesignerToolDeps`, `ToolId`, `RenderState`.
- Behaviour change, stated once: the tools' `EditorContext.commandDispatcher` is now queued. Every designer tool dispatch, and `commitHeight`, waits for earlier queued writes and their read-backs. `undo`/`redo`/`setBackground`/`setFootprintFromDimensions`/`applyShape` keep using the unqueued `dispatcher`, as today.
- Remaining refusal, by design: a write queued AFTER a press was taken (an inspector field committing on blur, say) still refuses that press's drag as a version conflict. The press version is the condition, and nothing is overwritten.

- [ ] **Step 1: Rewrite `editShape.test.ts` against the chain**

Replace the whole of `tests/presentation/designer/selection/editShape.test.ts` with:

```ts
/**
 * `createWriteChain` and `createEditShape` — the designer leaf's ONE write chain (spec Amendment 2), and
 * the door a click-, field- or key-bound shape edit takes onto it (Amendment 1): read the design when
 * the step runs, run a pure edit, and dispatch a conditional write only when the edit has one to make.
 */
import { describe, expect, it } from 'vitest';
import type { EntityVersion } from '../../../../src/application/ports/versioning';
import type { DispatchResult } from '../../../../src/application/commands/DispatchOutcome';
import { err, ok } from '../../../../src/core/result/Result';
import { assetError } from '../../../../src/domain/asset/Asset.errors';
import type { AssetShape } from '../../../../src/domain/asset/AssetShape';
import { createEditShape, createWriteChain } from '../../../../src/presentation/designer/selection/editShape';
import { DESIGN_VERSION, TOILET } from '../../../helpers/designerSelection';
import { settle } from '../../../helpers/settle';

function writes(): { readonly calls: { shape: AssetShape; expected: EntityVersion }[]; write: (shape: AssetShape, expected: EntityVersion) => Promise<DispatchResult> } {
	const calls: { shape: AssetShape; expected: EntityVersion }[] = [];
	return {
		calls,
		write: (shape, expected) => {
			calls.push({ shape, expected });
			return Promise.resolve(ok('wrote'));
		},
	};
}

/** `createEditShape` over a fresh chain of its own. */
function editShapeOver(design: Parameters<typeof createEditShape>[1], write: Parameters<typeof createEditShape>[2]) {
	return createEditShape(createWriteChain().enqueue, design, write);
}

const drawn = () => ({ shape: TOILET, geometryVersion: DESIGN_VERSION });

const shifted = (shape: AssetShape) => ok({ ...shape, anchor: { x: 10, y: 0 } });

const faulting = (): never => {
	throw new Error('the edit faulted');
};

describe('createWriteChain', () => {
	it('is writing from the moment a step is queued until it settles, and settled waits for it', async () => {
		const chain = createWriteChain();
		let finish!: () => void;
		let drained = false;
		expect(chain.writing()).toBe(false);

		const step = chain.enqueue(
			() =>
				new Promise<void>((resolve) => {
					finish = resolve;
				}),
		);
		void (async () => {
			await chain.settled();
			drained = true;
		})();
		await settle();
		expect([chain.writing(), drained]).toEqual([true, false]);

		finish();
		await step;
		await settle();
		expect([chain.writing(), drained]).toEqual([false, true]);
	});

	it('stops writing after a step that rejected, and runs the step behind it', async () => {
		const chain = createWriteChain();

		const faulted = chain.enqueue(() => Promise.reject(new Error('the step faulted')));
		const later = chain.enqueue(() => Promise.resolve('ran'));

		await expect(faulted).rejects.toThrow('the step faulted');
		await expect(later).resolves.toBe('ran');
		expect(chain.writing()).toBe(false);
	});
});

describe('createEditShape', () => {
	it('writes nothing, and resolves no-write, when nothing has been read or nothing drawn', async () => {
		const recorder = writes();
		let edits = 0;
		const count = (shape: AssetShape) => {
			edits += 1;
			return ok(shape);
		};

		const unread = await editShapeOver(() => null, recorder.write)(count);
		const shapeless = await editShapeOver(() => ({ shape: null, geometryVersion: DESIGN_VERSION }), recorder.write)(count);

		expect(unread).toEqual(ok('no-write'));
		expect(shapeless).toEqual(ok('no-write'));
		expect(edits).toBe(0);
		expect(recorder.calls).toEqual([]);
	});

	it('writes nothing, and resolves no-write, for an edit with nothing to do on the shape it is handed', async () => {
		const recorder = writes();

		const result = await editShapeOver(drawn, recorder.write)(() => null);

		expect(result).toEqual(ok('no-write'));
		expect(recorder.calls).toEqual([]);
	});

	it('resolves a refused edit as that refusal, without dispatching', async () => {
		const recorder = writes();
		const refusal = assetError('part-not-found', 'That part is not on this shape.');

		const result = await editShapeOver(drawn, recorder.write)(() => err(refusal));

		expect(result).toEqual(err(refusal));
		expect(recorder.calls).toEqual([]);
	});

	it('writes the edited shape once, conditional on the version it read, and resolves the write', async () => {
		const recorder = writes();

		const result = await editShapeOver(drawn, recorder.write)(shifted);

		expect(result).toEqual(ok('wrote'));
		expect(recorder.calls).toHaveLength(1);
		expect(recorder.calls[0]?.shape.anchor).toEqual({ x: 10, y: 0 });
		expect(recorder.calls[0]?.expected).toBe(DESIGN_VERSION);
	});

	it('rejects, rather than throwing at the call, when the edit faults', async () => {
		const recorder = writes();

		// Taken without awaiting: a synchronous throw would fail HERE, which is the defect this case pins.
		const outcome = editShapeOver(drawn, recorder.write)(faulting);

		await expect(outcome).rejects.toThrow('the edit faulted');
		expect(recorder.calls).toEqual([]);
	});

	it('reads the design for an edit only once every step queued before it has settled', async () => {
		const chain = createWriteChain();
		let reads = 0;
		let settleEarlier!: () => void;
		const editShape = createEditShape(
			chain.enqueue,
			() => {
				reads += 1;
				return drawn();
			},
			() => Promise.resolve(ok('wrote')),
		);

		// A tool's release, queued first on the same chain and not yet settled.
		const earlier = chain.enqueue(
			() =>
				new Promise<void>((resolve) => {
					settleEarlier = resolve;
				}),
		);
		const edit = editShape(shifted);
		await settle();
		expect(reads).toBe(0);

		settleEarlier();
		await earlier;
		await expect(edit).resolves.toEqual(ok('wrote'));
		expect(reads).toBe(1);
	});

	it('runs a later edit after an earlier one faulted, rather than wedging behind it', async () => {
		const recorder = writes();
		const editShape = editShapeOver(drawn, recorder.write);

		const faulted = editShape(faulting);
		const later = editShape(shifted);

		await expect(faulted).rejects.toThrow('the edit faulted');
		await expect(later).resolves.toEqual(ok('wrote'));
		expect(recorder.calls).toHaveLength(1);
	});
});
```

- [ ] **Step 2: Give the unit rig the chain's two questions, and write the hold cases**

In `tests/helpers/designerSelection.ts`, replace:

```ts
	readonly context?: ToolContextOptions;
}
```

with:

```ts
	readonly context?: ToolContextOptions;
	/** The leaf's write chain as the tool asks it (`createWriteChain`). Default: nothing ever queued. */
	readonly writing?: () => boolean;
	readonly settled?: () => Promise<void>;
}
```

and in `selectToolRig`, replace:

```ts
		reportInvalidInput: (error) => {
			invalid.push(error);
		},
	});
```

with:

```ts
		reportInvalidInput: (error) => {
			invalid.push(error);
		},
		writing: options.writing ?? (() => false),
		settled: options.settled ?? (() => Promise.resolve()),
	});
```

In `tests/presentation/designer/tools/drawDetailTool.test.ts`, `traceRig`, replace:

```ts
			reportRejected: (error) => rejected.push(error),
			reportInvalidInput: (error) => invalid.push(error),
		},
	});
	manager.setActiveTool('trace-detail');
```

with:

```ts
			reportRejected: (error) => rejected.push(error),
			reportInvalidInput: (error) => invalid.push(error),
			writing: () => false,
			settled: () => Promise.resolve(),
		},
	});
	manager.setActiveTool('trace-detail');
```

Create `tests/presentation/designer/tools/designerSelectHold.test.ts`:

```ts
/**
 * `DesignerSelectTool`'s HOLD (asset designer symbols spec, Amendment 2), driven directly: a press made
 * while the leaf's write chain still has a write queued is held, with its latest move and its release,
 * and replayed once the chain has drained — so it reads the design that write left. The mounted half is
 * `designerWriteChain.test.ts`; what only this file can reach is the moment between the two.
 */
import { describe, expect, it } from 'vitest';
import { flushGesture, pointerAt } from '../../../helpers/tool-context';
import { DESIGN_VERSION, detailOutline, justInsideBottom, selectToolRig } from '../../../helpers/designerSelection';

const BOWL = detailOutline('detail-2');
const IN_BOWL = justInsideBottom(BOWL);

/** A chain the case drains by hand: every `settled()` waits for `wake`, which also says whether a write is still queued then. */
function manualChain() {
	let busy = true;
	let waiting: (() => void)[] = [];
	return {
		writing: () => busy,
		settled: () =>
			new Promise<void>((resolve) => {
				waiting.push(resolve);
			}),
		wake: (stillWriting: boolean) => {
			busy = stillWriting;
			const woken = waiting;
			waiting = [];
			for (const resolve of woken) resolve();
		},
	};
}

function heldRig() {
	const chain = manualChain();
	const rig = selectToolRig({ writing: chain.writing, settled: chain.settled });
	rig.tool.activate(rig.harness.context);
	return { rig, chain };
}

/** A whole drag of the bowl by +100 mm, with a +50 move before the +100 one. */
function dragBowl(rig: ReturnType<typeof selectToolRig>): void {
	rig.tool.pointerDown(pointerAt(IN_BOWL.x, IN_BOWL.y));
	rig.tool.pointerMove(pointerAt(IN_BOWL.x + 50, IN_BOWL.y));
	rig.tool.pointerMove(pointerAt(IN_BOWL.x + 100, IN_BOWL.y));
	rig.tool.pointerUp(pointerAt(IN_BOWL.x + 100, IN_BOWL.y));
}

describe('a press made while a write is queued', () => {
	it('is held: nothing is selected, previewed or written, and it is a draft Escape can abandon', async () => {
		const { rig } = heldRig();

		dragBowl(rig);
		await flushGesture();

		expect(rig.selected).toEqual([]);
		expect(rig.previews).toEqual([]);
		expect(rig.written).toEqual([]);
		expect(rig.tool.hasDraft()).toBe(true);
		expect(rig.tool.tracksPointer()).toBe(false);
	});

	it('is replayed with only its latest move and its release once the chain drains', async () => {
		const { rig, chain } = heldRig();
		dragBowl(rig);

		chain.wake(false);
		await flushGesture();

		expect(rig.selected).toEqual([{ kind: 'detail', id: 'detail-2' }]);
		// The +50 move was superseded while held: the first preview is already the +100 one.
		expect(rig.previews[0]?.details.find((detail) => detail.id === 'detail-2')?.outline.points).toEqual(
			BOWL.points.map((point) => ({ x: point.x + 100, y: point.y })),
		);
		expect(rig.written).toHaveLength(1);
		expect(rig.written[0]?.expected).toBe(DESIGN_VERSION);
		expect(rig.tool.hasDraft()).toBe(false);
	});

	it('is held again, with what it carried, when another write was queued while it waited', async () => {
		const { rig, chain } = heldRig();
		dragBowl(rig);

		chain.wake(true);
		await flushGesture();
		expect([rig.selected, rig.written]).toEqual([[], []]);
		expect(rig.tool.hasDraft()).toBe(true);

		chain.wake(false);
		await flushGesture();
		expect(rig.written).toHaveLength(1);
	});

	it('is replayed as a live press when its release has not come yet, and that release commits it', async () => {
		const { rig, chain } = heldRig();
		rig.tool.pointerDown(pointerAt(IN_BOWL.x, IN_BOWL.y));

		chain.wake(false);
		await flushGesture();
		expect(rig.selected).toEqual([{ kind: 'detail', id: 'detail-2' }]);
		expect(rig.tool.hasDraft()).toBe(true);

		rig.tool.pointerMove(pointerAt(IN_BOWL.x + 100, IN_BOWL.y));
		rig.tool.pointerUp(pointerAt(IN_BOWL.x + 100, IN_BOWL.y));
		await flushGesture();
		expect(rig.written).toHaveLength(1);
	});

	it.each(['cancel', 'abandonGesture', 'deactivate'] as const)('is dropped by %s, and nothing replays it', async (exit) => {
		const { rig, chain } = heldRig();
		dragBowl(rig);

		rig.tool[exit]();
		expect(rig.tool.hasDraft()).toBe(false);
		chain.wake(false);
		await flushGesture();

		expect(rig.selected).toEqual([]);
		expect(rig.written).toEqual([]);
	});
});
```

- [ ] **Step 3: Write the step-time detail cases**

Create `tests/presentation/designer/tools/detailWrite.test.ts`:

```ts
/**
 * The detail tools' ONE write as `registerDesignerTools` builds it (symbols spec, Amendment 2), over a
 * recording context whose dispatcher HOLDS the command rather than executing it — so a case can change
 * the design between the release and the moment the write's step runs, which is the gap a queued write
 * waits in. `designerWriteChain.test.ts` is the mounted half.
 */
import { describe, expect, it } from 'vitest';
import { ok } from '../../../../src/core/result/Result';
import type { DispatchResult } from '../../../../src/application/commands/DispatchOutcome';
import type { EntityVersion } from '../../../../src/application/ports/versioning';
import type { AssetId } from '../../../../src/domain/asset/AssetId';
import type { AssetShape } from '../../../../src/domain/asset/AssetShape';
import type { ReversibleAssetDesignCommands } from '../../../../src/application/editor/asset/ReversibleAssetDesignCommands';
import type { UndoableCommand } from '../../../../src/presentation/editor/tools/undoable-command';
import { registerDesignerTools } from '../../../../src/presentation/designer/tools/registerDesignerTools';
import { ToolManager } from '../../../../src/presentation/editor/tools/tool-manager';
import { observationToken } from '../../../helpers/domain';
import { DESIGN_VERSION, TOILET } from '../../../helpers/designerSelection';
import { flushGesture, pointerAt, toolContext } from '../../../helpers/tool-context';

const LATER_VERSION: EntityVersion = { revision: 8, observed: observationToken('geometry-8') };
/** The toilet after a write that added a third detail — so the id a new detail takes has moved on. */
const WITH_THIRD = { ...TOILET, details: [...TOILET.details, { ...TOILET.details[0], id: 'detail-3' }] };

function drawRig() {
	let design: { shape: AssetShape; geometryVersion: EntityVersion } | null = { shape: TOILET, geometryVersion: DESIGN_VERSION };
	const held: UndoableCommand[] = [];
	const built: { shape: AssetShape; expected: EntityVersion }[] = [];
	const inner = { executed: 0, undone: 0 };
	const harness = toolContext({
		commandDispatcher: {
			run: (command) => {
				held.push(command);
				return new Promise<DispatchResult>(() => {
					// Never settles: each case runs the held step itself.
				});
			},
		},
	});
	const manager = new ToolManager(() => harness.context);
	registerDesignerTools(manager, {
		assetId: 'asset-1' as AssetId,
		edits: {} as ReversibleAssetDesignCommands,
		reportRejected: () => undefined,
		reportInvalidInput: () => undefined,
		supplyKnownDistance: () => Promise.resolve(null),
		hasGeometryToRescale: () => false,
		confirmRecalibration: () => Promise.resolve(false),
		detailPending: () => false,
		returnToSelect: () => undefined,
		selectTool: {
			design: () => design,
			selection: () => null,
			mode: () => 'transform',
			select: () => undefined,
			setPreview: () => undefined,
			createCommand: (shape, expected) => {
				built.push({ shape, expected });
				return {
					execute: () => {
						inner.executed += 1;
						return Promise.resolve(ok('wrote'));
					},
					undo: () => {
						inner.undone += 1;
						return Promise.resolve(ok('wrote'));
					},
				};
			},
			reportRejected: () => undefined,
			reportInvalidInput: () => undefined,
			writing: () => false,
			settled: () => Promise.resolve(),
		},
	});
	manager.setActiveTool('draw-rect');
	return {
		held,
		built,
		inner,
		manager,
		setDesign: (next: typeof design) => {
			design = next;
		},
	};
}

/** A rectangle far outside the toilet, where nothing snaps. */
function drawRect(rig: ReturnType<typeof drawRig>): void {
	rig.manager.pointerDown(pointerAt(1000, 1000));
	rig.manager.pointerMove(pointerAt(1200, 1100));
	rig.manager.pointerUp(pointerAt(1200, 1100));
}

describe('a drawn detail’s write', () => {
	it('is built on the design its step reads, not the one its release read', async () => {
		const rig = drawRig();
		drawRect(rig);
		expect(rig.built).toEqual([]);

		rig.setDesign({ shape: WITH_THIRD, geometryVersion: LATER_VERSION });
		await expect(rig.held[0]?.execute()).resolves.toEqual(ok('wrote'));

		expect(rig.built).toHaveLength(1);
		expect(rig.built[0]?.expected).toBe(LATER_VERSION);
		expect(rig.built[0]?.shape.details.map((detail) => detail.id)).toEqual(['detail-1', 'detail-2', 'detail-3', 'detail-4']);
	});

	it('refuses at its step, building nothing, when the design it reads then has no shape', async () => {
		const rig = drawRig();
		drawRect(rig);

		rig.setDesign(null);
		const result = await rig.held[0]?.execute();

		expect(result?.ok === false && result.error.code).toBe('asset.no-footprint');
		expect(rig.built).toEqual([]);
	});

	/** Green before this task too (the command WAS the built one then); it pins that the lazy write is built once. */
	it('re-executes the write it built on redo, reading the design once, and undoes through it', async () => {
		const rig = drawRig();
		drawRect(rig);
		const command = rig.held[0] as UndoableCommand;

		await command.execute();
		rig.setDesign({ shape: WITH_THIRD, geometryVersion: LATER_VERSION });
		await command.undo();
		await command.execute();
		await flushGesture();

		expect(rig.built).toHaveLength(1);
		expect(rig.built[0]?.expected).toBe(DESIGN_VERSION);
		expect(rig.inner).toEqual({ executed: 2, undone: 1 });
	});
});
```

- [ ] **Step 4: Write the mounted cases**

Create `tests/presentation/designer/designerWriteChain.test.ts`. Not probe-verified in exactly this form: every case's event stream was verified, the helpers were reshaped afterwards, and the red step below is the check.

```ts
/**
 * @vitest-environment jsdom
 *
 * One write chain for every designer gesture (asset designer symbols spec, Amendment 2), MOUNTED: a
 * gesture made before the previous gesture's write has been read back composes with it, rather than
 * being refused as a version conflict against the user's own earlier gesture — and a drag stays
 * conditional on the design the user pressed on (Amendment 1).
 *
 * The composing cases put NO `settle()` between their gestures: that gap is the subject. Every press
 * target is derived from the toilet preset and sits more than the rig's 80 mm grab radius from every
 * handle of the selected bowl, moved or not — a press near a handle would resize the bowl instead.
 */
import { describe, expect, it } from 'vitest';
import type { Point } from '../../../src/core/geometry/Point';
import { t } from '../../../src/presentation/i18n/strings';
import type { StringKey } from '../../../src/presentation/i18n/locales/en';
import { useAssetDesignStore } from '../../../src/presentation/designer/stores/assetDesignStore';
import { useSaveStateStore } from '../../../src/presentation/editor/save-state/save-state-store';
import { expectOk } from '../../helpers/domain';
import { settle } from '../../helpers/editor';
import { designerRig, drag, type DesignerRig } from '../../helpers/designerRig';
import { TOILET, detailOutline, justInsideBottom } from '../../helpers/designerSelection';

const BOWL = detailOutline('detail-2');
/** (0, 163): inside the bowl, 162 mm above its box's bottom-middle handle. */
const IN_BOWL = justInsideBottom(BOWL);
/** The same point on the bowl once it has moved 100 mm right — still 162 mm or more from every handle of it. */
const IN_MOVED_BOWL = { x: IN_BOWL.x + 100, y: IN_BOWL.y };
const FURTHER = { x: IN_BOWL.x + 200, y: IN_BOWL.y };
/** Two corners outside the footprint, more than the 80 mm snap tolerance from every vertex the toilet has. */
const RECT_FROM = { x: -300, y: 600 };
const RECT_TO = { x: -200, y: 800 };

async function toolbar(rig: DesignerRig, label: StringKey): Promise<void> {
	rig.toolbarButton(t('en', label)).click();
	await settle();
}

/** A press on `from` and a move to `to` with the primary button held: a drag whose release has not come yet. */
function pressAndMove(rig: DesignerRig, from: Point, to: Point): void {
	for (const [type, world] of [['pointerdown', from], ['pointermove', to]] as const) {
		const at = rig.at(world);
		rig.canvasEl.dispatchEvent(new PointerEvent(type, { button: 0, buttons: 1, pointerId: 1, clientX: at.x, clientY: at.y, bubbles: true }));
	}
}

/** The release that ends `pressAndMove`'s drag, with the primary bit clear as a device sends it. */
function release(rig: DesignerRig, world: Point): void {
	const at = rig.at(world);
	rig.canvasEl.dispatchEvent(new PointerEvent('pointerup', { button: 0, buttons: 0, pointerId: 1, clientX: at.x, clientY: at.y, bubbles: true }));
}

function tap(rig: DesignerRig, key: string): void {
	rig.canvasEl.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

/** The bowl as written, `dx` mm right of the preset's — within a micrometre, since a rig point crosses the camera twice. */
async function expectBowlMoved(rig: DesignerRig, dx: number): Promise<void> {
	const points = (await rig.document()).shape?.details.find((detail) => detail.id === 'detail-2')?.outline.points;
	expect(points).toHaveLength(BOWL.points.length);
	BOWL.points.forEach((point, index) => {
		expect(points?.[index]?.x).toBeCloseTo(point.x + dx, 6);
		expect(points?.[index]?.y).toBeCloseTo(point.y, 6);
	});
}

async function detailIds(rig: DesignerRig): Promise<string[] | undefined> {
	return (await rig.document()).shape?.details.map((detail) => detail.id);
}

describe('gestures made before the last write lands', () => {
	it('compose a second drag with the first: the bowl ends 200 mm right, and nothing is refused', async () => {
		const rig = await designerRig({ shape: TOILET });
		await toolbar(rig, 'designer.toolbar.select');

		drag(rig, IN_BOWL, IN_MOVED_BOWL);
		drag(rig, IN_MOVED_BOWL, FURTHER);
		await settle();

		await expectBowlMoved(rig, 200);
		expect(useSaveStateStore(rig.pinia).state).toBe('saved');
		rig.unmount();
	});

	it('compose an arrow tap with a drag: 110 mm, and two undo entries', async () => {
		const rig = await designerRig({ shape: TOILET });
		await toolbar(rig, 'designer.toolbar.select');

		drag(rig, IN_BOWL, IN_MOVED_BOWL);
		tap(rig, 'ArrowRight');
		await settle();
		await expectBowlMoved(rig, 110);

		await toolbar(rig, 'designer.toolbar.undo');
		await expectBowlMoved(rig, 100);
		await toolbar(rig, 'designer.toolbar.undo');
		await expectBowlMoved(rig, 0);
		expect(rig.toolbarButton(t('en', 'designer.toolbar.undo')).disabled).toBe(true);
		rig.unmount();
	});

	it('compose a drag made after a manual switch to Select with the detail drawn just before it', async () => {
		const rig = await designerRig({ shape: TOILET });
		await toolbar(rig, 'designer.toolbar.draw-rect');

		drag(rig, RECT_FROM, RECT_TO);
		// Not awaited: Select is chosen while the drawn detail's write is still queued.
		rig.toolbarButton(t('en', 'designer.toolbar.select')).click();
		drag(rig, IN_BOWL, IN_MOVED_BOWL);
		await settle();

		expect(await detailIds(rig)).toEqual(['detail-1', 'detail-2', 'detail-3']);
		await expectBowlMoved(rig, 100);
		expect(useSaveStateStore(rig.pinia).state).toBe('saved');
		rig.unmount();
	});

	it('compose a detail drawn straight after a drag with that drag', async () => {
		const rig = await designerRig({ shape: TOILET });
		await toolbar(rig, 'designer.toolbar.select');

		drag(rig, IN_BOWL, IN_MOVED_BOWL);
		rig.toolbarButton(t('en', 'designer.toolbar.draw-rect')).click();
		drag(rig, RECT_FROM, RECT_TO);
		await settle();

		expect(await detailIds(rig)).toEqual(['detail-1', 'detail-2', 'detail-3']);
		await expectBowlMoved(rig, 100);
		expect(useSaveStateStore(rig.pinia).state).toBe('saved');
		rig.unmount();
	});
});

describe('a press held behind a queued write', () => {
	/**
	 * Green before the chain existed too — Escape cancelled the live drag then. What it pins is that
	 * `cancel` drops a HELD press, so nothing replays it once the write lands: drop that and the bowl
	 * ends 200 mm right.
	 */
	it('is abandoned by Escape, and never replayed', async () => {
		const rig = await designerRig({ shape: TOILET });
		await toolbar(rig, 'designer.toolbar.select');

		drag(rig, IN_BOWL, IN_MOVED_BOWL);
		pressAndMove(rig, IN_MOVED_BOWL, FURTHER);
		tap(rig, 'Escape');
		release(rig, FURTHER);
		await settle();

		await expectBowlMoved(rig, 100);
		expect(useSaveStateStore(rig.pinia).state).toBe('saved');
		rig.unmount();
	});

	/**
	 * Green before the chain existed too, for the refusal's own reason. What it pins is Amendment 1's
	 * press-read version surviving the replay: a release made conditional on the version the store
	 * holds AT RELEASE — the peer's, once its refresh has landed — writes over the peer's facing.
	 */
	it('stays conditional on the design it was replayed on, so a peer write before its release refuses it', async () => {
		const rig = await designerRig({ shape: TOILET });
		await toolbar(rig, 'designer.toolbar.select');

		drag(rig, IN_BOWL, IN_MOVED_BOWL);
		pressAndMove(rig, IN_MOVED_BOWL, FURTHER);
		// The first write lands, and the held press is replayed on the design it left.
		await settle();
		expectOk(await rig.peer.setFacing.execute({ assetId: rig.assetId, facing: 0 }));
		// The peer's refresh lands too: the store now holds a newer version than the press read.
		await settle();
		expect(useAssetDesignStore(rig.pinia).design?.shape?.facing).toBe(0);
		release(rig, FURTHER);
		await settle();

		expect((await rig.document()).shape?.facing).toBe(0);
		await expectBowlMoved(rig, 100);
		expect(useSaveStateStore(rig.pinia).state).toBe('save-error');
		rig.unmount();
	});
});
```

- [ ] **Step 5: Run the new and rewritten tests and watch them fail**

Run: `npx vitest run tests/presentation/designer/selection/editShape.test.ts tests/presentation/designer/tools/designerSelectHold.test.ts tests/presentation/designer/tools/detailWrite.test.ts tests/presentation/designer/designerWriteChain.test.ts --testTimeout=20000`

Expected: `Tests  21 failed | 4 passed (25)`. vitest runs without type-checking; `vue-tsc` would also refuse the rig's new options until Step 7.
- `editShape.test.ts`: all 9 fail with `TypeError: createWriteChain is not a function`. Verified by probe.
- `designerSelectHold.test.ts`: 6 fail, verified by probe. The press is processed at once: `is held…` fails with `expected [ { kind: 'detail', id: 'detail-2' } ] to deeply equal []`; `is replayed with only its latest move…` fails with `expected [ { x: -102, y: 27 }, …(3) ] to deeply equal [ { x: -52, y: 27 }, …(3) ]`. The live-press case passes today; it guards the replay arm with no release.
- `detailWrite.test.ts`: 2 fail, verified by probe (`expected [ { shape: { …(9) }, …(1) } ] to deeply equal []`; `expected false to be 'asset.no-footprint'`). The redo case passes today; it guards the build-once arm.
- `designerWriteChain.test.ts`: 4 fail and the 2 guards pass. The failures match what was measured for these streams: the second drag leaves the bowl at +100, the arrow at +100 with `save-error`, the manual-Select drag at +0, and the draw is refused with details still `['detail-1', 'detail-2']`. This exact file is the implementer's check.

- [ ] **Step 6: Write the chain**

Replace the whole of `src/presentation/designer/selection/editShape.ts` with:

```ts
import type { ValidationError } from '../../../core/errors/AppError';
import { err, ok, type Result } from '../../../core/result/Result';
import type { DispatchResult } from '../../../application/commands/DispatchOutcome';
import type { EntityVersion } from '../../../application/ports/versioning';
import type { AssetShape } from '../../../domain/asset/AssetShape';
import { createSerialQueue } from '../../editor/tools/serial-queue';

/** A pure whole-shape edit from `shapeEdits.ts`/`detailEdits.ts`: the edited shape, or why not. */
export type ShapeEdit = (shape: AssetShape) => Result<AssetShape, ValidationError>;

/**
 * One whole-shape edit of the leaf's current design (symbols spec, Amendment 1): a pure edit, dispatched
 * as ONE `SetAssetShape` conditional on the version the step read, or not dispatched at all.
 *
 * An edit may answer `null` for "nothing to do on the shape I was handed" (Amendment 2) — a key whose
 * part a queued Delete already removed. That resolves `no-write` and dispatches nothing, so it pushes
 * no undo entry: `CommandHistory` pushes one for ANY ok result a command answers, which is why the
 * check lives here and never inside a command.
 *
 * It RESOLVES every outcome rather than reporting one, so a field can show a refusal beside itself
 * and a key binding can hand it to `notifyIfRefused` — which sends a pre-write `Validation` refusal to
 * a notice and a write-boundary one to the save indicator, so one door serves both halves.
 */
export type EditShape = (edit: (shape: AssetShape) => ReturnType<ShapeEdit> | null) => Promise<DispatchResult>;

/**
 * The designer leaf's ONE write chain (symbols spec, Amendment 2): every gesture's write is a step on
 * it — a tool's release through the runtime's queued dispatcher, and an `editShape` call — and a step
 * runs only once every earlier one has SETTLED, its read-back included. So a step that reads the design
 * reads what the previous write left, and two gestures made before the first refresh lands compose
 * rather than the second being refused as a version conflict against the user's own first.
 *
 * `writing` and `settled` are the Select tool's two questions for a press (`DesignerSelectTool`'s
 * `hold`): is a write still queued, and when will every write queued so far have landed. `settled`
 * queues an empty step rather than counting one, so it never reads as writing itself.
 *
 * The queue is `createSerialQueue`, shared rather than copied, so a step that rejects cannot wedge the
 * steps behind it; `pending` is decremented in a `finally` for the same reason.
 */
export function createWriteChain(): {
	readonly enqueue: <T>(step: () => Promise<T>) => Promise<T>;
	readonly writing: () => boolean;
	readonly settled: () => Promise<void>;
} {
	const queue = createSerialQueue();
	let pending = 0;
	return {
		enqueue: (step) => {
			pending += 1;
			return queue(async () => {
				try {
					return await step();
				} finally {
					pending -= 1;
				}
			});
		},
		writing: () => pending > 0,
		settled: () => queue(() => Promise.resolve()),
	};
}

/**
 * `design` is read INSIDE the step — a designer leaf edits and re-reads without remounting, and a step
 * queued behind a write must see what that write left. Nothing read yet, or nothing drawn, is
 * `no-write`: there is no shape for an edit to act on, which is not a refusal. What a caller acts ON —
 * the selection — is captured before it calls, never inside the step.
 *
 * `write` must NOT be the chain's own queued dispatcher: a step dispatching through it would wait behind
 * itself. The runtime hands the fault-mapped dispatcher unqueued.
 *
 * A fault in `design()`, the edit or `write` rejects the returned promise rather than throwing at the
 * call. Nothing catches that rejection: `write` resolves every coded refusal, so only a programming
 * fault gets here — and the key bindings `void` the promise, so it surfaces as an unhandled rejection.
 */
export function createEditShape(
	enqueue: <T>(step: () => Promise<T>) => Promise<T>,
	design: () => { readonly shape: AssetShape | null; readonly geometryVersion: EntityVersion } | null,
	write: (shape: AssetShape, expected: EntityVersion) => Promise<DispatchResult>,
): EditShape {
	return (edit) =>
		enqueue(async (): Promise<DispatchResult> => {
			const current = design();
			if (current === null || current.shape === null) return ok('no-write');
			const next = edit(current.shape);
			if (next === null) return ok('no-write');
			if (!next.ok) return err(next.error);
			return await write(next.value, current.geometryVersion);
		});
}
```

- [ ] **Step 7: Hold a press made while the chain is busy**

In `src/presentation/designer/tools/designer-select-tool.ts`:

(a) Replace:

```ts
	readonly reportInvalidInput: (error: AppError) => void; // a domain refusal at release; nothing dispatched
}
```

with:

```ts
	readonly reportInvalidInput: (error: AppError) => void; // a domain refusal at release; nothing dispatched
	/** Whether a write this leaf queued has not settled yet, its read-back included (`createWriteChain`). */
	readonly writing: () => boolean;
	/** Resolves once every write queued so far has settled. */
	readonly settled: () => Promise<void>;
}

/** A press made while a write was still queued: held, with its latest move and its release, until that write settles. */
interface Held {
	readonly down: EditorPointerEvent;
	move: EditorPointerEvent | null;
	up: EditorPointerEvent | null;
}
```

(b) In the class docblock, replace:

```ts
 * **A release does not join `runtime.editShape`'s serialised chain** (`selection/editShape.ts`), any
 * more than a draw does (`registerDesignerTools.ts`'s `detailWrite`). So a second gesture begun before
 * the first write's refresh lands — another drag or bend, an arrow key, an inspector field — reads the
 * design from before that write, and its own write is refused as a version conflict and reported as if
 * a peer had written. That is safe: the condition refuses and nothing is overwritten. Routing the
 * release through the chain is not the fix, because the version the press read is the right condition
 * for a drag.
```

with:

```ts
 * **Every write joins the leaf's ONE write chain** (`selection/editShape.ts`'s `createWriteChain`, spec
 * Amendment 2): `commit` dispatches through the context's dispatcher, which the runtime queues behind
 * every earlier write and its read-back. And a press that arrives while a write is still queued is
 * HELD (`hold`) and replayed once the chain drains, so a second drag or bend begun before the first
 * one's refresh lands reads the design that write left — the one its preview showed — and is
 * conditional on THAT version. A write queued after a press was taken still refuses its drag, which is
 * the version check doing its job: nothing is overwritten.
```

(c) Replace:

```ts
	private bend: Bend | null = null;
	private previewGeneration = 0;
```

with:

```ts
	private bend: Bend | null = null;
	private held: Held | null = null;
	private previewGeneration = 0;
```

(d) In `pointerDown`, replace:

```ts
		if (this.bend !== null) this.abandonGesture();
		this.drag = null;
		const selection = this.deps.selection();
```

with:

```ts
		if (this.bend !== null) this.abandonGesture();
		this.drag = null;
		if (this.deps.writing()) {
			this.hold(event);
			return;
		}
		const selection = this.deps.selection();
```

(e) Replace:

```ts
	pointerMove(event: EditorPointerEvent): void {
		if (this.bend !== null) {
```

with:

```ts
	pointerMove(event: EditorPointerEvent): void {
		if (this.held !== null) {
			this.held.move = event;
			return;
		}
		if (this.bend !== null) {
```

(f) Replace:

```ts
		if (event.button !== 'primary') return;
		if (this.bend !== null) {
			// `CurveTool` takes the release's own bulge and drops its drag; `finish` then commits.
```

with:

```ts
		if (event.button !== 'primary') return;
		if (this.held !== null) {
			this.held.up = event;
			return;
		}
		if (this.bend !== null) {
			// `CurveTool` takes the release's own bulge and drops its drag; `finish` then commits.
```

(g) Replace:

```ts
	/** A press with no release yet — so Escape mid-gesture abandons it before it clears the selection. */
	hasDraft(): boolean {
		return this.drag !== null || this.bend !== null;
	}
```

with:

```ts
	/** A press with no release yet, or one held behind a write — so Escape abandons it before it clears the selection. */
	hasDraft(): boolean {
		return this.drag !== null || this.bend !== null || this.held !== null;
	}
```

(h) Replace:

```ts
	private dropGesture(): void {
		this.drag = null;
		this.bend = null;
		this.deps.setPreview(null);
	}
```

with:

```ts
	private dropGesture(): void {
		this.drag = null;
		this.bend = null;
		this.held = null;
		this.deps.setPreview(null);
	}

	/**
	 * A press made while a write is still queued is HELD, with its latest move and its release, and
	 * replayed once every write queued so far has settled — so it reads, and a drag is conditional on,
	 * the design those writes left (spec Amendments 1 and 2). Replayed through the public doors, so a
	 * press that finds another write queued by then is simply held again with what it carried.
	 */
	private hold(down: EditorPointerEvent): void {
		const held: Held = { down, move: null, up: null };
		this.held = held;
		void this.replayWhenSettled(held);
	}

	private async replayWhenSettled(held: Held): Promise<void> {
		await this.deps.settled();
		// Escape, an interruption or a tool switch dropped it, or a later press replaced it.
		if (this.held !== held) return;
		this.held = null;
		this.pointerDown(held.down);
		if (held.move !== null) this.pointerMove(held.move);
		if (held.up !== null) this.pointerUp(held.up);
	}
```

`replayWhenSettled` is an `async` method rather than a `.then` callback, because oxlint's `promise(always-return)` refuses a `then` that returns nothing (it fired on exactly that shape in the probe).

- [ ] **Step 8: Read the design again when a drawn detail's step runs**

In `src/presentation/designer/tools/registerDesignerTools.ts`, replace:

```ts
import type { AssetId } from '../../../domain/asset/AssetId';
```

with:

```ts
import type { DispatchResult } from '../../../application/commands/DispatchOutcome';
import type { EntityVersion } from '../../../application/ports/versioning';
import type { AssetId } from '../../../domain/asset/AssetId';
```

and replace the whole `detailWrite` docblock and function (from `/**\n * The ONE write all three detail tools build:` through the function's closing `}`) with:

```ts
/**
 * `addDetail` over the design `selectTool.design()` answers NOW, pending by the capture rule, with the
 * version a write of it is conditional on and the id the new detail will have.
 *
 * A shapeless asset refuses THROUGH `requireShape` (`updateAssetShape.ts`), the one function that owns
 * that code and its sentence, rather than a second spelling of them here: a detail, like a clearance,
 * is drawn relative to a footprint.
 */
function detailOn(deps: DesignerToolDeps, name: string, outline: CurvedPolygon): Result<{ readonly shape: AssetShape; readonly expected: EntityVersion; readonly detailId: string }, ValidationError> {
	const design = deps.selectTool.design();
	// A null shape only ever gets `requireShape`'s refusal, which is all the cast states.
	if (design === null) return requireShape(null) as Result<never, ValidationError>;
	const added = addDetail(design.shape, { name, outline, line: 'solid', pending: deps.detailPending(design.shape) });
	if (!added.ok) return err(added.error);
	return ok({ shape: added.value, expected: design.geometryVersion, detailId: nextDetailId(design.shape) });
}

/**
 * The ONE write all three detail tools build, and it asks `detailOn` TWICE, for two reasons.
 *
 * - **At release**, so a domain refusal is the tool's own: it reaches `reportInvalidInput` and
 *   dispatches nothing (the one-gesture constraint).
 * - **When its step runs**, inside `execute`: the leaf's dispatcher queues this write behind every
 *   earlier write and its read-back (`createWriteChain`, spec Amendment 2), so a draw released before a
 *   drag's or a nudge's refresh landed builds on what that write left rather than being refused as a
 *   version conflict. `detailId` is re-pointed at the id that read gives, and the tool reads it only
 *   once the dispatch has resolved. A refusal here is the dispatcher's answer, reported as one.
 *
 * The command is built ONCE: a redo re-executes the same write rather than reading the design again.
 */
function detailWrite(deps: DesignerToolDeps, name: string, outline: CurvedPolygon): DetailWrite {
	const released = detailOn(deps, name, outline);
	if (!released.ok) return err(released.error);
	let command: UndoableCommand | null = null;
	const write = {
		detailId: released.value.detailId,
		command: {
			execute: async (): Promise<DispatchResult> => {
				if (command === null) {
					const step = detailOn(deps, name, outline);
					if (!step.ok) return err(step.error);
					command = deps.selectTool.createCommand(step.value.shape, step.value.expected);
					write.detailId = step.value.detailId;
				}
				return await command.execute();
			},
			// Undo is only ever asked of a write whose `execute` succeeded, which built the command.
			undo: () => (command as UndoableCommand).undo(),
		},
	};
	return ok(write);
}
```

`DrawDetailTool` and `traceDetailTool` are unchanged. Both read `write.detailId` only after `commandDispatcher.run` resolves, and the value they hold is this same object.

- [ ] **Step 9: Build the chain in the runtime**

In `src/presentation/designer/runtime.ts`:

(a) Replace `import { createEditShape, type EditShape } from './selection/editShape';` with `import { createEditShape, createWriteChain, type EditShape } from './selection/editShape';`.

(b) In `DesignerRuntime`, replace the `editShape` docblock:

```ts
	/**
	 * One whole-shape edit of the design this leaf read, dispatched through `toolDispatcher` as ONE
	 * `SetAssetShape` conditional on that read's `geometryVersion` — or not at all when the edit
	 * refuses or nothing is drawn (`selection/editShape.ts`). RESOLVES, like `commitHeight`, so a field
	 * can place a refusal beside itself; a key binding hands the result to `notifyIfRefused`.
	 */
```

with:

```ts
	/**
	 * One whole-shape edit of the design this leaf holds, queued on the leaf's one write chain behind
	 * every gesture's write and read-back, and dispatched as ONE `SetAssetShape` conditional on the
	 * version its step reads — or not at all when the edit refuses, has nothing to do, or nothing is
	 * drawn (`selection/editShape.ts`). RESOLVES, like `commitHeight`, so a field can place a refusal
	 * beside itself; a key binding hands the result to `notifyIfRefused`.
	 */
```

(c) Replace the whole `selectToolDeps` function (its docblock stays) with the version below, and add `designWrites` directly after it:

```ts
function selectToolDeps(
	store: ReturnType<typeof useAssetDesignStore>,
	edits: ReversibleAssetDesignCommands,
	assetId: AssetId,
	chain: Pick<ReturnType<typeof createWriteChain>, 'writing' | 'settled'>,
): DesignerSelectToolDeps {
	return {
		design: () => {
			const design = store.design;
			return design?.shape ? { shape: design.shape, geometryVersion: design.geometryVersion } : null;
		},
		selection: () => store.selection,
		mode: () => store.mode,
		select: (next) => store.select(next),
		setPreview: (shape) => store.setPreview(shape),
		createCommand: (shape, expected) => edits.setShape({ assetId, shape, expected }),
		reportRejected: reportDispatchFailure,
		reportInvalidInput: notifyOperationFailure,
		writing: chain.writing,
		settled: chain.settled,
	};
}

/**
 * This leaf's ONE write chain (symbols spec, Amendment 2) and the two doors onto it, built here for
 * `calibrationDeps`' reason: `buildRuntime` sits at its 100-line budget.
 *
 * - `toolDispatcher` is the tools' door, handed to every `EditorContext`: the leaf's dispatcher QUEUED on
 *   the chain, then mapped so `run` RESOLVES a coded refusal instead of rejecting. A tool dispatches
 *   detached, so an unmapped rejection was an unhandled one and the gesture said nothing;
 *   `EditorContextDeps` requires the mapped form, which is what stops this surface — or a third — from
 *   composing a context without it.
 * - `editShape` queues a step of its own that reads the design when it runs, and writes through a
 *   SECOND mapping of the same dispatcher that is NOT queued: a step dispatching through the queued door
 *   would wait behind itself for ever.
 *
 * `withStateRefresh`'s own queue is not the chain, measured rather than assumed: a step that finds
 * nothing to do would have to answer from inside a command's `execute`, and `CommandHistory` pushes an
 * undo entry for any ok result, `no-write` included; and the Select tool's hold needs to ask whether a
 * write is queued, which that decorator — shared with the plan editor — does not say.
 */
function designWrites(
	dispatcher: RefreshedHistory,
	logger: AssetDesignerContext['logger'],
	store: ReturnType<typeof useAssetDesignStore>,
	setShape: DesignerSelectToolDeps['createCommand'],
) {
	const chain = createWriteChain();
	const unqueued = mapDispatchFaults(dispatcher, logger, DISPATCH_FAULT_EVENT);
	return {
		chain,
		toolDispatcher: mapDispatchFaults({ run: (command) => chain.enqueue(() => dispatcher.run(command)) }, logger, DISPATCH_FAULT_EVENT),
		editShape: createEditShape(chain.enqueue, () => store.design, (shape, expected) => unqueued.run(setShape(shape, expected))),
	};
}
```

(d) In `buildRuntime`, delete:

```ts
	// The tools' own door: the same dispatcher, with `run` mapped so it RESOLVES a coded refusal
	// instead of rejecting. A tool dispatches detached, so an unmapped rejection was an unhandled
	// one and the gesture said nothing. `EditorContextDeps` requires the mapped form, which is
	// what stops this surface — or a third — from composing a context without it.
	const toolDispatcher = mapDispatchFaults(dispatcher, context.logger, DISPATCH_FAULT_EVENT);

```

(its reasoning now lives on `designWrites`), and replace:

```ts
	const edits: ReversibleAssetDesignCommands = context.commands.designEdits({ noteLedger, geometryLedger });
```

with:

```ts
	const edits: ReversibleAssetDesignCommands = context.commands.designEdits({ noteLedger, geometryLedger });
	const { chain, toolDispatcher, editShape } = designWrites(dispatcher, context.logger, store, (shape, expected) => edits.setShape({ assetId, shape, expected }));
```

`toolDispatcher` is read only inside the `ToolManager` factory closure and `commitHeight`, both below this line.

(e) Replace `selectTool: selectToolDeps(store, edits, assetId),` with `selectTool: selectToolDeps(store, edits, assetId, chain),`.

(f) In the returned object, replace:

```ts
		editShape: createEditShape(() => store.design, (shape, expected) => toolDispatcher.run(edits.setShape({ assetId, shape, expected }))),
```

with:

```ts
		editShape,
```

- [ ] **Step 10: Run the tests and watch them pass**

Run: `npm run check:fast -- tests/presentation/designer/selection/editShape.test.ts tests/presentation/designer/tools/designerSelectHold.test.ts tests/presentation/designer/tools/detailWrite.test.ts tests/presentation/designer/designerWriteChain.test.ts tests/presentation/designer/tools/drawDetailTool.test.ts tests/presentation/designer/tools/designerSelectTool.test.ts tests/presentation/designer/tools/designerSelectBend.test.ts`

Expected: oxlint and `vue-tsc` report nothing, then `Test Files  7 passed (7)`. Verified green by probe for every file except `designerWriteChain.test.ts`, whose cases were green in their verified form.

Run (this task widens `DesignerSelectToolDeps` and the runtime's composition): `npm run check:fast -- tests/presentation tests/helpers tests/harness`

Expected: every test file passes. By probe against this implementation, these were all green:
- `designerSelectBend` 5, `designerSelectTool` 21, `designerToolUnits` 14, `drawDetailTool` 19
- `assetDesignerRoot` 21, `assetDimensions` 12, `assetPresetFlow` 6
- `designerBackground` 7, `designerCalibration` 4, `designerCrossLeaf` 4, `designerDrawDetails` 10
- `designerEscapeRouting` 3, `designerGesture` 4, `designerInspector` 15
- `designerKeyboard` 13, `designerKeys` 25, `designerRefresh` 22
- `designerSelection` 8, `designerSelectionInspector` 31, `designerToolbar` 30, `designerTools` 18

If a case times out, re-run with `--testTimeout=20000` before believing it.

- [ ] **Step 11: Lint, fallow, budgets**

Run: `npx eslint src/presentation/designer/selection/editShape.ts src/presentation/designer/tools/designer-select-tool.ts src/presentation/designer/tools/registerDesignerTools.ts src/presentation/designer/runtime.ts tests/helpers/designerSelection.ts tests/presentation/designer/selection/editShape.test.ts tests/presentation/designer/tools/designerSelectHold.test.ts tests/presentation/designer/tools/detailWrite.test.ts tests/presentation/designer/designerWriteChain.test.ts tests/presentation/designer/tools/drawDetailTool.test.ts`
Expected: no output, exit 0.

Run: `npx fallow dead-code` then `npx fallow dupes`
Expected: no finding that names a file this task touched. `createWriteChain` is consumed by `runtime.ts`. `designWrites` is not exported, and its inferred return type names no private type. If `dupes` pairs `designerWriteChain.test.ts` with `designerSelection.test.ts` or `designerKeyboard.test.ts` over the pointer helpers, rename or reshape the local helper rather than adding a press-without-release helper to `tests/helpers/designerRig.ts`: that rig's docblock refuses one.

Budgets (ESLint counts measured by probe on this exact code, blank lines and comments skipped):
- `runtime.ts`: 224 → 241 of 400. `buildRuntime` stays at 99 of 100 (the deleted `toolDispatcher` line is replaced by the destructuring). `selectToolDeps` 22, `designWrites` 14.
- `designer-select-tool.ts`: 218 → 251 of 400. `pointerDown` 32 lines, complexity 9; `pointerMove` 13, complexity 5; `pointerUp` 19, complexity 6; `hold` 5; `replayWhenSettled` 8, complexity 4.
- `registerDesignerTools.ts`: 145 → 167 of 400. `detailOn` 7, `detailWrite` 21, `registerDesignerTools` 65.
- `editShape.ts`: 45 of 400. `createWriteChain` 22, `createEditShape` 15.
- Tests, raw lines (all under 450): `editShape.test.ts` about 190, `designerSelectHold.test.ts` about 125, `detailWrite.test.ts` about 140, `designerWriteChain.test.ts` about 190, `tests/helpers/designerSelection.ts` 113.

- [ ] **Step 12: Commit**

```bash
git add src/presentation/designer/selection/editShape.ts src/presentation/designer/tools/designer-select-tool.ts src/presentation/designer/tools/registerDesignerTools.ts src/presentation/designer/runtime.ts tests/helpers/designerSelection.ts tests/presentation/designer/selection/editShape.test.ts tests/presentation/designer/tools/designerSelectHold.test.ts tests/presentation/designer/tools/detailWrite.test.ts tests/presentation/designer/designerWriteChain.test.ts tests/presentation/designer/tools/drawDetailTool.test.ts
git commit -m "$(cat <<'EOF'
fix(designer): one write chain for every designer gesture

A second drag, an arrow tap or a draw made before the previous write's
read-back landed read the pre-write version and was refused as a
revision conflict (save-error, gesture lost). The leaf now owns one
write chain: the tools' dispatcher and editShape both queue on it, a
drawn detail re-reads the design when its step runs, and the select
tool holds a press made while a write is queued, replaying it once the
chain drains so the drag reads, and is conditional on, the design the
user saw. withStateRefresh's queue could not be the chain: a step with
nothing to do would push an empty undo entry.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

**Captures:** none. The chain changes timing only, and no shot or entry capture records a gesture in flight.

---

### Task 9: Simplification review of the selection feature

Part C3. **Review only: no code change and no commit.** The findings file lives under `.superpowers/`, which `.gitignore` excludes (line 70). Qualifying findings become Task 10 onward in the controller's committed plan amendment. Not probe-verified; there is no code to verify.

**Files:**
- Create (gitignored): `C:\Projects\renovation-planner\.claude\worktrees\plan-editor-improvements-80c30e\.superpowers\sdd\2026-09-14-asset-designer-selection-polish\task-9-review.md`
- Read: `src/presentation/designer/selection/` (`designerSelection.ts`, `editShape.ts`, `handles.ts`, `hitTest.ts`, `partExtent.ts`, `selectionDrag.ts`, `snapCandidates.ts`), `src/presentation/designer/tools/` (`designer-select-tool.ts`, `draw-detail-tool.ts`, `registerDesignerTools.ts`, `set-anchor-tool.ts`, `set-facing-tool.ts`), `src/presentation/designer/inspector/` (`DesignerInspector.vue`, `DesignerSelectionInspector.vue`), `src/domain/asset/shapeEdits.ts`, `src/domain/asset/detailEdits.ts`

**Interfaces:**
- Consumes: the tree as it stands after Tasks 1–8 are committed.
- Produces: a numbered findings file the controller reads. Nothing in `src/` or `tests/` changes.

- [ ] **Step 1: Confirm the tree is the one to review**

Run: `git log --oneline -10` and `git status --short`
Expected: Tasks 1–8's commits are on top, and the status is empty. If a task is missing, STOP and report it: a review of an unfinished tree finds what the next task deletes anyway.

- [ ] **Step 2: Run the over-engineering pass**

Invoke the `ponytail-review` skill (Skill tool, `skill: "ponytail-review"`) with the args `src/presentation/designer/selection src/presentation/designer/tools src/presentation/designer/inspector src/domain/asset/shapeEdits.ts src/domain/asset/detailEdits.ts — review the files as they stand, not a diff`. It answers one line per finding: location, what to cut, what replaces it. Read every file in the scope yourself as well, looking for four kinds of thing:
1. **Dead flexibility**: a parameter, option or door with one caller or one value.
2. **Duplicated steps**: the same read-edit-validate sequence spelled twice.
3. **Unreachable guards that cost branch arms**: an `if` no production input reaches. Ruling B4 already measured one candidate: the leftover-bend abandon in `DesignerSelectTool.pointerDown`, reachable only by a secondary release that `EditorSurface` never forwards.
4. **Prose stating a count or a claim no check holds**: "TWO callers", "the only place", "every tool", and the like.

Seed candidates to check, not pre-judged:
- The `kind` guards inside `selectionKeyActions().deleteSelection`/`duplicateSelection`, which `designerShortcut` already asked at the press.
- `DesignerSelectTool`'s `never`/`nothing` `CurveToolActions` stubs.
- `detailWrite`'s `requireShape(null) as Result<never, ValidationError>` cast.
- Every "callers" count in the docblocks of `registerDesignerTools.ts` and `designer-select-tool.ts`.

- [ ] **Step 3: Check each candidate against the code, the tests and coverage**

For each candidate:
- Find every caller: `rg -n "<symbol>" src tests`.
- Find the tests that cover it: `rg -n "<symbol or behaviour>" tests/presentation/designer tests/domain/asset`.
- Check every docblock claim of the form "N callers" or "the only" against a grep made in the same step. Write the finding from what the grep printed.

Then measure coverage for the scope in one foreground run:

Run: `npx vitest run tests/presentation/designer tests/domain/asset --coverage.enabled=true --coverage.reporter=json --coverage.reportsDirectory=C:/Users/LUISME~1/AppData/Local/Temp/task9-coverage --coverage.include=src/presentation/designer/selection/** --coverage.include=src/presentation/designer/tools/** --coverage.include=src/presentation/designer/inspector/** --coverage.include=src/domain/asset/shapeEdits.ts --coverage.include=src/domain/asset/detailEdits.ts --testTimeout=20000`

Expected: the suites pass. A coverage-threshold message from this partial run is NOT a finding: the floors in `vitest.config.ts` are whole-suite figures. Read `coverage-final.json` from that directory. For each candidate, record the branch arms it owns BY SOURCE LOCATION (file:line:column of the arm), never by istanbul id, which differs between runs. An arm that is never taken is a stronger candidate. An arm taken only by a unit case that drives an input no production path produces is a candidate whose test would go with it.

- [ ] **Step 4: Write the findings file**

Create `C:\Projects\renovation-planner\.claude\worktrees\plan-editor-improvements-80c30e\.superpowers\sdd\2026-09-14-asset-designer-selection-polish\task-9-review.md` (create the directory if it is missing) with this header, then one numbered section per candidate, rejected candidates included:

```markdown
# Task 9 — simplification review of the asset designer selection feature

Reviewed at: <`git rev-parse --short HEAD`>, after Tasks 1–8.
Scope: src/presentation/designer/selection/, src/presentation/designer/tools/, src/presentation/designer/inspector/, src/domain/asset/shapeEdits.ts, src/domain/asset/detailEdits.ts.
Rule: a finding qualifies only if it shrinks code or removes a real risk WITHOUT changing behaviour; a behavioural one must name the test that would fail today.

## Finding 1: <short title>

- **Location:** `<path>` — `<symbol>` (lines as of the reviewed commit)
- **Kind:** dead flexibility | duplicated step | unreachable guard | unchecked prose claim
- **Cut:** <exactly what is deleted>
- **Replacement:** <what stands in its place, or "nothing">
- **Behaviour change:** none | yes — failing test: `<test file>` › "<case name>" (and what it asserts)
- **Covering tests:** `<test file>` › "<case name>", …
- **Coverage arms freed:** `<file>:<line>:<col>` (then-arm / else-arm), … — N arms; or "none"
- **Verdict:** QUALIFIES | REJECTED — <one sentence why>
```

Rules for the file:
- Name every location by symbol as well as by line, since lines move.
- A prose finding quotes the sentence and the grep that contradicts it.
- A finding whose cut would also delete a test names that test under **Covering tests** and says so under **Cut**.
- A REJECTED finding says which rule refused it: a ruling in this plan, a Global Constraint, or "changes behaviour with no failing test".

- [ ] **Step 5: Confirm nothing tracked changed**

Run: `git status --short`
Expected: empty. The findings file is gitignored, and no source or test file was edited. Report the findings file's path and the count of QUALIFIES and REJECTED findings to the controller.

**Captures:** none.

---

## Amendment 1 — 2026-09-14, from Task 1's capture critique

Task 1 took 30 designer captures and wrote 27 numbered critique findings (git-ignored, `.superpowers/sdd/…/task-1-critique.md`). The controller's rulings:

- **Accepted, as Tasks 10–14:** #1 an opened asset is not framed (Task 10); #2 the unscaled warning fails contrast in light, #5 Undo/Redo orphaned on a wrapped row (alignment only), #15 the mode control looks like a second pressed tool, #22 selection actions at natural width, #24 toolbar titles repeat the label (Task 11); #7 a selected outline drops its dash, #8 the anchor/facing ring muddles the dot and arrowhead, #17 points and bend handles share a glyph, #19 light-theme strokes at the 3:1 floor (Task 12); #4 the asset block reads as the part's, #11 reorder buttons disable under focus, #25 the facing angle states no direction (Task 13); #6 the inspector keeps its width at a sidebar width (Task 14).
- **Already covered:** #12 (Task 3), #13 (Task 2), #14 (Task 5), #27 (Task 4).
- **Deferred, each with a trigger:** #3 handles bury a small part (Task 10's framing removes the common case; trigger: a report at small scale); #9 live size while drawing (new chrome beyond a hint; trigger: users correcting drawn sizes by number).
- **Declined:** #5's tool grouping (reorders the pinned `DESIGNER_TOOL_LABELS` order, a product decision); #10 open trace previewed closed (`GestureSketch.vue` is shared with the plan editor); #16 bold label shifts buttons 2 px (sizing trick costs more than it fixes); #18 rotation handle on an inner line (toilet-specific; moves hit-test pins); #20 two-column fields (revisit after Tasks 3 and 14 change the column); #21 clearance size fields (the spec's Presentation section offers the clearance Delete only); #23 unstyled Line dropdown (the harness sheet declares no `select` rule — a manual vault check in the final task); #26 pending parts drawn like calibrated ones (a pending dash collides with `line: 'dashed'` details).
- **Execution order:** Tasks 2–8, then 10–14, then Task 9 (the review sees the polish code too), then any tasks Task 9 adds, then the final docs, changelog and re-capture task.
- **Drafting:** Tasks 10–14 were drafted from reading at `a85631b4`, against the tree Tasks 2–8 leave, and are not probe-verified; each implementer's red step is the check. Task 10's first step found no restored camera (`AssetDesignerView.getState` saves only the asset id), so the fit-on-open ruling holds as written.

### Task 10: Frame an opened asset once

Critique finding 1, ruling C#1. **Not probe-verified; the implementer's red step is the check.**

**Why the code said "an asset merely opened keeps its view" (measured, so this task stays inside the ruling):**
- `git log -S "merely opened keeps its view" -- src/presentation/designer/runtime.ts` prints one commit, `350f8513 fix(designer): frame the design after a preset is applied`.
- Its message scopes a PRESET fit: "a refused write and an asset merely opened keep their view". It describes what that commit left out. It is not a decision with a reason behind it.
- No camera is restored for a leaf. `AssetDesignerView.getState()` returns `{ assetId: this.assetId ?? '' }` and nothing else.
- `docs/development/agent-guide-increment-history.md` has no entry on framing an opened asset (grep for `merely opened`, `keeps its view` and `fit.*open`: no hits).
- So the fit runs whenever an asset opens. No restored-camera check is needed.

**Where it goes.** The fit goes in `DesignerCanvas.vue`, beside `framedBounds`, using the plan editor's own pattern (`PlanCanvas.vue`: `watch(() => editor.stageSize.width > 0 && …, fit, { once: true })`).
- It stays out of `runtime.ts`: `buildRuntime` measures 99 of 100 lines, and Task 8 leaves it at 99.
- The canvas mounts only once `design !== null` (`AssetDesignerRoot.vue`'s `v-else`), so the design is already read when the watch starts.
- It asks exactly once, at the first measured size. A shape traced later is never jumped to.

**What else the behaviour change reaches (measured by reading):**
- **`designerRig`.** Every rig case with a shape would open framed. The rig's geometry notes and the Global Constraints' rig trap (10 mm per pixel, an 80 mm grab radius) are arithmetic at `DEFAULT_VIEWPORT`. So the rig puts that camera back unless a case asks for `camera: 'opened'`.
- **`layers.test.ts`.** `frames the footprint and the clearance around it, never the outline alone` asserts that `Shift+1` MOVES the camera. After this task it opens already framed there, so that case starts from `DEFAULT_VIEWPORT`. No other case in that file reads the camera except against a `fitViewport` it computes, which is unchanged.
- **The harness.** `driveHarness` pressed `Shift+1` because the product did not fit. It stops pressing, so a capture photographs the product's own fit. `&camera=default` now puts `DEFAULT_VIEWPORT` back, which keeps `asset-designer-select-transform-unframed` showing the small-on-screen state (ruling C#3's deferred trigger).

**Files:**
- Modify: `src/presentation/designer/DesignerCanvas.vue`:
  - the `vue` import at `:44`;
  - the `framedBounds` docblock's last paragraph at `:161-162`;
  - a new `watch` directly after `framedBounds` (`:164-168`).

  Task 2 edits `:139-147` of the same file; nothing here overlaps it.
- Modify: `src/presentation/designer/runtime.ts:407-409` (a comment inside `applyShape`; no code). Task 8 does not touch `applyShape`.
- Modify: `tests/helpers/designerRig.ts` (header geometry note, `DesignerRigOptions`, the mount tail at `:330-334`, the `Viewport` import)
- Modify: `tests/presentation/designer/assetPresetFlow.test.ts` (imports; a new `describe` at the end)
- Modify: `tests/presentation/designer/layers.test.ts`: the `Viewport` import at `:35`, and one case, `frames the footprint and the clearance around it, never the outline alone` (`:306-322`)
- Modify: `tests/harness/assetDesigner.ts` (imports; `driveHarness` docblock and body, `:206-246`)
- Modify: `tests/harness/assetDesignerSelectKnob.test.ts` (header line 5; the case at `:86-101`; imports)
- Modify: `tests/harness/page.ts:8` (header phrase)
- Modify: `scripts/harness-shot.mjs:738` (comment only; the table is untouched, so its 394/400 lines do not move)

**Interfaces:**
- Consumes: `designFrame` (via `framedBounds(true)`), `EditorStore.fitTo`, `EditorStore.stageSize`, and `DEFAULT_VIEWPORT` from `src/presentation/editor/viewport/Viewport.ts`. All exist.
- Produces:
  - `DesignerRigOptions.camera?: 'default' | 'opened'`. It defaults to `'default'`, which assigns `DEFAULT_VIEWPORT` after the rig sizes the canvas.
  - The behaviour: an opened asset whose design has a shape at the canvas's first measured size is fitted exactly as `Shift+1` fits it.
  - The harness's `&camera=default` now means "put back `DEFAULT_VIEWPORT`" rather than "skip the fit".
  - No `src/` export and no shared-contract type changes.

- [ ] **Step 1: Confirm the reason still stands**

Run: `git log --oneline -S "merely opened keeps its view" -- src/presentation/designer/runtime.ts`

Expected: exactly `350f8513 fix(designer): frame the design after a preset is applied`.

Run: `grep -n "getState" -A3 src/presentation/designer/AssetDesignerView.ts`

Expected: `return { assetId: this.assetId ?? '' };`, with no camera field.

If either answer differs (a persisted camera now exists), STOP and report: ruling C#1 says to fit only when no camera was restored.

- [ ] **Step 2: Give the rig its camera option, and write the failing test**

In `tests/helpers/designerRig.ts`, change the Viewport import:

```ts
import { DEFAULT_VIEWPORT, STAGE_PIXELS, worldToScreen } from '../../src/presentation/editor/viewport/Viewport';
```

Extend the header's geometry note. Replace:

```ts
 * Geometry note: `DEFAULT_ZOOM` is 0.1 with a 48 px margin, so world = 10 × screen − 480 per
 * axis at the default camera. `at()` below derives the screen point from the LIVE viewport
```

with:

```ts
 * Geometry note: `DEFAULT_ZOOM` is 0.1 with a 48 px margin, so world = 10 × screen − 480 per
 * axis at the default camera — which an opened asset does NOT keep (`DesignerCanvas` frames it), so
 * `options.camera` puts it back unless a case asks otherwise. `at()` below derives the screen point from the LIVE viewport
```

In `DesignerRigOptions`, after `unrecoveredSettings`, add:

```ts
	/**
	 * The camera a case starts at. An asset OPENS framed (`DesignerCanvas`), which moves the camera the
	 * moment the canvas is sized; `'default'` — the default — puts `DEFAULT_VIEWPORT` back after that,
	 * because the geometry every case here reasons in (10 mm per pixel, an 80 mm grab radius, the header's
	 * `world = 10 × screen − 480`) is arithmetic at that camera, and a user reaches it by zooming out.
	 * `'opened'` keeps what opening did, for the cases about the opening fit itself.
	 */
	readonly camera?: 'default' | 'opened';
```

Replace the mount tail (`:330-334`):

```ts
	placeAt(canvasEl, 0, 0, 800, 600);
	resizeTo(canvasEl, 800, 600);
	await settle();

	const editor = useEditorStore(pinia);
```

with:

```ts
	placeAt(canvasEl, 0, 0, 800, 600);
	resizeTo(canvasEl, 800, 600);
	await settle();

	const editor = useEditorStore(pinia);
	if (options.camera !== 'opened') editor.viewport = DEFAULT_VIEWPORT;
```

In `tests/presentation/designer/layers.test.ts`, change `:35` to:

```ts
import { DEFAULT_VIEWPORT, fitViewport } from '../../../src/presentation/editor/viewport/Viewport';
```

In the case `frames the footprint and the clearance around it, never the outline alone` only, replace its first three lines:

```ts
		const designer = await mountDesigner(assetDesign({ shape: WITH_CLEARANCE }));
		const store = useEditorStore(designer.pinia);
		const before = store.viewport;
```

with:

```ts
		const designer = await mountDesigner(assetDesign({ shape: WITH_CLEARANCE }));
		const store = useEditorStore(designer.pinia);
		// The design opened framed (`DesignerCanvas`); start from the default camera so the press has a fit to make.
		store.viewport = DEFAULT_VIEWPORT;
		const before = store.viewport;
```

In `tests/presentation/designer/assetPresetFlow.test.ts`, add two imports:

```ts
import { DEFAULT_VIEWPORT } from '../../../src/presentation/editor/viewport/Viewport';
import { toiletShape } from '../../helpers/assetShapes';
```

and change the rig import to:

```ts
import { designerRig, tracePolygon, type DesignerRig } from '../../helpers/designerRig';
```

Append at the end of the file:

```ts
/**
 * An asset OPENS framed (selection polish critique, finding 1): once, at the canvas's first measured size,
 * exactly as `Shift+1` frames it — and only a design that HAS a shape then. `designerRig`'s
 * `camera: 'opened'` keeps what opening did; every other rig case gets the default camera back.
 */
describe('the camera an asset opens with', () => {
	it('frames an opened design exactly as Shift+1 does', async () => {
		const rig = await designerRig({ shape: toiletShape(), camera: 'opened' });
		const editor = useEditorStore(rig.pinia);
		const opened = editor.viewport;

		pressFitAll(rig.canvasEl);

		expect(opened).not.toEqual(DEFAULT_VIEWPORT);
		expect(editor.viewport).toEqual(opened);
		rig.unmount();
	});

	/**
	 * A GUARD, green before and after: the fit is asked once, at the first measure. A fit that waited for a
	 * shape instead would jump the camera the moment the user's first trace lands, away from the sheet they
	 * were tracing at.
	 */
	it('leaves a shapeless asset where it opened, and does not jump when its first outline is traced', async () => {
		const rig = await designerRig({ shape: null, camera: 'opened' });
		const editor = useEditorStore(rig.pinia);
		expect(editor.viewport).toEqual(DEFAULT_VIEWPORT);

		rig.toolbarButton(t('en', 'designer.toolbar.trace-footprint')).click();
		await settle();
		tracePolygon(rig, [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }]);
		await settle();

		expect((await rig.document()).shape).not.toBeNull();
		expect(editor.viewport).toEqual(DEFAULT_VIEWPORT);
		rig.unmount();
	});
});
```

- [ ] **Step 3: Run it to watch it fail**

Run: `npm run check:fast -- tests/presentation/designer/assetPresetFlow.test.ts tests/presentation/designer/layers.test.ts`

Expected:
- oxlint and vue-tsc clean;
- FAIL, 1 failed: `frames an opened design exactly as Shift+1 does`, with `AssertionError: expected { pan: { x: -480, y: -480 }, zoom: 0.1 } not to deeply equal { pan: { x: -480, y: -480 }, zoom: 0.1 }`;
- the guard and every `layers.test.ts` case pass.

- [ ] **Step 4: Implement the opening fit**

In `DesignerCanvas.vue`, change `:44` to:

```ts
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
```

In `framedBounds`' docblock, replace:

```ts
 * The whole-design box is `designFrame` (`runtime.ts`), which Apply preset fits to as well, so the two
 * cannot frame the same design differently.
```

with:

```ts
 * The whole-design box is `designFrame` (`runtime.ts`), which Apply preset fits to as well, and the fit an
 * opened design takes below asks this very function — so none of the three frames a design differently.
```

Directly after the closing `}` of `function framedBounds`, add:

```ts
/**
 * An asset OPENS framed, as `Shift+1` frames it (selection polish critique, finding 1): opened at the default
 * camera, a toilet was a few dozen pixels in the corner with its handles piled on it. Once, the first time
 * the stage has an area — the canvas mounts only over a design already read, so what is drawn then is the
 * design as opened. A design with no shape at that moment keeps its camera, and `once` ends the question
 * there: a footprint traced afterwards is drawn at the camera the user traced it at, never jumped to.
 * Nothing restores a camera to defer to: `AssetDesignerView.getState` persists the asset id alone. The plan
 * editor's `PlanCanvas` opens a plan the same way.
 */
watch(
	() => editor.stageSize.width > 0 && editor.stageSize.height > 0,
	() => {
		const bounds = framedBounds(true);
		if (bounds !== null) editor.fitTo(bounds, editor.stageSize);
	},
	{ once: true },
);
```

In `runtime.ts`, replace the comment inside `applyShape` (`:407-409`):

```ts
		// A preset is centred on the origin at whatever size was typed, so it can land wholly outside
		// the view it was applied from. A WRITTEN shape is framed as `Shift+1` frames it — the same
		// `fitTo` the plan editor's `selectAndFrame` takes; an asset merely opened keeps its view.
```

with:

```ts
		// A preset is centred on the origin at whatever size was typed, so it can land wholly outside
		// the view it was applied from. A WRITTEN shape is framed as `Shift+1` frames it — the same
		// `fitTo` the plan editor's `selectAndFrame` takes. An OPENED asset is framed once by `DesignerCanvas`.
```

- [ ] **Step 5: Run it to watch it pass, and watch the guard go red against its mutant**

Run: `npm run check:fast -- tests/presentation/designer/assetPresetFlow.test.ts tests/presentation/designer/layers.test.ts`

Expected: PASS, every case.

**Mutant (temporary, restore it straight after).** Change the watch source to:

```ts
	() => shape.value !== null && editor.stageSize.width > 0 && editor.stageSize.height > 0,
```

Run: `npx vitest run tests/presentation/designer/assetPresetFlow.test.ts --testTimeout=20000`

Expected: FAIL, 1 failed: `leaves a shapeless asset where it opened…`, with `AssertionError: expected { pan: …, zoom: … } to deeply equal { pan: { x: -480, y: -480 }, zoom: 0.1 }`.

Restore the source from Step 4 exactly, and re-run the same command. Expected: PASS.

- [ ] **Step 6: Stop the harness pressing a fit the product now takes**

In `tests/harness/assetDesigner.ts`, add an import beside the other `src/presentation` imports:

```ts
import { DEFAULT_VIEWPORT } from '../../src/presentation/editor/viewport/Viewport';
```

Replace the `driveHarness` docblock (`:206-223`) with:

```ts
/**
 * What every `?preset=` capture waits on. It waits first for the leaf's mount, then for TWO things before
 * touching anything: the design, which the leaf reads after it mounts, and the canvas's first measured size
 * (`EditorStore.stageSize`) — the moment `DesignerCanvas` frames an opened design, so a capture taken before
 * it would photograph the unframed camera. A bare `setTimeout(0)` promised neither.
 *
 * Then, in order:
 * - `&select=`/`&mode=`, through the REAL Select button and the leaf's own store;
 * - `&camera=default`, which puts `DEFAULT_VIEWPORT` back — the camera a user zoomed out to, where the toilet
 *   is a few dozen pixels across. No fit is pressed otherwise: a capture shows the opening fit the product
 *   took, so a regression in that fit is photographed rather than repaired by this page;
 * - `&draw=`, LAST, so the preview it leaves is drawn at the camera the capture keeps.
 *
 * Last of all it sets `data-rp-harness-ready` on the view: the mark `scripts/harness-shot.mjs`'s preset
 * shots wait on, since the view element itself is attached at mount, before any of this. The leaf's Pinia
 * is reached through the Vue app `AssetDesignerView` mounts on its host element. Harness-only: no
 * production seam exists for this, and none is added.
 */
```

Replace the body's tail (`:240-245`):

```ts
	const canvas = view.contentEl.querySelector('.rp-plan-canvas') as HTMLElement;
	if (knobs.camera !== 'default') {
		canvas.dispatchEvent(new KeyboardEvent('keydown', { key: '!', code: 'Digit1', shiftKey: true, bubbles: true }));
	}
	if (knobs.draw !== undefined) drawInHarness(view, canvas, knobs.draw);
	view.contentEl.dataset.rpHarnessReady = '';
```

with:

```ts
	if (knobs.camera === 'default') editor.viewport = DEFAULT_VIEWPORT;
	if (knobs.draw !== undefined) drawInHarness(view, view.contentEl.querySelector('.rp-plan-canvas') as HTMLElement, knobs.draw);
	view.contentEl.dataset.rpHarnessReady = '';
```

In `tests/harness/assetDesignerSelectKnob.test.ts`:

(a) Header, replace:

```ts
 * `&select=` and `&mode=`, `&pending`, `&draw=` and `&camera=default` beside `&preset=`, and the Shift+1
 * fit every preset takes.
```

with:

```ts
 * `&select=` and `&mode=`, `&pending`, `&draw=` and `&camera=default` beside `&preset=`, and the fit an
 * opened design takes.
```

If the line break falls differently, replace the same two phrases wherever they sit in lines 5-6.

(b) Add `import { DEFAULT_VIEWPORT } from '../../src/presentation/editor/viewport/Viewport';` beside the `EditorStore` import.

(c) Replace the docblock and case at `:86-101`:

```ts
/**
 * A second Shift+1 is the instrument: a fit that already ran against the measured canvas leaves the
 * camera where it is, while a fit that never ran — or ran into 0 × 0 — would move it now.
 */
it('frames a preset exactly as Shift+1 does, and &camera=default keeps the view it opened with', async () => {
```

through its closing `});`, with:

```ts
/**
 * A second Shift+1 is the instrument: the fit the designer took on opening, against the measured canvas,
 * leaves nothing for the press to move — while a fit that never ran, or ran into 0 × 0, would move it now.
 * The harness presses no fit of its own, so this is the product's.
 */
it('opens a preset framed exactly as Shift+1 frames it, and &camera=default puts the default camera back', async () => {
	const framed = await mountKnobs('curved-table');
	await landed(framed.view);
	const fitted = framed.editor.viewport;
	framed.canvas.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1', shiftKey: true, bubbles: true, cancelable: true }));
	expect(framed.editor.viewport).toEqual(fitted);
	expect(fitted).not.toEqual(DEFAULT_VIEWPORT);

	const opened = await mountKnobs('curved-table', { camera: 'default' });
	await landed(opened.view);
	expect(opened.editor.viewport).toEqual(DEFAULT_VIEWPORT);
});
```

In `tests/harness/page.ts:8`, replace `` `&camera=default` skipping the fit `` with `` `&camera=default` putting the default camera back after the opening fit ``.

In `scripts/harness-shot.mjs:738`, replace:

```js
	// The same Transform selection at the camera an opened asset keeps (`&camera=default`), where the toilet
```

with:

```js
	// The same Transform selection at the default camera (`&camera=default`, a user zoomed out), where the toilet
```

- [ ] **Step 7: Run every mounted designer suite and the harness**

The camera change reaches every mounted designer, so run the directories:

Run: `npm run check:fast -- tests/presentation/designer tests/harness tests/build/harness-shot-designer.test.ts --testTimeout=20000`

Expected: oxlint and vue-tsc clean, and every case passes. If any case OTHER than the two named above reddens on a camera assertion or a grab or snap distance, STOP and report it: never edit its expectation.

- [ ] **Step 8: Lint, budgets, fallow**

Run: `npx eslint src/presentation/designer/DesignerCanvas.vue src/presentation/designer/runtime.ts tests/helpers/designerRig.ts tests/presentation/designer/assetPresetFlow.test.ts tests/presentation/designer/layers.test.ts tests/harness/assetDesigner.ts tests/harness/assetDesignerSelectKnob.test.ts tests/harness/page.ts scripts/harness-shot.mjs`

Expected: no output.

Budgets (ESLint lines):
- `DesignerCanvas.vue`: 162 measured, 163 after Task 2 → ≈ 173 of 400;
- `runtime.ts`: unchanged, a comment only (224 measured, 241 after Task 8); `buildRuntime` untouched at 99 of 100;
- `designerRig.ts`: 219 measured → ≈ 221 of 450;
- `assetPresetFlow.test.ts`: 136 measured → ≈ 166 of 450;
- `layers.test.ts`: ≈ 358 after Task 2 → ≈ 359 of 450;
- `assetDesigner.ts`: 160 measured → ≈ 158 of 450;
- `assetDesignerSelectKnob.test.ts`: 100 measured → ≈ 101 of 450.

Run: `npx fallow dead-code` then `npx fallow dupes`. Expected: nothing naming these files.

- [ ] **Step 9: Commit**

```bash
git add src/presentation/designer/DesignerCanvas.vue src/presentation/designer/runtime.ts tests/helpers/designerRig.ts tests/presentation/designer/assetPresetFlow.test.ts tests/presentation/designer/layers.test.ts tests/harness/assetDesigner.ts tests/harness/assetDesignerSelectKnob.test.ts tests/harness/page.ts scripts/harness-shot.mjs
git commit -m "$(cat <<'EOF'
fix(designer): frame an opened asset once, as Shift+1 frames it

An opened asset kept the default camera, so a toilet was a few dozen pixels in the corner under its
own handles. The canvas now fits the design once, at its first measured size; a shapeless asset
keeps its camera and a later trace never jumps it. The rig restores the default camera its cases
reason in, and the harness no longer presses a fit of its own.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 10: Re-take the captures and open them**

Run: `npm run harness-shot` (foreground, timeout 600000).

Expected: exit 0.

Open `harness-shots/asset-designer-preset-toilet.png`, `asset-designer-preset-curved-table.png`, `asset-designer-select-transform.png` and `asset-designer-select-transform-unframed.png`. Say which were opened.

**Captures this changes:** none, by intent.
- Every preset shot was already fitted by the harness's own `Shift+1`, and the product's fit is the same call on the same box. The four opened PNGs must look as Task 1 left them.
- `-select-transform-unframed` must still show the toilet small in the corner, now through the `DEFAULT_VIEWPORT` reset.
- A difference in any of the four is a finding to report.

---

### Task 11: Designer CSS and toolbar polish

Critique findings 2, 5 (the Undo/Redo half only), 15, 22 and 24; rulings C#2, C#5, C#15, C#22 and C#24. **Not probe-verified; the implementer's red step is the check.**

**Measured before drafting:**
- `styles/designer.css` is 380 raw lines. Moving the mode-group rule out of it and into `designer-selection.css` (Task 5 leaves that file at ≈ 72) gives this task and Task 14 room.
- No test pins `.rp-designer-toolbar-spacer` (grep over `tests/`).
- `dialogKinds.test.ts:341` pins the text `.rp-dialog-warning {` in `styles/dialogs.css`, so that selector keeps its exact spelling.
- The toolbar's exact-list case reads `.rp-designer-tools button` (a descendant selector), and `rig.toolbarButton` and the harness's `pressTool` use the same one. So wrapping Undo/Redo in a group changes no list.
- The knob test's `.rp-designer-tools > button[aria-pressed="true"]` only reads buttons that carry `aria-pressed`, and Undo/Redo carry none.
- No test pins a tool button's `title`. Task 4 pins the mode buttons' titles, which stay.
- No existing designer test reads a stylesheet, so this task creates `designerStyles.test.ts`, and Tasks 13 and 14 append to it.

**Files:**
- Modify: `src/presentation/designer/DesignerToolbar.vue` (docblock; template: drop both kinds of `:title`, and replace the spacer and the two history buttons with one `.rp-designer-history` group)
- Modify: `src/presentation/designer/DesignerSelectionModes.vue` (one docblock sentence; Task 4 leaves the rest)
- Modify: `styles/designer.css` (`.rp-designer-unscaled`; `.rp-designer-toolbar-spacer` → `.rp-designer-history`; delete the `.rp-designer-selection-modes` block at the end)
- Modify: `styles/designer-selection.css` (header; append the mode group, the pressed-mode override and the action fill)
- Modify: `styles/dialogs.css:55-66` (`.rp-dialog-warning`)
- Create: `tests/presentation/designer/designerStyles.test.ts`
- Test: `tests/presentation/designer/designerToolbar.test.ts` (one new `describe` at the end)

**Interfaces:**
- Consumes: Task 3's `<p class="rp-designer-unscaled">` in the selection section, which takes the new style with no markup change. Task 4's mode-button `title`s, which are kept.
- Produces:
  - the class `rp-designer-history` (a `div` wrapping Undo and Redo, the last child of `.rp-designer-tools`);
  - `.rp-designer-toolbar-spacer` removed from markup and stylesheet;
  - no `title` on any `.rp-designer-tools > button` or history button;
  - in `tests/presentation/designer/designerStyles.test.ts`, the local helpers `onlyRule`, `partial`, `parsed`, `spelled` and `declared`, which Tasks 13 and 14 append cases against.

- [ ] **Step 1: Write the failing tests**

Create `tests/presentation/designer/designerStyles.test.ts`:

```ts
/**
 * The asset designer's stylesheet partials, read through lightningcss (`tests/helpers/selectors.ts`): jsdom
 * resolves no CSS, so what a template's class LOOKS like is only what these rules declare. Every expected
 * value is the same parser's reading of a one-rule reference sheet, so no case spells lightningcss's AST by
 * hand; and a rule is found by its WHOLE selector under its condition, so a descendant rule's declarations
 * are never read as this one's.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { propertyOf, show, stylesheetRules, type StyleRule } from '../../helpers/selectors';

function onlyRule(css: string): StyleRule {
	const [rule] = stylesheetRules(css);
	if (rule === undefined) throw new Error(`no rule parsed from: ${css}`);
	return rule;
}

const partial = (file: string): StyleRule[] => stylesheetRules(readFileSync(`styles/${file}`, 'utf8'));

/** How the parser reads `property: value`, as the one-item list `declared` answers for a single rule. */
const parsed = (property: string, value: string): unknown[] =>
	onlyRule(`.reference { ${property}: ${value}; }`).declarations.map((declaration) => declaration.value);

/** How `show` spells a selector, read off the parser rather than retyped — attribute quoting included. */
const spelled = (selector: string): string => onlyRule(`${selector} { color: inherit; }`).selectors.map(show).join(', ');

/** Every value `property` takes in the rules whose selector list names `selector`, under `condition` (`''`: none). */
function declared(rules: readonly StyleRule[], selector: string, property: string, condition = ''): unknown[] {
	const wanted = spelled(selector);
	return rules
		.filter((rule) => rule.condition === condition && rule.selectors.map(show).includes(wanted))
		.flatMap((rule) => rule.declarations.filter((declaration) => propertyOf(declaration) === property).map((declaration) => declaration.value));
}

describe('the designer’s warnings, toolbar and selection actions', () => {
	/**
	 * Critique finding 2: `--text-warning` as TEXT measured about 2.73:1 on the light inspector, under the
	 * 4.5:1 AA floor for text this size. The sentence is normal text and the warning colour is a rule on its
	 * leading edge — on the designer, and in the dimensions dialog, which makes the same claim.
	 */
	it.each([
		['designer.css', '.rp-designer-unscaled'],
		['dialogs.css', '.rp-dialog-warning'],
	])('draws %s’s %s in normal text beside a warning-coloured rule', (file, selector) => {
		const rules = partial(file);

		expect(declared(rules, selector, 'color')).toEqual(parsed('color', 'var(--text-normal)'));
		expect(declared(rules, selector, 'border-inline-start')).toEqual(parsed('border-inline-start', '2px solid var(--text-warning)'));
		expect(declared(rules, selector, 'padding-inline-start')).toEqual(parsed('padding-inline-start', 'var(--size-4-2)'));
	});

	/** Critique finding 5, the half ruled in: a `flex: 1` spacer stops pushing once the toolbar wraps. */
	it('ends Undo and Redo as one group on whichever row they land, with no spacer left', () => {
		const rules = partial('designer.css');

		expect(declared(rules, '.rp-designer-history', 'display')).toEqual(parsed('display', 'flex'));
		expect(declared(rules, '.rp-designer-history', 'margin-inline-start')).toEqual(parsed('margin-inline-start', 'auto'));
		expect(rules.flatMap((rule) => rule.selectors.map(show)).filter((selector) => selector.includes('rp-designer-toolbar-spacer'))).toEqual([]);
	});

	/** Critique finding 15: the pressed mode wore the pressed tool's accent border and read as a second tool. */
	it('draws the selection modes as one bordered control, the pressed mode without the tool’s accent border', () => {
		const rules = partial('designer-selection.css');

		expect(declared(rules, '.rp-designer-selection-modes', 'border')).toEqual(parsed('border', '1px solid var(--background-modifier-border)'));
		expect(declared(rules, '.rp-designer-selection-modes', 'border-radius')).toEqual(parsed('border-radius', 'var(--radius-s)'));
		for (const pressed of [
			'.rp-designer-tools .rp-designer-selection-modes .rp-designer-tool-active',
			'.rp-designer-tools .rp-designer-selection-modes .rp-designer-tool-active:hover',
		]) {
			expect(declared(rules, pressed, 'border-color')).toEqual(parsed('border-color', 'transparent'));
		}
	});

	/** Critique finding 22: natural-width actions over full-width asset buttons, wrapping into uneven rows. */
	it('lets each wrapped row of selection actions fill the column', () => {
		const rules = partial('designer-selection.css');

		expect(declared(rules, '.rp-designer-inspector .rp-designer-selection-actions .rp-designer-selection-button', 'flex')).toEqual(parsed('flex', '1 1 auto'));
	});
});
```

At the end of `tests/presentation/designer/designerToolbar.test.ts`, append:

```ts
/**
 * Undo and Redo sit in ONE trailing group, which `designer.css` ends on whichever row it wraps to (critique
 * finding 5), and no toolbar button repeats its label as a tooltip (finding 24): a button's text is its
 * name. The mode buttons keep their describing tooltips, pinned in `the selection mode buttons` above.
 */
describe('the toolbar’s own markup', () => {
	it('groups Undo and Redo last, and gives no button a tooltip repeating its label', async () => {
		const rig = await designerRig();
		const history = rig.wrapper.find('.rp-designer-tools > .rp-designer-history');

		expect(history.findAll('button').map((button) => button.text())).toEqual([t('en', 'designer.toolbar.undo'), t('en', 'designer.toolbar.redo')]);
		expect(rig.wrapper.find('.rp-designer-tools').element.lastElementChild).toBe(history.element);
		expect(rig.wrapper.findAll('.rp-designer-tools button').map((button) => button.attributes('title')).filter((title) => title !== undefined)).toEqual([]);
		rig.unmount();
	});
});
```

- [ ] **Step 2: Run them to watch them fail**

Run: `npm run check:fast -- tests/presentation/designer/designerStyles.test.ts tests/presentation/designer/designerToolbar.test.ts`

Expected: oxlint and vue-tsc clean. FAIL, 6 failed:
- the two `draws …’s … in normal text…` cases, each with an `AssertionError` on `toEqual`, since `color` is still `var(--text-warning)`;
- `ends Undo and Redo as one group…`, `draws the selection modes as one bordered control…` and `lets each wrapped row of selection actions fill the column`, each with `AssertionError: expected [] to deeply equal [ … ]`;
- `groups Undo and Redo last…`, with `Error: Cannot call findAll on an empty DOMWrapper.`

- [ ] **Step 3: Implement the toolbar markup**

In `DesignerToolbar.vue`, append a paragraph to the header docblock before its closing ` */`:

```ts
 *
 * **No button here carries a `title`.** Each one's text IS its accessible name, so a tooltip repeating
 * it shows a sighted user nothing new and may be announced twice (selection polish critique, finding 24).
 * The mode buttons' `title`s describe a gesture, which is why `DesignerSelectionModes` keeps them. Undo and
 * Redo are ONE group, `.rp-designer-history`, which `designer.css` ends on whichever row it wraps to — the
 * `flex: 1` spacer it replaces stopped pushing once the toolbar wrapped (finding 5).
```

Replace the whole `<template>` with:

```html
<template>
	<div
		class="rp-designer-tools"
		role="toolbar"
		:aria-label="tr('designer.toolbar')"
	>
		<button
			v-for="mode in MODES"
			:key="mode.label"
			type="button"
			class="rp-designer-tool-button"
			:class="{ 'rp-designer-tool-active': runtime.activeToolId.value === mode.id }"
			:aria-pressed="runtime.activeToolId.value === mode.id"
			@click="runtime.setTool(mode.id)"
		>
			{{ tr(mode.label) }}
		</button>
		<DesignerSelectionModes v-if="runtime.activeToolId.value === 'select' && isOutlineSelection(designStore.selection)" />
		<div class="rp-designer-history">
			<button
				type="button"
				class="rp-designer-tool-button"
				:disabled="!runtime.canUndo.value"
				@click="runtime.undo()"
			>
				{{ tr('designer.toolbar.undo') }}
			</button>
			<button
				type="button"
				class="rp-designer-tool-button"
				:disabled="!runtime.canRedo.value"
				@click="runtime.redo()"
			>
				{{ tr('designer.toolbar.redo') }}
			</button>
		</div>
	</div>
</template>
```

In `DesignerSelectionModes.vue`'s docblock (Task 4 appended a paragraph after this one; leave it), replace:

```ts
 * `button:not(.clickable-icon)` contest (`buttonSpecificity.test.ts`) style them — no second button
 * rule to argue. `styles/designer.css` adds only the group's own rule.
```

with:

```ts
 * `button:not(.clickable-icon)` contest (`buttonSpecificity.test.ts`) style them — no second button
 * rule to argue. `styles/designer-selection.css` adds only the group's border and the pressed mode's
 * plain border, which is what sets a mode apart from a pressed tool.
```

- [ ] **Step 4: Implement the stylesheet changes**

In `styles/designer.css`, replace the unscaled block:

```css
/*
 * The unscaled warning. `--text-warning`, not `--text-error`: a traced-but-uncalibrated
 * footprint is an expected, recoverable state on the way to being designed, never a fault.
 */
.rp-designer-unscaled {
	margin: 0 0 var(--size-4-2);
	font-size: var(--font-ui-smaller);
	color: var(--text-warning);
}
```

with:

```css
/*
 * The unscaled warning. The SENTENCE is `--text-normal`, and the warning colour is a rule on its leading
 * edge: `--text-warning` as text measured about 2.73:1 on `--background-secondary` in the light theme, under
 * the 4.5:1 AA floor for text this size (selection polish critique, finding 2). The words carry the meaning,
 * so the rule is decoration. `--text-warning`, not `--text-error`: a traced-but-uncalibrated footprint is an
 * expected, recoverable state on the way to being designed, never a fault.
 */
.rp-designer-unscaled {
	margin: 0 0 var(--size-4-2);
	padding-inline-start: var(--size-4-2);
	font-size: var(--font-ui-smaller);
	color: var(--text-normal);
	border-inline-start: 2px solid var(--text-warning);
}
```

Replace:

```css
.rp-designer-toolbar-spacer {
	flex: 1;
}
```

with:

```css
/*
 * Undo and Redo as ONE trailing group: `margin-inline-start: auto` ends it on the row it shares with the
 * tools and on whichever row it wraps to, where a `flex: 1` spacer stopped pushing (critique finding 5).
 */
.rp-designer-history {
	display: flex;
	gap: var(--size-4-2);
	margin-inline-start: auto;
}
```

Delete the last block of the file, from `/*` through the closing `}`, with the blank line before it:

```css
/*
 * The selection's mode control (asset designer symbols spec, Decision 10), in the toolbar only while
 * Select holds an outline. Its buttons are `.rp-designer-tool-button`s, so the flat-button and
 * active-state rules above already style them; this only groups the three and sets them off from the
 * tools with a rule on the leading edge.
 */
.rp-designer-selection-modes {
	display: flex;
	flex-wrap: wrap;
	gap: var(--size-4-1);
	padding-inline-start: var(--size-4-2);
	border-inline-start: 1px solid var(--background-modifier-border);
}
```

In `styles/designer-selection.css`, replace the header:

```css
/*
 * The asset designer inspector's section for the selected part (asset designer symbols spec,
 * "Inspector for the selection"). Its own partial because `designer.css` sits within a few lines of
 * the assembler's 400-line cap. Obsidian variables only, no colour literal (SDD §84).
 */
```

with:

```css
/*
 * The asset designer inspector's section for the selected part (asset designer symbols spec,
 * "Inspector for the selection"), and the selection's mode control in the toolbar. Its own partial
 * because `designer.css` sits within a few lines of the assembler's 400-line cap. Obsidian variables
 * only, no colour literal (SDD §84).
 */
```

Append at the end of the file, after Task 5's `:focus-visible` rule:

```css

/*
 * The selection's mode control (asset designer symbols spec, Decision 10), in the toolbar only while Select
 * holds an outline — drawn as ONE segmented control, so a mode no longer reads as a second tool pressed
 * beside Select (selection polish critique, finding 15). Its buttons are `.rp-designer-tool-button`s, so
 * `designer.css`'s flat-button rules style them; the group draws the one border round all three.
 */
.rp-designer-selection-modes {
	display: flex;
	flex-wrap: wrap;
	border: 1px solid var(--background-modifier-border);
	border-radius: var(--radius-s);
}

/*
 * The pressed MODE keeps the fill and the weight `.rp-designer-tool-active` gives it and drops the accent
 * border the pressed TOOL keeps. Three classes, with the `:hover` twin, to outrank that rule's (0,2,0) and
 * (0,3,0) without leaning on which partial `styles/index.css` imports last.
 */
.rp-designer-tools .rp-designer-selection-modes .rp-designer-tool-active,
.rp-designer-tools .rp-designer-selection-modes .rp-designer-tool-active:hover {
	border-color: transparent;
}

/*
 * Each wrapped row of actions fills the column, as Edit dimensions and Start from preset below it do
 * (critique finding 22). Qualified with `.rp-designer-inspector` for the specificity reason above.
 */
.rp-designer-inspector .rp-designer-selection-actions .rp-designer-selection-button {
	flex: 1 1 auto;
}
```

In `styles/dialogs.css`, replace `:55-66`:

```css
/*
 * A descriptor's `warning` — a sentence about the values a form is asking for, not a refusal.
 * `--text-warning` rather than `--text-muted`, which is what tells it from `.rp-dialog-message`
 * beside it: the message says what the dialog is about, and this says something is not right
 * about the data behind it. The same variable `.rp-designer-unscaled` uses on the inspector,
 * because it is the same claim reaching the user on a second surface.
 */
.rp-dialog-warning {
	margin: 0;
	font-size: var(--font-ui-smaller);
	color: var(--text-warning);
}
```

with:

```css
/*
 * A descriptor's `warning` — a sentence about the values a form is asking for, not a refusal. The words
 * are `--text-normal` and `--text-warning` is a rule on the leading edge, which is what tells it from
 * `.rp-dialog-message` beside it: the message says what the dialog is about, and this says something is
 * not right about the data behind it. Not `--text-warning` as TEXT: that measured about 2.73:1 in the light
 * theme, under the 4.5:1 AA floor (selection polish critique, finding 2). The same treatment
 * `.rp-designer-unscaled` takes on the inspector, because it is the same claim on a second surface.
 */
.rp-dialog-warning {
	margin: 0;
	padding-inline-start: var(--size-4-2);
	font-size: var(--font-ui-smaller);
	color: var(--text-normal);
	border-inline-start: 2px solid var(--text-warning);
}
```

- [ ] **Step 5: Run them to watch them pass, plus the pins that read the same markup and sheets**

Run: `npm run check:fast -- tests/presentation/designer/designerStyles.test.ts tests/presentation/designer/designerToolbar.test.ts tests/presentation/designer/designerSelection.test.ts tests/presentation/dialogs/dialogKinds.test.ts tests/harness/assetDesignerSelectKnob.test.ts tests/build/buttonSpecificity.test.ts tests/build/buttonFocusRing.test.ts tests/build/libraryComponentStyles.test.ts tests/build/styles.test.ts --testTimeout=20000`

Expected: oxlint and vue-tsc clean; every case passes. In particular:
- `offers Pan, Select, every design tool, Undo and Redo, in that order` stays exact;
- `libraryComponentStyles.test.ts` finds `rp-designer-history` declared.

Run: `npm run build`

Expected: exit 0. That is the assembler's check: every partial within 400 raw lines, no colour literal.

- [ ] **Step 6: Lint, budgets, fallow**

Run: `npx eslint src/presentation/designer/DesignerToolbar.vue src/presentation/designer/DesignerSelectionModes.vue tests/presentation/designer/designerStyles.test.ts tests/presentation/designer/designerToolbar.test.ts`

Expected: no output.

Run: `wc -l styles/designer.css styles/designer-selection.css styles/dialogs.css`

Expected:
- `designer.css` ≈ 376 raw (was 380);
- `designer-selection.css` ≈ 104 (≈ 72 after Task 5);
- `dialogs.css` ≈ 231 (was 228).

All are ≤ 400.

ESLint budgets:
- `DesignerToolbar.vue`: 56 measured → ≈ 55 of 400;
- `DesignerSelectionModes.vue`: 32 → 32;
- `designerToolbar.test.ts`: ≈ 172 after Task 4 → ≈ 183 of 450;
- `designerStyles.test.ts`: ≈ 60 of 450.

Run: `npx fallow dead-code` then `npx fallow dupes`. Expected: nothing naming these files.

- [ ] **Step 7: Commit**

```bash
git add src/presentation/designer/DesignerToolbar.vue src/presentation/designer/DesignerSelectionModes.vue styles/designer.css styles/designer-selection.css styles/dialogs.css tests/presentation/designer/designerStyles.test.ts tests/presentation/designer/designerToolbar.test.ts
git commit -m "$(cat <<'EOF'
fix(designer): legible warnings, a segmented mode control and a trailing Undo group

The unscaled and dialog warnings draw normal text beside a warning-coloured rule, since
--text-warning as text failed AA contrast in the light theme. Undo and Redo end whichever row they
wrap to, the selection modes read as one control rather than a second pressed tool, selection
actions fill their rows, and toolbar buttons no longer repeat their label as a tooltip.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 8: Re-take the captures and open them**

Run: `npm run harness-shot` (foreground, timeout 600000). Expected: exit 0.

**Captures this changes, all to be opened:**
- The warning rule: `asset-designer-pending` and `asset-designer-pending-anchor-light` (Task 3's line and the Dimensions warning, both now normal text with a rule).
- The segmented mode control:
  - `asset-designer-select-transform`, `-select-transform-light`, `-select-transform-unframed`;
  - `-select-points`, `-select-points-light`, `-select-bend`, `-select-bend-dark`;
  - `-select-footprint`, `-select-footprint-light`, `-select-clearance`, `-select-clearance-light`;
  - `-select-narrow`, `-select-narrow-de`, `asset-designer-pending`.
- The action rows filling the column: `-select-footprint`, `-select-points`, `-select-clearance`, `-select-transform`, `-select-narrow`, `-select-narrow-de`, `asset-designer-pending`.
- Undo and Redo on a wrapped row, now at its end: `asset-designer-narrow`, `-select-narrow`, `-select-narrow-de`.
- At 1280 the group sits where the spacer put it, so `asset-designer-dark` and `-light` should look unchanged. Open them to confirm.
- The dialog warning and the dropped tooltips appear in no capture.

---

### Task 12: Legible selection marks

Critique findings 7, 8, 17 and 19; rulings C#7, C#8, C#17 and C#19. **Not probe-verified; the implementer's red step is the check.**

**Measured before drafting:**
- `VERTEX_GRAB_RADIUS_PX` is 8 (the ring). The anchor dot is `POLYGON_CLOSE_TARGET_RADIUS_PX` 6.
- After this task the ring's stroke is 2, so it covers 7–9 px.
- A halo at 6.5 px with a 3 px stroke paints the canvas colour over 5–8 px. What reads is the dot out to 5 px, then 2 px of canvas, then the ring. The same band cuts the facing's arrowhead short of the ring.
- vue-konva's `applyNodeProps` unsets a key a new config omits (`t.hasOwnProperty(e) || i?.setAttr(e, void 0)` in `node_modules/vue-konva/dist/vue-konva.js`). So `rotation` and `dash` may be present only when they apply: a node reused across a mode or selection change sheds them.
- The halo is one more `Rect` in the canvas's existing `.asset-selection-handle` `v-for`. A ring selection therefore draws TWO handle nodes, and Task 2's case in `layers.test.ts` changes its count from 1 to 2 here.

**Files:**
- Modify: `src/presentation/designer/layers/selectionLayer.ts` (whole file below)
- Modify: `src/presentation/designer/layers/clearanceLayer.ts` (`CLEARANCE_DASH_PX` exported; `CLEARANCE_STROKE_PX` 1 → 1.5, with its docblock)
- Modify: `src/presentation/designer/layers/detailsLayer.ts` (`DETAIL_DASH_PX` exported)
- Test: `tests/presentation/designer/selectionLayer.test.ts` (imports; one assertion added to the Transform case; the ring case rewritten; two new cases)
- Test: `tests/presentation/designer/layers.test.ts`:
  - one assertion in `draws the clearance distinct from the footprint…` (`:104-109`);
  - the two `toHaveLength(1)` in Task 2's `keeps the %s ring under Draw rectangle…` become `toHaveLength(2)`

**Interfaces:**
- Consumes: `OutlinePart` (`src/domain/asset/shapeEdits.ts`), `HandleRole` (`selection/handles.ts`) and `isOutlineSelection`, which exist. Task 2's `marks` gate is unchanged: a ring selection's marks, halo included, stay under every tool.
- Produces:
  - `export const CLEARANCE_DASH_PX: readonly number[]` (`[8, 6]`) in `clearanceLayer.ts`;
  - `export const DETAIL_DASH_PX: readonly number[]` (`[4, 3]`) in `detailsLayer.ts`;
  - both consumed by `selectionLayer.ts` in `src/`, which is fallow's requirement;
  - `HandleMarkConfig.rotation?: number` (`45` on a Bend edges handle, absent otherwise);
  - `selectionMarks(...).outline.dash` present for a selected clearance and a selected `line: 'dashed'` detail;
  - a ring selection's `handles` is `[halo, ring]`.

- [ ] **Step 1: Write the failing tests**

In `tests/presentation/designer/selectionLayer.test.ts`, add the imports:

```ts
import { clearanceOutline } from '../../../src/presentation/designer/layers/clearanceLayer';
import { detailOutlines } from '../../../src/presentation/designer/layers/detailsLayer';
```

In `restrokes a selected outline in the accent and draws eight square box handles and a round rotate handle`, add as its last line:

```ts
		expect(marks.handles.every((handle) => handle.strokeWidth === 2)).toBe(true);
```

Replace the whole case `rings the anchor, or the facing tip, at the grab radius and leaves it unfilled` with:

```ts
	/**
	 * The ring stays at the GRAB radius — it shows the region a press takes — over a canvas-coloured halo
	 * drawn first, which parts it from the anchor dot and cuts the facing's arrowhead short of it (critique
	 * finding 8). Both unfilled, so neither hides the mark it surrounds.
	 */
	it('rings the anchor, or the facing tip, at the grab radius over a canvas-coloured halo, both unfilled', () => {
		const anchor = selectionMarks(TOILET, { kind: 'anchor' }, 'transform', TOKENS, 1);
		const facing = selectionMarks(TOILET, { kind: 'facing' }, 'transform', TOKENS, 1);
		const tip = facingTip(TOILET, 1);
		const [halo, ring] = anchor.handles;

		expect(anchor.outline).toBeNull();
		expect(anchor.handles).toHaveLength(2);
		expect(halo).toMatchObject({ x: TOILET.anchor.x, y: TOILET.anchor.y, width: 13, cornerRadius: 6.5, stroke: TOKENS.canvasBackground, strokeWidth: 3 });
		expect(ring).toMatchObject({ x: TOILET.anchor.x, y: TOILET.anchor.y, width: 16, cornerRadius: 8, stroke: TOKENS.accent, strokeWidth: 2 });
		expect(halo).not.toHaveProperty('fill');
		expect(ring).not.toHaveProperty('fill');
		expect(facing.handles.map((handle) => ({ x: handle.x, y: handle.y }))).toEqual([tip, tip]);
	});

	/**
	 * Dashed means overhead or provisional (`clearanceLayer.ts`, `detailsLayer.ts`), so a selected clearance
	 * or dashed detail keeps its dash in the accent restroke rather than turning solid while it is edited
	 * (critique finding 7). Compared against each layer's own config, never retyped.
	 */
	it('keeps the part’s own dash on the selected outline, and draws a solid one solid', () => {
		const dashedTank = { ...TOILET, details: TOILET.details.map((detail) => (detail.id === 'detail-1' ? { ...detail, line: 'dashed' as const } : detail)) };

		expect(clearanceOutline(TOILET, TOKENS, 1)?.dash).toBeDefined();
		expect(selectionMarks(TOILET, { kind: 'clearance' }, 'transform', TOKENS, 1).outline?.dash).toEqual(clearanceOutline(TOILET, TOKENS, 1)?.dash);
		expect(selectionMarks(dashedTank, TANK_SELECTED, 'transform', TOKENS, 1).outline?.dash).toEqual(detailOutlines(dashedTank, TOKENS, 1)[0]?.dash);
		expect(selectionMarks(TOILET, TANK_SELECTED, 'transform', TOKENS, 1).outline).not.toHaveProperty('dash');
		expect(selectionMarks(TOILET, { kind: 'footprint' }, 'transform', TOKENS, 1).outline).not.toHaveProperty('dash');
	});

	/** A bend handle is a diamond, so Bend edges and Edit points no longer draw the same glyph (critique finding 17). */
	it('draws a Bend edges handle as a diamond, and rotates no other handle', () => {
		const bend = selectionMarks(TOILET, TANK_SELECTED, 'bend', TOKENS, 1).handles;
		const others = [
			...selectionMarks(TOILET, TANK_SELECTED, 'points', TOKENS, 1).handles,
			...selectionMarks(TOILET, TANK_SELECTED, 'transform', TOKENS, 1).handles,
			...selectionMarks(TOILET, { kind: 'anchor' }, 'transform', TOKENS, 1).handles,
		];

		expect(bend.length).toBeGreaterThan(0);
		expect(bend.every((handle) => handle.cornerRadius === 0 && handle.rotation === 45)).toBe(true);
		expect(others.filter((handle) => 'rotation' in handle)).toEqual([]);
	});
```

In `tests/presentation/designer/layers.test.ts`, inside `draws the clearance distinct from the footprint, so neither is mistaken for the other`, after `expect(drawn.clearance?.dash).not.toBeUndefined();` add:

```ts
		// 1.5, not 1: a 1 px accent dash measured about 2.98:1 on the light canvas (critique finding 19).
		expect(drawn.clearance?.strokeWidth).toBe(1.5);
```

In Task 2's case `keeps the %s ring under Draw rectangle, its only selection mark`, change both `expect(designer.stage.find('.asset-selection-handle')).toHaveLength(1);` to:

```ts
		expect(designer.stage.find('.asset-selection-handle')).toHaveLength(2);
```

and change its docblock's first sentence to:

```ts
	 * The anchor's and the facing's ring, over its halo, is that selection's ONLY mark — neither has an outline to restroke
```

- [ ] **Step 2: Run them to watch them fail**

Run: `npx vitest run tests/presentation/designer/selectionLayer.test.ts tests/presentation/designer/layers.test.ts --testTimeout=20000`

(`npm run check:fast` stops earlier, at `vue-tsc` `TS2339`, because `rotation` is not yet a member of `HandleMarkConfig`.)

Expected: FAIL.
- `selectionLayer.test.ts`, 4 failed:
  - the Transform case, on `expected false to be true` (strokes are 1.5);
  - the ring case, with `expected [ …(1) ] to have a length of 2 but got 1`;
  - the dash case, with `expected undefined to deeply equal [ 8, 6 ]`;
  - the diamond case, with `expected false to be true`.
- `layers.test.ts`, 3 failed:
  - the clearance case, with `expected 1 to be 1.5`;
  - `keeps the anchor ring…` and `keeps the facing ring…`, each with `expected [ …(1) ] to have a length of 2 but got 1`.

- [ ] **Step 3: Export the dashes and thicken the clearance**

In `clearanceLayer.ts`, replace:

```ts
const CLEARANCE_DASH_PX = [8, 6];

/** Thinner than the footprint: the outline of record is the heavier of the two marks. */
const CLEARANCE_STROKE_PX = 1;
```

with:

```ts
export const CLEARANCE_DASH_PX: readonly number[] = [8, 6];

/**
 * The footprint's own weight: the DASH, not the stroke, tells the two apart. It was 1 px, and a 1 px
 * accent dash measured about 2.98:1 against the light theme's white canvas, under WCAG 1.4.11's 3:1 for
 * a non-text mark; a thicker line renders closer to the token's own colour (selection polish critique,
 * finding 19). `selectionLayer.ts` restrokes a selected clearance in the dash above.
 */
const CLEARANCE_STROKE_PX = 1.5;
```

In `detailsLayer.ts`, replace:

```ts
const DETAIL_DASH_PX = [4, 3];
```

with:

```ts
/** Also the dash `selectionLayer.ts` restrokes a selected dashed detail in, so it stays dashed while edited. */
export const DETAIL_DASH_PX: readonly number[] = [4, 3];
```

- [ ] **Step 4: Rewrite `selectionLayer.ts`**

Replace the whole of `src/presentation/designer/layers/selectionLayer.ts` with:

```ts
import type { BoundingBox } from '../../../core/geometry/BoundingBox';
import type { Point } from '../../../core/geometry/Point';
import { polygonPolyline } from '../../../core/geometry/curvePolyline';
import type { AssetShape } from '../../../domain/asset/AssetShape';
import { outlineOf, type OutlinePart } from '../../../domain/asset/shapeEdits';
import { VERTEX_GRAB_RADIUS_PX, VERTEX_HANDLE_RADIUS_PX } from '../../editor/handleMetrics';
import type { ThemeTokens } from '../../editor/theme/themeTokens';
import { boundsOfZones } from '../../editor/viewport/zoneExtent';
import { isOutlineSelection, type DesignerSelection, type SelectionMode } from '../selection/designerSelection';
import { selectionHandles, type HandleRole } from '../selection/handles';
import { facingTip } from './anchorLayer';
import { CLEARANCE_DASH_PX } from './clearanceLayer';
import { DETAIL_DASH_PX } from './detailsLayer';
import { ARC_TOLERANCE_PX, flatPoints, type OutlineConfig } from './footprintLayer';

/**
 * What the designer draws for its selection (symbols spec, Decision 10): the selected outline
 * restroked in the accent, in its part's own dash; a mark per handle the active mode offers; and a
 * ring, over a halo, on the anchor or the facing tip. Every mark is sized in SCREEN pixels on a
 * world-space layer, like `anchorLayer.ts`.
 *
 * **One Konva `Rect` per mark**, so the canvas renders a single `v-for` and never a `<template>`
 * fragment inside its `VLayer`: square with no `cornerRadius`, a diamond with `rotation`, round with
 * its radius as `cornerRadius`. vue-konva UNSETS a key a later config omits (`applyNodeProps`), so
 * `rotation` and `dash` are present only where they apply and a node reused across a mode or
 * selection change sheds them.
 */
export interface HandleMarkConfig {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
	readonly offsetX: number;
	readonly offsetY: number;
	/** `0` for a box or bend handle; the radius for a round one, which makes the rect a circle. */
	readonly cornerRadius: number;
	/** `45` on a Bend edges handle, which turns its square into a diamond; absent on every other mark. */
	readonly rotation?: number;
	/** Absent on the anchor/facing ring and its halo, which must not hide the mark they surround. */
	readonly fill?: string;
	readonly stroke: string;
	readonly strokeWidth: number;
	readonly strokeScaleEnabled: false;
	readonly listening: false;
	readonly perfectDrawEnabled: false;
}

const SELECTED_STROKE_PX = 2;

/**
 * 2, not 1.5: a 1.5 px accent handle measured about 3.35:1 against the light theme's white canvas, on
 * WCAG 1.4.11's 3:1 floor, and a thicker stroke renders closer to the token's own colour (selection
 * polish critique, finding 19).
 */
const HANDLE_STROKE_PX = 2;

/** The ring is drawn at the GRAB radius, so it shows exactly the region a press will take. */
const RING_RADIUS_PX = VERTEX_GRAB_RADIUS_PX;

/**
 * A canvas-coloured band drawn BEFORE the ring, from 5 to 8 px out. The ring's 2 px stroke covers 7 to 9
 * px over it, so what reads is the 6 px anchor dot out to 5 px, then 2 px of canvas, then the ring — and
 * the facing's arrowhead stops short of the ring rather than tangling with it. A selected anchor read as a
 * slightly fatter dot without it (critique finding 8). The ring itself stays at the grab radius.
 */
const HALO_RADIUS_PX = 6.5;
const HALO_STROKE_PX = 3;

/** Which mark a handle wears: a box handle square, a bend handle a diamond (critique finding 17), a vertex and the rotate handle round. */
const HANDLE_STYLE: Record<HandleRole['kind'], 'square' | 'diamond' | 'round'> = { box: 'square', edge: 'diamond', vertex: 'round', rotate: 'round' };

type MarkStyle = 'square' | 'diamond' | 'round' | 'ring' | 'halo';

type PointSelection = Exclude<DesignerSelection, { readonly kind: 'footprint' | 'clearance' | 'detail' }>;

function pointOf(shape: AssetShape, selection: PointSelection, worldPerPixel: number): Point {
	return selection.kind === 'anchor' ? shape.anchor : facingTip(shape, worldPerPixel);
}

function mark(at: Point, radius: number, style: MarkStyle, tokens: ThemeTokens): HandleMarkConfig {
	return {
		x: at.x,
		y: at.y,
		width: radius * 2,
		height: radius * 2,
		offsetX: radius,
		offsetY: radius,
		cornerRadius: style === 'square' || style === 'diamond' ? 0 : radius,
		...(style === 'diamond' ? { rotation: 45 } : {}),
		...(style === 'ring' || style === 'halo' ? {} : { fill: tokens.canvasBackground }),
		stroke: style === 'halo' ? tokens.canvasBackground : tokens.accent,
		strokeWidth: style === 'halo' ? HALO_STROKE_PX : HANDLE_STROKE_PX,
		strokeScaleEnabled: false,
		listening: false,
		perfectDrawEnabled: false,
	};
}

/**
 * The selected part's own dash — the clearance's, or a `line: 'dashed'` detail's — so dashed keeps meaning
 * overhead or provisional while the part is edited (critique finding 7). `null` for a solid outline.
 */
function outlineDash(shape: AssetShape, part: OutlinePart): readonly number[] | null {
	if (part.kind === 'clearance') return CLEARANCE_DASH_PX;
	return part.kind === 'detail' && shape.details.some((detail) => detail.id === part.id && detail.line === 'dashed') ? DETAIL_DASH_PX : null;
}

export function selectionMarks(
	shape: AssetShape | null,
	selection: DesignerSelection | null,
	mode: SelectionMode,
	tokens: ThemeTokens,
	worldPerPixel: number,
): { readonly outline: OutlineConfig | null; readonly handles: readonly HandleMarkConfig[] } {
	if (shape === null || selection === null) return { outline: null, handles: [] };
	if (!isOutlineSelection(selection)) {
		const at = pointOf(shape, selection, worldPerPixel);
		return { outline: null, handles: [mark(at, HALO_RADIUS_PX * worldPerPixel, 'halo', tokens), mark(at, RING_RADIUS_PX * worldPerPixel, 'ring', tokens)] };
	}
	const outline = outlineOf(shape, selection);
	const dash = outlineDash(shape, selection);
	return {
		outline: outline === null
			? null
			: {
				points: flatPoints(polygonPolyline(outline, ARC_TOLERANCE_PX * worldPerPixel)),
				closed: true,
				stroke: tokens.accent,
				strokeWidth: SELECTED_STROKE_PX,
				strokeScaleEnabled: false,
				listening: false,
				perfectDrawEnabled: false,
				...(dash === null ? {} : { dash: [...dash] }),
			},
		handles: selectionHandles(shape, selection, mode, worldPerPixel).map((handle) =>
			mark(handle.at, VERTEX_HANDLE_RADIUS_PX * worldPerPixel, HANDLE_STYLE[handle.role.kind], tokens),
		),
	};
}

/**
 * What `Shift+2` frames: a selected outline's curve-aware box, or the anchor or facing tip as a point
 * (`fitViewport` keeps the zoom and centres on a point). `null` — nothing to frame — with no
 * selection or for a part the shape does not have.
 */
export function selectionFrame(shape: AssetShape, selection: DesignerSelection | null, worldPerPixel: number): BoundingBox | null {
	if (selection === null) return null;
	if (!isOutlineSelection(selection)) {
		const at = pointOf(shape, selection, worldPerPixel);
		return { min: at, max: at };
	}
	const outline = outlineOf(shape, selection);
	return boundsOfZones(outline === null ? [] : [outline]);
}
```

- [ ] **Step 5: Run them to watch them pass**

Run: `npm run check:fast -- tests/presentation/designer/selectionLayer.test.ts tests/presentation/designer/layers.test.ts tests/presentation/designer/designerSelection.test.ts tests/presentation/designer/tools/designerSelectTool.test.ts tests/harness/assetDesignerSelectKnob.test.ts --testTimeout=20000`

Expected: oxlint and vue-tsc clean; every case passes.

- [ ] **Step 6: Lint, budgets, fallow**

Run: `npx eslint src/presentation/designer/layers/selectionLayer.ts src/presentation/designer/layers/clearanceLayer.ts src/presentation/designer/layers/detailsLayer.ts tests/presentation/designer/selectionLayer.test.ts tests/presentation/designer/layers.test.ts`

Expected: no output. The complexity of `mark` stays well under 16.

Budgets (ESLint lines):
- `selectionLayer.ts`: 89 measured → ≈ 106 of 400;
- `clearanceLayer.ts`: 19 → 19;
- `detailsLayer.ts`: 28 → 28;
- `selectionLayer.test.ts`: 62 measured → ≈ 88 of 450;
- `layers.test.ts`: ≈ 359 after Task 10 → ≈ 360 of 450.

Run: `npx fallow dead-code` then `npx fallow dupes`. Expected: nothing naming these files. `CLEARANCE_DASH_PX` and `DETAIL_DASH_PX` each have a `src/` consumer in `selectionLayer.ts`.

- [ ] **Step 7: Commit**

```bash
git add src/presentation/designer/layers/selectionLayer.ts src/presentation/designer/layers/clearanceLayer.ts src/presentation/designer/layers/detailsLayer.ts tests/presentation/designer/selectionLayer.test.ts tests/presentation/designer/layers.test.ts
git commit -m "$(cat <<'EOF'
fix(designer): keep a selected part's dash, halo the anchor ring, diamond bend handles

A selected clearance or dashed detail keeps its dash in the accent restroke. The anchor and
facing ring sits over a canvas-coloured halo, so it no longer merges with the dot or crosses the
arrowhead. Bend edges handles are diamonds, distinct from Edit points' round ones, and the
clearance and handle strokes are heavier to clear 3:1 on the light canvas.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 8: Re-take the captures and open them**

Run: `npm run harness-shot` (foreground, timeout 600000). Expected: exit 0.

**Captures this changes, all to be opened:**
- The dashed selected clearance: `asset-designer-select-clearance`, `-select-clearance-light`.
- The halo and ring:
  - `-select-anchor`, `-select-anchor-light`, `asset-designer-pending-anchor-light`;
  - `-select-facing`, `-select-facing-light` (check the arrowhead stops short of the ring).
- The diamond bend handles: `-select-bend`, `-select-bend-dark`.
- Heavier handle strokes: `-select-transform`, `-select-transform-light`, `-select-transform-unframed`, `-select-points`, `-select-points-light`, `-select-footprint`, `-select-footprint-light`, `-select-narrow`, `-select-narrow-de`, `asset-designer-pending`.
- The 1.5 px clearance on every toilet-based shot: `asset-designer-preset-toilet`, `-draw-rect`, `-draw-rect-light`, `-draw-circle`, `-draw-trace-detail`, plus the select shots above. Also `-preset-sofa`, `-preset-tree` and `-preset-curved-table`, where each draws a clearance.

---

### Task 13: Inspector clarity

Critique findings 4, 11 and 25; rulings C#4, C#11 and C#25. **Not probe-verified; the implementer's red step is the check.** Written against Tasks 3 and 5's result in `DesignerSelectionInspector.vue`.

**Measured before drafting:**
- **The `aria-disabled` precedents:**
  - `NewAssetForm.vue:263` states that a paused control is inoperative and never `:disabled`, since Chromium blurs a disabled element to `<body>`.
  - `EmptyState.vue` binds `:aria-disabled="actionDisabled ? 'true' : undefined"` with `@click="actionDisabled ? undefined : emit('action')"`, the no-op press this task copies.
  - `styles/dialogs.css:166` records that Obsidian dims `button[aria-disabled="true"]` like `button[disabled]`. The designer's own `:disabled` rule sets colour, background and cursor, so this task gives the attribute the same rule.
- **Which way the facing points.** `AssetShape.facing` is "anticlockwise from +x" in the domain's terms. `facingTip` ADDS `sin(facing)` to y, and y grows DOWN the screen. So on screen 0 points right, 90 points down, and a positive angle turns clockwise. The critique's wording "0 points right, 90 points down" matches.
- **Existing precedent a digit-first English string passes:** `'90° left'` in `locales/en/object.ts`.
- **Ids:** `useId()` is the repo's id source (`FieldError.vue`), and `AssetDesignerView` sets `app.config.idPrefix` per app, so two designer leaves do not collide.
- **jsdom focus:** jsdom is not known to run focus fix-up when a focused control turns disabled (not probe-verified). So in the mounted case the `document.activeElement` line is a guard, and the attribute lines are the red.
- **Axe:** an `it.each` that needs `HARNESS_SCAN_MS` takes it from a wrapping `describe(name, { timeout }, …)`, as `accessibility.test.ts` does.

**Files:**
- Modify: `src/presentation/designer/inspector/DesignerInspector.vue` (an `<h3>` after `<DesignerSelectionInspector … />`)
- Modify: `src/presentation/designer/inspector/DesignerSelectionInspector.vue`:
  - the `vue` import;
  - `NumberField` gains `hint`;
  - `Action`'s docblock;
  - `hintId`;
  - the facing field in `fields`' `default` arm;
  - the template: the `<h3>` class, the field `v-for`, and the action button
- Modify: `src/presentation/i18n/locales/en/assetSymbols.ts`, `src/presentation/i18n/locales/de/assetSymbols.ts` (two keys each, after Task 4's)
- Modify: `styles/designer-selection.css` (the `:disabled` rule gains `[aria-disabled='true']`; two rules appended)
- Test: `tests/presentation/designer/designerSelectionInspector.test.ts`:
  - `describe('what the inspector offers for each kind of part')` gains the hint case;
  - `describe('what an action commits')`'s first case is replaced, and a no-op case is added;
  - `describe('the inspector in the mounted designer')` gains the focus case
- Test: `tests/presentation/designer/designerInspector.test.ts` (one case in `describe('the designer’s inspector')`)
- Test: `tests/presentation/designer/designerStyles.test.ts` (one `describe` appended after Task 11's)
- Test: `tests/harness/accessibilityDesignerSelection.test.ts` (the first case becomes a two-row `it.each` inside a `describe` carrying the timeout; Task 5's case stays)

**Interfaces:**
- Consumes: Task 3's `pendingPart`/`fields` shape; Task 5's `import { computed, nextTick, onBeforeUnmount, ref } from 'vue'` and `root` ref; Task 11's `designerStyles.test.ts` helpers `partial`, `parsed` and `declared`.
- Produces:
  - locale keys `designer.inspector.asset` and `designer.selection.angle.hint`;
  - the class `rp-designer-section-title` on both inspector `<h3>`s;
  - the class `rp-designer-field-hint`;
  - an unavailable action is `aria-disabled="true"` (never `disabled`), and its click runs nothing;
  - the facing's `angle` input carries `aria-describedby` naming the hint paragraph.

- [ ] **Step 1: Write the failing tests**

In `designerSelectionInspector.test.ts`, inside `describe('what the inspector offers for each kind of part')`, after `draws nothing for a part the shape lacks`, add:

```ts
	/**
	 * Critique finding 25: "Angle in degrees" did not say which way 0 points or which way the angle grows.
	 * `facingTip` adds the sine to y and y grows DOWN the screen, so 0 points right and 90 points down; the
	 * field names that sentence as its description. No other field carries one.
	 */
	it('describes the facing’s angle by where 0 and 90 point, and no other field', () => {
		const facing = mountFor({ kind: 'facing' }).wrapper;
		const describedBy = facing.find('[name="angle"]').attributes('aria-describedby');

		expect(describedBy).toBeDefined();
		expect(facing.find(`[id="${String(describedBy)}"]`).text()).toBe(t('en', 'designer.selection.angle.hint'));
		expect(mountFor(BOWL).wrapper.findAll('input[aria-describedby]')).toHaveLength(0);
	});
```

In `describe('what an action commits')`, replace the case `disables Bring forward on the topmost detail and Send backward on the bottom one` with:

```ts
	/**
	 * Critique finding 11: an unavailable reorder is `aria-disabled`, never `disabled` — pressing Send backward
	 * until the detail is last would otherwise disable the button that has focus, and Chromium drops focus to
	 * the page. `NewAssetForm.vue`'s paused controls take the same split.
	 */
	it('marks Bring forward unavailable on the topmost detail and Send backward on the bottom one, disabling neither', () => {
		const top = mountFor(BOWL).wrapper;
		const bottom = mountFor({ kind: 'detail', id: 'detail-1' }).wrapper;
		const state = (wrapper: VueWrapper, name: string) => {
			const button = wrapper.find(`[name="${name}"]`);
			return [button.attributes('aria-disabled'), (button.element as HTMLButtonElement).disabled];
		};

		expect(state(top, 'bring-forward')).toEqual(['true', false]);
		expect(state(top, 'send-backward')).toEqual([undefined, false]);
		expect(state(bottom, 'bring-forward')).toEqual([undefined, false]);
		expect(state(bottom, 'send-backward')).toEqual(['true', false]);
	});

	/** A GUARD, green before and after: a press on an unavailable reorder reaches no edit. */
	it('commits nothing for a press on an unavailable reorder', async () => {
		const { wrapper, applied } = mountFor(BOWL);

		await wrapper.find('[name="bring-forward"]').trigger('click');
		await flushPromises();

		expect(applied).toEqual([]);
	});
```

In `describe('the inspector in the mounted designer')`, after Task 5's `it.each`, add:

```ts
	/**
	 * Critique finding 11, mounted: the reorder lands, the button turns unavailable under the focus it still
	 * holds, and a second press writes nothing. jsdom is not known to blur a control that turns disabled, so
	 * the `activeElement` line is a guard; the attribute lines are what fail before the fix.
	 */
	it('keeps focus on Send backward once the detail is last, and a second press writes nothing', async () => {
		const rig = await designerRig({ shape: TOILET });
		try {
			useAssetDesignStore(rig.pinia).select(BOWL);
			await settle();
			const button = rig.wrapper.find('.rp-designer-selection [name="send-backward"]').element as HTMLButtonElement;
			button.focus();
			button.click();
			await settleUntil(async () => (await rig.document()).shape?.details[0]?.id === 'detail-2', 'the reorder to land');
			await settle();

			expect(button.getAttribute('aria-disabled')).toBe('true');
			expect(button.disabled).toBe(false);
			expect(document.activeElement).toBe(button);

			button.click();
			await settle();
			expect((await rig.document()).shape?.details.map((detail) => detail.id)).toEqual(['detail-2', 'detail-1']);
		} finally {
			rig.unmount();
		}
	});
```

In `designerInspector.test.ts`, after `draws a section for the selected part only while something is selected`, add:

```ts
	/**
	 * Critique finding 4: under a selected detail's section, the asset's "Dimensions 380 × 700 mm" read as
	 * that detail's size. The asset's own block now opens with its own heading, after the part's section.
	 */
	it('heads the asset’s own block, after the selected part’s section when there is one', () => {
		const headings = (selection: DesignerSelection | null) => mountInspector({}, selection).findAll('h3').map((heading) => heading.text());

		expect(headings(null)).toEqual([t('en', 'designer.inspector.asset')]);
		expect(headings({ kind: 'footprint' })).toEqual([t('en', 'designer.selection.footprint'), t('en', 'designer.inspector.asset')]);
	});
```

At the end of `designerStyles.test.ts`, append:

```ts
describe('the inspector’s headings, hint and unavailable actions', () => {
	/** Critique finding 4: the "Inspector" `<h2>` and the section `<h3>`s were styled alike, so a section added no hierarchy. */
	it('sets the section headings in normal text at semibold, under the muted panel title', () => {
		const rules = partial('designer-selection.css');

		expect(declared(rules, '.rp-designer-inspector .rp-designer-section-title', 'color')).toEqual(parsed('color', 'var(--text-normal)'));
		expect(declared(rules, '.rp-designer-inspector .rp-designer-section-title', 'font-weight')).toEqual(parsed('font-weight', 'var(--font-semibold)'));
	});

	/** Critique finding 11: an unavailable action is `aria-disabled` now, and must look exactly as a `:disabled` one did. */
	it('draws an aria-disabled selection action as a disabled one', () => {
		const rules = partial('designer-selection.css');
		const disabled = '.rp-designer-inspector .rp-designer-selection-button:disabled';
		const unavailable = ".rp-designer-inspector .rp-designer-selection-button[aria-disabled='true']";

		expect(declared(rules, unavailable, 'color')).toEqual(parsed('color', 'var(--text-faint)'));
		for (const property of ['color', 'background-color', 'cursor']) {
			expect(declared(rules, unavailable, property)).toEqual(declared(rules, disabled, property));
		}
	});

	/** Critique finding 25: the facing angle's direction hint reads quieter than its label. */
	it('draws a field hint in muted text', () => {
		expect(declared(partial('designer-selection.css'), '.rp-designer-field-hint', 'color')).toEqual(parsed('color', 'var(--text-muted)'));
	});
});
```

In `tests/harness/accessibilityDesignerSelection.test.ts`, change `import { expect, it } from 'vitest';` to `import { describe, expect, it } from 'vitest';`.

Replace the first case, `reports no violations for the designer with a detail selected`, from `it(` through its closing `});`, with:

```ts
/** A detail's section, and the facing's, whose angle field names its direction hint by `aria-describedby` (critique finding 25). */
describe('the designer with a part selected', { timeout: HARNESS_SCAN_MS }, () => {
	it.each([
		[{ kind: 'detail', id: 'detail-2' }, 'detail-name'],
		[{ kind: 'facing' }, 'angle'],
	] as const)('reports no violations with %o selected', async (selection, field) => {
		const rig = await designerRig({ shape: toiletShape() });
		try {
			useAssetDesignStore(rig.pinia).select(selection);
			await settle();

			expect(rig.wrapper.find(`.rp-designer-selection [name="${field}"]`).exists()).toBe(true);
			const results = await axe.run(rig.wrapper.element as HTMLElement, runOptions);

			expect(results.violations).toEqual([]);
		} finally {
			rig.unmount();
		}
	});
});
```

- [ ] **Step 2: Run them to watch them fail**

Run: `npx vitest run tests/presentation/designer/designerSelectionInspector.test.ts tests/presentation/designer/designerInspector.test.ts tests/presentation/designer/designerStyles.test.ts tests/harness/accessibilityDesignerSelection.test.ts --testTimeout=20000`

(`npm run check:fast` stops earlier, at `vue-tsc` `TS2345`, because the two keys are not yet `StringKey`s.)

Expected: FAIL.
- `designerSelectionInspector.test.ts`, 3 failed:
  - `describes the facing’s angle…`, with `AssertionError: expected undefined to be defined`;
  - `marks Bring forward unavailable…`, with `AssertionError: expected [ undefined, true ] to deeply equal [ 'true', false ]`;
  - `keeps focus on Send backward…`, with `AssertionError: expected null to be 'true'`.
- `designerInspector.test.ts`, 1 failed: `heads the asset’s own block…`, with `AssertionError: expected [] to deeply equal [ …(1) ]`.
- `designerStyles.test.ts`, 3 failed, each an `AssertionError` on `toEqual`.
- `accessibilityDesignerSelection.test.ts` passes: a facing selection already scans clean. It becomes the check that the new `aria-describedby` resolves.
- The guard `commits nothing for a press on an unavailable reorder` passes.

- [ ] **Step 3: Add the strings**

`src/presentation/i18n/locales/en/assetSymbols.ts`, before `} as const;` (after Task 4's keys):

```ts
	// The asset-level block's own heading, so its Dimensions never read as the selected part's (critique finding 4).
	'designer.inspector.asset': 'Asset',
	// Under the facing's angle field, as its description: `facingTip` adds the sine to y, and y grows DOWN the screen.
	'designer.selection.angle.hint': '0 points right, 90 points down',
```

`src/presentation/i18n/locales/de/assetSymbols.ts`, before `};`:

```ts
	'designer.inspector.asset': 'Objekt',
	'designer.selection.angle.hint': '0 zeigt nach rechts, 90 nach unten',
```

- [ ] **Step 4: Implement the headings**

In `DesignerInspector.vue`, directly after the `<DesignerSelectionInspector … />` element (before `<dl`), add:

```html
		<!--
			The asset's own block gets a heading of its own, so its Dimensions never read as the size of the
			part whose section sits right above them (selection polish critique, finding 4).
		-->
		<h3 class="rp-designer-panel-title rp-designer-section-title">
			{{ tr('designer.inspector.asset') }}
		</h3>
```

In `DesignerSelectionInspector.vue`, change the section heading's opening tag to:

```html
		<h3 class="rp-designer-panel-title rp-designer-section-title">
```

- [ ] **Step 5: Implement the unavailable actions and the hint**

In `DesignerSelectionInspector.vue`, change the Vue import (Task 5's) to:

```ts
import { computed, nextTick, onBeforeUnmount, ref, useId } from 'vue';
```

In `interface NumberField`, after `readonly resets?: true;`, add:

```ts
	/** A one-line description drawn under the field and linked by `aria-describedby`; only the facing's angle has one. */
	readonly hint?: StringKey;
```

Replace `interface Action {` with:

```ts
/**
 * `disabled` marks an action with nothing to do here — Bring forward on the topmost detail, Send backward on
 * the bottom one. It is drawn `aria-disabled` and its press runs nothing, never `:disabled`: pressing Send
 * backward until the detail is last would otherwise disable the very button that has focus, and Chromium
 * drops focus to `<body>` (selection polish critique, finding 11). `NewAssetForm.vue`'s paused controls take
 * the same split, and `EmptyState.vue`'s action the same no-op press.
 */
interface Action {
```

After `const refusal = ref<AppError | null>(null);` (and Task 5's `root` and `onBeforeUnmount` block that follow it), add:

```ts
/** The facing angle's hint paragraph, which its field names by `aria-describedby`; `useId` is unique per leaf's app. */
const hintId = useId();
```

In `fields`' `default` arm, replace the returned line:

```ts
			return [{ name: 'angle', label: 'designer.selection.angle', value: (shape.value.facing * 180) / Math.PI, edit: (value) => (current) => setFacing(current, radians(value)) }];
```

with:

```ts
			return [{ name: 'angle', label: 'designer.selection.angle', hint: 'designer.selection.angle.hint', value: (shape.value.facing * 180) / Math.PI, edit: (value) => (current) => setFacing(current, radians(value)) }];
```

In the template, replace the number-field block:

```html
		<label
			v-for="field in fields"
			:key="field.name"
			class="rp-designer-field"
		>
			{{ tr(field.label) }}
			<input
				type="number"
				:name="field.name"
				step="any"
				inputmode="decimal"
				:value="Math.round(field.value)"
				@change="(event: Event) => void onNumber(field, event)"
			>
		</label>
```

with:

```html
		<template
			v-for="field in fields"
			:key="field.name"
		>
			<label class="rp-designer-field">
				{{ tr(field.label) }}
				<input
					type="number"
					:name="field.name"
					step="any"
					inputmode="decimal"
					:value="Math.round(field.value)"
					:aria-describedby="field.hint === undefined ? undefined : hintId"
					@change="(event: Event) => void onNumber(field, event)"
				>
			</label>
			<!-- Outside the label, so the hint is the field's DESCRIPTION and never part of its name. -->
			<p
				v-if="field.hint !== undefined"
				:id="hintId"
				class="rp-designer-field-hint"
			>
				{{ tr(field.hint) }}
			</p>
		</template>
```

Replace the action button's two bindings:

```html
				:disabled="action.disabled"
				@click="action.run()"
```

with:

```html
				:aria-disabled="action.disabled ? 'true' : undefined"
				@click="action.disabled ? undefined : action.run()"
```

In `styles/designer-selection.css`, replace:

```css
.rp-designer-inspector .rp-designer-selection-button:disabled {
```

with:

```css
/* `[aria-disabled]` beside `:disabled`: an unavailable reorder keeps its focus (`DesignerSelectionInspector`'s `Action`). */
.rp-designer-inspector .rp-designer-selection-button:disabled,
.rp-designer-inspector .rp-designer-selection-button[aria-disabled='true'] {
```

Append at the end of the file:

```css

/*
 * The two SECTION headings — the selected part's and the asset's own — one level under the muted panel
 * title: normal text at semibold, where both had worn the title's own muted medium and added no hierarchy
 * (selection polish critique, finding 4). Two classes, to outrank `.rp-designer-panel-title` in `designer.css`
 * without leaning on import order.
 */
.rp-designer-inspector .rp-designer-section-title {
	color: var(--text-normal);
	font-weight: var(--font-semibold);
}

/* The facing angle's direction hint (critique finding 25): a description under its field, quieter than the label. */
.rp-designer-field-hint {
	margin: 0;
	font-size: var(--font-ui-smaller);
	color: var(--text-muted);
}
```

- [ ] **Step 6: Run them to watch them pass**

Run: `npm run check:fast -- tests/presentation/designer/designerSelectionInspector.test.ts tests/presentation/designer/designerInspector.test.ts tests/presentation/designer/designerStyles.test.ts tests/harness/accessibilityDesignerSelection.test.ts tests/presentation/designer/assetDesignerRoot.test.ts tests/build/libraryComponentStyles.test.ts tests/build/buttonSpecificity.test.ts --testTimeout=20000`

Expected: oxlint and vue-tsc clean; every case passes. Both axe rows are clean, and `libraryComponentStyles.test.ts` finds `rp-designer-section-title` and `rp-designer-field-hint` declared.

Run: `npm run build`. Expected: exit 0.

- [ ] **Step 7: Lint, budgets, fallow**

Run: `npx eslint src/presentation/designer/inspector/DesignerInspector.vue src/presentation/designer/inspector/DesignerSelectionInspector.vue src/presentation/i18n/locales/en/assetSymbols.ts src/presentation/i18n/locales/de/assetSymbols.ts tests/presentation/designer/designerSelectionInspector.test.ts tests/presentation/designer/designerInspector.test.ts tests/presentation/designer/designerStyles.test.ts tests/harness/accessibilityDesignerSelection.test.ts`

Expected: no output.

If `sentence-case-locale-module` refuses `'0 points right, 90 points down'`, STOP and report rather than rewording. `'90° left'` in `en/object.ts` is the precedent that it passes.

Budgets:
- `DesignerInspector.vue`: 128 measured → ≈ 131 ESLint lines of 400;
- `DesignerSelectionInspector.vue`: ≈ 236 after Task 5 → ≈ 249 of 400;
- `en/assetSymbols.ts`: ≈ 104 raw after Task 4 → ≈ 108;
- `de/assetSymbols.ts`: ≈ 98 → ≈ 100;
- `styles/designer-selection.css`: ≈ 104 after Task 11 → ≈ 124 raw of 400;
- `designerSelectionInspector.test.ts`: ≈ 325 after Task 5 → ≈ 378 of 450;
- `designerInspector.test.ts`: 137 measured → ≈ 145 of 450;
- `designerStyles.test.ts`: ≈ 60 → ≈ 82 of 450;
- `accessibilityDesignerSelection.test.ts`: ≈ 37 after Task 5 → ≈ 40 of 450.

`en.ts` and `de.ts` are untouched.

Run: `npx fallow dead-code` then `npx fallow dupes`. Expected: nothing naming these files. The axe `it.each` replaces the single case and so removes a likely clone rather than adding one.

- [ ] **Step 8: Commit**

```bash
git add src/presentation/designer/inspector/DesignerInspector.vue src/presentation/designer/inspector/DesignerSelectionInspector.vue src/presentation/i18n/locales/en/assetSymbols.ts src/presentation/i18n/locales/de/assetSymbols.ts styles/designer-selection.css tests/presentation/designer/designerSelectionInspector.test.ts tests/presentation/designer/designerInspector.test.ts tests/presentation/designer/designerStyles.test.ts tests/harness/accessibilityDesignerSelection.test.ts
git commit -m "$(cat <<'EOF'
fix(designer): head the asset block, keep focus on an unavailable reorder, explain the facing angle

The asset's own block gets an "Asset" heading and both section headings sit visibly under the
panel title, so the asset's dimensions no longer read as the selected part's. Bring forward and
Send backward turn aria-disabled rather than disabled, so focus stays on them at the end of the
order. The facing angle field describes where 0 and 90 point.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 9: Re-take the captures and open them**

Run: `npm run harness-shot` (foreground, timeout 600000). Expected: exit 0.

**Captures this changes, all to be opened:**
- The "Asset" heading appears in every capture that draws the inspector over a design:
  - `asset-designer-dark`, `-light`, `-narrow`;
  - every `asset-designer-preset-*`, `-select-*`, `-pending*` and `-draw-*` shot.

  Open at least `asset-designer-dark`, `-select-transform`, `-select-narrow-de` and `asset-designer-pending`.
- The semibold section headings: every `-select-*` and `-pending*` shot.
- The facing hint: `asset-designer-select-facing`, `-select-facing-light`.
- The topmost detail's Bring forward in `-select-transform` should look exactly as before, now through `[aria-disabled='true']`. Open it to confirm.
- Focus staying put appears in no capture.

---

### Task 14: Stack the inspector under the canvas at a sidebar width

Critique finding 6, ruling C#6 (CSS stacking, no drawer). **Not probe-verified; the implementer's red step and the captures are the check.** No PLANNING CONFLICT: the canvas keeps a measured height (below).

**Measured before drafting (read-only; the plan editor is not changed):**
- **The designer's layout** (`styles/designer.css`):
  - `.renovation-asset-designer` is a flex column at `height: 100%` holding toolbar, `.rp-designer-body`, notices and status.
  - `.rp-designer-body` is a flex ROW (`flex: 1; min-height: 0`) holding `.rp-designer-canvas` (`flex: 1; min-height: 0; min-width: 0`) and `.rp-designer-inspector` (`flex: 0 0 auto; width: 14rem; overflow-y: auto; border-left`).
  - At a 460 px leaf that leaves the canvas about 236 px wide.
  - No element is a container today.
- **How the canvas gets its size:**
  - `EditorSurface.vue` measures its `.rp-plan-canvas` element's `clientWidth`/`clientHeight` in a `ResizeObserver` and writes `editor.setStageSize`.
  - `.rp-plan-canvas` (`styles/editor.css:160`) is `flex: 1; min-height: 0`, stretched inside `.rp-designer-canvas`'s row, so its height IS the canvas region's height.
- **The plan editor's answer:**
  - `ResponsiveEditorShell.vue` computes `data-layout` in TypeScript.
  - The constrained layout moves the inspector into an absolutely positioned `.rp-inspector-drawer` (`styles/editor-layout.css`) beside `container-type: inline-size` on its shell (`styles/editor-visual-shell.css:3`).
  - The ruling declines the drawer, so no attribute and no Vue change are needed. An `@container` rule is enough.
- **Why the canvas keeps a MEASURED height.** Stacked, both regions take a ZERO flex basis (`flex: 3 1 0` and `flex: 2 1 0`), so their heights are fixed shares of `.rp-designer-body`, whatever the inspector holds.
  - A content-sized inspector (`flex: 0 0 auto`) would take the whole column once a detail is selected, and `EditorSurface` would measure a canvas of 0. That is the conflict the ruling told the drafter to stop on, and this split avoids it.
  - The inspector already has `min-height: 0` and `overflow-y: auto`, so it scrolls inside its share.
- **Budget:** `designer.css` sits at ≈ 376 raw after Task 11, too close for a ~40-line block, so the rules go in a new partial `styles/designer-narrow.css`.
- **Specificity:** every override is qualified with `.renovation-asset-designer` (0,2,0), so it outranks `designer.css`'s (0,1,0) rules without depending on import order.
- **Container name:** `tests/build/styles.test.ts` requires every named `@container` to name a container the shipped sheet declares. `container-name: rp-designer` is that declaration, in the longhand `project-list-narrow.css` uses.
- **Threshold:** 35rem is the critique's ~560 px at Obsidian's 16 px root.

**Files:**
- Create: `styles/designer-narrow.css`
- Modify: `styles/index.css` (one `@import`, directly after `@import "./designer-selection.css";`)
- Test: `tests/presentation/designer/designerStyles.test.ts` (one `describe` appended after Task 13's)

**Interfaces:**
- Consumes: Task 11's `designerStyles.test.ts` helpers `onlyRule`, `partial`, `parsed` and `declared`.
- Produces:
  - the container `rp-designer` (inline-size) on `.renovation-asset-designer`;
  - below 35rem, `.rp-designer-body` stacks as a column with the canvas above the inspector at a 3 : 2 split.

  No markup or TypeScript change.

- [ ] **Step 1: Write the failing test**

Append to `tests/presentation/designer/designerStyles.test.ts`:

```ts
/**
 * Critique finding 6: at a 460px leaf the inspector kept its 14rem and left the canvas about 236px wide.
 * Below 35rem the inspector stacks under the canvas, in FIXED flex shares — a content-sized inspector would
 * take the whole column once a detail is selected and leave `EditorSurface` measuring a canvas of nothing.
 * The condition is the parser's reading of the query itself, never a hand-written serialisation.
 */
describe('the designer at a sidebar leaf’s width', () => {
	const narrow = (): string => onlyRule('@container rp-designer (width < 35rem) { .reference { color: inherit; } }').condition;

	it('makes the designer root the container whose width is asked', () => {
		const rules = partial('designer-narrow.css');

		expect(declared(rules, '.renovation-asset-designer', 'container-type')).toEqual(parsed('container-type', 'inline-size'));
		expect(declared(rules, '.renovation-asset-designer', 'container-name')).toEqual(parsed('container-name', 'rp-designer'));
	});

	it('stacks the inspector under the canvas below 35rem, in fixed shares of the body', () => {
		const rules = partial('designer-narrow.css');

		expect(narrow()).not.toBe('');
		expect(declared(rules, '.renovation-asset-designer .rp-designer-body', 'flex-direction', narrow())).toEqual(parsed('flex-direction', 'column'));
		expect(declared(rules, '.renovation-asset-designer .rp-designer-canvas', 'flex', narrow())).toEqual(parsed('flex', '3 1 0'));
		expect(declared(rules, '.renovation-asset-designer .rp-designer-inspector', 'flex', narrow())).toEqual(parsed('flex', '2 1 0'));
		expect(declared(rules, '.renovation-asset-designer .rp-designer-inspector', 'width', narrow())).toEqual(parsed('width', 'auto'));
		expect(declared(rules, '.renovation-asset-designer .rp-designer-inspector', 'border-left', narrow())).toEqual(parsed('border-left', 'none'));
		expect(declared(rules, '.renovation-asset-designer .rp-designer-inspector', 'border-top', narrow())).toEqual(parsed('border-top', '1px solid var(--background-modifier-border)'));
	});
});
```

- [ ] **Step 2: Run it to watch it fail**

Run: `npm run check:fast -- tests/presentation/designer/designerStyles.test.ts`

Expected: oxlint and vue-tsc clean. FAIL, 2 failed, each with `Error: ENOENT: no such file or directory, open 'styles/designer-narrow.css'`.

- [ ] **Step 3: Implement**

Create `styles/designer-narrow.css`:

```css
/*
 * The asset designer at a sidebar leaf's width (selection polish critique, finding 6). Below 35rem —
 * about 560px at Obsidian's 16px root — the inspector keeping its 14rem left the canvas about 236px wide
 * at a 460px leaf, with the selected part a small figure under its handles. There the inspector stacks
 * UNDER the canvas. No drawer: that is the plan editor's constrained answer (`editor-layout.css`), and a
 * second mechanism this surface does not need.
 *
 * **The canvas keeps a MEASURED height, and the split is why.** Both regions take a zero flex basis, so
 * their heights are fixed shares of `.rp-designer-body` — three to two — whatever the inspector holds. A
 * content-sized inspector would take the whole column once a detail is selected, and `EditorSurface`'s
 * resize observer would then measure a canvas of nothing. The inspector already scrolls (`designer.css`),
 * now inside its share.
 *
 * The container is the Vue root, the nearest element spanning the leaf that is not inside the body it
 * rearranges; `inline-size` only, so the height chain `designer.css` calls load-bearing is untouched.
 * Every override names `.renovation-asset-designer` too, so it outranks `designer.css`'s single-class rules
 * without depending on which partial `styles/index.css` imports last. Obsidian variables only (SDD §84).
 */
.renovation-asset-designer {
	container-type: inline-size;
	container-name: rp-designer;
}

@container rp-designer (width < 35rem) {
	.renovation-asset-designer .rp-designer-body {
		flex-direction: column;
	}

	.renovation-asset-designer .rp-designer-canvas {
		flex: 3 1 0;
	}

	.renovation-asset-designer .rp-designer-inspector {
		flex: 2 1 0;
		width: auto;
		border-left: none;
		border-top: 1px solid var(--background-modifier-border);
	}
}
```

In `styles/index.css`, after `@import "./designer-selection.css";`, add:

```css
@import "./designer-narrow.css";
```

- [ ] **Step 4: Run it to watch it pass, plus the stylesheet gates**

Run: `npm run check:fast -- tests/presentation/designer/designerStyles.test.ts tests/build/styles.test.ts tests/presentation/designer/assetDesignerRoot.test.ts tests/harness/harness.test.ts --testTimeout=20000`

Expected: oxlint and vue-tsc clean; every case passes. That includes `styles.test.ts`'s `queries no container the sheet does not declare`.

Run: `npm run build`

Expected: exit 0. The assembler resolves the new `@import`, and the partial is ≈ 41 raw lines of 400 with no colour literal.

- [ ] **Step 5: Lint, budgets, fallow**

Run: `npx eslint tests/presentation/designer/designerStyles.test.ts`

Expected: no output.

Budgets:
- `styles/designer-narrow.css` ≈ 41 raw of 400;
- `styles/index.css` 125 → 126 raw;
- `designerStyles.test.ts` ≈ 82 → ≈ 102 ESLint lines of 450;
- `styles/designer.css` untouched.

Run: `npx fallow dead-code` then `npx fallow dupes`. Expected: nothing naming these files.

- [ ] **Step 6: Commit**

```bash
git add styles/designer-narrow.css styles/index.css tests/presentation/designer/designerStyles.test.ts
git commit -m "$(cat <<'EOF'
fix(designer): stack the inspector under the canvas at a sidebar width

Below a 35rem container width the inspector kept its 14rem and left the canvas about 236px wide.
It now stacks under the canvas, the two taking fixed three-to-two shares of the body so the canvas
keeps a measured height however tall the inspector is. CSS only; no drawer.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 7: Re-take the captures and OPEN each**

Run: `npm run harness-shot` (foreground, timeout 600000). The three narrow shots already carry `width: 460` in the table.

Expected: exit 0.

Open `harness-shots/asset-designer-narrow.png`, `harness-shots/asset-designer-select-narrow.png` and `harness-shots/asset-designer-select-narrow-de.png`. In each, check:
- the canvas spans the pane's width above the inspector;
- the toilet (or the empty state in `-narrow`) draws inside a canvas taller than the inspector;
- the inspector scrolls rather than pushing the canvas to nothing;
- no horizontal overflow.

Also open `asset-designer-dark.png` and `asset-designer-select-transform.png` (1280 px). They must be unchanged, inspector beside the canvas, since 1280 px is above the threshold. Say which PNGs were opened.

If a narrow capture shows a canvas with no height, STOP and report: that is ruling C#6's stated failure, and the split's percentage-free flex basis is the part to question first.

**Captures this changes:** `asset-designer-narrow`, `asset-designer-select-narrow`, `asset-designer-select-narrow-de`. No 1280 px capture changes.
