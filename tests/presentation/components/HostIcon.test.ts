// @vitest-environment jsdom
import { mount } from '@vue/test-utils';
import { afterEach, expect, it, vi } from 'vitest';
import * as obsidian from 'obsidian';
import HostIcon from '../../../src/presentation/components/HostIcon.vue';
import { nextTick } from 'vue';
import { EDITOR_MODE_ICONS, EDITOR_PERSPECTIVE_ICONS } from '../../../src/presentation/editor/editorIcons';
import { CREATION_CATALOGUE } from '../../../src/presentation/editor/add/creationCatalogue';

afterEach(() => vi.restoreAllMocks());
it('uses the host catalogue without changing the native control or its accessible text', async () => {
	const icon = vi.spyOn(obsidian, 'setIcon');
	const wrapper = mount(HostIcon, { props: { name: 'pencil' } });
	await nextTick();
	const root = wrapper.element;
	expect(icon).toHaveBeenCalledWith(root, 'lucide-pencil');
	expect(wrapper.attributes('aria-hidden')).toBe('true');
	expect(wrapper.find('svg').exists()).toBe(true); expect(wrapper.text()).toBe('');
	await wrapper.setProps({ name: 'ruler' });
	expect(wrapper.element).toBe(root); expect(icon).toHaveBeenLastCalledWith(root, 'lucide-ruler');
	expect(wrapper.findAll('svg')).toHaveLength(1);
	await wrapper.setProps({ name: 'lucide-pencil' });
	expect(icon).toHaveBeenLastCalledWith(root, 'lucide-pencil');
	expect(wrapper.findAll('svg')).toHaveLength(1);
	wrapper.unmount();
});

it.each([...new Set([
	...Object.values(EDITOR_MODE_ICONS), ...Object.values(EDITOR_PERSPECTIVE_ICONS),
	...CREATION_CATALOGUE.map(entry => entry.icon),
])])('renders the host-catalogue spelling used by editor navigation and creation: %s', async name => {
	const wrapper = mount(HostIcon, { props: { name } });
	await nextTick();
	expect(wrapper.find('svg').exists()).toBe(true);
	expect(wrapper.find('svg').classes()).toContain(`lucide-${name}`);
	expect(wrapper.element.childElementCount).toBe(1);
	wrapper.unmount();
});
