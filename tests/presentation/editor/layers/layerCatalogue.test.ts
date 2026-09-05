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

	/**
	 * Design spec §2.9: `writesBlocked` joins the reason mechanism Set scale already has for
	 * "no background" rather than adding a second one. Defaulted to `false`, so every case
	 * above — none of which passes a second argument — keeps asserting the shape this
	 * function had before this task.
	 */
	it('disables Set scale with the paused reason when writes are blocked, even with a background', () => {
		const planWithBackground = { ...FIXTURE_PLAN, background: { path: 'Plans/g.png', kind: 'image' as const } };

		const [blocked] = layerCatalogue(planWithBackground, true);
		expect(blocked.action).toEqual({
			labelKey: 'editor.layer.reference-plan.set-scale',
			toolId: 'calibrate',
			enabled: false,
			reasonKey: 'editor.paused.reason',
		});

		const [unblocked] = layerCatalogue(planWithBackground, false);
		expect(unblocked.action).toEqual({
			labelKey: 'editor.layer.reference-plan.set-scale',
			toolId: 'calibrate',
			enabled: true,
			reasonKey: 'editor.layer.reference-plan.none',
		});
	});

	/**
	 * The "no background" reason takes priority over the paused one: it is the more useful
	 * thing to tell a user, whether or not the floor also happens to be paused, and it is
	 * already the row's own reason for existing.
	 */
	it('keeps the no-background reason when writes are also blocked', () => {
		const [reference] = layerCatalogue(FIXTURE_PLAN, true);
		expect(reference.action?.enabled).toBe(false);
		expect(reference.action?.reasonKey).toBe('editor.layer.reference-plan.none');
	});
});
