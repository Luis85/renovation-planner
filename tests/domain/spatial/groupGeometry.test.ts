import { expect, it } from 'vitest';
import { transformGroupGeometry, groupPoints } from '../../../src/domain/spatial/groupGeometry';
import type { Structure } from '../../../src/domain/spatial/Structure';
import type { GroupGeometry } from '../../../src/domain/spatial/groupGeometry';

const structureWithElements: Structure = {
	walls: [{ id: 'wall-a', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, height: 2400, thickness: 100 }],
	openings: [],
	boundaries: [],
	elements: [
		{ id: 'element-in', kind: 'path', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] },
		{ id: 'element-out', kind: 'path', points: [{ x: 5, y: 5 }, { x: 6, y: 6 }] },
	],
};

it('transformGroupGeometry moves a member element and leaves a non-member element untouched', () => {
	const objects = [{ id: 'room-a', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] }];
	const result = transformGroupGeometry(objects, structureWithElements, ['room-a', 'wall-a', 'element-in'], point => ({ x: point.x + 100, y: point.y }));
	expect(result.objects[0].points).toEqual([{ x: 100, y: 0 }, { x: 110, y: 0 }]);
	expect(result.structure.elements?.find(item => item.id === 'element-in')?.points).toEqual([{ x: 100, y: 0 }, { x: 101, y: 1 }]);
	expect(result.structure.elements?.find(item => item.id === 'element-out')?.points).toEqual([{ x: 5, y: 5 }, { x: 6, y: 6 }]);
});

it('groupPoints tessellates a curved object, passes a straight object through, and reaches structure elements', () => {
	const geometry: GroupGeometry = {
		objects: [
			// A `bulges` array shorter than `points` leaves edges past index 0 without an entry
			// of their own, exactly like `curveContains.test.ts` and `curveMeasures.test.ts`.
			{ id: 'room-curved', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }], bulges: [1] },
			{ id: 'room-straight', points: [{ x: 20, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 10 }, { x: 20, y: 10 }] },
		],
		structure: structureWithElements,
	};
	const points = groupPoints(geometry, ['room-curved', 'room-straight', 'wall-a', 'element-in']);
	// The straight Room's own declared vertices pass through unchanged (the ternary's false arm).
	expect(points).toEqual(expect.arrayContaining([...geometry.objects[1].points]));
	// The curved edge's own extremum — this shape's math matches the one `operations.ts` proves
	// in "frames a curved boundary by its arc extrema" — is a point NO declared vertex is.
	expect(points.some(point => Math.abs(point.x - 5) < 1e-9 && Math.abs(point.y + 5) < 1e-9)).toBe(true);
	// The member element's points reached through the optional `structure.elements` chain.
	expect(points).toEqual(expect.arrayContaining([{ x: 0, y: 0 }, { x: 1, y: 1 }]));
	expect(points).not.toEqual(expect.arrayContaining([{ x: 5, y: 5 }]));
});
