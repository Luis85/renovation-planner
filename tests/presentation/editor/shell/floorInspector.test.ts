// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import { t } from '../../../../src/presentation/i18n/strings';
import { ok } from '../../../../src/core/result/Result';
import { NO_HIERARCHY } from '../../../../src/presentation/read-models/planHierarchy';
import { useProjectStore } from '../../../../src/presentation/stores/ProjectStore';
import { useSelectionStore } from '../../../../src/presentation/editor/selection/selection-store';
import { mountPlanEditorCanvas, settle, type CanvasHarness } from '../../../helpers/editor';
import { fakeQueries, FIXTURE_PLAN } from '../../../helpers/planFixtures';

/**
 * The Inspector FRAME (Task 15, component library §8): `EntityInspector.vue` routes by
 * selection to the floor state (`FloorInspector.vue`, over Task 7's `buildFloorSummary`), the
 * multiple-selection text, or the room body (`RoomInspector.vue`, `InspectorPanel.vue` through
 * Task 15) — driven through the REAL mounted Plan Editor over `FIXTURE_ZONES`
 * (`zone-kitchen`, a Room; `zone-terrace`, a Terrace), the same fixture `runtime.test.ts`'s
 * `selectAndFrame` cases already use.
 */

let harness: CanvasHarness | null = null;

afterEach(() => {
	harness?.unmount();
	harness = null;
});

const HOUSE = { name: 'House', points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }] };
/** A detail plan's fixture: a parent zone with an ancestry one plan deep, so `guideSource` has both name and plan. */
const detail = (parentZone: typeof HOUSE | null) => ({ zones: [], queries: { ...fakeQueries(FIXTURE_PLAN, []), hierarchy: () => Promise.resolve(ok({ ...NO_HIERARCHY, ancestry: [{ id: 'plan-site', name: 'Site plan', kind: 'floor' as const }], parentZone })) } });

describe('the floor state', () => {
	it('with nothing selected shows the floor summary: counts available, unbuilt aggregates unavailable, never zero', async () => {
		harness = await mountPlanEditorCanvas();
		const floor = harness.wrapper.find('.rp-floor-inspector');

		expect(floor.find('[data-rp-stat="rooms"]').text()).toContain('1');
		expect(floor.find('[data-rp-stat="planned-changes"]').text()).toBe('0');
		expect(floor.find('[data-rp-stat="estimated-cost"]').text()).not.toMatch(/\d/);
	});

	it('marks counts partial when zones were unreadable', async () => {
		harness = await mountPlanEditorCanvas({ unreadableZones: 2 });

		expect(harness.wrapper.find('[data-rp-stat="rooms"]').classes()).toContain('rp-floor-inspector__stat--partial');
		expect(harness.wrapper.find('[data-rp-stat="rooms"]').text()).toContain('2');
	});

	it('lists every room and every area as a button, and a row selects and frames its record', async () => {
		harness = await mountPlanEditorCanvas();
		const rows = harness.wrapper.find('.rp-floor-inspector').findAll('.rp-room-list__row');

		expect(rows.map((row) => row.find('span').text())).toEqual(['Kitchen', 'Terrace']);

		await rows[0].trigger('click');

		expect(useSelectionStore().selectedIds.map(String)).toEqual(['zone-kitchen']);
	});
});

/**
 * The shell-level `role="status"` guidance region (design spec §6.6, R15): announced once when
 * a selection CLEARS to nothing, retired shortly after so an unrelated refresh never
 * re-announces it. This case proves the FULL-layout half, with `EntityInspector` mounted
 * beside it; `responsiveShell.test.ts`'s constrained case proves the region keeps announcing
 * once `EntityInspector` is unmounted, which is the whole reason the watcher lives in
 * `SelectionGuidance.vue` rather than here.
 *
 * **The timing is the whole of what this case has to prove, so it is spelled out.**
 * `SelectionGuidance`'s watcher sets the guidance text SYNCHRONOUSLY on the clear and then
 * awaits one tick before arming a REAL `setTimeout(0)` to blank it — and `settle()` (this
 * suite's usual wait) itself waits out exactly such a timer, so asserting the text is present
 * after a `settle()` would already find it cleared. The first half is read after ONE
 * `nextTick()` instead, which is enough for Vue to have painted the watcher's synchronous
 * assignment and not enough for the timer to have fired; the second half is read after
 * `settle()`, which both drains that timer and proves `changePlan()` — an ordinary refresh
 * that leaves the (already empty) selection untouched — does not arm it again.
 */
describe('a detail plan in the floor state', () => {
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

describe('the guidance region', () => {
	it('announces guidance once when the selection clears, and not on a refresh', async () => {
		harness = await mountPlanEditorCanvas();

		useSelectionStore().select(['zone-kitchen' as never]);
		await settle();
		useSelectionStore().clear();
		await nextTick();

		expect(harness.wrapper.find('.rp-selection-guidance').text()).toBe(t('en', 'editor.inspector.floor.guidance'));
		// Announced, never drawn: a visible line here pushed the canvas down for one tick on every deselect.
		expect(harness.wrapper.find('.rp-selection-guidance').classes()).toContain('rp-visually-hidden');

		harness.changePlan();
		await settle();

		expect(harness.wrapper.find('.rp-selection-guidance').text()).toBe('');
	});
});
