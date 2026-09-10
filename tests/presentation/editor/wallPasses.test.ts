/**
 * Each wall pass is its own butt-capped polyline, so two walls meeting at an L both stop at
 * the shared centreline point and the OUTER quadrant of the corner gets neither pass — the
 * 13 px notch the harness capture photographed at every Kitchen corner. Extending both passes
 * past a shared endpoint closes it; extending only the edge pass by 1 / zoom past a FREE end
 * is what draws that end's 1 px dark cap, since a wider butt stroke is not a longer one.
 */
import { describe, expect, it } from 'vitest';
import { wallPasses } from '../../../src/presentation/editor/structure/wallPasses';
import { arcPolyline } from '../../../src/core/geometry/curvePolyline';
import type { Wall } from '../../../src/domain/spatial/Structure';

const wall = (id: string, start: Wall['start'], end: Wall['end'], bulge?: number): Wall =>
	({ id, start, end, thickness: 240, height: 2600, ...(bulge === undefined ? {} : { bulge }) });
const north = wall('wall-n', { x: 0, y: 0 }, { x: 4000, y: 0 });
const east = wall('wall-e', { x: 4000, y: 0 }, { x: 4000, y: 3000 });
const south = wall('wall-s', { x: 4000, y: 3000 }, { x: 0, y: 3000 });

describe('wallPasses', () => {
	it('extends both passes past a shared joint, the edge 1 / zoom further than the body', () => {
		const passes = wallPasses(north, [north, east], 0.1);
		expect(passes.body.slice(2)).toEqual([4120, 0]);
		expect(passes.edge.slice(2)).toEqual([4130, 0]);
	});

	it('leaves a free end unextended in the body and 1 / zoom long in the edge, the dark cap', () => {
		const passes = wallPasses(north, [north], 0.1);
		expect(passes.body).toEqual([0, 0, 4000, 0]);
		expect(passes.edge).toEqual([-10, 0, 4010, 0]);
	});

	it('extends both ends of a wall that shares both', () => {
		const passes = wallPasses(east, [north, east, south], 0.1);
		expect(passes.body).toEqual([4000, -120, 4000, 3120]);
		expect(passes.edge).toEqual([4000, -130, 4000, 3130]);
	});

	it('extends a curved wall along its end tangent and keeps its interior vertices', () => {
		const arc = wall('wall-arc', { x: 0, y: 0 }, { x: 4000, y: 0 }, 1);
		const line = arcPolyline({ ...arc, bulge: 1 }, 0.25);
		const passes = wallPasses(arc, [arc], 1);
		expect(passes.edge).toHaveLength(line.length * 2);
		expect(passes.body).toEqual(line.flatMap(point => [point.x, point.y]));
		const extension = { x: passes.edge[0] - line[0].x, y: passes.edge[1] - line[0].y };
		const tangent = { x: line[0].x - line[1].x, y: line[0].y - line[1].y };
		expect(Math.hypot(extension.x, extension.y)).toBeCloseTo(1);
		expect(extension.x * tangent.y - extension.y * tangent.x).toBeCloseTo(0);
		expect(extension.x * tangent.x + extension.y * tangent.y).toBeGreaterThan(0);
		// A semicircle leaves its start perpendicular to the chord, not along it.
		expect(Math.abs(extension.y)).toBeGreaterThan(Math.abs(extension.x));
	});
});
