import { expect, it } from 'vitest';
import { captureGroup, groupRotationTarget } from '../../../src/presentation/editor/groups/groupSnapshot';
import { adjustedNeighbours, rotatedGroup, translatedGroup } from '../../../src/presentation/editor/groups/groupTransforms';
import { rotationPivot, rotationPoints } from '../../../src/presentation/editor/elements/objectRotation';
import { expectDefined } from '../../helpers/domain';
import type { PlanGeometryDocument } from '../../../src/application/ports/PlanGeometrySidecar';

const document: PlanGeometryDocument = { calibration: null, objects: [
	{ id: 'room-a', points: [{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 300 }, { x: 0, y: 300 }], bulges: [0.25, 0, 0, 0] },
	{ id: 'room-b', points: [{ x: 500, y: 0 }, { x: 900, y: 0 }, { x: 900, y: 300 }, { x: 500, y: 300 }] },
], groups: [{ id: 'group-rooms', name: '  Rooms  ', memberIds: ['room-b', 'room-a'] }] };

it('moves a saved Room group without architecture while preserving curves, group order and source geometry', () => {
	const before = structuredClone(document), snapshot = expectDefined(captureGroup(document, ['room-a', 'room-b'], 7), 'Room group');
	const moved = translatedGroup(snapshot, { dx: 12.345, dy: -98.765 });
	expect(moved.objects[0].points[0]).toEqual({ x: 12.345, y: -98.765 });
	expect(moved.objects[1].points[0]).toEqual({ x: 512.345, y: -98.765 });
	expect(moved.objects[0].bulges).toEqual(document.objects[0].bulges); expect(moved.groups).toEqual(document.groups);
	expect(adjustedNeighbours(snapshot, moved)).toBe(0); expect(document).toEqual(before);
});

it('rotates all Room group edges rigidly without requiring architecture and retains exact curve metadata', () => {
	const before = structuredClone(document), snapshot = expectDefined(captureGroup(document, ['room-a', 'room-b'], 7), 'Room group');
	const target = expectDefined(groupRotationTarget(snapshot, true), 'rotation target'), pivot = expectDefined(rotationPivot(target), 'group pivot');
	const envelope = expectDefined(rotationPoints(target, 90, pivot), 'rotated envelope'), rotated = expectDefined(rotatedGroup(snapshot, envelope), 'rotated group');
	expect(rotated.groups).toEqual(document.groups); expect(rotated.objects[0].bulges).toEqual(document.objects[0].bulges);
	for (const [index, room] of document.objects.entries()) {
		const expected = room.points.map(point => ({ x: pivot.x - (point.y - pivot.y), y: pivot.y + (point.x - pivot.x) }));
		expect(rotated.objects[index].points).toEqual(expected);
	}
	expect(document).toEqual(before); expect(adjustedNeighbours(snapshot, { objects: [], calibration: null })).toBe(0);
});

it('refuses a rotation after every captured group member has disappeared', () => {
	const snapshot = expectDefined(captureGroup(document, ['room-a', 'room-b'], 7), 'Room group');
	const empty = { ...snapshot, document: { ...document, objects: [] } };
	expect(groupRotationTarget(empty, true)).toBeNull(); expect(rotatedGroup(empty, document.objects[0].points)).toBeNull();
	expect(captureGroup(document, [], 7)).toBeNull(); expect(captureGroup(document, ['room-a', 'missing'], 7)).toBeNull();
});
