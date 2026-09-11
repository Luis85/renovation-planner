import { describe, expect, it } from 'vitest';
import { arcPoint } from '../../../src/core/geometry/circularArc';
import { edgeSupports, offsetOutline, outwardDistance } from '../../../src/core/geometry/offsetOutline';
import { expectOk } from '../../helpers/domain';

const at = (x: number, y: number) => ({ x, y });
const rectangle = [at(0, 0), at(4000, 0), at(4000, 3000), at(0, 3000)];

describe('offsetOutline', () => {
	it('moves every edge outward and mitres the corners, whichever way the outline winds', () => {
		expect(expectOk(offsetOutline({ points: rectangle }, [75, 75, 75, 75])).points).toEqual([at(-75, -75), at(4075, -75), at(4075, 3075), at(-75, 3075)]);
		expect(expectOk(offsetOutline({ points: [at(0, 3000), at(4000, 3000), at(4000, 0), at(0, 0)] }, [75, 75, 75, 75])).points).toEqual([at(-75, 3075), at(4075, 3075), at(4075, -75), at(-75, -75)]);
	});
	it('moves inward for a negative distance', () => {
		expect(expectOk(offsetOutline({ points: rectangle }, [-75, -75, -75, -75])).points).toEqual([at(75, 75), at(3925, 75), at(3925, 2925), at(75, 2925)]);
	});
	it('keeps an edge with no distance on its own line and returns an untouched outline exactly', () => {
		expect(expectOk(offsetOutline({ points: rectangle }, [0, 75, 75, 75])).points).toEqual([at(-75, 0), at(4075, 0), at(4075, 3075), at(-75, 3075)]);
		const curved = { points: rectangle, bulges: [0.25, 0, 0, 0] };
		expect(expectOk(offsetOutline(curved, [0, 0, 0, 0]))).toEqual(curved);
	});
	it('pulls a reflex corner back along both edges', () => {
		const ell = [at(0, 0), at(4000, 0), at(4000, 2000), at(2000, 2000), at(2000, 4000), at(0, 4000)];
		expect(expectOk(offsetOutline({ points: ell }, ell.map(() => 100))).points).toEqual([at(-100, -100), at(4100, -100), at(4100, 2100), at(2100, 2100), at(2100, 4100), at(-100, 4100)]);
	});
	it('offsets a curved edge concentrically and meets its straight neighbours on the larger circle', () => {
		const result = expectOk(offsetOutline({ points: rectangle, bulges: [0.25, 0, 0, 0] }, [75, 75, 75, 75]));
		const [first, second] = result.points, centre = at(2000, 3750);
		expect(first.x).toBe(-75); expect(second.x).toBe(4075);
		for (const corner of [first, second]) expect(Math.hypot(corner.x - centre.x, corner.y - centre.y)).toBeCloseTo(4325, 9);
		expect(arcPoint({ start: first, end: second, bulge: result.bulges?.[0] ?? 0 }, 0.5).y).toBeCloseTo(3750 - 4325, 9);
		expect(result.bulges?.slice(1)).toEqual([0, 0, 0]);
	});
	it('meets two arcs on their offset circles and keeps a tangent semicircle exact', () => {
		const radius = 2000, quarter = Math.tan(Math.PI / 8);
		const circle = expectOk(offsetOutline({ points: [at(radius, 0), at(0, radius), at(-radius, 0), at(0, -radius)], bulges: [quarter, quarter, quarter, quarter] }, [100, 100, 100, 100]));
		for (const [index, expected] of [at(2100, 0), at(0, 2100), at(-2100, 0), at(0, -2100)].entries()) {
			expect(circle.points[index].x).toBeCloseTo(expected.x, 9); expect(circle.points[index].y).toBeCloseTo(expected.y, 9);
		}
		for (const bulge of circle.bulges ?? []) expect(bulge).toBeCloseTo(quarter, 12);
		const stadium = expectOk(offsetOutline({ points: [at(0, 0), at(4000, 0), at(4000, 2000), at(0, 2000)], bulges: [0, 1, 0, 0] }, [100, 100, 100, 100]));
		expect(stadium).toEqual({ points: [at(-100, -100), at(4000, -100), at(4000, 2100), at(-100, 2100)], bulges: [0, 1, 0, 0] });
		const clockwise = expectOk(offsetOutline({ points: [at(0, 2000), at(4000, 2000), at(4000, 0), at(0, 0)], bulges: [0, -1, 0, 0] }, [100, 100, 100, 100]));
		expect(clockwise).toEqual({ points: [at(-100, 2100), at(4000, 2100), at(4000, -100), at(-100, -100)], bulges: [0, -1, 0, 0] });
	});
	it('meets two curved edges at an angle on both moved circles', () => {
		const shape = { points: [at(0, 0), at(4000, 0), at(2000, 3000)], bulges: [0.2, 0.2, 0] };
		const corner = expectOk(offsetOutline(shape, [100, 100, 100])).points[1], [first, second] = edgeSupports(shape);
		expect(outwardDistance(first, corner)).toBeCloseTo(100, 9); expect(outwardDistance(second, corner)).toBeCloseTo(100, 9);
	});
	it('grows an outward semicircle past half a circle when its neighbours lean in, a bend walls then refuse', () => {
		const moved = expectOk(offsetOutline({ points: [at(0, 0), at(4000, 0), at(3000, 3000), at(1000, 3000)], bulges: [1, 0, 0, 0] }, [100, 100, 100, 100]));
		expect(moved.bulges?.[0]).toBeGreaterThan(1);
	});
	it('passes straight through a collinear corner whose two edges move the same distance', () => {
		const points = [at(0, 0), at(2000, 0), at(4000, 0), at(4000, 3000), at(0, 3000)];
		expect(expectOk(offsetOutline({ points }, points.map(() => 50))).points[1]).toEqual(at(2000, -50));
	});
	it('refuses a corner the two moved edges can no longer meet at, and an arc offset past its centre', () => {
		const points = [at(0, 0), at(2000, 0), at(4000, 0), at(4000, 3000), at(0, 3000)];
		expect(offsetOutline({ points }, [0, 75, 75, 75, 75])).toMatchObject({ ok: false, error: { category: 'Geometry', code: 'outline-offset-unsolvable' } });
		const bay = { points: [at(0, 0), at(200, 0), at(200, 3000), at(0, 3000)], bulges: [1, 0, 0, 0] };
		expect(offsetOutline(bay, [-150, 0, 0, 0])).toMatchObject({ ok: false, error: { code: 'outline-offset-unsolvable' } });
		const stadium = { points: [at(0, 0), at(4000, 0), at(4000, 2000), at(0, 2000)], bulges: [0, 1, 0, 0] };
		expect(offsetOutline(stadium, [0, -100, 0, 0])).toMatchObject({ ok: false, error: { code: 'outline-offset-unsolvable' } });
		const radius = 2000, quarter = Math.tan(Math.PI / 8), circle = { points: [at(radius, 0), at(0, radius), at(-radius, 0), at(0, -radius)], bulges: [quarter, quarter, quarter, quarter] };
		expect(offsetOutline(circle, [100, 0, 0, 0])).toMatchObject({ ok: false, error: { code: 'outline-offset-unsolvable' } });
	});
});

describe('outwardDistance', () => {
	it('measures along the outward normal of a line and radially from a curve', () => {
		const [north, east] = edgeSupports({ points: rectangle, bulges: [0.25, 0, 0, 0] });
		expect(outwardDistance(east, at(4100, 1500))).toBe(100);
		expect(outwardDistance(east, at(3900, 9000))).toBe(-100);
		expect(outwardDistance(north, at(2000, 3750 - 4325))).toBeCloseTo(75, 9);
		const [inward] = edgeSupports({ points: rectangle, bulges: [-0.25, 0, 0, 0] });
		expect(outwardDistance(inward, at(2000, 500 - 75))).toBeCloseTo(75, 9);
	});
});
