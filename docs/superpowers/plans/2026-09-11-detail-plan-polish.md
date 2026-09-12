# Detail plan polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a detail plan's parent-zone outline understandable and reachable: name its source, explain it, frame it with Fit, say honestly when the hierarchy read fails, and title the creation dialog for what it creates.

**Architecture:** Presentation-only polish of ADR-0028's detail plans. No domain, persistence or command change. The guide stays at world origin (ADR-0019/0028). Two harness knobs (`?detail`, `?locked=`) make the state capturable in `npm run harness-shot`.

**Tech Stack:** Vue 3 SFCs, Pinia, vue-konva, Vitest + jsdom, Playwright captures.

**Spec:** `docs/superpowers/specs/2026-09-10-zone-lock-and-detail-plans-design.md` §4.6–4.9 (amended by Task 7), ADR-0028, and the scope approved in chat on 2026-09-11:

- Fit frames the guide **like the reference**: in Fit floor and the empty-plan first-open fit whenever the Reference layer is visible.
- The guide stays hidden with the Reference layer; the Reference row becomes a live toggle when a guide exists.
- The explanation lives in the **floor Inspector** while the plan has no reference plan.
- Skipped, deliberately: curve bounds for the guide's placement (ponytail trigger unmet), live cross-leaf refresh (ADR consequence), duplicate-creation guard, zone-delete warning, restoring the start panel.

## Global Constraints

- Work only in `C:\Projects\renovation-planner\.claude\worktrees\detail-plan-polish` (branch `feat/detail-plan-polish`, off origin/main, `npm ci` done). Never `cd` to the main checkout.
- Inner loop: `npm run check:fast -- <test paths> --testTimeout=20000`. Do **not** run `npm run check`; the controller runs it once before the PR. If a test times out, re-run that file alone before believing it.
- TDD: write the test, run it, **see it fail for the stated reason**, then implement.
- Every user-visible string goes through `tr`/`t` with a key in BOTH `en` and `de` locale files (`tests/presentation/i18n/strings.test.ts` refuses an untranslated key).
- Editor copy never says "zone"/"zoning" (EN) or "Zone" (DE) in values of `editor.*` keys — use "room or area" / "Raum oder Fläche". Placeholder names count: use `{name}`, never `{zone}`.
- Sentence case for UI text. No hard-coded colours in CSS; Obsidian variables only.
- `max-lines` 400 (non-blank, non-comment) for `src/**` and scripts; keep SFC `<script>` logic short.
- Match the surrounding code: docblocks explain *why*, one short paragraph; no line-number references in comments.
- Commit after each task with a message ending `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. Never stage `.impeccable/`.

## File map

| File | Change |
|---|---|
| `tests/harness/detailPlanKnob.ts` (new) | `detailPlanDeps`, `lockedZoneDeps`, `HARNESS_PARENT_ZONE` |
| `tests/harness/planEditor.ts`, `tests/harness/page.ts` | wire `detail` / `locked` options |
| `tests/harness/detailPlanKnob.test.ts` (new) | knob plumbing |
| `scripts/harness-shot.mjs`, `tests/build/harness-shot.test.ts` | five new shots + pin |
| `src/presentation/editor/hierarchy/parentZoneGuide.ts` | `guideFramePoints`, `guideSource` |
| `src/presentation/editor/viewport/usePlanFrame.ts`, `src/presentation/editor/PlanCanvas.vue` | frame the guide |
| `src/presentation/editor/selection/useCanvasMenuActions.ts` | Fit's own disabled reason |
| `src/presentation/editor/hierarchy/ParentZoneGuide.vue` | caption names the source |
| `src/presentation/editor/shell/FloorInspector.vue`, `styles/editor-inspector.css` | explainer |
| `src/presentation/editor/layers/layerCatalogue.ts`, `src/presentation/editor/shell/PropertyLayerPanel.vue` | guide-aware Reference row |
| `src/presentation/editor/hierarchy/detailPlanActions.ts` | dialog title |
| `src/presentation/editor/shell/EditorContextBar.vue` | `aria-current` |
| `src/presentation/stores/PlanHierarchyStore.ts`, `src/presentation/editor/shell/PropertyTree.vue` | failed read surfaced |
| locale files `en.ts`, `de.ts`, `en/editor.ts`, `de/editor.ts`, `en/input.ts`, `de/input.ts` | keys |
| docs (Task 7) | user guide, manual case, ADR-0028, spec, PBI, CHANGELOG |

---

### Task 1: Harness knobs for a detail plan and a locked zone

**Files:**
- Create: `tests/harness/detailPlanKnob.ts`
- Create: `tests/harness/detailPlanKnob.test.ts`
- Modify: `tests/harness/planEditor.ts` (`PlanEditorHarnessOptions`, `mountPlanEditorHarness`)
- Modify: `tests/harness/page.ts` (the plan-editor branch that calls `mountPlanEditorHarness`, and the knob docblock above `selectZoneId`)
- Modify: `scripts/harness-shot.mjs` (`SHOTS`, after `plan-editor-light`)
- Modify: `tests/build/harness-shot.test.ts` ("defines exactly the fixed shots this file lists")

**Interfaces:**
- Produces: `PlanEditorHarnessOptions.detail?: boolean`, `PlanEditorHarnessOptions.locked?: string` (comma-separated zone ids); `HARNESS_PARENT_ZONE: ParentZoneOutlineDto`; `detailPlanDeps(base: PlanEditorDeps): PlanEditorDeps`; `lockedZoneDeps(base: PlanEditorDeps, ids: readonly string[]): PlanEditorDeps`. Shot names `plan-editor-detail`, `plan-editor-detail-dark`, `plan-editor-detail-narrow-de`, `plan-editor-locked`, `plan-editor-locked-dark`.

- [ ] **Step 1: Write the failing knob test**

`tests/harness/detailPlanKnob.test.ts`:

```ts
/**
 * @vitest-environment jsdom
 *
 * The two knobs that make a detail plan and a locked zone capturable (detail-plan polish,
 * 2026-09-11). The harness composed no hierarchy query before, so the parent-zone guide could
 * not be drawn outside a vault at all.
 */
import { beforeEach, expect, it } from 'vitest';
import { mountPlanEditorHarness } from './planEditor';
import { installCanvas } from '../helpers/canvas';
import { installResizeObserver } from '../helpers/layout';
import { settleUntil, sizedShellRoot } from '../helpers/editor';

beforeEach(() => {
	document.body.innerHTML = '';
});

it('?detail draws an empty plan with the parent-zone guide and its ancestry', async () => {
	installCanvas();
	installResizeObserver();
	const { leafEl, view } = mountPlanEditorHarness(document.body, { detail: true });
	sizedShellRoot(leafEl);
	await settleUntil(() => leafEl.querySelector('.rp-property-tree')?.textContent?.includes('Site plan') === true, 'the ?detail ancestry');
	expect(leafEl.querySelectorAll('.rp-room-list__row')).toHaveLength(0);
	await view.onClose();
});

it('?locked locks the named seeded zones and no others', async () => {
	installCanvas();
	installResizeObserver();
	const { leafEl, view } = mountPlanEditorHarness(document.body, { locked: 'harness-terrace' });
	sizedShellRoot(leafEl);
	await settleUntil(() => leafEl.querySelector('.rp-room-list__row') !== null, 'the seeded rows');
	const locked = [...leafEl.querySelectorAll('.rp-room-list__row')].filter((row) => row.querySelector('[data-rp-locked], .rp-room-list__locked') !== null);
	expect(locked.map((row) => row.getAttribute('data-rp-id'))).toEqual(['harness-terrace']);
	await view.onClose();
});
```

Before running, open `src/presentation/editor/shell/RoomSummaryList.vue` and replace `[data-rp-locked], .rp-room-list__locked` with the exact marker a locked row renders (ADR-0027 added one). Do not add a marker to production code for this test.

- [ ] **Step 2: Run it and watch it fail**

Run: `npm run check:fast -- tests/harness/detailPlanKnob.test.ts --testTimeout=20000`
Expected: FAIL — type error / unknown option `detail`, and the settle times out.

- [ ] **Step 3: Implement the knob module**

`tests/harness/detailPlanKnob.ts`:

```ts
import { ok } from '../../src/core/result/Result';
import { EMPTY_STRUCTURE } from '../../src/domain/spatial/Structure';
import type { PlanEditorDeps } from '../../src/presentation/editor/PlanEditorView';
import type { ParentZoneOutlineDto } from '../../src/presentation/read-models/planHierarchy';

/**
 * An L-shaped parent zone far from origin and larger than the default camera shows, so a
 * capture shows both halves of ADR-0028's placement: translated to world origin, and big
 * enough that only Fit brings all of it into view.
 */
export const HARNESS_PARENT_ZONE: ParentZoneOutlineDto = {
	name: 'Workshop',
	points: [
		{ x: 30_000, y: 12_000 }, { x: 42_000, y: 12_000 }, { x: 42_000, y: 19_000 },
		{ x: 36_000, y: 19_000 }, { x: 36_000, y: 23_000 }, { x: 30_000, y: 23_000 },
	],
};

/** `?detail`: the harness plan as a fresh detail plan — no zones, no structure, a parent zone guide. */
export function detailPlanDeps(base: PlanEditorDeps): PlanEditorDeps {
	return {
		...base,
		queries: {
			...base.queries,
			findZonesByPlan: () => Promise.resolve(ok({ zones: [], unreadable: 0, structure: EMPTY_STRUCTURE })),
			hierarchy: () => Promise.resolve(ok({ ancestry: [{ id: 'harness-site', name: 'Site plan' }], detailPlans: [], parentZone: HARNESS_PARENT_ZONE, parentZoneMissing: false })),
		},
	};
}

/** `?locked=<id,id>`: the seeded zones answered as locked (ADR-0027), so their faded captions can be looked at. */
export function lockedZoneDeps(base: PlanEditorDeps, ids: readonly string[]): PlanEditorDeps {
	return {
		...base,
		queries: {
			...base.queries,
			findZonesByPlan: async (input) => {
				const found = await base.queries.findZonesByPlan(input);
				return found.ok ? ok({ ...found.value, zones: found.value.zones.map((zone) => (ids.includes(zone.id) ? { ...zone, locked: true as const } : zone)) }) : found;
			},
		},
	};
}
```

Check the import paths against the real exports before running: `PlanEditorDeps` is what `harnessDeps` in `tests/harness/planEditor.ts` returns (use that file's import), and `findZonesByPlan`'s answer shape is whatever `harnessDeps` resolves (`{ zones, unreadable, structure }`). Adjust the imports only; keep the behaviour.

- [ ] **Step 4: Wire the options**

In `tests/harness/planEditor.ts`, add to `PlanEditorHarnessOptions`:

```ts
	/** A fresh detail plan: no zones, a parent-zone guide and one ancestor (`detailPlanKnob.ts`). */
	readonly detail?: boolean;
	/** Comma-separated seeded zone ids answered as locked (`detailPlanKnob.ts`). */
	readonly locked?: string;
```

In `mountPlanEditorHarness`, directly after the line that computes `const deps = …`, add these and pass `composed` instead of `deps` to `new PlanEditorView(…)`:

```ts
	const detailed = options.detail === true ? detailPlanDeps(deps) : deps;
	const composed = options.locked === undefined ? detailed : lockedZoneDeps(detailed, options.locked.split(','));
```

In `tests/harness/page.ts`, pass `detail: params.has('detail')` and `locked: params.get('locked') ?? undefined` in the `mountPlanEditorHarness(document.body, { … })` call, and extend the knob docblock ("The Plan Editor's own four knobs") to name `?detail` and `?locked=` in one sentence each.

- [ ] **Step 5: Run the knob test and watch it pass**

Run: `npm run check:fast -- tests/harness/detailPlanKnob.test.ts tests/harness/harnessSurfaces.test.ts --testTimeout=20000`
Expected: PASS.

- [ ] **Step 6: Add the shots and pin them (test first)**

In `tests/build/harness-shot.test.ts`, add to the sorted `toEqual([...])` list in "defines exactly the fixed shots this file lists": `'plan-editor-detail'`, `'plan-editor-detail-dark'`, `'plan-editor-detail-narrow-de'`, `'plan-editor-locked'`, `'plan-editor-locked-dark'` (keep alphabetical order). Run `npm run check:fast -- tests/build/harness-shot.test.ts --testTimeout=20000`; expected FAIL (declared list lacks them).

In `scripts/harness-shot.mjs`, after the `plan-editor-light` entry:

```js
	// Detail-plan polish (2026-09-11): a fresh detail plan and a locked zone, the two states the
	// `?detail` and `?locked=` knobs exist for. The detail shots wait on the floor state until the
	// guide explainer exists to wait on; the narrow one waits on the constrained rail like
	// `plan-editor-narrow`, because the Inspector is not on screen at that width.
	{ name: 'plan-editor-detail', query: '?view=plan-editor&detail&theme=light', selector: FLOOR_STATE },
	{ name: 'plan-editor-detail-dark', query: '?view=plan-editor&detail', selector: FLOOR_STATE },
	{
		name: 'plan-editor-detail-narrow-de',
		query: '?view=plan-editor&detail&theme=light&lang=de',
		selector: [PLAN_CANVAS, '.rp-editor-shell[data-layout="constrained"] .rp-panel-rail'],
		width: 460,
	},
	{ name: 'plan-editor-locked', query: '?view=plan-editor&locked=harness-terrace,harness-garden&theme=light', selector: FLOOR_STATE },
	{ name: 'plan-editor-locked-dark', query: '?view=plan-editor&locked=harness-terrace,harness-garden', selector: FLOOR_STATE },
```

Re-run `npm run check:fast -- tests/build/harness-shot.test.ts --testTimeout=20000`; expected PASS. If another case in that file pins plan-editor shot fields and goes red, satisfy it rather than weakening it.

- [ ] **Step 7: Commit**

```bash
git add tests/harness/detailPlanKnob.ts tests/harness/detailPlanKnob.test.ts tests/harness/planEditor.ts tests/harness/page.ts scripts/harness-shot.mjs tests/build/harness-shot.test.ts
git commit -m "Add harness knobs for a detail plan and a locked zone"
```

Controller, after this task: `npm run harness-shot` for the five new shots (before captures), saved aside.

---

### Task 2: Fit frames the guide, and says why when there is nothing to fit

**Files:**
- Modify: `src/presentation/editor/hierarchy/parentZoneGuide.ts`
- Modify: `src/presentation/editor/viewport/usePlanFrame.ts`
- Modify: `src/presentation/editor/PlanCanvas.vue` (the `watch([referencePoints, …])` auto-fit)
- Modify: `src/presentation/editor/selection/useCanvasMenuActions.ts` (the `fit` action in the returned `computed`)
- Modify: `src/presentation/i18n/locales/en/editor.ts`, `src/presentation/i18n/locales/de/editor.ts` (beside `editor.view.fit-floor`)
- Test: `tests/presentation/editor/parentZoneGuide.test.ts`

**Interfaces:**
- Produces: `guideFramePoints(zone: ParentZoneOutlineDto | null): readonly Point[]` in `parentZoneGuide.ts`; key `editor.view.fit-nothing`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/presentation/editor/parentZoneGuide.test.ts` (add imports: `useEditorStore` from `src/presentation/stores/EditorStore`, `useWorkspaceStore` from `src/presentation/stores/WorkspaceStore`, `t` from `src/presentation/i18n/strings`, `expectDefined` from `../../helpers/domain`, `guideFramePoints` beside `guideOutline`):

```ts
/** Far from origin and far larger than the default camera (1 px per 10 mm) shows. */
const SITE = { name: 'Site', points: [{ x: 5000, y: 5000 }, { x: 65_000, y: 5000 }, { x: 65_000, y: 45_000 }, { x: 5000, y: 45_000 }] };
const withGuide = (parentZone = SITE) => ({ zones: [], queries: { ...fakeQueries(FIXTURE_PLAN, []), hierarchy: () => Promise.resolve(ok({ ...NO_HIERARCHY, parentZone })) } });
const shiftOne = () => new KeyboardEvent('keydown', { key: '!', code: 'Digit1', shiftKey: true, bubbles: true });

describe('guideFramePoints', () => {
	it('answers the guide at origin, and nothing without a parent zone', () => {
		expect(guideFramePoints(null)).toEqual([]);
		const xs = guideFramePoints(HOUSE).map((p) => p.x), ys = guideFramePoints(HOUSE).map((p) => p.y);
		expect([Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]).toEqual([0, 0, 10000, 8000]);
	});
});

describe('framing a detail plan on its guide', () => {
	it('fits an empty detail plan to its guide on first open, and Fit floor frames it while the reference layer is visible', async () => {
		const harness = await mountPlanEditorCanvas(withGuide());
		await settle();
		const editor = useEditorStore(harness.pinia);
		const rect = expectDefined(harness.stage.findOne<Konva.Line>('.parent-zone-guide'), 'the guide').getClientRect();
		expect(rect.x).toBeGreaterThanOrEqual(0);
		expect(rect.y).toBeGreaterThanOrEqual(0);
		expect(rect.x + rect.width).toBeLessThanOrEqual(editor.stageSize.width);
		expect(rect.y + rect.height).toBeLessThanOrEqual(editor.stageSize.height);

		const fitted = editor.viewport;
		editor.viewport = { ...fitted, pan: { x: 10000, y: 10000 } };
		harness.canvasEl?.dispatchEvent(shiftOne()); await settle();
		expect(editor.viewport).toEqual(fitted);

		useWorkspaceStore(harness.pinia).layerVisibility.background = false; await settle();
		editor.viewport = { ...fitted, pan: { x: 10000, y: 10000 } };
		harness.canvasEl?.dispatchEvent(shiftOne()); await settle();
		expect(editor.viewport.pan).toEqual({ x: 10000, y: 10000 });
		harness.unmount();
	});

	it('greys Fit floor on an empty plan with a reason of its own, and offers it once a guide is drawn', async () => {
		const menuFit = async (harness: Awaited<ReturnType<typeof mountPlanEditorCanvas>>) => {
			harness.canvasEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ContextMenu', bubbles: true, cancelable: true }));
			await settle();
			return harness.wrapper.get('[data-rp-context-action="fit"]');
		};
		const empty = await mountPlanEditorCanvas({ zones: [] });
		await settle();
		const greyed = await menuFit(empty);
		expect(greyed.attributes('aria-disabled')).toBe('true');
		expect(greyed.attributes('title')).toBe(t('en', 'editor.view.fit-nothing'));
		empty.unmount();

		const detail = await mountPlanEditorCanvas(withGuide());
		await settle();
		expect((await menuFit(detail)).attributes('aria-disabled')).not.toBe('true');
		detail.unmount();
	});
});
```

If `fakeQueries`'s second argument or `mountPlanEditorCanvas`'s `zones` option is shaped differently, follow `tests/helpers/editor.ts` / `planFixtures.ts`; keep the assertions.

- [ ] **Step 2: Run and watch them fail**

Run: `npm run check:fast -- tests/presentation/editor/parentZoneGuide.test.ts --testTimeout=20000`
Expected: FAIL — `guideFramePoints` is not exported; then the guide rect overflows the stage, Shift+1 leaves the pan, and the Fit title is `Not available while another tool or edit is active.`

- [ ] **Step 3: Implement**

`src/presentation/editor/hierarchy/parentZoneGuide.ts` — add (import `polygonPolyline` from `../../../core/geometry/curvePolyline` and `Point` from `../../../core/geometry/Point`):

```ts
/**
 * The guide as points a frame can bound: its polyline at 1 mm, curves included, so Fit and the
 * first-open fit frame what is drawn rather than only its vertices. Empty without a parent zone,
 * which `boundsOfZones` skips.
 */
export function guideFramePoints(zone: ParentZoneOutlineDto | null): readonly Point[] {
	return zone === null ? [] : polygonPolyline(guideOutline(zone));
}
```

`src/presentation/editor/viewport/usePlanFrame.ts`:

```ts
import { guideFramePoints } from '../hierarchy/parentZoneGuide';
import { usePlanHierarchyStore } from '../../stores/PlanHierarchyStore';
// …existing imports…

/**
 * One extent calculation for the native View controls and canvas fit shortcuts. The parent-zone
 * guide (ADR-0028) is framed exactly like the reference it lines up with: in a whole-plan fit
 * while the Reference layer is visible, never in a selection fit.
 */
export function usePlanFrame() {
	const editor = useEditorStore(), project = useProjectStore(), hierarchy = usePlanHierarchyStore();
	const workspace = useWorkspaceStore(), selection = useSelectionStore();
	return (all: boolean) => {
		const zones = [...project.zones.values(), ...structureCandidates(project.structure)];
		const framed = all ? zones : zones.filter(zone => selection.selectedIds.some(id => String(id) === zone.id));
		return boundsOfZones(all && workspace.layerVisibility.background
			? [...framed, { points: editor.referencePoints }, { points: guideFramePoints(hierarchy.hierarchy.parentZone) }] : framed);
	};
}
```

`src/presentation/editor/PlanCanvas.vue` — import `usePlanHierarchyStore` and `guideFramePoints`; replace the auto-fit watch with:

```ts
const planHierarchy = usePlanHierarchyStore();
watch([referencePoints, () => planHierarchy.hierarchy.parentZone, () => editor.stageSize, () => layerVisibility.value.background], ([points, parentZone]) => {
 const bounds = boundsOfZones([{ points }, { points: guideFramePoints(parentZone) }]);
 if (bounds !== null && project.zones.size === 0 && project.structure.walls.length === 0 && !project.structure.elements?.length && layerVisibility.value.background && runtime.activeToolId.value === 'select') editor.fitTo(bounds, editor.stageSize);
}, { flush: 'post' });
```

`src/presentation/editor/selection/useCanvasMenuActions.ts` — in the returned `computed`, build the fit action with its own reason:

```ts
		const nothingToFit = frame(ids.length === 0) === null;
		const result: CanvasMenuAction[] = [{ id: 'fit', label: ids.length ? 'editor.view.fit-selection' : 'editor.view.fit-floor', group: 'view', icon: 'maximize', disabled: nothingToFit, ...(nothingToFit ? { reason: 'editor.view.fit-nothing' as const } : {}), run: () => fit(ids.length === 0) }];
```

Locales, beside `editor.view.fit-selection`:
- `en/editor.ts`: `'editor.view.fit-nothing': 'Nothing on this floor to fit yet.',`
- `de/editor.ts`: `'editor.view.fit-nothing': 'Auf diesem Geschoss gibt es noch nichts zum Einpassen.',`

- [ ] **Step 4: Run and watch them pass, plus the neighbours**

Run: `npm run check:fast -- tests/presentation/editor/parentZoneGuide.test.ts tests/presentation/editor/backgroundInEditor.test.ts tests/presentation/editor/contextMenuActions.test.ts tests/presentation/editor/clipboard.test.ts tests/presentation/i18n/strings.test.ts --testTimeout=20000`
Expected: PASS. If a context-menu test asserted the old generic reason for an empty-plan Fit, update that expectation to `editor.view.fit-nothing` — that was the defect.

- [ ] **Step 5: Commit**

```bash
git add src/presentation/editor/hierarchy/parentZoneGuide.ts src/presentation/editor/viewport/usePlanFrame.ts src/presentation/editor/PlanCanvas.vue src/presentation/editor/selection/useCanvasMenuActions.ts src/presentation/i18n/locales/en/editor.ts src/presentation/i18n/locales/de/editor.ts tests/presentation/editor/parentZoneGuide.test.ts
git commit -m "Frame the parent-zone guide in Fit and say why Fit is greyed"
```

---

### Task 3: Explain the guide — caption, Inspector sentence, Reference row

**Files:**
- Modify: `src/presentation/editor/hierarchy/parentZoneGuide.ts` (add `guideSource`)
- Modify: `src/presentation/editor/hierarchy/ParentZoneGuide.vue` (caption text)
- Modify: `src/presentation/editor/shell/FloorInspector.vue` (explainer paragraph)
- Modify: `styles/editor-inspector.css` (one rule)
- Modify: `src/presentation/editor/layers/layerCatalogue.ts` (4th parameter `hasGuide`)
- Modify: `src/presentation/editor/shell/PropertyLayerPanel.vue` (pass `hasGuide`)
- Modify: `src/presentation/i18n/locales/en/input.ts`, `de/input.ts`, `en/editor.ts`, `de/editor.ts`
- Modify: `scripts/harness-shot.mjs` (tighten the two wide detail shots' selector)
- Test: `tests/presentation/editor/parentZoneGuide.test.ts`, `tests/presentation/editor/shell/floorInspector.test.ts`, `tests/presentation/editor/layers/layerCatalogue.test.ts`

**Interfaces:**
- Consumes: `guideOutline`, `guideFramePoints` (Task 2).
- Produces: `guideSource(hierarchy: PlanHierarchyDto): { readonly name: string; readonly plan: string } | null`; `layerCatalogue(plan, toggles, writesBlocked = false, hasGuide = false)`; class `.rp-floor-inspector__guide`; keys `editor.input.detail-plan-guide-caption`, `editor.input.detail-plan-guide-explainer`, `editor.layer.reference-plan.guide-only`.

- [ ] **Step 1: Write the failing tests**

`tests/presentation/editor/parentZoneGuide.test.ts` — add (import `guideSource`):

```ts
const FROM_SITE = { ...NO_HIERARCHY, ancestry: [{ id: 'plan-site', name: 'Site plan' }], parentZone: HOUSE };

describe('guideSource', () => {
	it('names the parent zone and the plan it sits on, and nothing without both', () => {
		expect(guideSource(FROM_SITE)).toEqual({ name: 'House', plan: 'Site plan' });
		expect(guideSource({ ...FROM_SITE, parentZone: null })).toBeNull();
		expect(guideSource({ ...FROM_SITE, ancestry: [] })).toBeNull();
	});
});

describe('explaining the guide on the canvas', () => {
	it('captions the guide with its source', async () => {
		const harness = await mountPlanEditorCanvas({ zones: [], queries: { ...fakeQueries(FIXTURE_PLAN, []), hierarchy: () => Promise.resolve(ok(FROM_SITE)) } });
		await settle();
		expect(harness.stage.findOne<Konva.Text>('.parent-zone-guide-caption')?.text()).toBe(t('en', 'editor.input.detail-plan-guide-caption', { name: 'House', plan: 'Site plan' }));
		harness.unmount();
	});

	it('makes the Reference row a live toggle while a guide is drawn, and hiding it hides the guide', async () => {
		const harness = await mountPlanEditorCanvas({ zones: [], queries: { ...fakeQueries(FIXTURE_PLAN, []), hierarchy: () => Promise.resolve(ok(FROM_SITE)) } });
		await settle();
		const checkbox = harness.wrapper.get('[data-rp-layer="reference"]');
		expect(checkbox.attributes('disabled')).toBeUndefined();
		await checkbox.trigger('change');
		await settle();
		expect(harness.stage.findOne<Konva.Line>('.parent-zone-guide')?.isVisible()).toBe(false);
		harness.unmount();
	});
});
```

The existing case "draws inside the background layer, at origin, and listens to nothing" keeps `expect(caption?.text()).toBe(HOUSE.name)` — its hierarchy has no ancestry, which is the fallback arm.

`tests/presentation/editor/shell/floorInspector.test.ts` — add a `describe` (imports: `ok` from `src/core/result/Result`, `NO_HIERARCHY` from `src/presentation/read-models/planHierarchy`, `fakeQueries`, `FIXTURE_PLAN` from `../../../helpers/planFixtures`, `useProjectStore` from `src/presentation/stores/ProjectStore`):

```ts
describe('a detail plan in the floor state', () => {
	const HOUSE = { name: 'House', points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }] };
	const detail = (parentZone: typeof HOUSE | null) => ({ zones: [], queries: { ...fakeQueries(FIXTURE_PLAN, []), hierarchy: () => Promise.resolve(ok({ ...NO_HIERARCHY, ancestry: [{ id: 'plan-site', name: 'Site plan' }], parentZone })) } });

	it('explains the dashed outline while the plan has no reference plan', async () => {
		harness = await mountPlanEditorCanvas(detail(HOUSE));
		await settle();
		expect(harness.wrapper.get('.rp-floor-inspector__guide').text()).toBe(t('en', 'editor.input.detail-plan-guide-explainer', { name: 'House', plan: 'Site plan' }));
	});

	it('drops the explanation once a reference plan is set', async () => {
		harness = await mountPlanEditorCanvas(detail(HOUSE));
		await settle();
		useProjectStore(harness.pinia).plan = { ...FIXTURE_PLAN, background: { path: 'Plans/g.png', kind: 'image' } };
		await settle();
		expect(harness.wrapper.find('.rp-floor-inspector__guide').exists()).toBe(false);
	});

	it('never explains a guide that is not drawn', async () => {
		harness = await mountPlanEditorCanvas(detail(null));
		await settle();
		expect(harness.wrapper.find('.rp-floor-inspector__guide').exists()).toBe(false);
	});
});
```

`tests/presentation/editor/layers/layerCatalogue.test.ts` — add inside the `describe`:

```ts
	it('makes the reference row a live toggle naming the guide when a detail plan has a guide but no background', () => {
		const [reference] = layerCatalogue(FIXTURE_PLAN, toggles(), false, true);
		expect(reference.state).toBe('available');
		expect(reference.reasonKey).toBe('editor.layer.reference-plan.guide-only');
		expect(reference.action).toEqual({ labelKey: 'editor.layer.reference-plan.set-scale', toolId: 'calibrate', enabled: false, reasonKey: 'editor.layer.reference-plan.none' });
	});

	it('says nothing extra about a guide once a background exists', () => {
		const [reference] = layerCatalogue({ ...FIXTURE_PLAN, background: { path: 'Plans/g.png', kind: 'image' } }, toggles(), false, true);
		expect(reference.state).toBe('available');
		expect(reference.reasonKey).toBeNull();
	});
```

- [ ] **Step 2: Run and watch them fail**

Run: `npm run check:fast -- tests/presentation/editor/parentZoneGuide.test.ts tests/presentation/editor/shell/floorInspector.test.ts tests/presentation/editor/layers/layerCatalogue.test.ts --testTimeout=20000`
Expected: FAIL — missing export/keys, caption is the bare name, no `.rp-floor-inspector__guide`, the Reference checkbox is disabled.

- [ ] **Step 3: Implement**

`parentZoneGuide.ts` — add (import `PlanHierarchyDto` beside `ParentZoneOutlineDto`):

```ts
/**
 * What the guide is a copy of, for its caption and the Inspector's explanation: the parent zone's
 * name and the plan that zone sits on (the nearest ancestor). `null` when either is missing,
 * which leaves the caption as the bare name and the Inspector silent.
 */
export function guideSource(hierarchy: PlanHierarchyDto): { readonly name: string; readonly plan: string } | null {
	const plan = hierarchy.ancestry.at(-1);
	return hierarchy.parentZone === null || plan === undefined ? null : { name: hierarchy.parentZone.name, plan: plan.name };
}
```

`ParentZoneGuide.vue` — import `tr` from `../../i18n/strings` and `guideSource`; add `const source = computed(() => guideSource(hierarchy.value));` and in `caption` replace `text: outline.value.name,` with:

```ts
	text: source.value === null ? outline.value.name : tr('editor.input.detail-plan-guide-caption', source.value),
```

Update the component docblock's first sentence to say the caption names the zone and the plan it comes from.

`FloorInspector.vue` — imports: `storeToRefs` from `pinia`, `usePlanHierarchyStore` from `../../stores/PlanHierarchyStore`, `guideSource` from `../hierarchy/parentZoneGuide`. Add:

```ts
const { hierarchy } = storeToRefs(usePlanHierarchyStore());
/** A detail plan's outline explained where nothing covers it (ADR-0028), while there is still a reference plan to line it up with. */
const guide = computed(() => (project.plan?.background === null ? guideSource(hierarchy.value) : null));
```

Template, directly after `<h3>{{ summary.floor.name }}</h3>`:

```html
		<p
			v-if="guide"
			class="rp-floor-inspector__guide"
		>
			{{ tr('editor.input.detail-plan-guide-explainer', guide) }}
		</p>
```

`styles/editor-inspector.css` — beside the other `.rp-floor-inspector*` rules:

```css
.rp-floor-inspector__guide {
	margin: 0 0 var(--size-4-3);
	color: var(--text-muted);
	font-size: var(--font-ui-small);
}
```

`layerCatalogue.ts` — signature `export function layerCatalogue(plan: PlanDto | null, toggles: LayerToggles, writesBlocked = false, hasGuide = false): readonly LayerEntry[]`; in the reference entry:

```ts
			state: hasReference || hasGuide ? 'available' : 'supported-empty',
			reasonKey: hasReference ? null : hasGuide ? 'editor.layer.reference-plan.guide-only' : 'editor.layer.reference-plan.none',
```

Add one sentence to its docblock: a detail plan's guide (ADR-0028) draws on this layer, so with a guide and no background the row is a live toggle that says what it shows.

`PropertyLayerPanel.vue` — import `usePlanHierarchyStore`; `const { hierarchy } = storeToRefs(usePlanHierarchyStore());` and `layerCatalogue(props.plan, toggles.value, stale.value, hierarchy.value.parentZone !== null)`.

Locales:
- `en/input.ts`:
  - `'editor.input.detail-plan-guide-caption': '{name} · outline from {plan}',`
  - `'editor.input.detail-plan-guide-explainer': 'The dashed outline is {name} from {plan}. It is a guide only and is not saved on this plan. Add a reference plan cropped at the same top-left corner and set its scale, and the two line up.',`
- `de/input.ts`:
  - `'editor.input.detail-plan-guide-caption': '{name} · Umriss aus {plan}',`
  - `'editor.input.detail-plan-guide-explainer': 'Der gestrichelte Umriss ist {name} aus {plan}. Er dient nur als Hilfslinie und wird in diesem Plan nicht gespeichert. Fügen Sie einen Referenzplan hinzu, der an derselben linken oberen Ecke zugeschnitten ist, und legen Sie den Maßstab fest – dann liegen beide übereinander.',`
- `en/editor.ts` beside `editor.layer.reference-plan.none`: `'editor.layer.reference-plan.guide-only': 'Shows the outline of the room or area this plan details.',`
- `de/editor.ts`: `'editor.layer.reference-plan.guide-only': 'Zeigt den Umriss des Raums oder der Fläche, zu der dieser Plan gehört.',`

`scripts/harness-shot.mjs` — change `selector: FLOOR_STATE` to `selector: '.rp-floor-inspector__guide'` on `plan-editor-detail` and `plan-editor-detail-dark` only, and reword their comment: they wait on the explainer because it draws only once the hierarchy read has landed.

- [ ] **Step 4: Run and watch them pass, plus the neighbours**

Run: `npm run check:fast -- tests/presentation/editor/parentZoneGuide.test.ts tests/presentation/editor/shell/floorInspector.test.ts tests/presentation/editor/layers/layerCatalogue.test.ts tests/presentation/editor/shell/layerList.test.ts tests/presentation/editor/shell.test.ts tests/presentation/editor/tools/calibrateWiring.test.ts tests/presentation/i18n/strings.test.ts tests/build/harness-shot.test.ts tests/harness/detailPlanKnob.test.ts --testTimeout=20000`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/presentation/editor/hierarchy src/presentation/editor/shell/FloorInspector.vue styles/editor-inspector.css src/presentation/editor/layers/layerCatalogue.ts src/presentation/editor/shell/PropertyLayerPanel.vue src/presentation/i18n/locales scripts/harness-shot.mjs tests/presentation/editor
git commit -m "Say what the parent-zone guide is and where it comes from"
```

---

### Task 4: The dialog says "detail plan", and the context bar marks the current plan

**Files:**
- Modify: `src/presentation/editor/hierarchy/detailPlanActions.ts` (`title:` in `create`)
- Modify: `src/presentation/i18n/locales/en.ts`, `src/presentation/i18n/locales/de.ts` (beside `form.new-plan.title`)
- Modify: `src/presentation/editor/shell/EditorContextBar.vue` (the current-plan `<span>`)
- Test: `tests/presentation/editor/detailPlans.e2e.test.ts`, `tests/presentation/editor/shell/editorContextBar.test.ts`

**Interfaces:**
- Produces: key `form.new-detail-plan.title` with `{name}`.

- [ ] **Step 1: Write the failing tests**

`detailPlans.e2e.test.ts`, in "creates a detail plan named after the zone, opens it, and then lists it under that zone", directly after `await settleUntil(() => r.dialogs.current !== null, 'new plan dialog');` (import `t` from `src/presentation/i18n/strings`):

```ts
	expect(r.dialogs.current?.title).toBe(t('en', 'form.new-detail-plan.title', { name: 'House' }));
```

`editorContextBar.test.ts`, at the end of "names the project and the floor as a breadcrumb":

```ts
		const current = harness.wrapper.findAll('.rp-context-bar__crumb').at(-1);
		expect(current?.attributes('aria-current')).toBe('page');
		expect(harness.wrapper.findAll('.rp-context-bar__crumb[aria-current]')).toHaveLength(1);
```

- [ ] **Step 2: Run and watch them fail**

Run: `npm run check:fast -- tests/presentation/editor/detailPlans.e2e.test.ts tests/presentation/editor/shell/editorContextBar.test.ts --testTimeout=20000`
Expected: FAIL — title is "New plan"; `aria-current` undefined.

- [ ] **Step 3: Implement**

`detailPlanActions.ts`: `title: tr('form.new-detail-plan.title', { name }),`

`en.ts` after `'form.new-plan.title'`: `'form.new-detail-plan.title': 'New detail plan for {name}',`
`de.ts` after `'form.new-plan.title'`: `'form.new-detail-plan.title': 'Neuer Detailplan für {name}',`

`EditorContextBar.vue`, the plan crumb:

```html
			<span
				v-if="plan?.name"
				class="rp-context-bar__crumb"
				aria-current="page"
			>{{ plan.name }}</span>
```

- [ ] **Step 4: Run and watch them pass**

Run: `npm run check:fast -- tests/presentation/editor/detailPlans.e2e.test.ts tests/presentation/editor/shell/editorContextBar.test.ts tests/presentation/i18n/strings.test.ts tests/harness/accessibility.test.ts --testTimeout=20000`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/presentation/editor/hierarchy/detailPlanActions.ts src/presentation/i18n/locales/en.ts src/presentation/i18n/locales/de.ts src/presentation/editor/shell/EditorContextBar.vue tests/presentation/editor/detailPlans.e2e.test.ts tests/presentation/editor/shell/editorContextBar.test.ts
git commit -m "Title the detail plan dialog and mark the current crumb"
```

---

### Task 5: A failed hierarchy read says so, and a missing parent zone says what it means

**Files:**
- Modify: `src/presentation/stores/PlanHierarchyStore.ts`
- Modify: `src/presentation/editor/shell/PropertyTree.vue`
- Modify: `src/presentation/i18n/locales/en/input.ts`, `de/input.ts`
- Test: `tests/presentation/stores/planHierarchyStore.test.ts`, `tests/presentation/editor/shell/propertyTree.test.ts`

**Interfaces:**
- Produces: `usePlanHierarchyStore().failed: Ref<boolean>`; key `editor.input.hierarchy-unreadable`.

- [ ] **Step 1: Write the failing tests**

`planHierarchyStore.test.ts` — replace the case "keeps the previous hierarchy when a later read fails" (and its docblock, which cites the retired ponytail comment) with:

```ts
	/**
	 * A failed read keeps the last answer on screen AND says it failed: a detail plan whose
	 * hierarchy could not be read must not pass for a parentless plan (PBI guarantee).
	 */
	it('keeps the previous hierarchy when a later read fails, flags the failure, and clears it on the next success', async () => {
		const store = usePlanHierarchyStore();
		await store.load({ ...fakeQueries(FIXTURE_PLAN), hierarchy: () => Promise.resolve(ok(HOUSE)) }, FIXTURE_PLAN.id);
		expect(store.failed).toBe(false);

		await store.load({ ...fakeQueries(FIXTURE_PLAN), hierarchy: () => Promise.resolve(err(READ_FAILED)) }, FIXTURE_PLAN.id);
		expect(store.hierarchy).toEqual(HOUSE);
		expect(store.failed).toBe(true);

		await store.load({ ...fakeQueries(FIXTURE_PLAN), hierarchy: () => Promise.resolve(ok(SITE)) }, FIXTURE_PLAN.id);
		expect(store.failed).toBe(false);
	});

	it('does not let an older failing read, resolving late, flag a newer successful one', async () => {
		const store = usePlanHierarchyStore();
		const first = defer<ReturnType<typeof err<typeof READ_FAILED>>>();
		const firstLoad = store.load({ ...fakeQueries(FIXTURE_PLAN), hierarchy: () => first.promise }, 'plan-house');
		await store.load({ ...fakeQueries(FIXTURE_PLAN), hierarchy: () => Promise.resolve(ok(SITE)) }, 'plan-site');
		first.resolve(err(READ_FAILED));
		await firstLoad;
		expect(store.failed).toBe(false);
	});
```

If `defer`'s type parameter does not accept that expression, type it the way the existing stale-answer case in the same file does.

`propertyTree.test.ts` — add inside the `describe` (import `err` beside `ok`):

```ts
	it('says the hierarchy could not be read rather than drawing a parentless plan', async () => {
		const harness = await mountPlanEditorCanvas({
			queries: { ...fakeQueries(FIXTURE_PLAN), hierarchy: () => Promise.resolve(err({ category: 'Persistence', code: 'vault.unexpected-failure', message: 'io' } as const)) },
		});
		await settle();
		expect(harness.wrapper.get('.rp-property-tree [role="status"]').text()).toBe(t('en', 'editor.input.hierarchy-unreadable'));
	});
```

- [ ] **Step 2: Run and watch them fail**

Run: `npm run check:fast -- tests/presentation/stores/planHierarchyStore.test.ts tests/presentation/editor/shell/propertyTree.test.ts --testTimeout=20000`
Expected: FAIL — `failed` undefined; no status line.

- [ ] **Step 3: Implement**

`PlanHierarchyStore.ts`:

```ts
/**
 * One Plan Editor leaf's plan hierarchy (ADR-0028), rebuildable from `queries.hierarchy` like
 * every store here. A slower earlier read never lands over a later one. A failed read keeps the
 * last answer — the breadcrumb and guide are additive — and sets `failed`, so the Property tree
 * can say so instead of letting a detail plan pass for a parentless one.
 */
export const usePlanHierarchyStore = defineStore('plan-hierarchy', () => {
	const hierarchy = ref<PlanHierarchyDto>(NO_HIERARCHY);
	const failed = ref(false);
	let latest = 0;

	async function load(queries: PlanEditorQueryServices, planId: string): Promise<void> {
		if (queries.hierarchy === undefined) return;
		const request = ++latest;
		const found = await queries.hierarchy(planId);
		if (request !== latest) return;
		failed.value = !found.ok;
		if (found.ok) hierarchy.value = found.value;
	}

	return { hierarchy, failed, load };
});
```

`PropertyTree.vue` — `const { hierarchy, failed } = storeToRefs(usePlanHierarchyStore());`; replace the missing-zone `<p>` with:

```html
		<p
			v-if="failed"
			class="rp-editor-inspector-empty"
			role="status"
		>
			{{ tr('editor.input.hierarchy-unreadable') }}
		</p>
		<p
			v-else-if="hierarchy.parentZoneMissing"
			class="rp-editor-inspector-empty"
			role="status"
		>
			{{ tr('editor.input.parent-zone-missing') }}
		</p>
```

Locales:
- `en/input.ts`: set `'editor.input.parent-zone-missing'` to `'The room or area this plan details no longer exists, so its outline is not shown.'`; add `'editor.input.hierarchy-unreadable': 'Could not read which plans this one sits under.',`
- `de/input.ts`: `'editor.input.parent-zone-missing': 'Der Raum oder die Fläche, zu der dieser Plan gehört, existiert nicht mehr. Der Umriss wird daher nicht angezeigt.',` and `'editor.input.hierarchy-unreadable': 'Es konnte nicht gelesen werden, zu welchen Plänen dieser Plan gehört.',`

- [ ] **Step 4: Run and watch them pass, plus the neighbours**

Run: `npm run check:fast -- tests/presentation/stores/planHierarchyStore.test.ts tests/presentation/editor/shell/propertyTree.test.ts tests/presentation/editor/detailPlans.e2e.test.ts tests/presentation/i18n/strings.test.ts tests/harness/accessibility.test.ts --testTimeout=20000`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/presentation/stores/PlanHierarchyStore.ts src/presentation/editor/shell/PropertyTree.vue src/presentation/i18n/locales/en/input.ts src/presentation/i18n/locales/de/input.ts tests/presentation/stores/planHierarchyStore.test.ts tests/presentation/editor/shell/propertyTree.test.ts
git commit -m "Say when a plan's hierarchy could not be read"
```

---

### Task 6 (controller): captures and the locked-caption judgement

- [ ] `npm run harness-shot` in the worktree (after-captures of all five new shots plus `plan-editor-light` and `plan-editor-narrow` as regressions).
- [ ] Compare before/after for the detail shots: guide framed, caption names source, explainer present, Reference row live.
- [ ] Zoom on `plan-editor-locked*` captions. If the halo reads through the half-transparent text as a muddy outline, dispatch a micro-task: in `ZoneShape.vue` `captionLayout`, `strokeWidth: props.model.locked ? 0 : 2`, with a jsdom case in `tests/presentation/editor/zoneLockedCaption.test.ts` asserting a locked zone's caption `strokeWidth()` is 0 and an unlocked one's is 2 (watched failing first), then re-capture. If it reads fine, record "judged acceptable" with the capture names in the PR.

---

### Task 7: Documentation

**Files:**
- Modify: `docs/using-plan-editor.md` ("Build detail plans from a zone")
- Modify: `docs/tests/cases/Build detail plans from site to floor.md`
- Modify: `docs/development/adrs/0028-a-plan-may-detail-a-zone-of-another-plan.md` (Consequences)
- Modify: `docs/superpowers/specs/2026-09-10-zone-lock-and-detail-plans-design.md` §4.8
- Modify: `docs/requirements/Create a detail plan from a zone and move between levels.md` (Amendments)
- Modify: `CHANGELOG.md` (`[Unreleased]` — extend the existing detail-plan bullet; no version)

- [ ] **Step 1: User guide** — replace the section's paragraph with:

> Right-click a zone such as House or Garden and choose **New detail plan**. The dialog is titled for that zone, and the new plan is named after it and opens in its own tab. There it shows the zone's outline as a dashed guide in the top-left corner, captioned with the zone and the plan it comes from; with nothing selected, the Inspector says what the outline is. **Fit floor** frames the guide while the Reference plan layer is visible, and that layer's eye hides it. Crop the new plan's reference image at the same corner and calibrate it, and the drawing lines up with the guide. A zone can have several detail plans, for example one per floor, and its right-click menu lists **Open** for each. On a detail plan, the breadcrumb and the Property tree list every plan above it, and each name opens that plan. If the zone is later deleted, the outline disappears and the Property tree says so.

- [ ] **Step 2: Manual case** — in step 3 replace "and a dashed `House` outline sits at the top-left of the empty canvas." with "the dialog was titled `New detail plan for House`; a dashed outline captioned `House · outline from Site plan` sits at the top-left of the empty canvas, fully in view; with nothing selected the Inspector explains the outline. Press `Shift+1`: the outline stays framed. Turn off **Reference plan** in Layers: the outline hides." Keep the Runs table row exactly as it is (`Not run`).

- [ ] **Step 3: ADR-0028** — add to Consequences:

> - Editing or renaming the parent zone in its own plan does not refresh an open detail plan's guide or caption until that detail plan reopens or retries, for the same reason as the line above: the plan-change source filters by the plan being shown.
> - The guide is framed by a whole-plan fit whenever the Reference plan layer is visible, like the reference it lines up with (amended 2026-09-11).

- [ ] **Step 4: Spec §4.8** — replace the bullet "**Never** a selection candidate, never in the sidebar lists, never in a fit-to-content bound, never persisted into the detail plan." with "**Never** a selection candidate, never in the sidebar lists, never persisted into the detail plan." and append after "Hidden when the background layer is hidden.":

> (detail-plan polish, 2026-09-11: a whole-plan fit and the empty-plan first-open fit include the guide while the background layer is visible, exactly as they include the reference; a selection fit never does. The caption reads "{name} · outline from {plan}", the floor Inspector explains the guide while the plan has no background, and with a guide but no background the Reference plan layer row is a live toggle — `usePlanFrame.ts`, `ParentZoneGuide.vue`, `FloorInspector.vue`, `layerCatalogue.ts`.)

- [ ] **Step 5: PBI amendment** — append under Amendments:

> **2026-09-11** — Detail-plan polish (`docs/superpowers/plans/2026-09-11-detail-plan-polish.md`) after a first vault user could not tell what the dashed outline was: the create dialog is titled for the zone, the guide's caption names its source plan, the floor Inspector explains it, Fit frames it, and a failed hierarchy read is said in the Property tree rather than presenting a parentless plan. Evidence: `tests/presentation/editor/parentZoneGuide.test.ts`, `tests/presentation/editor/shell/floorInspector.test.ts`, `tests/presentation/stores/planHierarchyStore.test.ts`. The manual walkthrough is still unrun.

- [ ] **Step 6: CHANGELOG** — extend the existing `[Unreleased]` detail-plan bullet's end with: " The guide is captioned with its source, explained in the Inspector and framed by Fit, and a failed hierarchy read is reported in the Property tree."

- [ ] **Step 7: Check and commit**

Run: `npm run check:fast -- tests/release tests/build/encoding.test.ts --testTimeout=20000`
Expected: PASS.

```bash
git add docs CHANGELOG.md
git commit -m "Document the detail plan guide's explanation and framing"
```

---

### Task 8 (controller): gate and PR

- [ ] `npm run check` once (nothing else running). Fix anything red through a fresh implementer with the failure output.
- [ ] `git push -u origin feat/detail-plan-polish`, open the PR: what changed, what jsdom proves (the test files), what the captures show (shot names), the halo judgement, and what still needs `npm run test-build` in a vault (the manual case, unrun).
