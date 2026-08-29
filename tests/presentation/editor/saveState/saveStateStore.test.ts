import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useSaveStateStore } from '../../../../src/presentation/editor/save-state/save-state-store';

describe('the save-state store', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
	});

	it('starts saved, because a fresh hydration has nothing unsaved by construction', () => {
		expect(useSaveStateStore().state).toBe('saved');
	});

	it('reports a dispatch in flight, then its outcome', () => {
		const store = useSaveStateStore();
		store.beginSaving();
		expect(store.state).toBe('saving');
		store.resolveOk();
		expect(store.state).toBe('saved');
	});

	it('reports a failed dispatch', () => {
		const store = useSaveStateStore();
		store.beginSaving();
		store.resolveErr();
		expect(store.state).toBe('save-error');
	});

	it('does not get stuck on a stale error', () => {
		const store = useSaveStateStore();
		store.beginSaving();
		store.resolveErr();
		store.beginSaving();
		expect(store.state).toBe('saving');
		store.resolveOk();
		expect(store.state).toBe('saved');
	});

	it('never says saved while a sibling dispatch is still in flight', () => {
		const store = useSaveStateStore();
		store.beginSaving();
		store.beginSaving();
		store.resolveOk();
		expect(store.state).toBe('saving');
		store.resolveOk();
		expect(store.state).toBe('saved');
	});

	it('lets one failure decide a whole batch, even where a sibling succeeded', () => {
		const store = useSaveStateStore();
		store.beginSaving();
		store.beginSaving();
		store.resolveErr();
		expect(store.state).toBe('saving');
		store.resolveOk();
		expect(store.state).toBe('save-error');
	});

	it('does not let a validation refusal clear a real save error', () => {
		const store = useSaveStateStore();
		store.beginSaving();
		store.resolveErr();
		expect(store.state).toBe('save-error');

		// A field edit refused for validation: nothing reached the repository, so the earlier
		// failed write is exactly as unsaved as it was.
		store.beginSaving();
		store.resolveNeutral();
		expect(store.state).toBe('save-error');
	});

	it('lets a write that actually succeeded clear a save error', () => {
		const store = useSaveStateStore();
		store.beginSaving();
		store.resolveErr();
		store.beginSaving();
		store.resolveOk();
		expect(store.state).toBe('saved');
	});

	it('leaves a resting saved state alone after a refusal that wrote nothing', () => {
		const store = useSaveStateStore();
		store.beginSaving();
		store.resolveNeutral();
		expect(store.state).toBe('saved');
	});

	it('reports a batch that mixed a real write with a refusal as saved', () => {
		const store = useSaveStateStore();
		store.beginSaving();
		store.beginSaving();
		store.resolveNeutral();
		store.resolveOk();
		expect(store.state).toBe('saved');
	});

	/**
	 * Named for what it PROVES, which is not what an earlier name claimed. It establishes no
	 * save error at all — the case below it does that — so it cannot be about clearing one. What
	 * it holds is that `beforeBatch` is captured when the batch OPENS and not on every
	 * `beginSaving`: the second `beginSaving` arrives with the store already reading
	 * `'saving'`, so an unconditional capture would settle this batch on `'saving'` and leave
	 * the indicator stuck there. That mutation survives 100% branch coverage and is killed here
	 * and nowhere else.
	 */
	it('settles an overlapping batch of refusals back to what it opened on, never to saving', () => {
		const store = useSaveStateStore();
		store.beginSaving();
		store.beginSaving();
		store.resolveNeutral();
		store.resolveNeutral();
		expect(store.state).toBe('saved');
	});

	it('preserves a save error across an overlapping batch that writes nothing', () => {
		const store = useSaveStateStore();
		store.beginSaving();
		store.resolveErr();
		expect(store.state).toBe('save-error');

		store.beginSaving();
		store.beginSaving();
		store.resolveNeutral();
		store.resolveNeutral();
		expect(store.state).toBe('save-error');
	});

	it('never reaches unsaved-changes through any sequence of its own actions', () => {
		type Store = ReturnType<typeof useSaveStateStore>;
		const actions: ((store: Store) => void)[] = [
			(store) => store.beginSaving(),
			(store) => store.resolveOk(),
			(store) => store.resolveErr(),
			(store) => store.resolveNeutral(),
		];

		/**
		 * Every sequence of up to four actions, each replayed from a FRESH store — a genuine
		 * proof over every sequence from the initial state, rather than one continuous stream
		 * that only ever visits whatever state the previous sequence happened to leave behind.
		 * A store that assigns `'unsaved-changes'` only when an action sees the store at rest
		 * (e.g. `resolveOk` doing so exactly when `state === 'saved'`) is caught at depth 1,
		 * because every sequence here genuinely starts from `'saved'`.
		 */
		const walk = (prefix: readonly ((store: Store) => void)[], depth: number): void => {
			setActivePinia(createPinia());
			const store = useSaveStateStore();
			for (const act of prefix) {
				act(store);
				expect(store.state).not.toBe('unsaved-changes');
			}
			if (depth === 0) return;
			for (const act of actions) {
				walk([...prefix, act], depth - 1);
			}
		};
		walk([], 4);
	});

	it('exposes exactly its own action surface, so a future action cannot slide in unnoticed', () => {
		const store = useSaveStateStore();
		expect(Object.keys(store)).toEqual(
			expect.arrayContaining(['state', 'beginSaving', 'resolveOk', 'resolveErr', 'resolveNeutral']),
		);
		// The exact key set Pinia hands back for this store today — its own five members plus
		// the setup-store machinery ($dispose, $patch, …) Pinia attaches to every store. An
		// exact match, not a negative check for a name (like the never-existed `markUnsaved`)
		// that no implementation would plausibly add: a genuinely new action changes this set
		// and must be added here deliberately rather than passing unnoticed.
		expect(Object.keys(store).toSorted()).toEqual([
			'$dispose',
			'$id',
			'$onAction',
			'$patch',
			'$reset',
			'$subscribe',
			'_customProperties',
			'_hmrPayload',
			'_hotUpdate',
			'_p',
			'beginSaving',
			'resolveErr',
			'resolveNeutral',
			'resolveOk',
			'state',
		]);
	});

	it('gives each Plan Editor its own state, since two can save independently', () => {
		const first = useSaveStateStore();
		setActivePinia(createPinia());
		const second = useSaveStateStore();
		first.beginSaving();
		expect(first.state).toBe('saving');
		expect(second.state).toBe('saved');
	});
});
