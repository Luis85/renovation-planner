// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type Konva from 'konva';
import { mountPlanEditorCanvas, settle } from '../../helpers/editor';
import { FIXTURE_ZONES } from '../../helpers/planFixtures';
import { useSelectionStore } from '../../../src/presentation/editor/selection/selection-store';
import { VERTEX_HANDLE_RADIUS_PX } from '../../../src/presentation/editor/handleMetrics';

async function selectedKitchen(locked: boolean) {
	const zones = FIXTURE_ZONES.map((zone) => (zone.id === 'zone-kitchen' && locked ? { ...zone, locked: true as const } : zone));
	const harness = await mountPlanEditorCanvas({ zones });
	useSelectionStore(harness.pinia).select(['zone-kitchen' as never]);
	await settle();
	const handles = (harness.stage.findOne<Konva.Layer>('.interaction')?.find<Konva.Circle>('Circle') ?? [])
		.filter((circle) => circle.radius() === VERTEX_HANDLE_RADIUS_PX);
	const group = harness.stage.findOne<Konva.Group>('.zone-kitchen');
	return { handles, opacity: group?.opacity() };
}

describe('a locked zone on the canvas', () => {
	it('draws dimmed and offers no vertex handles when selected from the sidebar', async () => {
		const unlocked = await selectedKitchen(false);
		expect(unlocked.handles).toHaveLength(4);
		expect(unlocked.opacity).toBe(1);
		const locked = await selectedKitchen(true);
		expect(locked.handles).toHaveLength(0);
		expect(locked.opacity).toBe(0.5);
	});
});
