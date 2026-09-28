// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { flushPromises, mount } from '@vue/test-utils';
import { nextTick, ref, type Ref } from 'vue';
import RoomSummaryList from '../../../../src/presentation/editor/shell/RoomSummaryList.vue';
import ZoneLockToggle from '../../../../src/presentation/editor/shell/ZoneLockToggle.vue';
import { EDITOR_RUNTIME, type EditorRuntime } from '../../../../src/presentation/editor/runtime';
import { PLAN_EDITOR_CONTEXT } from '../../../../src/presentation/editor/PlanEditorContext';
import { useSelectionStore } from '../../../../src/presentation/editor/selection/selection-store';
import type { SpatialRecordDto } from '../../../../src/presentation/read-models/spatialRecords';
import { ok } from '../../../../src/core/result/Result';
import * as notices from '../../../../src/presentation/notices/notify';

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

/**
 * `writesBlocked` and `getById` are overridable per case, for the two guard tests below: one
 * drives the toggle while paused, the other holds the zone read open to catch a second click
 * arriving before the first one's `busy` guard is set back down.
 */
function mountList(
	selectAndFrame = vi.fn<(id: string) => void>(),
	options: { attach?: boolean; writesBlocked?: boolean | Ref<boolean>; getById?: () => Promise<ReturnType<typeof ok<{ entity: { name: string; zoneType: string; locked: boolean }; version: typeof KITCHEN_VERSION }>>> } = {},
) {
	setActivePinia(createPinia());
	const commitEdit = vi.fn<(edit: unknown) => Promise<boolean>>(() => Promise.resolve(true));
	const writesBlocked = typeof options.writesBlocked === 'object' ? options.writesBlocked : ref(options.writesBlocked ?? false);
	const runtime = {
		selectAndFrame,
		commitEdit,
		writesBlocked,
		pausedReasonId: 'stub-paused-reason',
	} as unknown as EditorRuntime;
	const context = {
		commands: {
			logger: { debug: vi.fn<LogLine>(), info: vi.fn<LogLine>(), warn: vi.fn<LogLine>(), error: vi.fn<LogLine>() },
			zones: { getById: options.getById ?? (() => Promise.resolve(ok({ entity: { name: 'Kitchen', zoneType: 'Room', locked: false }, version: KITCHEN_VERSION }))) },
		},
	};
	const wrapper = mount(RoomSummaryList, {
		props: { records: RECORDS, heading: 'Rooms' },
		...(options.attach === true ? { attachTo: document.body } : {}),
		global: { provide: { [EDITOR_RUNTIME as symbol]: runtime, [PLAN_EDITOR_CONTEXT as symbol]: context } },
	});
	return { wrapper, selectAndFrame, commitEdit, writesBlocked };
}

describe('RoomSummaryList', () => {
	afterEach(() => { vi.restoreAllMocks(); });

	it('does not commit the lock edit when writes become blocked while the zone read is pending', async () => {
		const zoneRead = ok({ entity: { name: 'Kitchen', zoneType: 'Room', locked: false }, version: KITCHEN_VERSION });
		let resolveZone!: () => void;
		const getById = vi.fn<() => Promise<typeof zoneRead>>(() => new Promise((resolve) => {
			resolveZone = () => resolve(zoneRead);
		}));
		const { wrapper, commitEdit, writesBlocked } = mountList(vi.fn(), { getById });

		const toggle = wrapper.get('[data-rp-lock="zone-kitchen"]');
		void toggle.trigger('click');
		writesBlocked.value = true;
		resolveZone();
		await flushPromises();

		expect(commitEdit).not.toHaveBeenCalled();
	});

	it('does not notify a fault from a throwing zone read that resolves after the toggle unmounts', async () => {
		const report = vi.spyOn(notices, 'notifyFault').mockImplementation(() => undefined);
		let rejectZone!: (cause: unknown) => void;
		const getById = vi.fn<() => Promise<never>>(() => new Promise((_resolve, reject) => {
			rejectZone = reject;
		}));
		const { wrapper } = mountList(vi.fn(), { getById });

		const toggle = wrapper.get('[data-rp-lock="zone-kitchen"]');
		void toggle.trigger('click');
		wrapper.unmount();
		rejectZone(new Error('retired zone read'));
		await flushPromises();

		expect(report).not.toHaveBeenCalled();
	});

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

	it('a paused toggle dispatches nothing and carries aria-disabled paired with aria-describedby', async () => {
		const { wrapper, commitEdit } = mountList(vi.fn(), { writesBlocked: true });
		const toggle = wrapper.get('[data-rp-lock="zone-kitchen"]');
		expect(toggle.attributes('aria-disabled')).toBe('true');
		expect(toggle.attributes('aria-describedby')).toBe('stub-paused-reason');

		await toggle.trigger('click');
		await flushPromises();
		expect(commitEdit).not.toHaveBeenCalled();
	});

	it('drops a second click while the first zone read is still pending, and commits once', async () => {
		const zoneRead = ok({ entity: { name: 'Kitchen', zoneType: 'Room', locked: false }, version: KITCHEN_VERSION });
		let resolveZone!: () => void;
		const getById = vi.fn<() => Promise<typeof zoneRead>>(() => new Promise((resolve) => {
			resolveZone = () => resolve(zoneRead);
		}));
		const { wrapper, commitEdit } = mountList(vi.fn(), { getById });

		const toggle = wrapper.get('[data-rp-lock="zone-kitchen"]');
		void toggle.trigger('click');
		void toggle.trigger('click');
		resolveZone();
		await flushPromises();

		expect(getById).toHaveBeenCalledTimes(1);
		expect(commitEdit).toHaveBeenCalledTimes(1);
	});

	/**
	 * `ZoneLockToggle`'s `finally` guards `busy.value = false` with the same `alive` flag its
	 * `catch` guards `notifyFault` with (set false in `onBeforeUnmount`), and only the `catch`
	 * half had a test (the pair above). Vue raises no warning and schedules no work for a plain
	 * `ref` write after a component unmounts — confirmed by running this exact scenario with the
	 * `finally`'s guard made unconditional, which produced neither a thrown error nor an
	 * `app.config.warnHandler`/`console.warn`/`console.error` call either way — so a spy on any
	 * of those cannot tell the guarded and unguarded code apart. The one observable that remains
	 * is the ref's own value, read straight off `wrapper.vm` — the same reach-in
	 * `projectListGroups.test.ts`'s `completedOpen` and `editorArrival.test.ts`'s
	 * `navigateToRecord` already use to reach a script-setup binding no prop or emit carries,
	 * but only on a MOUNTED instance. That the reach-in stays readable after
	 * `wrapper.unmount()` is new here, and was confirmed empirically: these two tests were run
	 * with the `finally`'s guard made unconditional and watched fail.
	 */
	it('leaves busy set rather than clearing it when a pending read resolves after the toggle unmounts', async () => {
		const zoneRead = ok({ entity: { name: 'Kitchen', zoneType: 'Room', locked: false }, version: KITCHEN_VERSION });
		let resolveZone!: () => void;
		const getById = vi.fn<() => Promise<typeof zoneRead>>(() => new Promise((resolve) => {
			resolveZone = () => resolve(zoneRead);
		}));
		const { wrapper } = mountList(vi.fn(), { getById });
		const lockToggle = wrapper.findComponent(ZoneLockToggle);

		void wrapper.get('[data-rp-lock="zone-kitchen"]').trigger('click');
		wrapper.unmount();
		resolveZone();
		await flushPromises();

		expect((lockToggle.vm as unknown as { busy: boolean }).busy).toBe(true);
	});

	it('leaves busy set rather than clearing it when a pending read rejects after the toggle unmounts', async () => {
		let rejectZone!: (cause: unknown) => void;
		const getById = vi.fn<() => Promise<never>>(() => new Promise((_resolve, reject) => {
			rejectZone = reject;
		}));
		vi.spyOn(notices, 'notifyFault').mockImplementation(() => undefined);
		const { wrapper } = mountList(vi.fn(), { getById });
		const lockToggle = wrapper.findComponent(ZoneLockToggle);

		void wrapper.get('[data-rp-lock="zone-kitchen"]').trigger('click');
		wrapper.unmount();
		rejectZone(new Error('retired zone read'));
		await flushPromises();

		expect((lockToggle.vm as unknown as { busy: boolean }).busy).toBe(true);
	});

	it('clears busy so a completed, still-mounted toggle can dispatch a second time', async () => {
		const { wrapper, commitEdit } = mountList();
		const toggle = wrapper.get('[data-rp-lock="zone-kitchen"]');

		await toggle.trigger('click');
		await flushPromises();
		expect(toggle.attributes('aria-disabled')).toBeUndefined();

		await toggle.trigger('click');
		await flushPromises();

		expect(commitEdit).toHaveBeenCalledTimes(2);
	});
});

/**
 * L-46, the owner's "One Tab stop" (2026-09-25): Tab once into the list, the arrows between rooms,
 * and the lock reached by a key. Attached to `document.body` because focus is the subject, and
 * jsdom moves `document.activeElement` only for a connected element.
 */
const FOUR: readonly SpatialRecordDto[] = [
	...RECORDS,
	{ kind: 'room', id: 'zone-bath', planId: 'plan-ground', name: 'Bath', zoneType: 'Room', points: [], areaMm2: 0 },
	{ kind: 'room', id: 'zone-hall', planId: 'plan-ground', name: 'Hall', zoneType: 'Room', points: [], areaMm2: 0 },
];

function mountFour(options: Parameters<typeof mountList>[1] = {}) {
	const mounted = mountList(vi.fn(), { ...options, attach: true });
	return { ...mounted, ready: mounted.wrapper.setProps({ records: FOUR }) };
}
const rowOf = (id: string) => document.querySelector<HTMLElement>(`.rp-room-list__row[data-rp-id="${id}"]`);
const tabStops = () => [...document.querySelectorAll<HTMLElement>('.rp-room-list button')].filter((button) => button.tabIndex >= 0);
const press = (key: string) => {
	(document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
	return nextTick();
};

describe('RoomSummaryList keyboard (one Tab stop)', () => {
	afterEach(() => { document.body.innerHTML = ''; });

	it('puts exactly one control of the whole list in the Tab order: the first row', async () => {
		const { ready } = mountFour();
		await ready;
		expect(document.querySelectorAll('.rp-room-list button')).toHaveLength(8);
		expect(tabStops()).toEqual([rowOf('zone-kitchen')]);
		expect([...document.querySelectorAll('[data-rp-lock]')].map((lock) => lock.getAttribute('tabindex'))).toEqual(['-1', '-1', '-1', '-1']);
	});

	it('ArrowDown and ArrowUp move the focus and the one Tab stop, clamped at both ends', async () => {
		const { ready } = mountFour();
		await ready;
		rowOf('zone-kitchen')?.focus();
		await press('ArrowUp');
		expect(document.activeElement).toBe(rowOf('zone-kitchen'));
		await press('ArrowDown');
		await press('ArrowDown');
		expect(document.activeElement).toBe(rowOf('zone-bath'));
		expect(tabStops()).toEqual([rowOf('zone-bath')]);
		await press('ArrowDown');
		await press('ArrowDown');
		expect(document.activeElement).toBe(rowOf('zone-hall'));
		await press('ArrowUp');
		expect(document.activeElement).toBe(rowOf('zone-bath'));
		expect(tabStops()).toEqual([rowOf('zone-bath')]);
	});

	it('leaves a modified arrow to the host and consumes a plain one', async () => {
		const { ready } = mountFour();
		await ready;
		rowOf('zone-kitchen')?.focus();
		for (const key of ['ArrowDown', 'ArrowRight']) {
			for (const modifier of ['altKey', 'ctrlKey', 'metaKey', 'shiftKey']) {
				const modified = new KeyboardEvent('keydown', { key, [modifier]: true, bubbles: true, cancelable: true });
				rowOf('zone-kitchen')?.dispatchEvent(modified);
				expect(modified.defaultPrevented, `${modifier}+${key}`).toBe(false);
				expect(document.activeElement).toBe(rowOf('zone-kitchen'));
			}
		}
		const plain = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
		rowOf('zone-kitchen')?.dispatchEvent(plain);
		expect(plain.defaultPrevented).toBe(true);
	});

	it('ArrowRight reaches the row\'s own lock and ArrowLeft returns to the row; the arrows still move between rooms from the lock', async () => {
		const { ready } = mountFour();
		await ready;
		rowOf('zone-terrace')?.focus();
		await press('ArrowRight');
		expect(document.activeElement).toBe(document.querySelector('[data-rp-lock="zone-terrace"]'));
		expect(tabStops()).toEqual([rowOf('zone-terrace')]);
		await press('ArrowLeft');
		expect(document.activeElement).toBe(rowOf('zone-terrace'));
		await press('ArrowRight');
		await press('ArrowDown');
		expect(document.activeElement).toBe(rowOf('zone-bath'));
	});

	it('the lock ArrowRight reaches is the same toggle: it dispatches the same edit, and nothing while writes are paused', async () => {
		const { ready, commitEdit } = mountFour();
		await ready;
		rowOf('zone-kitchen')?.focus();
		await press('ArrowRight');
		(document.activeElement as HTMLElement).click();
		await flushPromises();
		expect(commitEdit).toHaveBeenCalledWith(expect.objectContaining({ kind: 'details', zoneId: 'zone-kitchen' }));

		document.body.innerHTML = '';
		const paused = mountFour({ writesBlocked: true });
		await paused.ready;
		rowOf('zone-kitchen')?.focus();
		await press('ArrowRight');
		expect(document.activeElement?.getAttribute('aria-disabled')).toBe('true');
		(document.activeElement as HTMLElement).click();
		await flushPromises();
		expect(paused.commitEdit).not.toHaveBeenCalled();
	});

	/**
	 * jsdom does not synthesize a native button's Enter/Space-to-click activation (that is a
	 * user-agent default action, not something the DOM event pipeline performs), so a test that
	 * dispatched a `keydown` for either key and asserted `selectAndFrame` was called would pass
	 * for the wrong reason: nothing in this component would fire it either way. What IS checkable
	 * is the half this component controls — that it stays a plain native button and does not
	 * intercept and `preventDefault` either key, which is what would block the platform's own
	 * activation from applying (L-46 review finding 4; the row-click path itself is covered above).
	 */
	it('rows stay native buttons, so the platform\'s Enter/Space activation applies', async () => {
		const { ready } = mountFour();
		await ready;
		const row = rowOf('zone-bath');
		expect(row?.tagName).toBe('BUTTON');
		expect(row?.getAttribute('type')).toBe('button');

		row?.focus();
		for (const key of ['Enter', ' ']) {
			const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
			row?.dispatchEvent(event);
			expect(event.defaultPrevented).toBe(false);
		}
	});

	it('keeps the focus and the Tab stop on the same room when rooms are added, removed and renamed around it', async () => {
		const { wrapper, ready } = mountFour();
		await ready;
		rowOf('zone-kitchen')?.focus();
		await press('ArrowDown');
		await press('ArrowDown');
		const bath = rowOf('zone-bath');
		expect(document.activeElement).toBe(bath);

		const [kitchen, terrace, bathRecord, hall] = FOUR;
		const added = { ...kitchen, id: 'zone-attic', name: 'Attic' };
		await wrapper.setProps({ records: [added, kitchen, { ...terrace, name: 'Patio' }, bathRecord, hall] });
		expect(document.activeElement).toBe(bath);
		expect(tabStops()).toEqual([bath]);

		await wrapper.setProps({ records: [bathRecord, hall] });
		expect(document.activeElement).toBe(bath);
		expect(tabStops()).toEqual([bath]);
	});

	it('moves the Tab stop to a surviving row when the room holding it is removed', async () => {
		const { wrapper, ready } = mountFour();
		await ready;
		rowOf('zone-kitchen')?.focus();
		await press('ArrowDown');
		await press('ArrowDown');
		await press('ArrowDown');
		await wrapper.setProps({ records: FOUR.slice(0, 3) });
		expect(tabStops()).toEqual([rowOf('zone-bath')]);
	});

	/**
	 * `reconcile` moves the Tab STOP (a `tabindex` write) to a survivor, but nothing else moves
	 * actual FOCUS — a plain `ref` write reaches no element — so it fell to `BODY` on removal
	 * (L-46 review finding 2).
	 */
	it('moves FOCUS itself to the surviving stop when the focused room is removed', async () => {
		const { wrapper, ready } = mountFour();
		await ready;
		rowOf('zone-kitchen')?.focus();
		await press('ArrowDown');
		expect(document.activeElement).toBe(rowOf('zone-terrace'));

		await wrapper.setProps({ records: FOUR.filter((record) => record.id !== 'zone-terrace') });
		expect(document.activeElement).toBe(rowOf('zone-bath'));
	});

	it('does not move focus on a removal when focus was outside the list to begin with', async () => {
		const { wrapper, ready } = mountFour();
		await ready;
		expect(document.activeElement).toBe(document.body);

		await wrapper.setProps({ records: FOUR.filter((record) => record.id !== 'zone-terrace') });
		expect(document.activeElement).toBe(document.body);
	});

	/**
	 * Regression (L-46 re-review, Important): `useSpatialRecords`/`buildFloorSummary` rebuild the
	 * `records` array on every reactive read, so a rename, a lock toggle or an undo of either hands
	 * this component a NEW array holding the SAME ids. The two watchers above are keyed on
	 * `records.map(r => r.id)`, a fresh array every evaluation, so they fire on every such
	 * content-only update too — not only a removal — and the post-flush watcher's unconditional
	 * `.focus()` on the row then yanked focus off a LOCK back onto its row on every content change,
	 * even though nothing left the list. Refocusing must be conditioned on the previously focused
	 * room's id actually being gone from the new ids, the same test `reconcile`'s own
	 * `surviving === -1` branch already makes.
	 */
	it('does not steal focus from a lock when an update leaves the same ids in place', async () => {
		const { wrapper, ready } = mountFour();
		await ready;
		rowOf('zone-kitchen')?.focus();
		await press('ArrowRight');
		const lock = document.querySelector('[data-rp-lock="zone-kitchen"]');
		expect(document.activeElement).toBe(lock);

		const [kitchen, terrace, bath, hall] = FOUR;
		await wrapper.setProps({ records: [{ ...kitchen, locked: true }, terrace, bath, hall] });
		expect(document.activeElement).toBe(lock);
	});

	it('does not move focus off a row when a same-ids update renames it', async () => {
		const { wrapper, ready } = mountFour();
		await ready;
		rowOf('zone-terrace')?.focus();

		const [kitchen, terrace, bath, hall] = FOUR;
		await wrapper.setProps({ records: [kitchen, { ...terrace, name: 'Patio' }, bath, hall] });
		expect(document.activeElement).toBe(rowOf('zone-terrace'));
	});

	it('a lock focused directly, not reached via ArrowRight, syncs the roving index to its own row', async () => {
		const { ready } = mountFour();
		await ready;
		rowOf('zone-kitchen')?.focus();
		await press('ArrowDown');
		await press('ArrowDown');
		await press('ArrowDown');
		expect(document.activeElement).toBe(rowOf('zone-hall'));

		// A pointer click on a DIFFERENT row's lock, bypassing ArrowRight entirely — the roving
		// index must follow it rather than staying on the row ArrowDown last visited.
		document.querySelector<HTMLElement>('[data-rp-lock="zone-kitchen"]')?.focus();
		await nextTick();
		await press('ArrowDown');
		expect(document.activeElement).toBe(rowOf('zone-terrace'));
		expect(tabStops()).toEqual([rowOf('zone-terrace')]);
	});

	it('consumes a plain ArrowRight and ArrowLeft on a row', async () => {
		const { ready } = mountFour();
		await ready;
		rowOf('zone-terrace')?.focus();

		const right = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
		rowOf('zone-terrace')?.dispatchEvent(right);
		expect(right.defaultPrevented).toBe(true);
		expect(document.activeElement).toBe(document.querySelector('[data-rp-lock="zone-terrace"]'));

		const left = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true });
		document.activeElement?.dispatchEvent(left);
		expect(left.defaultPrevented).toBe(true);
		expect(document.activeElement).toBe(rowOf('zone-terrace'));
	});
});
