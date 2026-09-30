/**
 * @vitest-environment jsdom
 *
 * AD18 UI critique, Task 4: a form dialog draws ONE action row — Cancel, then the submit, the submit
 * carrying Obsidian's `mod-cta` — where it used to draw the form's submit row and then `FormDialog`'s
 * own Cancel row under it. The submit stays inside the form, which is what keeps Enter in a field a
 * submit; a form with no `FormSubmitRow` keeps the dialog's own Cancel row, and since the open-issues
 * round's Task 3 every shipped dialog form draws one (`dialogFormSubmitRow.test.ts`).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick, ref } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import { mountDialogHost, type DialogHarness } from '../../helpers/dialogs';
import NewProjectForm from '../../../src/presentation/views/NewProjectForm.vue';
import KnownDistanceForm from '../../../src/presentation/editor/shell/KnownDistanceForm.vue';
import FormSubmitRow from '../../../src/presentation/dialogs/FormSubmitRow.vue';
import AssetPresetForm from '../../../src/presentation/designer/presets/AssetPresetForm.vue';
import type { Logger } from '../../../src/application/ports/Logger';

const logger: Logger = { debug: () => undefined, info: () => undefined, warn: () => undefined, error: () => undefined };

let harness: DialogHarness | null = null;
afterEach(() => {
	harness?.unmount();
	harness = null;
});

/** A dispatch that never settles, so the form stays mid-write for as long as a case looks. */
const neverSettles = () =>
	new Promise<never>(() => {
		// Deliberately never resolves or rejects.
	});

async function openNewProject(dispatch: (...args: never[]) => Promise<unknown>, busy = ref(false)) {
	harness = mountDialogHost();
	const pending = harness.store.openDialog({ kind: 'form', title: 'New project', component: NewProjectForm, props: { dispatch, logger, busy }, busy });
	await nextTick();
	return { dialog: harness.wrapper.get('.rp-dialog'), pending, busy };
}

describe('a form dialog’s one action row', () => {
	it('draws Cancel then the submit in one row, the submit as the primary action inside the form', async () => {
		const { dialog } = await openNewProject(neverSettles);

		const rows = dialog.findAll('.rp-dialog-actions');
		expect(rows).toHaveLength(1);
		const buttons = rows[0].findAll('button');
		expect(buttons.map((button) => button.attributes('data-rp-action') ?? button.attributes('type'))).toEqual(['cancel', 'submit']);
		const [cancel, submit] = buttons;
		expect(cancel.classes()).not.toContain('mod-cta');
		expect(submit.classes()).toContain('mod-cta');
		// The submit's form OWNER is the form holding the fields: that is what makes Enter in a field
		// an implicit submission through it, which jsdom does not perform itself.
		const name = dialog.get('[data-field="name"]').element as HTMLInputElement;
		expect((submit.element as HTMLButtonElement).form).toBe(name.form);
	});

	it('submits the form from that row', async () => {
		const dispatch = vi.fn<typeof neverSettles>(neverSettles);
		const { dialog } = await openNewProject(dispatch);
		await dialog.get('[data-field="name"]').setValue('Flat');

		await dialog.get('button[type="submit"]').trigger('click');
		await flushPromises();

		expect(dispatch).toHaveBeenCalledTimes(1);
	});

	it('cancels from that row while idle, and refuses Escape and keeps focus in the dialog while busy', async () => {
		const { dialog, pending, busy } = await openNewProject(neverSettles);
		busy.value = true;
		await nextTick();
		const cancel = dialog.get('[data-rp-action="cancel"]');
		expect(cancel.attributes('aria-disabled')).toBe('true');
		(cancel.element as HTMLElement).focus();

		cancel.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
		await cancel.trigger('click');
		await flushPromises();
		expect(harness?.store.current).not.toBeNull();
		expect(document.activeElement).toBe(cancel.element);

		busy.value = false;
		await nextTick();
		await cancel.trigger('click');
		await expect(pending).resolves.toBe('cancel');
	});

	it('keeps the dialog’s own Cancel row under a form that draws no FormSubmitRow', async () => {
		// No shipped form is one any more (`dialogFormSubmitRow.test.ts` holds that); this is the
		// fallback for a component that is not, so the dialog is never left with no way out.
		const bare = defineComponent({ emits: ['submit'], render: () => h('form', [h('button', { type: 'submit' }, 'Save')]) });
		harness = mountDialogHost();
		void harness.store.openDialog({ kind: 'form', title: 'Bare', component: bare });
		await nextTick();

		const dialog = harness.wrapper.get('.rp-dialog');
		expect(dialog.findAll('[data-rp-action="cancel"]')).toHaveLength(1);
		expect(dialog.get('.rp-dialog-body ~ .rp-dialog-actions').find('[data-rp-action="cancel"]').exists()).toBe(true);
	});

	it('draws an editor form that used to carry its own submit as the same one row', async () => {
		harness = mountDialogHost();
		void harness.store.openDialog({ kind: 'form', title: 'Known distance', component: KnownDistanceForm, props: { measured: 120 } });
		await nextTick();

		const rows = harness.wrapper.findAll('.rp-dialog .rp-dialog-actions');
		expect(rows).toHaveLength(1);
		expect(rows[0].classes()).toContain('rp-dialog-footer');
		expect(rows[0].findAll('button').map((button) => button.attributes('data-rp-action') ?? button.attributes('type'))).toEqual(['cancel', 'submit']);
	});

	it('puts a form’s own attributes on the submit, and its slot between Cancel and the submit', async () => {
		const withBack = defineComponent({
			emits: ['submit'],
			render: () =>
				h('form', { class: 'rp-dialog-form' }, [
					h(FormSubmitRow, { submitting: false, 'data-probe': '' }, { default: () => h('button', { type: 'button', 'data-rp-action': 'back' }, 'Back') }),
				]),
		});
		harness = mountDialogHost();
		void harness.store.openDialog({ kind: 'form', title: 'Steps', component: withBack });
		await nextTick();

		const row = harness.wrapper.get('.rp-dialog .rp-dialog-actions');
		expect(row.findAll('button').map((button) => button.attributes('data-rp-action') ?? button.attributes('type'))).toEqual(['cancel', 'back', 'submit']);
		expect(row.get('[data-probe]').attributes('type')).toBe('submit');
		expect(row.attributes('data-probe')).toBeUndefined();
	});

	it('draws the submit alone when no dialog is around the form', () => {
		const wrapper = mount(NewProjectForm, { props: { dispatch: neverSettles, logger } });

		expect(wrapper.findAll('.rp-dialog-actions button').map((button) => button.attributes('type'))).toEqual(['submit']);
	});
});

describe('the preset dialog', () => {
	afterEach(() => {
		delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
	});

	it('puts Apply in the one row, after Cancel', async () => {
		harness = mountDialogHost();
		void harness.store.openDialog({ kind: 'form', title: 'Start from preset', component: AssetPresetForm, props: { replaces: false } });
		await nextTick();

		const rows = harness.wrapper.findAll('.rp-dialog .rp-dialog-actions');
		expect(rows).toHaveLength(1);
		expect(rows[0].findAll('button').map((button) => button.text())).toEqual(['Cancel', 'Apply preset']);
	});

	it('scrolls the chosen preset’s fields and preview into view when a card is chosen', async () => {
		const scrolled = vi.fn<(this: HTMLElement, options?: ScrollIntoViewOptions) => void>(function (this: HTMLElement) {
			return undefined;
		});
		HTMLElement.prototype.scrollIntoView = scrolled;
		const wrapper = mount(AssetPresetForm, { props: { replaces: false } });

		await wrapper.get('.rp-preset-choice[data-preset="sofa"]').trigger('click');
		await nextTick();

		expect(scrolled).toHaveBeenCalledTimes(1);
		const [target] = scrolled.mock.contexts;
		expect(target).toBe(wrapper.get('.rp-asset-preset-chosen').element);
		expect(target.querySelector('input[name="width"]')).not.toBeNull();
		expect(target.querySelector('svg.rp-asset-preset-preview')).not.toBeNull();
		expect(scrolled.mock.calls[0]).toEqual([{ block: 'start' }]);
	});
});

/**
 * The primary action outside `FormSubmitRow`: Set dimensions' submit and a non-destructive confirm
 * wear `mod-cta` too, and so take the AA fill `styles/dialogs.css` gives `.rp-dialog
 * .rp-dialog-button.mod-cta` — asked of THAT selector inside the real host, so a button drawn
 * outside `.rp-dialog` or without `.rp-dialog-button` would not count. A destructive confirm keeps
 * its danger paint and is not primary.
 */
const primary = (): Element | null => document.querySelector('.rp-dialog .rp-dialog-button.mod-cta');

describe('the other dialogs’ primary action', () => {
	it('is Set dimensions’ submit', async () => {
		harness = mountDialogHost();
		void harness.store.openDialog({ kind: 'asset-dimensions', title: 'Set dimensions' });
		await nextTick();

		expect(primary()).toBe(harness.wrapper.get('.rp-dialog button[type="submit"]').element);
	});

	it('is a plain confirm’s confirm, and a destructive confirm has none', async () => {
		harness = mountDialogHost();
		void harness.store.openDialog({ kind: 'confirm', title: 'T', message: 'M' });
		await nextTick();
		expect(primary()).toBe(harness.wrapper.get('[data-rp-action="confirm"]').element);
		harness.unmount();

		harness = mountDialogHost();
		void harness.store.openDialog({ kind: 'confirm', title: 'T', message: 'M', danger: true });
		await nextTick();
		expect(harness.wrapper.find('.rp-dialog-button-danger').exists()).toBe(true);
		expect(primary()).toBeNull();
	});
});
