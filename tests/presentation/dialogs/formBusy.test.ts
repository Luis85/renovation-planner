/**
 * @vitest-environment jsdom
 *
 * The cancel-during-write hole (design slice 16): while a form's own dispatch is in
 * flight, neither Cancel nor Escape may resolve the dialog out from under it — the
 * framework never started that write, so it has no way to stop it either. `busy` is the
 * one flag both ends read, passed straight through from `useFormCommit().submitting`.
 */
import { describe, expect, it } from 'vitest';
import { ref, nextTick } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { mountDialogHost, type DialogHarness } from '../../helpers/dialogs';
import NewProjectForm from '../../../src/presentation/views/NewProjectForm.vue';
import type { Result } from '../../../src/core/result/Result';

let harness: DialogHarness | null = null;

function pressKey(element: Element, key: string): void {
	element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

/** A dispatch that never settles — every case here is about the write still being open. */
function neverSettles(): Promise<Result<{ project: { entity: { id: string } } }, never>> {
	return new Promise(() => {
		// Deliberately never resolves or rejects.
	});
}

describe('a form dialog with a write in flight', () => {
	it('refuses Escape and disables Cancel while the form has a write in flight', async () => {
		harness = mountDialogHost();
		const busy = ref(true);
		const pending = harness.store.openDialog({
			kind: 'form',
			title: 'New project',
			component: NewProjectForm,
			props: { dispatch: neverSettles },
			busy,
		});
		let settled = false;
		void pending.then(() => {
			settled = true;
			return undefined;
		});
		await nextTick();

		pressKey(harness.wrapper.find('.rp-dialog').element, 'Escape');
		// `flushPromises()`, not `nextTick()`: `settled` flips inside a plain `.then()` on the
		// RAW `openDialog` promise, outside Vue's own reactivity scheduler, and `nextTick()`
		// only guarantees Vue's own render flush has run — measured, not assumed: with the
		// `DialogHost` guard this case exists to prove removed, `nextTick()` alone left
		// `settled` reading `false` regardless of whether the dialog had actually resolved,
		// which would have made this assertion pass on the very regression it exists to catch.
		await flushPromises();

		// The write is still running: the dialog may not resolve out from under it.
		expect(settled).toBe(false);
		// aria-disabled, never disabled: a `:disabled` Cancel leaves the trap with nothing
		// to hold, Tab walks out of the dialog, and the Escape handler above stops being
		// reachable at all.
		expect(harness.wrapper.get('.rp-dialog-cancel').attributes('aria-disabled')).toBe('true');
		expect(harness.wrapper.get('.rp-dialog-cancel').attributes('disabled')).toBeUndefined();

		harness.unmount();
		harness = null;
	});

	it('accepts Escape again once the write has settled', async () => {
		harness = mountDialogHost();
		const busy = ref(true);
		const pending = harness.store.openDialog({
			kind: 'form',
			title: 'New project',
			component: NewProjectForm,
			props: { dispatch: neverSettles },
			busy,
		});
		await nextTick();
		busy.value = false;

		pressKey(harness.wrapper.find('.rp-dialog').element, 'Escape');

		// Decision 3 is NARROWED, not reversed: Escape still cancels at every other moment.
		await expect(pending).resolves.toBe('cancel');

		harness.unmount();
		harness = null;
	});

	/**
	 * `dialogKinds.test.ts` proves every kind renders at least one focusable control, but
	 * never in the busy state — which is exactly where this slice could break the invariant:
	 * every `NewProjectForm` control (including its OWN submit button) is `:disabled` while
	 * submitting, so `.rp-dialog-cancel` staying merely `aria-disabled` is what keeps the
	 * trap from going empty. `focusableWithin()` itself is module-private; this drives the
	 * same selector `DialogHost.vue` declares, over the real mounted tree.
	 */
	it('leaves the focus trap non-empty while the form is busy', async () => {
		harness = mountDialogHost();
		const busy = ref(false);
		void harness.store.openDialog({
			kind: 'form',
			title: 'New project',
			component: NewProjectForm,
			props: { dispatch: neverSettles },
			busy,
		});
		await nextTick();

		await harness.wrapper.get('input[data-field="name"]').setValue('Kitchen');
		await harness.wrapper.get('form').trigger('submit');
		await nextTick();

		const dialog = harness.wrapper.find('.rp-dialog').element;
		const focusable = [
			...dialog.querySelectorAll(
				'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
			),
		];

		expect(focusable).toEqual([harness.wrapper.get('.rp-dialog-cancel').element]);

		harness.unmount();
		harness = null;
	});

	/**
	 * The connection, not the intent. This plan's own history records a first draft that
	 * declared a `busy` ref nowhere real, and a later one that passed it only to the
	 * descriptor and never to the form's own `props` — both look wired and neither is: the
	 * form's `watchEffect` never runs without the prop, so the ref stays `false` for the
	 * whole write and Cancel/Escape stay live throughout it. Sharing ONE ref between
	 * `props.busy` and the descriptor's `busy` — as `ViewRoot` (Task 7) will — is what a test
	 * that merely asserts "`busy` was passed" cannot tell apart from that broken draft.
	 */
	it('is driven by the REAL form: Escape stays refused only because the shared ref actually moved', async () => {
		harness = mountDialogHost();
		const busy = ref(false);
		const pending = harness.store.openDialog({
			kind: 'form',
			title: 'New project',
			component: NewProjectForm,
			props: { dispatch: neverSettles, busy },
			busy,
		});
		let settled = false;
		void pending.then(() => {
			settled = true;
			return undefined;
		});
		await nextTick();
		// Nothing has been submitted yet: the shared ref is still false, and Escape would
		// cancel normally, exactly like any other form dialog.
		expect(busy.value).toBe(false);

		await harness.wrapper.get('input[data-field="name"]').setValue('Kitchen');
		await harness.wrapper.get('form').trigger('submit');
		await nextTick();

		// The form's OWN `submitting` flowed out through the shared ref — nobody in this test
		// set `busy` directly.
		expect(busy.value).toBe(true);

		pressKey(harness.wrapper.find('.rp-dialog').element, 'Escape');
		// See the first case's comment: a plain `.then()` on the raw promise needs a real
		// microtask-queue drain, not merely Vue's own render flush.
		await flushPromises();

		expect(settled).toBe(false);

		harness.unmount();
		harness = null;
	});
});
