import { CreateZoneCommand } from '../../src/application/commands/zone/CreateZone';
import { zoneRenamed } from '../../src/domain/zone/Zone.events';
import { expectDefined, expectOk } from '../helpers/domain';
import type { referenceWorkspace } from './referenceWorkspace';

/** Explicit test-data preparation, never a production control or a write performed by a query. */
export function editorFidelityProbe(workspace: ReturnType<typeof referenceWorkspace>) {
	let seeded = false;
	return { async seedSurroundings(german: boolean) {
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
