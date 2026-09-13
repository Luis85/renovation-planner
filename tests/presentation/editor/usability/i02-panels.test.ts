// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { t } from '../../../../src/presentation/i18n/strings';
import { useEditorStore } from '../../../../src/presentation/stores/EditorStore';
import { mountPlanEditorCanvas, runtimeOf, settle, type EditorHarness } from '../../../helpers/editor';
import { resizeTo } from '../../../helpers/layout';

let open: EditorHarness | null = null;
afterEach(() => { open?.unmount(); open = null; });

describe('I02 compact panel navigation', () => {
	it('keeps Details stable and opens the existing Property or Layers section without moving the camera', async () => {
		const harness = await mountPlanEditorCanvas();
		open = harness;
		resizeTo(harness.rootEl, 460, 800);
		await settle();

		runtimeOf(harness).selectAndFrame('zone-kitchen');
		await settle();
		expect(harness.wrapper.get('[data-rp-rail="details"]').text()).toBe(t('en', 'editor.rail.details'));
		const viewport = { ...useEditorStore(harness.pinia).viewport };

		await harness.wrapper.get('[data-rp-rail="property"]').trigger('click');
		await settle();
		const context = harness.wrapper.get('[data-rp-section="context"]');
		expect(context.attributes('open')).toBeDefined();
		expect(document.activeElement).toBe(harness.wrapper.get('.rp-overlay-panel').element);

		await harness.wrapper.get('[data-rp-rail="layers"]').trigger('click');
		await settle();
		const layers = harness.wrapper.get('[data-rp-section="layers"]');
		expect(layers.attributes('open')).toBeDefined();
		expect(document.activeElement).toBe(harness.wrapper.get('.rp-overlay-panel').element);
		expect({ ...useEditorStore(harness.pinia).viewport }).toEqual(viewport);
	});
});
