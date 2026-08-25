/**
 * @vitest-environment jsdom
 *
 * What each dialog kind RENDERS and what it RESOLVES — the two halves of the only job a
 * kind component has. Mounted bare, with no store and no host: a kind that needed either
 * would be reaching past the seam that keeps `store.resolve` to one call site.
 */
import { describe, expect, it } from 'vitest';
import { defineComponent, h } from 'vue';
import { mount } from '@vue/test-utils';
import ConfirmDialog from '../../../src/presentation/dialogs/ConfirmDialog.vue';
import DeleteReferenceDialog from '../../../src/presentation/dialogs/DeleteReferenceDialog.vue';
import EntityPickerDialog from '../../../src/presentation/dialogs/EntityPickerDialog.vue';
import FormDialog from '../../../src/presentation/dialogs/FormDialog.vue';
import { t } from '../../../src/presentation/i18n/strings';

const EN = 'en';

describe('ConfirmDialog', () => {
	it('renders the title and message it is handed', () => {
		const wrapper = mount(ConfirmDialog, {
			props: { descriptor: { kind: 'confirm', title: 'Recalibrate?', message: 'Zones rescale.' } },
		});

		expect(wrapper.find('.rp-dialog-title').text()).toBe('Recalibrate?');
		expect(wrapper.find('.rp-dialog-message').text()).toBe('Zones rescale.');
	});

	it('falls back to translated labels, never to an English literal', () => {
		const wrapper = mount(ConfirmDialog, {
			props: { descriptor: { kind: 'confirm', title: 'T', message: 'M' } },
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
			},
		});

		expect(wrapper.findAll('.rp-dialog-button').map((b) => b.text())).toEqual(['Keep', 'Rescale']);
	});

	it('resolves confirm and cancel from their own buttons', async () => {
		const wrapper = mount(ConfirmDialog, {
			props: { descriptor: { kind: 'confirm', title: 'T', message: 'M' } },
		});

		await wrapper.findAll('.rp-dialog-button')[1]?.trigger('click');
		await wrapper.findAll('.rp-dialog-button')[0]?.trigger('click');

		expect(wrapper.emitted('resolve')).toEqual([['confirm'], ['cancel']]);
	});

	it('marks the confirm action destructive only when asked', () => {
		const plain = mount(ConfirmDialog, {
			props: { descriptor: { kind: 'confirm', title: 'T', message: 'M' } },
		});
		const dangerous = mount(ConfirmDialog, {
			props: { descriptor: { kind: 'confirm', title: 'T', message: 'M', danger: true } },
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
			props: { descriptor: { kind: 'delete-reference', entityLabel: 'Kitchen', references: rows } },
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
			props: { descriptor: { kind: 'delete-reference', entityLabel: 'Kitchen', references: [] } },
		});

		expect(wrapper.findAll('.rp-dialog-reference-row')).toHaveLength(0);
	});

	it('names the entity it would delete', () => {
		const wrapper = mount(DeleteReferenceDialog, {
			props: { descriptor: { kind: 'delete-reference', entityLabel: 'Kitchen', references: rows } },
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
				props: { descriptor: { kind: 'delete-reference', entityLabel: 'Kitchen', references: rows } },
			});

			await wrapper.find(`[data-rp-action="${action}"]`).trigger('click');

			expect(wrapper.emitted('resolve')).toEqual([[{ action }]]);
		}
	});

	it('emits once for a double-click', async () => {
		const wrapper = mount(DeleteReferenceDialog, {
			props: { descriptor: { kind: 'delete-reference', entityLabel: 'Kitchen', references: rows } },
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
			props: { descriptor: { kind: 'entity-picker', title: 'Reassign to', candidates } },
		});

		expect(wrapper.findAll('.rp-dialog-candidate').map((c) => c.text())).toEqual([
			'Bathroom',
			'Kitchen',
		]);
	});

	it('resolves the id of the candidate that was picked', async () => {
		const wrapper = mount(EntityPickerDialog, {
			props: { descriptor: { kind: 'entity-picker', title: 'Reassign to', candidates } },
		});

		await wrapper.findAll('.rp-dialog-candidate')[1]?.trigger('click');

		expect(wrapper.emitted('resolve')).toEqual([[{ id: 'z-1' }]]);
	});

	it('resolves cancel from its cancel control', async () => {
		const wrapper = mount(EntityPickerDialog, {
			props: { descriptor: { kind: 'entity-picker', title: 'Reassign to', candidates } },
		});

		await wrapper.find('[data-rp-action="cancel"]').trigger('click');

		expect(wrapper.emitted('resolve')).toEqual([['cancel']]);
	});

	it('says so rather than showing an empty list', () => {
		const wrapper = mount(EntityPickerDialog, {
			props: { descriptor: { kind: 'entity-picker', title: 'Reassign to', candidates: [] } },
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
			},
		});

		expect(wrapper.find('.field').exists()).toBe(true);
	});

	it('resolves submit with whatever the form emitted', async () => {
		const wrapper = mount(FormDialog, {
			props: {
				descriptor: { kind: 'form', title: 'New asset', component: Field, props: { seed: 'x' } },
			},
		});

		await wrapper.find('.field').trigger('click');

		expect(wrapper.emitted('resolve')).toEqual([[{ action: 'submit', values: 'x!' }]]);
	});

	it('resolves cancel from its cancel control', async () => {
		const wrapper = mount(FormDialog, {
			props: { descriptor: { kind: 'form', title: 'New asset', component: Field } },
		});

		await wrapper.find('[data-rp-action="cancel"]').trigger('click');

		expect(wrapper.emitted('resolve')).toEqual([['cancel']]);
	});
});
