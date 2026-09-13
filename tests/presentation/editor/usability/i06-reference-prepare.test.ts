// @vitest-environment jsdom
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import ReferencePrepare from '../../../../src/presentation/editor/reference/ReferencePrepare.vue';

function setup(sources: readonly string[] = ['plans/Ground-floor.png', 'surveys/Survey.pdf']) {
	return mount(ReferencePrepare, {
		props: {
			sources,
			pdf: true,
			paused: false,
			loading: false,
			hasRaster: true,
			path: '',
			page: 1,
			rotation: 0,
			crop: { x: 0, y: 0, width: 800, height: 600 },
			onLoad: () => undefined,
		},
	});
}

describe('I06 reference preparation', () => {
	it('puts supported vault files in a selectable, filename-first list while preserving exact paths', async () => {
		const wrapper = setup();
		const option = wrapper.get('[data-rp-reference-source="plans/Ground-floor.png"]');

		expect(wrapper.find('[role="listbox"]').exists()).toBe(false);
		expect(wrapper.find('[role="group"]').attributes('aria-label')).toBe('Source file in your vault');
		expect(option.attributes('aria-pressed')).toBe('false');
		expect(option.text()).toContain('Ground-floor.png');
		expect(option.text()).toContain('plans/Ground-floor.png');
		await option.trigger('click');

		expect(wrapper.get('input[name="source"]').element).toHaveProperty('value', 'plans/Ground-floor.png');
		expect(option.attributes('aria-pressed')).toBe('true');
		expect(wrapper.find('.rp-reference-source-context').text()).toContain('Ground-floor.png');
		expect(wrapper.find('.rp-reference-source-context').text()).toContain('plans/Ground-floor.png');
	});

	it('uses native disabled buttons while the preparation surface is paused', async () => {
		const wrapper = setup();
		await wrapper.setProps({ paused: true });

		for (const option of wrapper.findAll('[data-rp-reference-source]')) expect(option.attributes('disabled')).toBeDefined();
	});

	it('keeps PDF page and raster preparation controls in native disclosures', async () => {
		const wrapper = setup();

		expect(wrapper.find('details').exists()).toBe(true);
		expect(wrapper.find('details').attributes('open')).toBeUndefined();
		expect(wrapper.find('input[name="page"]').exists()).toBe(true);
		expect(wrapper.find('input[name="rotation"]').exists()).toBe(true);
		expect(wrapper.find('input[name="crop-width"]').exists()).toBe(true);
		await wrapper.get('details:last-of-type summary').trigger('click');
		expect(wrapper.get('details:last-of-type').attributes('open')).toBeDefined();
	});
});
