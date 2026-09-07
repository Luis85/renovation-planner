import type { PlanEditorContext } from '../../src/presentation/editor/PlanEditorContext';
import { structureEditor } from './structureEditor';
import { expectDefined, expectOk } from './domain';
import { settle } from './editor';
import { WALL_LOOP } from './structure';
import { useRenovationSession } from '../../src/presentation/editor/renovation/renovationSession';

export async function renovationEditor(planning = false, navigation?: PlanEditorContext['navigation']) {
	const rig = await structureEditor(planning, navigation);
	const room = expectOk(await rig.deps.commands.createZone.execute({ planId: rig.plan.id, name: 'Studio', zoneType: 'Room', geometry: { points: WALL_LOOP.walls.map(wall => wall.start) } })).zone.entity;
	const before = expectOk(await rig.geometry.read(rig.plan.id));
	expectOk(await rig.runtime.dispatcher.run(rig.services.command({ planId: rig.plan.id, baseline: before, structure: WALL_LOOP, ledger: rig.runtime.structureTask.ledger })));
	rig.selection.select([room.id]); await settle();
	const services = expectDefined(rig.deps.commands.renovation, 'renovation services');
	return { ...rig, room, renovation: services, session: useRenovationSession(rig.pinia) };
}
