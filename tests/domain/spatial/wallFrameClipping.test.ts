import { expect, it } from 'vitest';
import { clipWallPolyline, type WallClip } from '../../../src/domain/spatial/wallSideJunctions';
import { openingSymbol } from '../../../src/domain/spatial/openingGeometry';
import type { Opening, Wall } from '../../../src/domain/spatial/Structure';

it('retains a legacy continuous stroke and omits paths with fewer than two points', () => {
	const points = [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 4, y: 1 }];
	expect(clipWallPolyline(points, [])[0]).toBe(points);
	expect(clipWallPolyline([], [])).toEqual([]); expect(clipWallPolyline([points[0]], [])).toEqual([]);
});

it('splits across an excluded span without a false connecting line or a dot at a tangent touch', () => {
	const clips: WallClip[] = [{ point: { x: 0, y: 0 }, normal: { x: 0, y: -1 }, distance: 0 }];
	const points = [{ x: -2, y: -1 }, { x: -1, y: -1 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: -1 }, { x: 3, y: -1 }];
	expect(clipWallPolyline(points, clips)).toEqual([
		[{ x: -2, y: -1 }, { x: -1, y: -1 }, { x: -0.5, y: 0 }],
		[{ x: 1.5, y: 0 }, { x: 2, y: -1 }, { x: 3, y: -1 }],
	]);
	expect(clipWallPolyline([{ x: 0, y: 1 }, { x: 1, y: 0 }, { x: 2, y: 1 }], clips)).toEqual([]);
});

it('clips jambs and window frame lines while preserving the door leaf and swing geometry', () => {
	const wall: Wall = { id: 'wall-a', start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, height: 2400, thickness: 150, sideExtents: { a: 100, b: 50 } };
	const door: Opening = { id: 'opening-a', kind: 'door', hostId: wall.id, offset: 500, width: 900, height: 2100, sill: 0, swing: { hinge: 'end', side: 'left', angle: 120 } };
	const clips: WallClip[] = [{ point: wall.start, normal: { x: 0, y: 1 }, distance: 0 }];
	const original = openingSymbol(door, wall), clipped = openingSymbol(door, wall, 1, clips);
	expect(clipped.frame.flat().every(point => point.y >= -1e-8)).toBe(true);
	expect(clipped.leaf).toEqual(original.leaf); expect(clipped.arc).toEqual(original.arc); expect(clipped.leaf[1].y).toBeLessThan(0);
	const window = openingSymbol({ ...door, kind: 'window', swing: { hinge: 'start', side: 'left', angle: 0 } }, wall, 1, clips);
	expect(window.frame).toHaveLength(3); expect(window.frame.flat().every(point => point.y >= -1e-8)).toBe(true);
});
