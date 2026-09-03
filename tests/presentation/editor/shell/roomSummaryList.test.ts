// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import RoomSummaryList from '../../../../src/presentation/editor/shell/RoomSummaryList.vue';
import { EDITOR_RUNTIME, type EditorRuntime } from '../../../../src/presentation/editor/runtime';
import { useSelectionStore } from '../../../../src/presentation/editor/selection/selection-store';
import type { SpatialRecordDto } from '../../../../src/presentation/read-models/spatialRecords';

/**
 * `RoomSummaryList` mounted STANDALONE, with a stub `EditorRuntime` rather than the real
 * `buildRuntime` — the component's one dependency it cannot supply itself, the same shape
 * `StatusBar`'s own harness note describes for a shell region that can only exist inside the
 * whole editor.
 *
 * **This is the one door `isSelected`'s `true` arm can be asked through.** The frame's own
 * routing (`EntityInspector.vue`) shows this list only while `selectedIds` is EMPTY —
 * selecting a record navigates the Inspector to the room body instead, unmounting this list
 * in the same reactive flush — so the mounted-editor suite (`floorInspector.test.ts`) can
 * only ever see the `false` arm. Asking the component directly is also the more honest test:
 * `isSelected` is a property of THIS component, not of whichever caller happens to combine it
 * with a selection today.
 */
const RECORDS: readonly SpatialRecordDto[] = [
	{ kind: 'room', id: 'zone-kitchen', planId: 'plan-ground', name: 'Kitchen', zoneType: 'Room', points: [], areaMm2: 0 },
	{ kind: 'area', id: 'zone-terrace', planId: 'plan-ground', name: 'Terrace', zoneType: 'Terrace', points: [], areaMm2: 0 },
];

function mountList(selectAndFrame = vi.fn<(id: string) => void>()) {
	setActivePinia(createPinia());
	const runtime = { selectAndFrame } as unknown as EditorRuntime;
	const wrapper = mount(RoomSummaryList, {
		props: { records: RECORDS, heading: 'Rooms' },
		global: { provide: { [EDITOR_RUNTIME as symbol]: runtime } },
	});
	return { wrapper, selectAndFrame };
}

describe('RoomSummaryList', () => {
	it('marks no row pressed when nothing is selected', () => {
		const { wrapper } = mountList();
		const rows = wrapper.findAll('.rp-room-list__row');

		expect(rows.map((row) => row.attributes('aria-pressed'))).toEqual(['false', 'false']);
	});

	it('marks the row matching the current selection pressed, and no other', async () => {
		const { wrapper } = mountList();
		useSelectionStore().select(['zone-terrace' as never]);
		await nextTick();

		const rows = wrapper.findAll('.rp-room-list__row');
		expect(rows.map((row) => row.attributes('aria-pressed'))).toEqual(['false', 'true']);
	});

	it('a row click asks the runtime to select and frame its own record', async () => {
		const { wrapper, selectAndFrame } = mountList();
		const rows = wrapper.findAll('.rp-room-list__row');

		await rows[0].trigger('click');

		expect(selectAndFrame).toHaveBeenCalledWith('zone-kitchen');
	});
});
