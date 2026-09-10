import { expect, it } from 'vitest';
import { DEFAULT_STAIR, stairPlanGeometry, stairWithRun, spatialElementFootprint } from '../../../src/domain/spatial/stairGeometry';
import { rotate } from '../../../src/core/geometry/operations';
import { expectDefined } from '../../helpers/domain';
const centreline = [{ x: 1000, y: 5000 }, { x: 1000, y: 2000 }];
it('derives the complete straight-stair footprint, evenly spaced treads and direction from one centreline', () => {
	const geometry = expectDefined(stairPlanGeometry(centreline, DEFAULT_STAIR), 'stair projection');
	expect(geometry.run).toBe(3000); expect(geometry.treads).toHaveLength(11);
	expect(geometry.outline).toEqual([{ x: 550, y: 5000 }, { x: 550, y: 2000 }, { x: 1450, y: 2000 }, { x: 1450, y: 5000 }]);
	expect(geometry.treads[0]).toEqual([{ x: 550, y: 4750 }, { x: 1450, y: 4750 }]);
	const down = expectDefined(stairPlanGeometry(centreline, { ...DEFAULT_STAIR, direction: 'down' }), 'down projection');
	expect(down.outline).toEqual(geometry.outline); expect(down.indicator).toEqual(geometry.indicator.toReversed());
});
it('projects a rotated stair footprint consistently while keeping its stored width unchanged', () => {
	const before = expectDefined(stairPlanGeometry(centreline, DEFAULT_STAIR), 'stair projection'), pivot = { x: 1000, y: 3500 }, angle = Math.PI / 7;
	const points = rotate({ points: centreline }, angle, pivot).points;
	const actual = expectDefined(stairPlanGeometry(points, DEFAULT_STAIR), 'rotated projection').outline;
	const expected = rotate({ points: before.outline }, angle, pivot).points;
	actual.forEach((point, index) => { expect(point.x).toBeCloseTo(expected[index].x, 6); expect(point.y).toBeCloseTo(expected[index].y, 6); });
	expect(spatialElementFootprint({ kind: 'stair', points, stair: DEFAULT_STAIR })).toEqual(actual);
	expect(spatialElementFootprint({ kind: 'arrow', points })).toBe(points);
});
it('refuses missing, collapsed, excessive and out-of-bounds stair geometry', () => {
	expect(stairPlanGeometry(centreline.slice(0, 1), DEFAULT_STAIR)).toBeNull();
	expect(stairPlanGeometry([centreline[0], centreline[0]], DEFAULT_STAIR)).toBeNull();
	expect(stairPlanGeometry(centreline, { ...DEFAULT_STAIR, width: 0 })).toBeNull();
	expect(stairPlanGeometry(centreline, { ...DEFAULT_STAIR, treads: 201 })).toBeNull();
	expect(stairPlanGeometry([{ x: 1e9, y: 0 }, { x: 1e9, y: 3000 }], DEFAULT_STAIR)).toBeNull();
	expect(spatialElementFootprint({ kind: 'stair', points: centreline })).toEqual([]);
});
it('anchors exact run changes at the start and keeps the existing bearing', () => {
	expect(stairWithRun(centreline, 4500)).toEqual([centreline[0], { x: 1000, y: 500 }]);
	expect(stairWithRun(centreline, 0)).toBeNull();
});
