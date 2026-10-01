/**
 * @vitest-environment jsdom
 *
 * `DesignerFieldRowShell`'s own contract (AD18-R16 Task 5's follow-up): the compact row's
 * PRESENTATION — a short visible label, a control column, an optional unit suffix — with no
 * opinion about the slotted input's commit behaviour or accessible name. `DesignerFieldRow`
 * composes this now (`designerFieldRow.test.ts` covers that composition); the clearance
 * helper, the repeat form and the height field each cover their own caller-supplied
 * `aria-label`. This file is the shell alone.
 */
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import DesignerFieldRowShell from '../../../src/presentation/designer/inspector/DesignerFieldRowShell.vue';
import { t } from '../../../src/presentation/i18n/strings';

function mountShell(unit?: 'mm' | '°') {
	return mount(DesignerFieldRowShell, {
		props: { short: 'designer.inspector.height.short', unit },
		slots: { default: '<input type="number" name="probe" aria-label="Height in millimetres">' },
	});
}

describe('the compact field row shell', () => {
	it('draws the short label as visible text, leaving the accessible name to the slotted input', () => {
		const wrapper = mountShell('mm');

		expect(wrapper.find('.rp-designer-field-row__label').text()).toBe(t('en', 'designer.inspector.height.short'));
		expect(wrapper.find('input').attributes('aria-label')).toBe('Height in millimetres');
	});

	it('projects the slotted input inside the control column', () => {
		const wrapper = mountShell('mm');

		expect(wrapper.find('.rp-designer-field-row__control input[name="probe"]').exists()).toBe(true);
	});

	it('draws the unit suffix aria-hidden, and draws none when the field has no unit', () => {
		const withUnit = mountShell('mm').find('.rp-designer-field-row__unit');
		expect(withUnit.exists()).toBe(true);
		expect(withUnit.attributes('aria-hidden')).toBe('true');
		expect(withUnit.text()).toBe('mm');

		expect(mountShell(undefined).find('.rp-designer-field-row__unit').exists()).toBe(false);
	});

	it('nests the input inside the label, so the short text still focuses it by implicit association', () => {
		const wrapper = mountShell('mm');

		expect(wrapper.find('label.rp-designer-field-row input').exists()).toBe(true);
	});
});
