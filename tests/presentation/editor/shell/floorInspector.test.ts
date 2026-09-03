// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import { t } from '../../../../src/presentation/i18n/strings';
import { useSelectionStore } from '../../../../src/presentation/editor/selection/selection-store';
import { mountPlanEditorCanvas, settle, type CanvasHarness } from '../../../helpers/editor';

/**
 * The Inspector FRAME (Task 15, component library §8): `EntityInspector.vue` routes by
 * selection to the floor state (`FloorInspector.vue`, over Task 7's `buildFloorSummary`), the
 * multiple-selection text, or the room body (`InspectorPanel.vue`, until Task 16 renames it
 * `RoomInspector`) — driven through the REAL mounted Plan Editor over `FIXTURE_ZONES`
 * (`zone-kitchen`, a Room; `zone-terrace`, a Terrace), the same fixture `runtime.test.ts`'s
 * `selectAndFrame` cases already use.
 */

let harness: CanvasHarness | null = null;

afterEach(() => {
	harness?.unmount();
	harness = null;
});

describe('the floor state', () => {
	it('with nothing selected shows the floor summary: counts available, unbuilt aggregates unavailable, never zero', async () => {
		harness = await mountPlanEditorCanvas();
		const floor = harness.wrapper.find('.rp-floor-inspector');

		expect(floor.find('[data-rp-stat="rooms"]').text()).toContain('1');
		expect(floor.find('[data-rp-stat="planned-changes"]').text()).toBe(t('en', 'editor.inspector.unavailable'));
		expect(floor.find('[data-rp-stat="estimated-cost"]').text()).not.toMatch(/\d/);
	});

	it('marks counts partial when zones were unreadable', async () => {
		harness = await mountPlanEditorCanvas({ unreadableZones: 2 });

		expect(harness.wrapper.find('[data-rp-stat="rooms"]').classes()).toContain('rp-floor-inspector__stat--partial');
		expect(harness.wrapper.find('[data-rp-stat="rooms"]').text()).toContain('2');
	});

	it('lists every room and every area as a button, and a row selects and frames its record', async () => {
		harness = await mountPlanEditorCanvas();
		const rows = harness.wrapper.findAll('.rp-room-list__row');

		expect(rows.map((row) => row.text())).toEqual(['Kitchen', 'Terrace']);

		await rows[0].trigger('click');

		expect(useSelectionStore().selectedIds.map(String)).toEqual(['zone-kitchen']);
	});
});

/**
 * The frame's `role="status"` guidance region (design spec §6.6): announced once when a
 * selection CLEARS to nothing, retired shortly after so an unrelated refresh never
 * re-announces it.
 *
 * **The timing is the whole of what this case has to prove, so it is spelled out.**
 * `EntityInspector`'s watcher sets the guidance text SYNCHRONOUSLY on the clear and then
 * awaits one tick before arming a REAL `setTimeout(0)` to blank it — and `settle()` (this
 * suite's usual wait) itself waits out exactly such a timer, so asserting the text is present
 * after a `settle()` would already find it cleared. The first half is read after ONE
 * `nextTick()` instead, which is enough for Vue to have painted the watcher's synchronous
 * assignment and not enough for the timer to have fired; the second half is read after
 * `settle()`, which both drains that timer and proves `changePlan()` — an ordinary refresh
 * that leaves the (already empty) selection untouched — does not arm it again.
 */
describe('the guidance region', () => {
	it('announces guidance once when the selection clears, and not on a refresh', async () => {
		harness = await mountPlanEditorCanvas();

		useSelectionStore().select(['zone-kitchen' as never]);
		await settle();
		useSelectionStore().clear();
		await nextTick();

		expect(harness.wrapper.find('.rp-inspector-guidance').text()).toBe(t('en', 'editor.inspector.floor.guidance'));

		harness.changePlan();
		await settle();

		expect(harness.wrapper.find('.rp-inspector-guidance').text()).toBe('');
	});
});
