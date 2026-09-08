// @vitest-environment jsdom
import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import * as obsidian from 'obsidian';
import HostIcon from '../../../src/presentation/components/HostIcon.vue';
import { nextTick } from 'vue';
import { EDITOR_MODE_ICONS, EDITOR_PERSPECTIVE_ICONS } from '../../../src/presentation/editor/editorIcons';
import { CREATION_CATALOGUE } from '../../../src/presentation/editor/add/creationCatalogue';
import { registerEditorIcons } from '../../../src/plugin/editorIconRegistration';

let unregister: () => void;
beforeEach(() => { unregister = registerEditorIcons(); });
afterEach(() => { unregister(); vi.restoreAllMocks(); });
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

it('preserves the registered application namespace and does not substitute unknown application icons', async () => {
	const icon = vi.spyOn(obsidian, 'setIcon');
	const wrapper = mount(HostIcon, { props: { name: 'rp-stairs' } });
	await nextTick();
	expect(icon).toHaveBeenCalledWith(wrapper.element, 'rp-stairs');
	const artwork = wrapper.get('svg');
	expect(artwork.classes()).toContain('rp-stairs');
	expect(artwork.attributes('viewBox')).toBe('0 0 100 100');
	await wrapper.setProps({ name: 'rp-unknown' });
	expect(wrapper.find('svg').exists()).toBe(false);
	wrapper.unmount();
});

it.each([...new Set([
	...Object.values(EDITOR_MODE_ICONS), ...Object.values(EDITOR_PERSPECTIVE_ICONS),
	...CREATION_CATALOGUE.map(entry => entry.icon),
])])('renders the host-catalogue spelling used by editor navigation and creation: %s', async name => {
	const wrapper = mount(HostIcon, { props: { name } });
	await nextTick();
	expect(wrapper.find('svg').exists()).toBe(true);
	expect(wrapper.find('svg').classes()).toContain(name.startsWith('rp-') ? name : `lucide-${name}`);
	expect(wrapper.element.childElementCount).toBe(1);
	wrapper.unmount();
});
