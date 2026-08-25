/**
 * @vitest-environment jsdom
 *
 * Design slice 15's first real caller: the calibration gesture, which slice 7 built and
 * slice 8 shipped unreachable. Two dialogs and a command, in that order.
 */
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import KnownDistanceForm from '../../../../src/presentation/editor/shell/KnownDistanceForm.vue';

describe('KnownDistanceForm', () => {
	it('shows what was measured on the plan, so the user knows what they are naming', () => {
		const wrapper = mount(KnownDistanceForm, { props: { measured: 1234.5 } });

		expect(wrapper.text()).toContain('1235');
	});

	it('emits the millimetres the user typed', async () => {
		const wrapper = mount(KnownDistanceForm, { props: { measured: 100 } });

		await wrapper.find('input').setValue('2400');
		await wrapper.find('form').trigger('submit');

		expect(wrapper.emitted('submit')).toEqual([[2400]]);
	});

	/**
	 * The tool refuses a non-positive or non-finite distance anyway, so this is the SECOND
	 * of two checks rather than the only one — but a form that submits an empty string
	 * makes the user press a button that does nothing, which is a worse failure than a
	 * disabled control.
	 */
	it.each([['', 'empty'], ['0', 'zero'], ['-5', 'negative'], ['abc', 'not a number']])(
		'refuses to submit %s (%s)',
		async (typed) => {
			const wrapper = mount(KnownDistanceForm, { props: { measured: 100 } });

			await wrapper.find('input').setValue(typed);
			await wrapper.find('form').trigger('submit');

			expect(wrapper.emitted('submit')).toBeUndefined();
		},
	);
});
