import { expect, it } from 'vitest';
import { bulgeAt, curveDocument, curveEdges, curveError, curveText, typedBulge, withCurve } from '../../../src/presentation/editor/curves/curveDraft';
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
