import { describe, expect, it } from 'vitest';
import { layerCatalogue, type LayerToggle, type LayerToggles } from '../../../../src/presentation/editor/layers/layerCatalogue';
import { FIXTURE_PLAN } from '../../../helpers/planFixtures';
import { expectDefined } from '../../../helpers/domain';

/** A toggle that records its own state, so each row's `toggle` can be shown to flip ITS predicate only. */
function toggle(initial = true): LayerToggle & { readonly calls: number[] } {
	let on = initial;
	const calls: number[] = [];
	return { visible: () => on, toggle: () => { on = !on; calls.push(calls.length); }, calls };
}

function toggles(planned: LayerToggle | null = toggle()): LayerToggles {
	return { reference: toggle(), rooms: toggle(), walls: toggle(), assets: toggle(), planned, notes: toggle() };
}

/**
 * The layers this editor can honestly offer, in the user's vocabulary (interaction spec §54,
 * §55): six rows, none of them a Konva layer by name. Sidebar polish, 2026-09-10.
 */
describe('layerCatalogue', () => {
	it('lists the six rows in the mockup order', () => {
		expect(layerCatalogue(FIXTURE_PLAN, toggles()).map((e) => e.id)).toEqual(['reference', 'rooms', 'walls', 'assets', 'planned', 'notes']);
	});

	it('omits the Planned changes row when the renovation session is not available', () => {
		expect(layerCatalogue(FIXTURE_PLAN, toggles(null)).map((e) => e.id)).toEqual(['reference', 'rooms', 'walls', 'assets', 'notes']);
	});

	it('binds each row to its own predicate and nothing else', () => {
		const t = toggles();
		const entries = layerCatalogue(FIXTURE_PLAN, t);
		const walls = expectDefined(entries.find((e) => e.id === 'walls'), 'the walls entry');

		expect(walls.visible()).toBe(true);
		walls.toggle();
		expect(walls.visible()).toBe(false);
		expect(t.rooms.visible()).toBe(true);
		expect(t.notes.visible()).toBe(true);
		expect(t.reference.visible()).toBe(true);
		expect(expectDefined(t.planned, 'the planned toggle').visible()).toBe(true);
	});

	it('marks the reference plan supported-empty with a reason when the plan has no background, and disables Set scale', () => {
		const [reference] = layerCatalogue(FIXTURE_PLAN, toggles());
		expect(reference.state).toBe('supported-empty');
		expect(reference.reasonKey).toBe('editor.layer.reference-plan.none');
		expect(reference.action?.enabled).toBe(false);
	});

	it('offers Set scale when a background exists', () => {
		const [reference] = layerCatalogue({ ...FIXTURE_PLAN, background: { path: 'Plans/g.png', kind: 'image' } }, toggles());
		expect(reference.state).toBe('available');
		expect(reference.action).toEqual({
			labelKey: 'editor.layer.reference-plan.set-scale',
			toolId: 'calibrate',
			enabled: true,
			reasonKey: 'editor.layer.reference-plan.none',
		});
	});

	it('lists nothing for a null plan', () => {
		expect(layerCatalogue(null, toggles())).toEqual([]);
	});

	it('disables Set scale with the paused reason when writes are blocked, even with a background', () => {
		const planWithBackground = { ...FIXTURE_PLAN, background: { path: 'Plans/g.png', kind: 'image' as const } };

		const [blocked] = layerCatalogue(planWithBackground, toggles(), true);
		expect(blocked.action).toEqual({
			labelKey: 'editor.layer.reference-plan.set-scale',
			toolId: 'calibrate',
			enabled: false,
			reasonKey: 'editor.paused.reason',
		});

		const [unblocked] = layerCatalogue(planWithBackground, toggles(), false);
		expect(unblocked.action?.enabled).toBe(true);
	});

	it('keeps the no-background reason when writes are also blocked', () => {
		const [reference] = layerCatalogue(FIXTURE_PLAN, toggles(), true);
		expect(reference.action?.enabled).toBe(false);
		expect(reference.action?.reasonKey).toBe('editor.layer.reference-plan.none');
	});

	it('makes the reference row a live toggle naming the guide when a detail plan has a guide but no background', () => {
		const [reference] = layerCatalogue(FIXTURE_PLAN, toggles(), false, true);
		expect(reference.state).toBe('available');
		expect(reference.reasonKey).toBe('editor.layer.reference-plan.guide-only');
		expect(reference.action).toEqual({ labelKey: 'editor.layer.reference-plan.set-scale', toolId: 'calibrate', enabled: false, reasonKey: 'editor.layer.reference-plan.none' });
	});

	it('says nothing extra about a guide once a background exists', () => {
		const [reference] = layerCatalogue({ ...FIXTURE_PLAN, background: { path: 'Plans/g.png', kind: 'image' } }, toggles(), false, true);
		expect(reference.state).toBe('available');
		expect(reference.reasonKey).toBeNull();
	});
});
