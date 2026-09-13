/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import AssetPresetForm from '../../../src/presentation/designer/presets/AssetPresetForm.vue';
import { dimensionsOf, type AssetShape } from '../../../src/domain/asset/AssetShape';
import { t } from '../../../src/presentation/i18n/strings';
import { expectOk } from '../../helpers/domain';

describe('AssetPresetForm', () => {
	it('submits the first preset at its default values', async () => {
		const wrapper = mount(AssetPresetForm, { props: { replaces: false } });

		expect(wrapper.find('svg.rp-asset-preset-preview').exists()).toBe(true);
		await wrapper.find('form').trigger('submit');

		const [[shape]] = wrapper.emitted('submit') as [[AssetShape]];
		expect(expectOk(dimensionsOf(shape.footprint))).toEqual({ width: 1600, depth: 900 });
	});

	it('resets the fields to the chosen preset’s defaults', async () => {
		const wrapper = mount(AssetPresetForm, { props: { replaces: false } });

		await wrapper.find('select[name="preset"]').setValue('round-table');

		expect((wrapper.find('input[name="diameter"]').element as HTMLInputElement).value).toBe('900');
		expect(wrapper.find('input[name="width"]').exists()).toBe(false);
	});

	it('shows the refusal and submits nothing for a value out of range', async () => {
		const wrapper = mount(AssetPresetForm, { props: { replaces: false } });

		await wrapper.find('input[name="width"]').setValue('0');
		await wrapper.find('form').trigger('submit');

		expect(wrapper.text()).toContain(t('en', 'asset.preset-value-out-of-range'));
		expect(wrapper.emitted('submit')).toBeUndefined();
	});

	it('warns that the current design will be replaced when there is one', () => {
		const wrapper = mount(AssetPresetForm, { props: { replaces: true } });

		expect(wrapper.text()).toContain(t('en', 'designer.preset.replaces'));
	});
});
