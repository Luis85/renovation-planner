import { expect, it } from 'vitest';
import { bulgeAt, curveDocument, curveEdges, curveError, curveSource, curveText, typedBulge, withCurve } from '../../../src/presentation/editor/curves/curveDraft';
import type { CurveTarget } from '../../../src/presentation/editor/curves/curveDraft';

const room: CurveTarget = { id: 'room-a', kind: 'room', name: 'Room', geometry: { points: [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 }], bulges: [0.123456789, 0, 0, 0] } };
it('keeps untouched precision and treats retyped bend or radius as an explicit new value', () => {
	const edge = curveEdges(room)[0], text = curveText(edge);
	expect(room.geometry.bulges?.[0]).toBe(0.123456789);
	expect(typedBulge(edge, 'depth', text.depth)).not.toBe(edge.bulge);
	expect(typedBulge(edge, 'depth', '0.5')).toBe(0.25);
	expect(typedBulge(edge, 'depth', '-0,5')).toBe(-0.25);
	expect(typedBulge(edge, 'radius', '2')).toBe(1);
	expect(typedBulge(edge, 'radius', '1.999')).toBeNull();
	expect(typedBulge(edge, 'depth', '2.001')).toBeNull();
	expect(typedBulge(edge, 'radius', 'invalid')).toBeNull();
	expect(bulgeAt(edge, { x: 2000, y: -1000 })).toBe(0.5);
	expect(bulgeAt(edge, { x: 2000, y: 99999 })).toBe(-1);
});
it('changes only the selected edge while preserving groups and exact source metadata', () => {
	const document = { calibration: null, objects: [{ id: room.id, ...room.geometry }], groups: [{ id: 'group-a', name: 'Set', memberIds: [room.id] }] };
	const edited = withCurve(room, 1, 0.5), next = curveDocument(document, edited);
	expect(next.groups).toBe(document.groups); expect(next.objects[0].bulges).toEqual([0.123456789, 0.5, 0, 0]);
	expect(curveError(document, edited)).toBeNull();
	expect(document.objects[0].bulges).toEqual([0.123456789, 0, 0, 0]);
});

it('refuses a vanished source and preserves unedited siblings when a Wall is straightened', () => {
	const wall: CurveTarget = { id: 'wall-a', name: '', kind: 'wall', geometry: { points: room.geometry.points.slice(0, 2) } };
	expect(curveSource({ calibration: null, objects: [] }, room)).toBeNull();
	expect(curveSource({ calibration: null, objects: [{ id: room.id, points: room.geometry.points, bulges: [0, 0, 0, 0] }] }, room)?.bulges).toBeUndefined();
	expect(curveSource({ calibration: null, objects: [] }, wall)).toBeNull();
	const document = { calibration: null, objects: [{ id: 'other-room', ...room.geometry }], structure: { walls: [{ id: wall.id, start: wall.geometry.points[0], end: wall.geometry.points[1], bulge: 0.5, thickness: 150, height: 2400 }, { id: 'wall-other', start: { x: 10000, y: 0 }, end: { x: 12000, y: 0 }, thickness: 150, height: 2400 }], openings: [], boundaries: [] } };
	const next = curveDocument(document, wall);
	expect(next.structure?.walls[0].bulge).toBe(0); expect(next.structure?.walls[1]).toBe(document.structure.walls[1]); expect(next.objects).toBe(document.objects);
	expect(curveDocument({ calibration: null, objects: [] }, wall).structure).toBeUndefined();
	expect(curveError(document, wall)).toBeNull();
	expect(curveError(document, { ...room, geometry: { ...room.geometry, bulges: [2, 0, 0, 0] } })).not.toBeNull();
	const blockedHost = { ...document, structure: { ...document.structure, openings: [{ id: 'opening-a', kind: 'door' as const, hostId: wall.id, offset: 3900, width: 500, height: 2100, sill: 0 }] } };
	expect(curveError(blockedHost, wall)?.code).toBe('spatial.opening-containment');
});

it('starts precise radius entry from a straight edge and refuses nonfinite or collapsed input', () => {
	const edge = { start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, bulge: 0 };
	expect(typedBulge(edge, 'radius', '2.5')).toBeCloseTo(0.5, 14);
	expect(typedBulge({ ...edge, bulge: -0.2 }, 'radius', '2.5')).toBeCloseTo(-0.5, 14);
	expect(typedBulge(edge, 'depth', '9'.repeat(400))).toBeNull();
	const collapsed = { ...edge, end: edge.start };
	expect(typedBulge(collapsed, 'depth', '0')).toBeNull(); expect(bulgeAt(collapsed, { x: 10, y: 20 })).toBe(0);
});
