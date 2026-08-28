/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import SaveStateIndicator from '../../../../src/presentation/editor/save-state/SaveStateIndicator.vue';
import { useSaveStateStore } from '../../../../src/presentation/editor/save-state/save-state-store';

describe('the save-state indicator', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
	});

	it('renders the resting state as words, not as a colour or an icon alone', () => {
		expect(mount(SaveStateIndicator).text()).toBe('Saved');
	});

	it('follows the store into saving', async () => {
		const wrapper = mount(SaveStateIndicator);
		useSaveStateStore().beginSaving();
		await wrapper.vm.$nextTick();
		expect(wrapper.text()).toBe('Saving');
	});

	it('follows the store into a save error', async () => {
		const wrapper = mount(SaveStateIndicator);
		const store = useSaveStateStore();
		store.beginSaving();
		store.resolveErr();
		await wrapper.vm.$nextTick();
		expect(wrapper.text()).toBe('Save error');
	});
});
