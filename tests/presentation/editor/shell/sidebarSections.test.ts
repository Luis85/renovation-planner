// @vitest-environment jsdom
/**
 * The sidebar's four sections (sidebar polish 2026-09-10), every one collapsible, in the
 * order the user ranked them: Property, Layers (with the legend at its foot), Rooms and
 * areas, Walls and openings. The first three open; the walls list closed, because it is the
 * keyboard route to walls rather than something the mockup draws at rest.
 */
import { describe, expect, it } from 'vitest';
import { mountPlanEditorCanvas } from '../../../helpers/editor';

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

	it('keeps the change legend inside the Layers section', async () => {
		const harness = await mountPlanEditorCanvas();
		const layers = harness.wrapper.get('.rp-property-layers');
		// The legend only draws with a renovation session; when absent, nothing else may draw it either.
		expect(harness.wrapper.findAll('.rp-change-legend').length).toBe(layers.findAll('.rp-change-legend').length);
	});
});
