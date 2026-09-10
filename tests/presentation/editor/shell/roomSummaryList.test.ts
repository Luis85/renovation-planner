// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { flushPromises, mount } from '@vue/test-utils';
import { nextTick, ref } from 'vue';
import RoomSummaryList from '../../../../src/presentation/editor/shell/RoomSummaryList.vue';
import { EDITOR_RUNTIME, type EditorRuntime } from '../../../../src/presentation/editor/runtime';
import { PLAN_EDITOR_CONTEXT } from '../../../../src/presentation/editor/PlanEditorContext';
import { useSelectionStore } from '../../../../src/presentation/editor/selection/selection-store';
import type { SpatialRecordDto } from '../../../../src/presentation/read-models/spatialRecords';
import { ok } from '../../../../src/core/result/Result';

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
	{ kind: 'area', id: 'zone-terrace', planId: 'plan-ground', name: 'Terrace', zoneType: 'Terrace', points: [], areaMm2: 0, locked: true },
];

const KITCHEN_VERSION = { revision: 3 };

/** Matches the pattern `requirementStaleness.test.ts` uses for the same port. */
type LogLine = (event: string, context?: Record<string, unknown>) => void;

function mountList(selectAndFrame = vi.fn<(id: string) => void>()) {
	setActivePinia(createPinia());
	const commitEdit = vi.fn<(edit: unknown) => Promise<boolean>>(() => Promise.resolve(true));
	const runtime = { selectAndFrame, commitEdit, writesBlocked: ref(false) } as unknown as EditorRuntime;
	const context = {
		commands: {
			logger: { debug: vi.fn<LogLine>(), info: vi.fn<LogLine>(), warn: vi.fn<LogLine>(), error: vi.fn<LogLine>() },
			zones: { getById: () => Promise.resolve(ok({ entity: { name: 'Kitchen', zoneType: 'Room', locked: false }, version: KITCHEN_VERSION })) },
		},
	};
	const wrapper = mount(RoomSummaryList, {
		props: { records: RECORDS, heading: 'Rooms' },
		global: { provide: { [EDITOR_RUNTIME as symbol]: runtime, [PLAN_EDITOR_CONTEXT as symbol]: context } },
	});
	return { wrapper, selectAndFrame, commitEdit };
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
		// The pressed row carries the same stable id the selection names, not merely the same
		// ARRAY POSITION — [[The cross-surface identity test starts after selection]]'s finding
		// that this case proved the pair by index correspondence alone, never by reading an id
		// off the row.
		const pressed = rows.filter((row) => row.attributes('aria-pressed') === 'true');
		expect(pressed.map((row) => row.attributes('data-rp-id'))).toEqual(['zone-terrace']);
	});

	it('a row click asks the runtime to select and frame its own record', async () => {
		const { wrapper, selectAndFrame } = mountList();
		const rows = wrapper.findAll('.rp-room-list__row');

		await rows[0].trigger('click');

		expect(selectAndFrame).toHaveBeenCalledWith('zone-kitchen', false);
		await rows[1].trigger('click', { shiftKey: true });
		expect(selectAndFrame).toHaveBeenLastCalledWith('zone-terrace', true);
	});

	it('puts a named lock toggle beside every row, pressed only for a locked record', () => {
		const { wrapper } = mountList();
		const toggles = wrapper.findAll('[data-rp-lock]');
		expect(toggles.map((toggle) => toggle.attributes('aria-pressed'))).toEqual(['false', 'true']);
		expect(toggles.map((toggle) => toggle.attributes('aria-label'))).toEqual(['Lock Kitchen', 'Unlock Terrace']);
	});

	it('dispatches the lock as one details edit against the version it just read', async () => {
		const { wrapper, commitEdit, selectAndFrame } = mountList();
		await wrapper.get('[data-rp-lock="zone-kitchen"]').trigger('click');
		await flushPromises();
		expect(commitEdit).toHaveBeenCalledWith({
			kind: 'details', zoneId: 'zone-kitchen', expected: KITCHEN_VERSION,
			forward: { name: 'Kitchen', zoneType: 'Room', locked: true },
			inverse: { name: 'Kitchen', zoneType: 'Room', locked: false },
		});
		expect(selectAndFrame).not.toHaveBeenCalled();
	});
});
