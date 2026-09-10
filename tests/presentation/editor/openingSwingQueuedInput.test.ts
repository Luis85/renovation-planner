// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import OpeningSwingFields from '../../../src/presentation/editor/structure/OpeningSwingFields.vue';

it('restores queued native swing edits when the host operation becomes busy before their delivery', async () => {
	const value = { hinge: 'start' as const, side: 'left' as const, angle: '90' };
	const wrapper = mount(OpeningSwingFields, { props: { modelValue: value, disabled: false } });
	try {
		const hinge = wrapper.get<HTMLSelectElement>('[name="opening-hinge"]').element;
		const side = wrapper.get<HTMLSelectElement>('[name="opening-side"]').element;
		const angle = wrapper.get<HTMLInputElement>('[name="opening-angle"]').element;
		await wrapper.setProps({ disabled: true });
		hinge.value = 'end'; hinge.dispatchEvent(new Event('change', { bubbles: true }));
		side.value = 'right'; side.dispatchEvent(new Event('change', { bubbles: true }));
		angle.value = '45'; angle.dispatchEvent(new Event('input', { bubbles: true }));
		expect([hinge.value, side.value, angle.value]).toEqual(['start', 'left', '90']);
		expect(wrapper.emitted('update:modelValue')).toBeUndefined();
		await wrapper.setProps({ disabled: false }); await wrapper.get('[name="opening-angle"]').setValue('45');
		expect(wrapper.emitted('update:modelValue')).toEqual([[{ ...value, angle: '45' }]]);
	} finally { wrapper.unmount(); }
});
