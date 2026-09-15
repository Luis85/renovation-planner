// @vitest-environment jsdom
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import ReferenceReview from '../../../../src/presentation/editor/reference/ReferenceReview.vue';

describe('I07 reference scale and review', () => {
	it('keeps rescale acknowledgement unchecked until the user chooses it and names the full impact', async () => {
		const wrapper = mount(ReferenceReview, {
			props: {
				path: 'plans/ground-floor.png', page: null, rotation: 0, crop: { x: 0, y: 0, width: 800, height: 600 },
				scaleSummary: 'Scale: 10 mm per source pixel. Known distance: 2 m.', factor: '10', needsConsent: true, paused: false,
				opacity: 0.65, visible: true, locked: true, acknowledged: false,
			},
		});

		const acknowledgement = wrapper.get<HTMLInputElement>('input[name="consent"]');
		expect(acknowledgement.element.checked).toBe(false);
		expect(wrapper.get('.rp-reference-rescale-impact h4').text()).toBe('Existing geometry will be rescaled');
		expect(wrapper.get('.rp-reference-rescale-impact').text()).toContain('Rescale all walls, openings, rooms and areas');
		await acknowledgement.setValue(true);
		expect(wrapper.emitted('update:acknowledged')?.at(-1)).toEqual([true]);
		wrapper.unmount();
	});
});
