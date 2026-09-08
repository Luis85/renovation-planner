// @vitest-environment jsdom
import { mount } from '@vue/test-utils';
import { afterEach, expect, it, vi } from 'vitest';
import * as obsidian from 'obsidian';
import HostIcon from '../../../src/presentation/components/HostIcon.vue';
import { nextTick } from 'vue';

afterEach(() => vi.restoreAllMocks());
it('uses the host catalogue without changing the native control or its accessible text', async () => {
	const icon = vi.spyOn(obsidian, 'setIcon');
	const wrapper = mount(HostIcon, { props: { name: 'pencil' } });
	await nextTick();
	const root = wrapper.element;
	expect(icon).toHaveBeenCalledWith(root, 'pencil');
	expect(wrapper.attributes('aria-hidden')).toBe('true');
	expect(wrapper.find('svg').exists()).toBe(true); expect(wrapper.text()).toBe('');
	await wrapper.setProps({ name: 'ruler' });
	expect(wrapper.element).toBe(root); expect(icon).toHaveBeenLastCalledWith(root, 'ruler');
	expect(wrapper.findAll('svg')).toHaveLength(1);
	wrapper.unmount();
});
