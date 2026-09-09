import { structureEditor } from './structureEditor';
import { makeZone } from './entities';
import { WALL_LOOP } from './structure';
import { expectOk } from './domain';
import { settle, settleUntil } from './editor';

/** A persisted assembly, created through the same enclosure action as a user. */
export async function groupEditor() {
	const rig = await structureEditor();
	const room = makeZone({ projectId: rig.plan.projectId, planId: rig.plan.id, name: 'Kitchen', zoneType: 'Room', geometry: { points: WALL_LOOP.walls.map(wall => wall.start) } });
	expectOk(await rig.stack.zones.save(room, 'absent')); await rig.runtime.refreshProjection();
	rig.selection.select([room.id]); await settle();
	await rig.wrapper.get('[data-rp-group-action="enclose"]').trigger('click');
	await settleUntil(() => rig.project.groups.length === 1 && !rig.runtime.groupActions.active.value, 'saved group');
	await settle();
	return { ...rig, room };
}
