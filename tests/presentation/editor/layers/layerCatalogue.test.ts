import { describe, expect, it } from 'vitest';
import { layerCatalogue } from '../../../../src/presentation/editor/layers/layerCatalogue';
import { FIXTURE_PLAN } from '../../../helpers/planFixtures';

/**
 * The layers this editor can honestly offer (design spec §5.3): the Reference plan and the
 * Rooms, never the four empty Konva layers or the interaction layer — a row for a layer with
 * no records and no capability is a fake.
 */
describe('layerCatalogue', () => {
	it('lists Reference plan then Rooms, in that order, and nothing else', () => {
		expect(layerCatalogue(FIXTURE_PLAN).map((e) => e.id)).toEqual(['reference', 'rooms']);
	});

	it('marks the reference plan supported-empty with a reason when the plan has no background, and disables Set scale', () => {
		const [reference] = layerCatalogue(FIXTURE_PLAN);
		expect(reference.state).toBe('supported-empty');
		expect(reference.reasonKey).toBe('editor.layer.reference-plan.none');
		expect(reference.action?.enabled).toBe(false);
	});

	it('offers Set scale when a background exists', () => {
		const [reference] = layerCatalogue({ ...FIXTURE_PLAN, background: { path: 'Plans/g.png', kind: 'image' } });
		expect(reference.state).toBe('available');
		expect(reference.action).toEqual({
			labelKey: 'editor.layer.reference-plan.set-scale',
			toolId: 'calibrate',
			enabled: true,
			reasonKey: 'editor.layer.reference-plan.none',
		});
	});

	it('lists nothing for a null plan', () => {
		expect(layerCatalogue(null)).toEqual([]);
	});
});
