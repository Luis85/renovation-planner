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
import type { Logger } from '../../../src/application/ports/Logger';

let harness: DialogHarness | null = null;

function pressKey(element: Element, key: string): void {
	element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

/** A dispatch that never settles — every case here is about the write still being open. */
/**
 * `NewProjectForm` requires a logger for the one failure `useFormCommit` owns both halves of
 * (a dispatch that THROWS). No case here reaches that path, so this is a stand-in with
 * nothing asserted on it — `useFormCommit.test.ts` is where that door is driven.
 */
const logger: Logger = { debug: () => undefined, info: () => undefined, warn: () => undefined, error: () => undefined };

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
			props: { dispatch: neverSettles, logger },
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
		expect(harness.wrapper.get('[data-rp-action="cancel"]').attributes('aria-disabled')).toBe('true');
		expect(harness.wrapper.get('[data-rp-action="cancel"]').attributes('disabled')).toBeUndefined();

		harness.unmount();
		harness = null;
	});

	/**
	 * The gesture more users reach for than `Escape`. `aria-disabled` is advisory only — it
	 * blocks nothing in the DOM, so `FormDialog.onCancel`'s early return
	 * (`if (props.descriptor.busy?.value === true) return;`) is the ONLY thing standing
	 * between a mid-write click and an abandoned write. Every other case in this file drives
	 * `Escape`; none of them calls `trigger('click')` on the button at all, so this is the
	 * one place that line is exercised.
	 */
	it('refuses a Cancel click while the form has a write in flight', async () => {
		harness = mountDialogHost();
		const busy = ref(true);
		const pending = harness.store.openDialog({
			kind: 'form',
			title: 'New project',
			component: NewProjectForm,
			props: { dispatch: neverSettles, logger },
			busy,
		});
		let settled = false;
		void pending.then(() => {
			settled = true;
			return undefined;
		});
		await nextTick();

		await harness.wrapper.get('[data-rp-action="cancel"]').trigger('click');
		// See the Escape case's comment: `settled` flips inside a plain `.then()` outside
		// Vue's own scheduler, so a real microtask-queue drain is what this needs.
		await flushPromises();

		expect(settled).toBe(false);

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
			props: { dispatch: neverSettles, logger },
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
	 * NOTHING THE USER COULD BE STANDING ON BECOMES `:disabled` WHILE THE WRITE IS IN FLIGHT,
	 * and that is a focus rule rather than a styling one.
	 *
	 * Chromium moves focus to `<body>` when the element holding it is disabled — and `<body>`
	 * is not inside `.rp-dialog`, which is where `DialogHost` binds its `keydown` listener. So
	 * disabling the focused control (the submit button on a click, or the text field the user
	 * pressed Enter in) took `Escape` and the whole Tab trap out for the duration of the write:
	 * the very window `busy` was added to make `Escape` refuse deliberately, refusing it by
	 * accident instead, and handing the key to Obsidian's own keymap. After a banner-routed
	 * rejection, focus then stayed on `<body>`, which is also what `focusFirstInvalidControl`
	 * and `FormDialog`'s own docblock each promise it does not.
	 *
	 * **jsdom cannot see the browser's half of that** — it implements no focus-loss-on-disable
	 * at all, so `document.activeElement` here is unmoved either way. What it CAN see is the
	 * condition the browser behaviour hangs off, which is the one asserted: every control in
	 * the dialog still matches `DialogHost`'s own focusable selector while busy. The inoperative
	 * half is `newProjectForm.test.ts`'s subject; this file's is the trap.
	 */
	it('keeps every control focusable while the form is busy', async () => {
		harness = mountDialogHost();
		const busy = ref(false);
		void harness.store.openDialog({
			kind: 'form',
			title: 'New project',
			component: NewProjectForm,
			props: { dispatch: neverSettles, logger },
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

		// The submit button first, because it is the one the user is standing on in the common
		// case, and Cancel last, because `DialogHost`'s Tab trap wraps between the two ends.
		expect(focusable).toContain(harness.wrapper.get('button[type="submit"]').element);
		expect(focusable).toContain(harness.wrapper.get('[data-rp-action="cancel"]').element);
		for (const field of ['name', 'status', 'description', 'start', 'targetCompletion']) {
			expect(focusable).toContain(harness.wrapper.get(`[data-field="${field}"]`).element);
		}

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
			props: { dispatch: neverSettles, busy, logger },
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
