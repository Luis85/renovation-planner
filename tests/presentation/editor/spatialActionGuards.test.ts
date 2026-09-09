// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { structureEditor } from '../../helpers/structureEditor';
import { renovationEditor } from '../../helpers/renovationEditor';
import { settle, settleUntil } from '../../helpers/editor';
import { expectDefined, expectOk, injectedPersistenceError } from '../../helpers/domain';
import { WALL_LOOP } from '../../helpers/structure';
import { makeZone } from '../../helpers/entities';
import { elementInput } from '../../../src/presentation/editor/elements/elementInput';
import type { NamedSpatialElement } from '../../../src/domain/spatial/SpatialElement';
import { err } from '../../../src/core/result/Result';
import WallRotationForm from '../../../src/presentation/editor/structure/WallRotationForm.vue';
import * as notices from '../../../src/presentation/notices/notify';

const mounted: { unmount(): void }[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); vi.restoreAllMocks(); });

async function walls(boundaryRoomId?: string) {
	const rig = await structureEditor(); mounted.push(rig);
	const baseline = expectOk(await rig.geometry.read(rig.plan.id));
	const structure = { ...WALL_LOOP, boundaries: boundaryRoomId ? [{ roomId: boundaryRoomId, wallIds: WALL_LOOP.walls.map(wall => wall.id) }] : [] };
	// An outline the sidecar still stores while no Zone note claims it: the boundary stays valid, the name is gone.
	const objects = boundaryRoomId ? [...baseline.document.objects, { id: boundaryRoomId, points: WALL_LOOP.walls.map(wall => wall.start) }] : baseline.document.objects;
	expectOk(await rig.geometry.write(rig.plan.id, { ...baseline.document, objects, structure }, baseline.version));
	await rig.runtime.refreshProjection(); rig.selection.select(['wall-a' as never]); await settle();
	return rig;
}

it('reports a refused wall read and opens no impact review at all', async () => {
	const rig = await walls();
	const notify = vi.spyOn(notices, 'notifyOperationFailure').mockImplementation(() => undefined);
	vi.spyOn(rig.services, 'read').mockResolvedValueOnce(err(injectedPersistenceError()));
	await rig.runtime.structureActions.rotateWall('wall-a');
	expect(notify).toHaveBeenCalledOnce(); expect(rig.dialogs.current).toBeNull();
});

it('opens no impact review for a selected record that hosts no wall', async () => {
	const rig = await structureEditor(); mounted.push(rig);
	const room = makeZone({ projectId: rig.plan.projectId, planId: rig.plan.id, zoneType: 'Room', geometry: { points: WALL_LOOP.walls.map(wall => wall.start) } });
	expectOk(await rig.stack.zones.save(room, 'absent')); await rig.runtime.refreshProjection();
	rig.selection.select([room.id]); await settle();
	const write = vi.spyOn(rig.geometry, 'write');
	await rig.runtime.structureActions.rotateWall(room.id);
	expect(rig.dialogs.current).toBeNull(); expect(write).not.toHaveBeenCalled();
});

it('names an impact-review room that this plan no longer holds by its stored identity', async () => {
	const rig = await walls('room-departed');
	const operation = rig.runtime.structureActions.rotateWall('wall-a');
	await settleUntil(() => rig.wrapper.findComponent(WallRotationForm).exists(), 'wall rotation form');
	expect(rig.wrapper.getComponent(WallRotationForm).props().roomNames).toEqual({ 'room-departed': 'room-departed' });
	rig.dialogs.resolve('cancel'); await operation;
});

it('reports a wall-review failure as a fault and leaves no preview behind', async () => {
	const rig = await walls();
	const notify = vi.spyOn(notices, 'notifyFault').mockImplementation(() => undefined);
	vi.spyOn(rig.dialogs, 'openDialog').mockRejectedValueOnce(new Error('Dialog host failed'));
	await rig.runtime.structureActions.rotateWall('wall-a');
	expect(notify).toHaveBeenCalledOnce(); expect(rig.runtime.structureActions.rotationHostId.value).toBeNull();
});

const ARROW: NamedSpatialElement = { id: 'element-guarded-arrow', kind: 'arrow', name: 'Route arrow', points: [{ x: 500, y: 500 }, { x: 2500, y: 500 }] };
it('reports a refused element deletion and leaves the stored element in place', async () => {
	const rig = await renovationEditor(); mounted.push(rig); rig.changePlan(); await settle();
	const baseline = expectOk(await rig.renovation.read(rig.plan.id));
	expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(baseline, elementInput(baseline, ARROW), rig.runtime.structureTask.ledger)));
	rig.selection.select([ARROW.id as never]); await settle();
	const notify = vi.spyOn(notices, 'notifyOperationFailure').mockImplementation(() => undefined);
	vi.spyOn(rig.runtime.dispatcher, 'run').mockResolvedValueOnce(err(injectedPersistenceError()));
	const removal = rig.runtime.elementActions.remove(ARROW.id);
	await settleUntil(() => rig.dialogs.current?.kind === 'confirm', 'delete confirmation');
	rig.dialogs.resolve('confirm'); await removal;
	expect(notify).toHaveBeenCalledOnce();
	expect(rig.project.structure.elements?.some(item => item.id === ARROW.id)).toBe(true);
});

it('groups a fresh plan that stores no saved groups yet without inventing one', async () => {
	const rig = await renovationEditor(); mounted.push(rig);
	const second = expectOk(await rig.deps.commands.createZone.execute({ planId: rig.plan.id, name: 'Hall', zoneType: 'Room', geometry: { points: [{ x: 6000, y: 0 }, { x: 8000, y: 0 }, { x: 8000, y: 2000 }, { x: 6000, y: 2000 }] } })).zone.entity;
	await rig.runtime.refreshProjection();
	expect(expectOk(await rig.geometry.read(rig.plan.id)).document.groups).toBeUndefined();
	rig.selection.select([rig.room.id, second.id]); await settle();
	await expectDefined(rig.runtime.groupActions.actions(rig.selection.selectedIds).find(action => action.id === 'group'), 'group').run();
	expect(rig.project.groups).toHaveLength(1);
	expect(rig.project.groups[0].memberIds).toEqual([rig.room.id, second.id]);
});

