/**
 * @vitest-environment jsdom
 *
 * `DesignerFieldRow`'s compact-row shape (AD18-R16 Task 5): a short visible label beside the
 * input, the field's full sentence carried as the input's accessible name (WCAG 2.5.3
 * label-in-name), and the unit suffix withheld from the accessibility tree. Mounted bare —
 * `DesignerSelectionInspector.test.ts` and the future `DesignerSetTransform` cases still cover
 * this component wired into a real field list; this file is the component's own contract.
 */
import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import DesignerFieldRow from '../../../src/presentation/designer/inspector/DesignerFieldRow.vue';
import { t } from '../../../src/presentation/i18n/strings';

function mountField(unit?: 'mm' | '°') {
	const onChange = vi.fn<(event: Event) => void>();
	const wrapper = mount(DesignerFieldRow, {
		props: {
			name: 'width',
			label: 'designer.preset.field.width',
			short: 'designer.preset.field.width.short',
			unit,
			value: 800,
			onChange,
		},
	});
	return { wrapper, onChange };
}

describe('the compact field row', () => {
	it('shows the short label as visible text and the full sentence as the accessible name', () => {
		const { wrapper } = mountField('mm');

		expect(wrapper.find('.rp-designer-field-row__label').text()).toBe(t('en', 'designer.preset.field.width.short'));
		expect(wrapper.find('input').attributes('aria-label')).toBe(t('en', 'designer.preset.field.width'));
		// WCAG 2.5.3: the visible text is contained in the accessible name.
		expect(t('en', 'designer.preset.field.width')).toContain(t('en', 'designer.preset.field.width.short'));
	});

	it('draws the unit suffix aria-hidden, and draws none when the field has no unit', () => {
		const withUnit = mountField('mm').wrapper.find('.rp-designer-field-row__unit');
		expect(withUnit.exists()).toBe(true);
		expect(withUnit.attributes('aria-hidden')).toBe('true');
		expect(withUnit.text()).toBe('mm');

		expect(mountField(undefined).wrapper.find('.rp-designer-field-row__unit').exists()).toBe(false);
	});

	it('still dispatches a change through onChange', async () => {
		const { wrapper, onChange } = mountField('mm');

		await wrapper.find('input').trigger('change');

		expect(onChange).toHaveBeenCalledTimes(1);
	});

	it('keeps the hint outside the label, linked by aria-describedby', () => {
		const wrapper = mount(DesignerFieldRow, {
			props: {
				name: 'angle',
				label: 'designer.selection.angle',
				short: 'designer.selection.angle.short',
				unit: '°',
				hint: 'designer.selection.angle.hint',
				value: 90,
				onChange: vi.fn<(event: Event) => void>(),
			},
		});
		const describedBy = wrapper.find('input').attributes('aria-describedby');

		expect(describedBy).toBeDefined();
		expect(wrapper.find(`#${String(describedBy)}`).text()).toBe(t('en', 'designer.selection.angle.hint'));
	});
});
