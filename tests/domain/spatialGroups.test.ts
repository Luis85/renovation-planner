import { expect, it } from 'vitest';
import { WALL_LOOP } from '../helpers/structure';
import { groupMembers, groupRoots, regroup, selectedGroup, validateSpatialGroups } from '../../src/domain/spatial/SpatialGroup';
import { groupPivot, groupPoints, transformGroupGeometry } from '../../src/domain/spatial/groupGeometry';
import { encloseRoom } from '../../src/domain/spatial/encloseRoom';
import { expectOk } from '../helpers/domain';
const group = { id: 'group-one', name: 'Room assembly', memberIds: ['room-one', 'wall-a'] };
const structure = { ...WALL_LOOP, openings: [{ id: 'opening-one', kind: 'door' as const, hostId: 'wall-a', offset: 100, width: 800, height: 2000, sill: 0 }] };
it('normalizes hosted opening membership and identifies the same group regardless of selection order', () => {
	expect(groupRoots(['opening-one', 'wall-a'], structure)).toEqual(['wall-a']);
	expect(groupMembers(group, structure)).toEqual(['room-one', 'wall-a', 'opening-one']);
	expect(selectedGroup([group], ['opening-one', 'room-one'], structure)).toBe(group);
	expect(selectedGroup([group], ['room-one'], structure)).toBeNull();
});
it.each([
	[{ ...group, id: 'bad' }], [{ ...group, name: ' ' }], [{ ...group, memberIds: [] }],
	[{ ...group, memberIds: ['missing'] }], [group, group], [{ ...group, memberIds: ['wall-a', 'wall-a'] }],
].map(groups => ({ groups })))('refuses invalid identities, names and overlapping or dangling membership $groups', ({ groups }) => {
	expect(validateSpatialGroups(groups, { zoneIds: ['room-one'], structure }).ok).toBe(false);
});
it('flattens selected groups without losing other members or changing unrelated groups', () => {
	const unrelated = { id: 'group-other', name: 'Elsewhere', memberIds: ['wall-c'] };
	const result = regroup([group, unrelated], { id: 'group-new', name: 'Larger assembly', memberIds: ['opening-one', 'wall-b'] }, structure);
	expect(result).toEqual([unrelated, { id: 'group-new', name: 'Larger assembly', memberIds: ['wall-a', 'wall-b', 'room-one'] }]);
	expect(validateSpatialGroups(result, { zoneIds: ['room-one'], structure }).ok).toBe(true);
});
it('preserves independent object and source order while deriving one union centre', () => {
	const objects = [{ id: 'room-one', points: [{ x: 0, y: 0 }, { x: 2000, y: 0 }, { x: 2000, y: 1000 }, { x: 0, y: 1000 }] }];
	const points = groupPoints({ objects, structure }, group.memberIds); expect(groupPivot(points)).toEqual({ x: 2000, y: 500 }); expect(groupPivot([])).toBeNull();
	const moved = transformGroupGeometry(objects, structure, ['wall-a'], point => ({ x: point.x, y: point.y + 100 }));
	expect(moved.objects[0]).toBe(objects[0]); expect(moved.structure.openings).toBe(structure.openings);
	expect(moved.structure.walls.map(wall => wall.id)).toEqual(structure.walls.map(wall => wall.id));
});
it('refuses group IDs colliding with a spatial member namespace', () => {
	expect(validateSpatialGroups([group], { zoneIds: ['room-one', 'group-one'], structure }).ok).toBe(false);
});

it('retains group catalogue and member order when extending an existing group identity', () => {
	const unrelated = { id: 'group-other', name: 'Elsewhere', memberIds: ['wall-c'] };
	const ordered = { ...group, memberIds: ['wall-a', 'room-one'] };
	expect(regroup([ordered, unrelated], { ...group, memberIds: ['room-one', 'wall-a'] }, structure)).toEqual([ordered, unrelated]);
	expect(regroup([ordered, unrelated], { ...group, memberIds: ['room-one', 'wall-b'] }, structure)).toEqual([
		{ ...ordered, memberIds: ['wall-a', 'room-one', 'wall-b'] }, unrelated,
	]);
});

it('leaves an existing Room boundary in its original catalogue position when enclosing it again', () => {
	const farWalls = WALL_LOOP.walls.map(wall => ({ ...wall, id: `${wall.id}-far`, start: { x: wall.start.x + 10000, y: wall.start.y }, end: { x: wall.end.x + 10000, y: wall.end.y } }));
	const original = { ...WALL_LOOP, walls: [...WALL_LOOP.walls, ...farWalls], boundaries: [
		{ roomId: 'room-one', wallIds: WALL_LOOP.walls.map(wall => wall.id) },
		{ roomId: 'room-two', wallIds: farWalls.map(wall => wall.id) },
	] };
	const enclosed = expectOk(encloseRoom({ id: 'room-one', points: WALL_LOOP.walls.map(wall => wall.start) }, original, { height: 2400, thickness: 150 }, () => 'unused'));
	expect(enclosed.createdIds).toEqual([]); expect(enclosed.structure).toEqual(original);
});
