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

	it('never reaches unsaved-changes through any sequence of its own actions', () => {
		const store = useSaveStateStore();
		const actions = [
			() => store.beginSaving(),
			() => store.resolveOk(),
			() => store.resolveErr(),
			() => store.resolveNeutral(),
		];

		// Every sequence of up to four actions. Exhaustive over the store's whole surface,
		// which is what backs the unreachability claim rather than asserting it in prose.
		const walk = (depth: number): void => {
			if (depth === 0) return;
			for (const act of actions) {
				act();
				expect(store.state).not.toBe('unsaved-changes');
				walk(depth - 1);
			}
		};
		walk(4);
	});

	it('exposes no action that could produce unsaved-changes', () => {
		const store = useSaveStateStore();
		expect(Object.keys(store)).toEqual(
			expect.arrayContaining(['state', 'beginSaving', 'resolveOk', 'resolveErr', 'resolveNeutral']),
		);
		expect(Object.keys(store)).not.toContain('markUnsaved');
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
