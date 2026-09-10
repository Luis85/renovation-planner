import { expect, it } from 'vitest';
import { roomEdges, roomSketchPoints } from '../../../src/presentation/editor/resize/roomEdgeMeasurements';
import { rotationPoints, rotationPivot } from '../../../src/presentation/editor/elements/objectRotation';
import { expectDefined } from '../../helpers/domain';

const points = [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 }];
it('measures every actual edge of a rotated rectangle without substituting its world extents', () => {
	const shape = { id: 'room', kind: 'room' as const, points };
	const rotated = expectDefined(rotationPoints(shape, 37, expectDefined(rotationPivot(shape), 'pivot')), 'rotated outline');
	expect(roomEdges(rotated, true).map(edge => Math.round(edge.length))).toEqual([4000, 3000, 4000, 3000]);
	expect(roomEdges(rotated, true, true)).toHaveLength(4);
	expect(roomEdges(points, true, true).map(edge => edge.index)).toEqual([1, 2]);
});
it('retains every concave edge and places normals outside either winding', () => {
	const concave = [...points.slice(0, 2), { x: 4000, y: 1000 }, { x: 1000, y: 1000 }, { x: 1000, y: 3000 }, { x: 0, y: 3000 }];
	expect(roomEdges(concave, true).map(edge => edge.length)).toEqual([4000, 1000, 3000, 2000, 1000, 3000]);
	const forward = roomEdges(points, true)[0], reverse = expectDefined(roomEdges(points.toReversed(), true).find(edge => edge.midpoint.y === 0), 'same upper edge');
	expect(forward.normal.x).toBeCloseTo(reverse.normal.x); expect(forward.normal.y).toBeCloseTo(reverse.normal.y);
	expect(forward.normal.y).toBe(-1);
});
it('shows only placed and proposed sketch segments until closure, skipping zero or invalid lengths', () => {
	expect(roomSketchPoints(null)).toEqual([]);
	expect(roomSketchPoints({ vertices: [], pointer: points[0], nextVertex: points[0] })).toEqual([]);
	const placed = points.slice(0, 2);
	expect(roomSketchPoints({ vertices: placed, pointer: points[1], nextVertex: points[1] })).toEqual(placed);
	const proposed = roomSketchPoints({ vertices: placed, pointer: points[2], nextVertex: points[2] });
	expect(roomEdges(proposed, false).map(edge => edge.length)).toEqual([4000, 3000]);
	expect(roomEdges(proposed, true)).toHaveLength(3);
	expect(roomEdges([points[0], points[0], { x: Infinity, y: 0 }], false)).toEqual([]);
});
