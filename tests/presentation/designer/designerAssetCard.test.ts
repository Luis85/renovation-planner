/**
 * @vitest-environment jsdom
 *
 * Task 9's asset card, mounted BARE with `design` as its one prop — `designerArrangePanel.test.ts`'s
 * shape, since this component reads no context and dispatches nothing. The last describe mounts the
 * real `DesignerInspector`, for that file's own reason: a component proven bare and bound to nothing
 * is the slice-7 shape this repository refuses, and the placement decision (before the `Asset`
 * heading, never after it) is a fact about the REAL template that only that mount can pin.
 */
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import DesignerAssetCard from '../../../src/presentation/designer/inspector/DesignerAssetCard.vue';
import DesignerInspector from '../../../src/presentation/designer/inspector/DesignerInspector.vue';
import { ok } from '../../../src/core/result/Result';
import type { DispatchResult } from '../../../src/application/commands/DispatchOutcome';
import { t } from '../../../src/presentation/i18n/strings';
import { ASSET_CATEGORY_LABELS } from '../../../src/presentation/views/assetLabels';
import { assetDesign } from '../../helpers/assetDesign';
import { recorder } from '../../helpers/logger';

describe('the asset card', () => {
	it('draws the category as text, the one channel that carries it', () => {
		const wrapper = mount(DesignerAssetCard, { props: { design: assetDesign({ category: 'fixture' }) } });

		expect(wrapper.find('.rp-designer-asset-category').text()).toBe(t('en', ASSET_CATEGORY_LABELS.fixture));
	});

	/** The fixture's own default shape (`assetDesign()`) is a real footprint. */
	it('draws a decorative thumbnail when the asset has a footprint', () => {
		const wrapper = mount(DesignerAssetCard, { props: { design: assetDesign() } });

		const thumbnail = wrapper.find('.rp-designer-asset-thumbnail');
		expect(thumbnail.exists()).toBe(true);
		expect(thumbnail.attributes('aria-hidden')).toBe('true');
	});

	it('draws no thumbnail for a shapeless asset, rather than an empty picture', () => {
		const wrapper = mount(DesignerAssetCard, { props: { design: assetDesign({ shape: null }) } });

		expect(wrapper.find('.rp-designer-asset-thumbnail').exists()).toBe(false);
	});
});

function mountInspector() {
	return mount(DesignerInspector, {
		props: {
			design: assetDesign({ category: 'plant' }),
			setHeight: () => Promise.resolve(ok('wrote') as DispatchResult),
			editDimensions: async (): Promise<void> => {},
			activateAnchorTool: () => undefined,
			logger: recorder,
			removeBackground: async (): Promise<void> => {},
			selection: null,
			editShape: () => Promise.resolve(ok('no-write') as DispatchResult),
			select: () => undefined,
			selected: [],
			lockedGraphics: new Set<string>(),
		},
	});
}

describe('mounted by the inspector it actually ships in', () => {
	it('draws the card, atop the Object tab', () => {
		const wrapper = mountInspector();

		expect(wrapper.find('.rp-designer-asset-card').exists()).toBe(true);
		expect(wrapper.find('.rp-designer-asset-category').text()).toBe(t('en', ASSET_CATEGORY_LABELS.plant));
	});

	/**
	 * **Locks the placement decision.** `designerUsageScope.test.ts`'s own pin requires
	 * `.rp-designer-usage-scope`'s `previousElementSibling` to be the `Asset` heading with nothing
	 * between — so this card has to sit BEFORE that heading, never between it and the usage scope.
	 * `nextElementSibling` rather than an index, for that file's own reason: a position is correct
	 * only until the next insertion above it.
	 */
	it('sits directly before the asset heading, never between it and the usage scope', () => {
		const wrapper = mountInspector();

		const card = wrapper.get('.rp-designer-asset-card').element;
		const heading = wrapper.findAll('h3').find((h3) => h3.text() === t('en', 'designer.inspector.asset'));

		expect(heading).toBeDefined();
		expect(card.nextElementSibling).toBe(heading?.element);
	});
});
