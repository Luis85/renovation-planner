import { expectOk } from './domain';
import { makePlan, makeProject } from './entities';
import { createRepositoryStack } from './vault';
import { makeDeleteZoneCommand } from './slice10';
import { ObsidianPlanGeometrySidecar } from '../../src/infrastructure/obsidian/repositories/ObsidianPlanGeometrySidecar';
import { structureServices } from '../../src/application/commands/spatial/StructureCommand';
import { SessionWriteLedger } from '../../src/application/editor/WriteLedger';
import { ReversibleCreateZoneCommand } from '../../src/application/commands/zone/reversible-create-zone-command';
import { CreateZoneCommand } from '../../src/application/commands/zone/CreateZone';
import type { Structure } from '../../src/domain/spatial/Structure';

export const WALL_LOOP: Structure = {
	walls: [
		{ id: 'wall-a', start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, height: 2400, thickness: 150 },
		{ id: 'wall-b', start: { x: 4000, y: 0 }, end: { x: 4000, y: 3000 }, height: 2400, thickness: 150 },
		{ id: 'wall-c', start: { x: 4000, y: 3000 }, end: { x: 0, y: 3000 }, height: 2400, thickness: 150 },
		{ id: 'wall-d', start: { x: 0, y: 3000 }, end: { x: 0, y: 0 }, height: 2400, thickness: 150 },
	], openings: [], boundaries: [],
};
export async function structureStack() {
	const stack = createRepositoryStack(), project = makeProject(), plan = makePlan({ projectId: project.id });
	expectOk(await stack.projects.save(project, 'absent'));
	expectOk(await stack.plans.save(plan, 'absent'));
	const geometry = new ObsidianPlanGeometrySidecar(stack.store), services = structureServices(geometry, stack.events), ledger = new SessionWriteLedger();
	const baseline = expectOk(await geometry.read(plan.id));
	const points = WALL_LOOP.walls.map(wall => wall.start);
	const create = new CreateZoneCommand(stack.zones, stack.plans, stack.events);
	const command = new ReversibleCreateZoneCommand(create, makeDeleteZoneCommand(stack.zones, stack.events, stack.requirements), ledger,
		{ planId: plan.id, name: 'Kitchen', zoneType: 'Room', geometry: { points } }, { zones: stack.zones, requirements: stack.requirements, events: stack.events, logger: stack.logger });
	const room = { execute: () => command.execute(), undo: () => command.undo(), get createdZoneId() { return command.createdZoneId; }, points };
	return { stack, plan, geometry, services, ledger, baseline, room };
}
