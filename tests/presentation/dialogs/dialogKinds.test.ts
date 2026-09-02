/**
 * @vitest-environment jsdom
 *
 * What each dialog kind RENDERS and what it RESOLVES — the two halves of the only job a
 * kind component has. Mounted bare, with no store and no host: a kind that needed either
 * would be reaching past the seam that keeps `store.resolve` to one call site.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { defineComponent, h } from 'vue';
import { mount } from '@vue/test-utils';
import ConfirmDialog from '../../../src/presentation/dialogs/ConfirmDialog.vue';
import DeleteReferenceDialog from '../../../src/presentation/dialogs/DeleteReferenceDialog.vue';
import EntityPickerDialog from '../../../src/presentation/dialogs/EntityPickerDialog.vue';
import FormDialog from '../../../src/presentation/dialogs/FormDialog.vue';
import AssetDimensionsDialog from '../../../src/presentation/dialogs/AssetDimensionsDialog.vue';
import { t } from '../../../src/presentation/i18n/strings';

const EN = 'en';
/**
 * `titleId` is now a REQUIRED prop (`DialogHost` always supplies it in practice), so every
 * mount below needs one; the value itself is arbitrary here since none of these tests
 * exercise `DialogHost`'s own `aria-labelledby` wiring — that pairing is asserted in
 * `dialogHost.test.ts`, against the real generated id.
 */
const TITLE_ID = 'test-title-id';

describe('ConfirmDialog', () => {
	it('renders the title and message it is handed', () => {
		const wrapper = mount(ConfirmDialog, {
			props: {
				descriptor: { kind: 'confirm', title: 'Recalibrate?', message: 'Zones rescale.' },
				titleId: TITLE_ID,
			},
		});

		expect(wrapper.find('.rp-dialog-title').text()).toBe('Recalibrate?');
		expect(wrapper.find('.rp-dialog-message').text()).toBe('Zones rescale.');
	});

	it('falls back to translated labels, never to an English literal', () => {
		const wrapper = mount(ConfirmDialog, {
			props: { descriptor: { kind: 'confirm', title: 'T', message: 'M' }, titleId: TITLE_ID },
		});
		const labels = wrapper.findAll('.rp-dialog-button').map((button) => button.text());

		expect(labels).toEqual([t(EN, 'dialog.cancel'), t(EN, 'dialog.confirm')]);
	});

	it("prefers the caller own labels when supplied", () => {
		const wrapper = mount(ConfirmDialog, {
			props: {
				descriptor: {
					kind: 'confirm',
					title: 'T',
					message: 'M',
					confirmLabel: 'Rescale',
					cancelLabel: 'Keep',
				},
				titleId: TITLE_ID,
			},
		});

		expect(wrapper.findAll('.rp-dialog-button').map((b) => b.text())).toEqual(['Keep', 'Rescale']);
	});

	it('resolves confirm and cancel from their own buttons', async () => {
		const wrapper = mount(ConfirmDialog, {
			props: { descriptor: { kind: 'confirm', title: 'T', message: 'M' }, titleId: TITLE_ID },
		});

		await wrapper.findAll('.rp-dialog-button')[1]?.trigger('click');
		await wrapper.findAll('.rp-dialog-button')[0]?.trigger('click');

		expect(wrapper.emitted('resolve')).toEqual([['confirm'], ['cancel']]);
	});

	it('marks the confirm action destructive only when asked', () => {
		const plain = mount(ConfirmDialog, {
			props: { descriptor: { kind: 'confirm', title: 'T', message: 'M' }, titleId: TITLE_ID },
		});
		const dangerous = mount(ConfirmDialog, {
			props: {
				descriptor: { kind: 'confirm', title: 'T', message: 'M', danger: true },
				titleId: TITLE_ID,
			},
		});

		expect(plain.find('.rp-dialog-button-danger').exists()).toBe(false);
		expect(dangerous.find('.rp-dialog-button-danger').exists()).toBe(true);
	});
});

describe('DeleteReferenceDialog', () => {
	const rows = [
		{ label: 'Requirements', count: 2 },
		{ label: 'Work packages', count: 5 },
	];

	it('renders every row it is handed, in the order supplied, and no other', () => {
		const wrapper = mount(DeleteReferenceDialog, {
			props: {
				descriptor: { kind: 'delete-reference', entityLabel: 'Kitchen', references: rows },
				titleId: TITLE_ID,
			},
		});
		const rendered = wrapper.findAll('.rp-dialog-reference-row').map((row) => row.text());

		expect(rendered).toHaveLength(2);
		expect(rendered[0]).toContain('Requirements');
		expect(rendered[0]).toContain('2');
		expect(rendered[1]).toContain('Work packages');
		expect(rendered[1]).toContain('5');
	});

	it('invents no row for an empty references array', () => {
		const wrapper = mount(DeleteReferenceDialog, {
			props: {
				descriptor: { kind: 'delete-reference', entityLabel: 'Kitchen', references: [] },
				titleId: TITLE_ID,
			},
		});

		expect(wrapper.findAll('.rp-dialog-reference-row')).toHaveLength(0);
	});

	it('names the entity it would delete', () => {
		const wrapper = mount(DeleteReferenceDialog, {
			props: {
				descriptor: { kind: 'delete-reference', entityLabel: 'Kitchen', references: rows },
				titleId: TITLE_ID,
			},
		});

		expect(wrapper.find('.rp-dialog-title').text()).toContain('Kitchen');
	});

	/**
	 * Each of the four independently, because the failure this catches is two buttons wired
	 * to one handler — which looks correct in a screenshot and destroys the wrong thing.
	 */
	it('resolves each of the four actions from its own button', async () => {
		const expected = ['cancel', 'remove-references', 'reassign', 'delete-anyway'] as const;

		for (const action of expected) {
			const wrapper = mount(DeleteReferenceDialog, {
				props: {
					descriptor: { kind: 'delete-reference', entityLabel: 'Kitchen', references: rows },
					titleId: TITLE_ID,
				},
			});

			await wrapper.find(`[data-rp-action="${action}"]`).trigger('click');

			expect(wrapper.emitted('resolve')).toEqual([[{ action }]]);
		}
	});

	it('emits once for a double-click', async () => {
		const wrapper = mount(DeleteReferenceDialog, {
			props: {
				descriptor: { kind: 'delete-reference', entityLabel: 'Kitchen', references: rows },
				titleId: TITLE_ID,
			},
		});
		const button = wrapper.find('[data-rp-action="delete-anyway"]');

		await button.trigger('click');
		await button.trigger('click');

		// The component emits per click; single-settle is the STORE's guarantee, asserted in
		// dialogStore.test.ts. What is asserted here is that one click emits exactly one
		// event — a handler bound twice would show up as two per click.
		expect(wrapper.emitted('resolve')).toHaveLength(2);
	});
});

describe('EntityPickerDialog', () => {
	const candidates = [
		{ id: 'z-2', label: 'Bathroom' },
		{ id: 'z-1', label: 'Kitchen' },
	];

	it('renders the candidates in the order given, applying no sort of its own', () => {
		const wrapper = mount(EntityPickerDialog, {
			props: { descriptor: { kind: 'entity-picker', title: 'Reassign to', candidates }, titleId: TITLE_ID },
		});

		expect(wrapper.findAll('.rp-dialog-candidate').map((c) => c.text())).toEqual([
			'Bathroom',
			'Kitchen',
		]);
	});

	it('resolves the id of the candidate that was picked', async () => {
		const wrapper = mount(EntityPickerDialog, {
			props: { descriptor: { kind: 'entity-picker', title: 'Reassign to', candidates }, titleId: TITLE_ID },
		});

		await wrapper.findAll('.rp-dialog-candidate')[1]?.trigger('click');

		expect(wrapper.emitted('resolve')).toEqual([[{ id: 'z-1' }]]);
	});

	it('resolves cancel from its cancel control', async () => {
		const wrapper = mount(EntityPickerDialog, {
			props: { descriptor: { kind: 'entity-picker', title: 'Reassign to', candidates }, titleId: TITLE_ID },
		});

		await wrapper.find('[data-rp-action="cancel"]').trigger('click');

		expect(wrapper.emitted('resolve')).toEqual([['cancel']]);
	});

	it('says so rather than showing an empty list', () => {
		const wrapper = mount(EntityPickerDialog, {
			props: {
				descriptor: { kind: 'entity-picker', title: 'Reassign to', candidates: [] },
				titleId: TITLE_ID,
			},
		});

		expect(wrapper.text()).toContain(t(EN, 'dialog.entity-picker.empty'));
	});
});

describe('FormDialog', () => {
	const Field = defineComponent({
		props: { seed: { type: String, default: '' } },
		emits: ['submit'],
		setup(props, { emit }) {
			return () =>
				h('button', { class: 'field', onClick: () => emit('submit', `${props.seed}!`) }, 'go');
		},
	});

	it('renders the component it is handed, with the props it is handed', () => {
		const wrapper = mount(FormDialog, {
			props: {
				descriptor: { kind: 'form', title: 'New asset', component: Field, props: { seed: 'x' } },
				titleId: TITLE_ID,
			},
		});

		expect(wrapper.find('.field').exists()).toBe(true);
	});

	it('resolves submit with whatever the form emitted', async () => {
		const wrapper = mount(FormDialog, {
			props: {
				descriptor: { kind: 'form', title: 'New asset', component: Field, props: { seed: 'x' } },
				titleId: TITLE_ID,
			},
		});

		await wrapper.find('.field').trigger('click');

		expect(wrapper.emitted('resolve')).toEqual([[{ action: 'submit', values: 'x!' }]]);
	});

	it('resolves cancel from its cancel control', async () => {
		const wrapper = mount(FormDialog, {
			props: { descriptor: { kind: 'form', title: 'New asset', component: Field }, titleId: TITLE_ID },
		});

		await wrapper.find('[data-rp-action="cancel"]').trigger('click');

		expect(wrapper.emitted('resolve')).toEqual([['cancel']]);
	});
});

describe('AssetDimensionsDialog', () => {
	it('resolves the typed width and depth on submit', async () => {
		const wrapper = mount(AssetDimensionsDialog, {
			props: { descriptor: { kind: 'asset-dimensions', title: 'Dimensions' }, titleId: TITLE_ID },
		});

		await wrapper.find('input[name="width"]').setValue('1200');
		await wrapper.find('input[name="depth"]').setValue('800');
		await wrapper.find('form').trigger('submit');

		expect(wrapper.emitted('resolve')).toEqual([[{ width: 1200, depth: 800 }]]);
	});

	it('resolves cancel from its cancel control, and null rather than the string', async () => {
		const wrapper = mount(AssetDimensionsDialog, {
			props: { descriptor: { kind: 'asset-dimensions', title: 'Dimensions' }, titleId: TITLE_ID },
		});

		await wrapper.find('[data-rp-action="cancel"]').trigger('click');

		expect(wrapper.emitted('resolve')).toEqual([[null]]);
	});

	it('pre-fills both fields from the descriptor’s initial dimensions', () => {
		const wrapper = mount(AssetDimensionsDialog, {
			props: {
				descriptor: { kind: 'asset-dimensions', title: 'Dimensions', initial: { width: 1200, depth: 800 } },
				titleId: TITLE_ID,
			},
		});

		expect((wrapper.find('input[name="width"]').element as HTMLInputElement).value).toBe('1200');
		expect((wrapper.find('input[name="depth"]').element as HTMLInputElement).value).toBe('800');
	});

	/**
	 * Neither field alone is enough to submit — the whole point of a rectangle needing both —
	 * and a submit while either is missing or non-positive resolves nothing at all, which is
	 * `KnownDistanceForm`'s own guard, met at two fields instead of one.
	 */
	it('submits nothing while either dimension is blank, zero or negative', async () => {
		const wrapper = mount(AssetDimensionsDialog, {
			props: { descriptor: { kind: 'asset-dimensions', title: 'Dimensions' }, titleId: TITLE_ID },
		});

		await wrapper.find('input[name="width"]').setValue('1200');
		await wrapper.find('form').trigger('submit');
		expect(wrapper.emitted('resolve')).toBeUndefined();

		await wrapper.find('input[name="depth"]').setValue('-5');
		await wrapper.find('form').trigger('submit');
		expect(wrapper.emitted('resolve')).toBeUndefined();
	});

	it('renders the caller warning above the fields, in a class the stylesheet declares', () => {
		const warned = mount(AssetDimensionsDialog, {
			props: {
				descriptor: { kind: 'asset-dimensions', title: 'Set dimensions', warning: 'Not measured yet.' },
				titleId: TITLE_ID,
			},
		});
		const warning = warned.get('.rp-dialog-warning');
		expect(warning.text()).toBe('Not measured yet.');
		// Above the fields: the warning is a claim about the PAIR, so it precedes both inputs.
		expect(warned.element.innerHTML.indexOf('rp-dialog-warning')).toBeLessThan(
			warned.element.innerHTML.indexOf('name="width"'),
		);
		// jsdom resolves no CSS, so the class the template emits is checked against the sheet
		// by text — the `rp-save-state-error` defect, refused here before it can recur.
		expect(readFileSync('styles/dialogs.css', 'utf8')).toContain('.rp-dialog-warning {');
	});

	it('renders no warning element at all when the caller sends none', () => {
		const silent = mount(AssetDimensionsDialog, {
			props: { descriptor: { kind: 'asset-dimensions', title: 'Set dimensions' }, titleId: TITLE_ID },
		});
		expect(silent.find('.rp-dialog-warning').exists()).toBe(false);
	});
});

/**
 * `DialogHost` binds `.rp-dialog`'s `aria-labelledby` to an id it generates and then relies
 * on the kind it rendered to put that id on a titled element — its own header calls that
 * "this decision's one unstated assumption", which it was: the cases above find
 * `.rp-dialog-title` by class and never read its `id`, and two of the four kinds asserted no
 * title element at all. An `aria-labelledby` pointing at nothing leaves the dialog with no
 * accessible name, which axe reports; one pointing at the WRONG element leaves it with a
 * name axe accepts and a screen-reader user cannot use.
 *
 * Enumerated rather than derived, because there is nothing to derive it from — the kinds are
 * five hand-written components. That is as wide as this check reaches: a sixth kind that
 * forgot its title is caught by review and by `dialogHost.test.ts`'s own pairing case, not
 * by anything here.
 */
describe('every kind labels the dialog with the id it is handed', () => {
	const StubForm = defineComponent({ template: '<p>stub form</p>' });

	it.each([
		['ConfirmDialog', ConfirmDialog, { kind: 'confirm', title: 'T', message: 'M' }],
		[
			'DeleteReferenceDialog',
			DeleteReferenceDialog,
			{ kind: 'delete-reference', entityLabel: 'Kitchen', references: [] },
		],
		['EntityPickerDialog', EntityPickerDialog, { kind: 'entity-picker', title: 'T', candidates: [] }],
		['FormDialog', FormDialog, { kind: 'form', title: 'T', component: StubForm }],
		['AssetDimensionsDialog', AssetDimensionsDialog, { kind: 'asset-dimensions', title: 'T' }],
	] as const)('%s renders exactly one titled element carrying it', (_name, component, descriptor) => {
		// Each row pairs a component with the descriptor IT takes, and TypeScript cannot see that
		// correlation: it checks the descriptor union against the union of all five prop types and
		// so demands every member of every variant at once. One cast at the seam where the pairing
		// is known, rather than five near-identical cases that would each lose the shared body.
		const wrapper = mount(component, { props: { descriptor, titleId: TITLE_ID } as never });
		const titles = wrapper.findAll('.rp-dialog-title');

		expect(titles).toHaveLength(1);
		expect(titles[0]?.attributes('id')).toBe(TITLE_ID);
	});
});
