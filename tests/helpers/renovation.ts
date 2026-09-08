import { structureStack, WALL_LOOP } from './structure';
import { expectOk, expectDefined } from './domain';
import { renovationServices } from '../../src/application/commands/renovation/RenovationCommand';
import type { Renovation } from '../../src/domain/renovation/Renovation';

export async function renovationStack() {
	const rig = await structureStack();
	expectOk(await rig.services.command({ planId: rig.plan.id, baseline: rig.baseline, structure: WALL_LOOP, ledger: rig.ledger, room: rig.room }).execute());
	const roomId = expectDefined(rig.room.createdZoneId, "created Room");
	const value: Renovation = {
		subjects: [{ id: 'detail-floor', roomId, targetId: roomId, kind: 'floor', existing: { description: 'Worn timber', condition: 'worn' }, planned: { change: 'modify', description: 'Oil finish' } }],
		work: [{ id: 'work-sand', roomId, targetId: roomId, title: 'Sand floor', description: 'Prepare for oil', order: 0, progress: 'pending', responsibility: 'diy', outcomes: ['detail-floor'], dependencies: [] }],
		decisions: [{ id: 'decision-finish', roomId, subjectId: 'detail-floor', question: 'Select oil', resolved: false, resolution: '' }],
	};
	const renovation = renovationServices(rig.stack.plans, rig.geometry, rig.stack.events);
	return { ...rig, roomId, value, renovation, read: () => renovation.read(rig.plan.id) };
}
