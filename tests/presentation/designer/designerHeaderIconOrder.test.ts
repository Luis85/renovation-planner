/**
 * @vitest-environment jsdom
 *
 * `Design an Asset.md` step 72: the library door reads "← Back to library", the arrow BEFORE the words.
 * `designerHeader.test.ts` asks which glyph the icon is and what the label says, each on its own, and never
 * where one sits against the other — so the icon moved after the words left it green.
 */
import { describe, expect, it } from 'vitest';
import { createPinia } from 'pinia';
import { flushPromises, mount } from '@vue/test-utils';
import DesignerHeader from '../../../src/presentation/designer/DesignerHeader.vue';
import { t } from '../../../src/presentation/i18n/strings';
import { assetDesign } from '../../helpers/assetDesign';

describe('the library door', () => {
	it('draws the arrow-left icon before the words, in DOM order', async () => {
		const wrapper = mount(DesignerHeader, {
			props: { design: assetDesign(), openLibrary: () => undefined },
			global: { plugins: [createPinia()] },
		});
		await flushPromises();
		const door = wrapper.get('.rp-designer-open-library').element;

		const parts = [...door.children].map((child) => ({ className: child.className, icon: child.getAttribute('data-icon'), text: child.textContent }));
		expect(parts).toEqual([
			{ className: 'rp-host-icon', icon: 'arrow-left', text: expect.any(String) },
			{ className: 'rp-designer-open-library-label', icon: null, text: t('en', 'designer.header.back-to-library') },
		]);
		// No bare text node on either side of the pair: the words are the label span's alone.
		expect([...door.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim() !== '')).toEqual([]);
		wrapper.unmount();
	});
});
