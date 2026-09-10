import { expect, it } from 'vitest';
import type { PlanGeometryDocument } from '../../../src/application/ports/PlanGeometrySidecar';
import { EMPTY_STRUCTURE } from '../../../src/domain/spatial/Structure';
import { captureGroup, groupRotationTarget } from '../../../src/presentation/editor/groups/groupSnapshot';
import { adjustedNeighbours, rotatedGroup, translatedGroup } from '../../../src/presentation/editor/groups/groupTransforms';
import { rotationPivot, rotationPoints } from '../../../src/presentation/editor/elements/objectRotation';
import { expectDefined } from '../../helpers/domain';

const room = { id: 'room-one', points: [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 }], bulges: [0.25, 0, 0, 0] };
const bare: PlanGeometryDocument = { calibration: null, objects: [room], groups: [{ id: 'group-one', name: 'Curved room', memberIds: [room.id] }] };

it('transforms a saved singleton curved Room before any structure exists without losing its group or curve map', () => {
	const before = structuredClone(bare), snapshot = expectDefined(captureGroup(bare, [room.id], 12), 'saved singleton');
	expect(snapshot).toMatchObject({ id: 'group-one', name: 'Curved room', memberIds: [room.id], generation: 12 });
	const translated = translatedGroup(snapshot, { dx: 100, dy: -200 });
	expect(translated.objects[0]).toEqual({ ...room, points: room.points.map(point => ({ x: point.x + 100, y: point.y - 200 })) });
	expect(translated.groups).toEqual(bare.groups);
	const target = expectDefined(groupRotationTarget(snapshot, false), 'rotation target');
	expect(target.visible).toBe(false);
	const pivot = expectDefined(rotationPivot(target), 'pivot');
	const envelope = expectDefined(rotationPoints(target, 90, pivot), 'turned envelope');
	const rotated = expectDefined(rotatedGroup(snapshot, envelope), 'turned room');
	expect(rotated.objects[0].points).toEqual(expectDefined(rotationPoints({ ...room, kind: 'room' }, 90, pivot), 'turned corners'));
	expect(rotated.objects[0].bulges).toEqual(room.bulges); expect(rotated.groups).toEqual(bare.groups);
	expect(adjustedNeighbours(snapshot, bare)).toBe(0);
	expect(bare).toEqual(before);
});

it('refuses a retired member envelope and out-of-range group geometry before proposing a transform', () => {
	const snapshot = expectDefined(captureGroup(bare, [room.id], 0), 'snapshot');
	const retired = { ...snapshot, document: { ...bare, objects: [] } };
	expect(groupRotationTarget(retired, true)).toBeNull();
	expect(rotatedGroup(retired, room.points)).toBeNull();
	const distant = { ...snapshot, document: { ...bare, objects: [{ ...room, points: room.points.map(point => ({ x: point.x + 2e9, y: point.y })) }] } };
	expect(rotatedGroup(distant, room.points)).toBeNull();
	expect(snapshot.document).toEqual(bare);
});

it('counts only changed existing unselected neighbour walls in a group impact preview', () => {
	const host = { id: 'host', start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, thickness: 100, height: 2400 };
	const neighbour = { id: 'neighbour', start: host.end, end: { x: 4000, y: 3000 }, thickness: 100, height: 2400 };
	const remote = { id: 'remote', start: { x: 8000, y: 0 }, end: { x: 8000, y: 3000 }, thickness: 100, height: 2400 };
	const document: PlanGeometryDocument = { calibration: null, objects: [], structure: { ...EMPTY_STRUCTURE, walls: [host, neighbour, remote] } };
	const snapshot = expectDefined(captureGroup(document, [host.id], 0, true), 'explicit single wall');
	const moved = translatedGroup(snapshot, { dx: 0, dy: 500 });
	expect(moved.structure?.walls[1]).toEqual({ ...neighbour, start: { x: 4000, y: 500 } });
	expect(moved.structure?.walls[2]).toEqual(remote);
	expect(adjustedNeighbours(snapshot, moved)).toBe(1);
	expect(adjustedNeighbours(snapshot, { ...moved, structure: { ...expectDefined(moved.structure, 'structure'), walls: [...expectDefined(moved.structure, 'structure').walls, { ...remote, id: 'new-wall' }] } })).toBe(1);
	expect(adjustedNeighbours(snapshot, document)).toBe(0);
});
