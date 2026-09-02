/**
 * @vitest-environment jsdom
 *
 * `DialogStore`'s three guarantees, each of which the framework above it assumes without
 * re-checking: one settle per open, no stacking, and `current` cleared before the awaiting
 * caller runs — the last being what makes two sequential dialogs (the delete flow's
 * Reassign branch) possible at all.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import {
	cancelResultFor,
	DialogStackingError,
	useDialogStore,
} from '../../../src/presentation/dialogs/dialog-store';

beforeEach(() => {
	setActivePinia(createPinia());
});

describe('openDialog', () => {
	it('resolves with exactly the value handed to resolve()', async () => {
		const store = useDialogStore();
		const pending = store.openDialog({ kind: 'confirm', title: 'T', message: 'M' });

		store.resolve('confirm');

		await expect(pending).resolves.toBe('confirm');
	});

	it('exposes the descriptor it was given while the dialog is open', () => {
		const store = useDialogStore();
		void store.openDialog({ kind: 'confirm', title: 'T', message: 'M' });

		expect(store.current).toEqual({ kind: 'confirm', title: 'T', message: 'M' });
	});

	it('refuses a second dialog while one is open', () => {
		const store = useDialogStore();
		void store.openDialog({ kind: 'confirm', title: 'T', message: 'M' });

		expect(() => store.openDialog({ kind: 'confirm', title: 'T2', message: 'M2' })).toThrow(
			DialogStackingError,
		);
	});

	it('clears current before the awaiting caller resumes, so the next open succeeds', async () => {
		const store = useDialogStore();
		const first = store.openDialog({ kind: 'delete-reference', entityLabel: 'Kitchen', references: [] });

		store.resolve({ action: 'reassign' });
		await first;

		expect(store.current).toBeNull();
		expect(() =>
			store.openDialog({ kind: 'entity-picker', title: 'T', candidates: [] }),
		).not.toThrow();
	});

	it('settles once — a second resolve is a no-op, not a second settle', async () => {
		const store = useDialogStore();
		const pending = store.openDialog({ kind: 'confirm', title: 'T', message: 'M' });

		store.resolve('confirm');
		store.resolve('cancel');

		await expect(pending).resolves.toBe('confirm');
		expect(store.current).toBeNull();
	});

	it('ignores a resolve with no dialog open', () => {
		const store = useDialogStore();

		expect(() => store.resolve('cancel')).not.toThrow();
		expect(store.current).toBeNull();
	});
});

describe('cancelResultFor', () => {
	/**
	 * The one place that knows what "cancelled" MEANS per kind. `Escape` and the cancel
	 * control both route through it, so the two cannot disagree — which they did in every
	 * hand-written dialog this framework exists to replace.
	 */
	it('answers each kind in its own result shape', () => {
		expect(cancelResultFor('confirm')).toBe('cancel');
		expect(cancelResultFor('delete-reference')).toEqual({ action: 'cancel' });
		expect(cancelResultFor('entity-picker')).toBe('cancel');
		expect(cancelResultFor('form')).toBe('cancel');
		// `null`, not the string `'cancel'`: `AssetDimensionsDialogResult` carries no such
		// member for a caller's `result === null` check to read as `undefined`.
		expect(cancelResultFor('asset-dimensions')).toBe(null);
	});
});
