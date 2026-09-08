import { editorRotationHoverPoint, editorRotationScene } from './editorRotationProbe';
import { CreateZoneCommand } from '../../src/application/commands/zone/CreateZone';
import { zoneRenamed } from '../../src/domain/zone/Zone.events';
import { expectDefined, expectOk } from '../helpers/domain';
import type { referenceWorkspace } from './referenceWorkspace';
import { editorCaptionScene } from './editorCaptionProbe';
import { useSelectionStore } from '../../src/presentation/editor/selection/selection-store';
import { useProjectStore } from '../../src/presentation/stores/ProjectStore';

/** Explicit test-data preparation, never a production control or a write performed by a query. */
export function editorFidelityProbe(workspace: ReturnType<typeof referenceWorkspace>) {
	let seeded = false;
	return { groups: () => {
		const project = useProjectStore();
		return JSON.parse(JSON.stringify({ groups: project.groups, structure: project.structure, rooms: [...project.zones.values()].map(zone => ({ id: zone.id, points: zone.points, ...(zone.bulges ? { bulges: zone.bulges } : {}) })) })) as unknown;
	}, rotation: editorRotationScene, rotationHoverPoint: editorRotationHoverPoint, captions: editorCaptionScene, selection: () => {
		const selection = useSelectionStore();
		return { ids: [...selection.selectedIds], focusedId: selection.focusedId };
	}, savedNotes: () => [...workspace.stack.vault.entries], async seedSurroundings(german: boolean) {
		if (seeded) return;
		seeded = true;
		const { stack, plan } = workspace;
		await workspace.ready;
		const rooms = expectOk(await stack.zones.listByPlan(plan.id));
		const kitchen = expectDefined(rooms.loaded[0], 'created Kitchen');
		expectOk(await stack.zones.save(expectOk(kitchen.entity.withName(german ? 'Küche' : 'Kitchen')), kitchen.version));
		await stack.events.publish(zoneRenamed({ zoneId: kitchen.entity.id, planId: plan.id, projectId: plan.projectId }));
		const create = new CreateZoneCommand(stack.zones, stack.plans, stack.events);
		for (const [name, x, y, width, depth] of [
			[german ? 'Wohnzimmer' : 'Living room', 4000, 0, 4000, 4500],
			[german ? 'Flur' : 'Hall', 0, 3000, 4000, 3000],
			[german ? 'Badezimmer' : 'Bathroom', 4000, 4500, 4000, 1500],
		] as const) {
			expectOk(await create.execute({ planId: plan.id, name, zoneType: 'Room', geometry: { points: [{ x, y }, { x: x + width, y }, { x: x + width, y: y + depth }, { x, y: y + depth }] } }));
		}
	} };
}
