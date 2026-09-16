import { expect, it } from 'vitest';
import { structureStack, WALL_LOOP } from '../../helpers/structure';
import { expectDefined, expectFound, expectOk } from '../../helpers/domain';
import { groupGeometryServices } from '../../../src/application/commands/spatial/GroupGeometryCommand';
import { sameGeometryDocument } from '../../../src/application/commands/spatial/sameGeometryDocument';
import { MoveSpatialObjectCommand } from '../../../src/application/commands/zone/MoveSpatialObject';
import { ReversibleMoveZoneCommand } from '../../../src/presentation/editor/tools/reversible-move-zone-command';
import type { ZoneId } from '../../../src/domain/zone/ZoneId';

const door = { id: 'opening-door', kind: 'door' as const, hostId: 'wall-a', offset: 500, width: 800, height: 2100, sill: 0 };
async function setup() {
	const rig = await structureStack();
	expectOk(await rig.services.command({ planId: rig.plan.id, baseline: rig.baseline, structure: { ...WALL_LOOP, openings: [door] }, ledger: rig.ledger, room: rig.room }).execute());
	const roomId = expectDefined(rig.room.createdZoneId, 'created Room') as ZoneId;
	return { ...rig, roomId, groups: groupGeometryServices(rig.geometry, rig.stack.zones, rig.stack.events) };
}

it('sees a colour change on a wall, an opening and a room entry', () => {
	const room = { id: 'zone-a', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }] };
	const document = { calibration: null, objects: [room], structure: { ...WALL_LOOP, openings: [door] } };
	const walls = WALL_LOOP.walls.map((wall, index) => index === 0 ? { ...wall, color: 'rose' as const } : wall);
	expect(sameGeometryDocument(document, { ...document, structure: { ...document.structure, walls } })).toBe(false);
	expect(sameGeometryDocument(document, { ...document, structure: { ...document.structure, openings: [{ ...door, color: '#3a7bd5' as const }] } })).toBe(false);
	expect(sameGeometryDocument(document, { ...document, objects: [{ ...room, color: 'amber' as const }] })).toBe(false);
	expect(sameGeometryDocument(document, { ...document, objects: [{ ...room }] })).toBe(true);
});

it('records a recoloured room, so the zone edits around it still undo in order', async () => {
	const rig = await setup();
	const move = async (dx: number) => {
		const room = expectFound(await rig.stack.zones.getById(rig.roomId));
		const points = room.entity.geometry.points.map(point => ({ x: point.x + dx, y: point.y }));
		const command = new ReversibleMoveZoneCommand(new MoveSpatialObjectCommand(rig.stack.zones, rig.stack.events), rig.ledger, rig.roomId, { points }, room.entity.geometry);
		expectOk(await command.execute()); return command;
	};
	const original = expectFound(await rig.stack.zones.getById(rig.roomId)).entity.geometry;
	const first = await move(20);
	const baseline = expectOk(await rig.groups.read(rig.plan.id));
	const objects = baseline.document.objects.map(object => object.id === rig.roomId ? { ...object, color: 'rose' as const } : object);
	const recolor = rig.groups.command({ planId: rig.plan.id, baseline, document: { ...baseline.document, objects }, ledger: rig.ledger });
	expectOk(await recolor.execute());
	expect(expectFound(await rig.stack.zones.getById(rig.roomId)).entity.color).toBe('rose');
	const later = await move(30);
	expect(expectFound(await rig.stack.zones.getById(rig.roomId)).entity.color).toBe('rose');
	expectOk(await later.undo()); expectOk(await recolor.undo()); expectOk(await first.undo());
	const restored = expectFound(await rig.stack.zones.getById(rig.roomId)).entity;
	expect(restored.color).toBeNull(); expect(restored.geometry).toEqual(original);
});
