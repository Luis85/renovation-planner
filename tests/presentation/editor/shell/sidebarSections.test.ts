// @vitest-environment jsdom
/**
 * The sidebar's four sections (sidebar polish 2026-09-10), every one collapsible, in the
 * order the user ranked them: Property, Layers (with the legend at its foot), Rooms and
 * areas, Walls and openings. The first three open; the walls list closed, because it is the
 * keyboard route to walls rather than something the mockup draws at rest.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { mountPlanEditorCanvas } from '../../../helpers/editor';
import { renovationEditor } from '../../../helpers/renovationEditor';

describe('sidebar sections', () => {
	it('draws four collapsible sections in order with the walls list closed', async () => {
		const harness = await mountPlanEditorCanvas();
		const sections = harness.wrapper.findAll('.rp-editor-layers > details.rp-sidebar-section');

		expect(sections.map((s) => s.classes().find((c) => c.startsWith('rp-property-')))).toEqual([
			'rp-property-context',
			'rp-property-layers',
			'rp-property-rooms',
			'rp-property-elements',
		]);
		expect(sections.map((s) => s.attributes('open') !== undefined)).toEqual([true, true, true, false]);
		expect(sections.every((s) => s.find('summary').exists())).toBe(true);
	});

	it('keeps the multiple selection control and its hint together in the rooms section footer', async () => {
		const harness = await mountPlanEditorCanvas();
		const footer = harness.wrapper.get('.rp-property-rooms > .rp-property-rooms__footer');
		expect(footer.find('input[data-rp-action="multiple-selection"]').exists()).toBe(true);
		expect(footer.find('p').exists()).toBe(true);
		harness.unmount();
	});

	let rig: Awaited<ReturnType<typeof renovationEditor>> | undefined;
	afterEach(() => { rig?.unmount(); rig = undefined; });

	it('places the change legend at the foot of the Layers section, after Reference options, and nowhere else', async () => {
		// With a renovation session active, runtime.renovation.available is true, so the
		// legend actually draws - unlike the plain-fixture mount above, this rig can tell
		// "inside the Layers section" from "nowhere at all".
		rig = await renovationEditor();
		const legends = rig.wrapper.findAll('.rp-change-legend');
		expect(legends).toHaveLength(1);

		const layers = rig.wrapper.get('.rp-property-layers');
		expect(layers.findAll('.rp-change-legend')).toHaveLength(1);

		const legendEl = legends[0].element;
		const referenceEl = layers.get('.rp-reference-options').element;
		// Last element child of the section: at its foot, not merely somewhere inside it.
		expect(layers.element.lastElementChild).toBe(legendEl);
		// Comes after Reference options in document order.
		expect(referenceEl.compareDocumentPosition(legendEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
	});
});
