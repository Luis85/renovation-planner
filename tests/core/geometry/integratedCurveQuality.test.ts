import { expect, it } from 'vitest';
import { area, perimeter, centroid, boundingBoxOf, contains, enclosesArea } from '../../../src/core/geometry/operations';
import { createCurvedPolygon, validateBulges } from '../../../src/core/geometry/CurvedPolygon';
import { encloseRoom } from '../../../src/domain/spatial/encloseRoom';
import { EMPTY_STRUCTURE } from '../../../src/domain/spatial/Structure';
import { DEFAULT_STAIR, spatialElementFootprint, stairPlanGeometry, stairWithRun } from '../../../src/domain/spatial/stairGeometry';
import { expectErr, expectOk } from '../../helpers/domain';

const points = [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }];
it.each([area, perimeter, centroid, boundingBoxOf])('refuses mismatched curve metadata in %s instead of silently measuring straight edges', measure => {
	expect(expectErr(measure({ points, bulges: [0.25] })).code).toBe('curve-edge-count');
});
it('refuses mismatched curve metadata in containment and area admission', () => {
	const shape = { points, bulges: [0.25] };
	expect(expectErr(contains(shape, { x: 100, y: 100 })).code).toBe('curve-edge-count'); expect(enclosesArea(shape)).toBe(false);
});
it.each([0, 1000])('refuses a curve without a representable chord/radius at separation %s', separation => {
	const shape = { points: [{ x: 0, y: 0 }, { x: separation, y: 0 }, { x: 1, y: 1 }], bulges: [Number.MIN_VALUE, 0, 0] };
	expect(expectErr(validateBulges(shape)).code).toBe('curve-chord-invalid');
});
it('refuses overlapping curved edges and preserves the supplied contour unchanged', () => {
	const shape = { points: [points[0], points[1], points[0], points[3]], bulges: [0.5, -0.5, 0, 0] }, before = structuredClone(shape);
	expect(expectErr(createCurvedPolygon(shape)).code).toBe('curve-self-intersection'); expect(shape).toEqual(before);
});
it('keeps a representable curved centroid at extreme finite scale', () => {
	const shape = { points: points.map(point => ({ x: point.x * 1e147, y: point.y * 1e147 })), bulges: [0.5, 0, 0, 0] };
	expect(area(shape).ok).toBe(true);
	const centre = expectOk(centroid(shape));
	expect(centre.x / 1e150).toBeCloseTo(0.5, 12);
	// Rectangle plus the circular segment above its first edge.
	expect(centre.y / 1e150).toBeCloseTo(0.4104693034551985, 12);
});
it('refuses invalid enclosure input, duplicate wall identities and invalid dimensions without mutating the Room', () => {
	const room = { id: 'room-quality', points }, before = structuredClone(room);
	expect(encloseRoom({ ...room, points: points.slice(0, 2) }, EMPTY_STRUCTURE, { height: 2400, thickness: 150 }, () => 'wall-new').ok).toBe(false);
	expect(expectErr<{ readonly code: string }>(encloseRoom(room, EMPTY_STRUCTURE, { height: 2400, thickness: 150 }, () => 'wall-duplicate')).code).toBe('spatial.intersection');
	let id = 0;
	expect(encloseRoom(room, EMPTY_STRUCTURE, { height: -1, thickness: 150 }, () => `wall-${++id}`).ok).toBe(false);
	expect(room).toEqual(before); expect(EMPTY_STRUCTURE.walls).toEqual([]);
});
it.each([Infinity, NaN, 1e10])('refuses non-renderable Stair coordinates %s and never falls back to the centreline footprint', value => {
	const bad = [{ x: 0, y: value }, { x: 1000, y: 0 }];
	expect(stairPlanGeometry(bad, DEFAULT_STAIR)).toBeNull();
	expect(spatialElementFootprint({ kind: 'stair', points: bad, stair: DEFAULT_STAIR })).toEqual([]);
});
it('refuses a missing Stair profile and undefined centreline bearing rather than fabricating a footprint or run', () => {
	expect(spatialElementFootprint({ kind: 'stair', points })).toEqual([]);
	expect(stairWithRun([{ x: Infinity, y: 0 }, { x: 0, y: 0 }], 1000)).toBeNull();
	expect(stairWithRun([points[0], points[0]], 1000)).toBeNull();
});
