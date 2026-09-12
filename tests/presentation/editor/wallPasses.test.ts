/**
 * Walls meeting end to end, two at a joint and equally thick, are chained into ONE run whose
 * stroke Konva mitres, so the corner is exact at any angle — the separately capped walls this
 * replaced overlapped into wedges wherever a joint was not a right angle. Every other run end is
 * butt-capped: a T's stem is carried until its far corner meets the host's far face, at any angle;
 * past any other shared endpoint (a change of thickness) both passes are extended by the joined
 * walls' half thickness; and past a FREE end only the edge pass, by 1 / zoom, which is what draws
 * that end's 1 px dark cap, since a wider butt stroke is not a longer one.
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
const west = wall('wall-w', { x: 0, y: 3000 }, { x: 0, y: 0 });
/** How far across a host along y = 0 a run's butt-capped START reaches on the host's far (negative y) side, for a stroke `width` wide. */
function farCorner(points: readonly number[], width: number): number {
	const [x0, y0, x1, y1] = points, length = Math.hypot(x1 - x0, y1 - y0);
	return y0 - Math.abs((x1 - x0) / length) * width / 2;
}

describe('wallPasses', () => {
	it('chains an L of equal walls into one open run, capping only its free ends', () => {
		const [run, ...rest] = wallPasses([north, east], 0.1);
		expect(rest).toHaveLength(0);
		expect(run.closed).toBe(false);
		expect(run.body).toEqual([0, 0, 4000, 0, 4000, 3000]);
		expect(run.edge).toEqual([-10, 0, 4000, 0, 4000, 3010]);
	});

	it('chains a closed loop into one closed run with no repeated corner, at any angle', () => {
		const slanted = { ...west, start: { x: 700, y: 3000 } }, bottom = { ...south, end: { x: 700, y: 3000 } };
		const [run, ...rest] = wallPasses([north, east, bottom, slanted], 0.1);
		expect(rest).toHaveLength(0);
		expect(run.closed).toBe(true);
		expect(run.body).toEqual([0, 0, 4000, 0, 4000, 3000, 700, 3000]);
		expect(run.edge).toEqual(run.body);
	});

	it('follows a wall drawn the other way round, from whichever wall is listed first', () => {
		const reversed = wall('wall-r', { x: 4000, y: 3000 }, { x: 4000, y: 0 });
		const [run, ...rest] = wallPasses([reversed, north], 0.1);
		expect(rest).toHaveLength(0);
		expect(run.body).toEqual([4000, 3000, 4000, 0, 0, 0]);
	});

	it('extends a joint by the JOINED wall\'s half thickness, so neither wall of an unequal L pokes past the other', () => {
		const thin = { ...wall('wall-thin', { x: 0, y: 0 }, { x: 4000, y: 0 }), thickness: 100 };
		const thick = wall('wall-thick', { x: 4000, y: 0 }, { x: 4000, y: 3000 });
		const [thinPasses, thickPasses] = wallPasses([thin, thick], 0.1);
		expect(thinPasses.body.slice(2)).toEqual([4120, 0]);
		expect(thinPasses.edge.slice(2)).toEqual([4130, 0]);
		expect(thickPasses.body.slice(0, 2)).toEqual([4000, -50]);
		expect(thickPasses.edge.slice(0, 2)).toEqual([4000, -60]);
	});

	it('leaves a free end unextended in the body and 1 / zoom long in the edge, the dark cap', () => {
		const [passes] = wallPasses([north], 0.1);
		expect(passes.body).toEqual([0, 0, 4000, 0]);
		expect(passes.edge).toEqual([-10, 0, 4010, 0]);
	});

	it('does not chain through a T, extending each of its three walls past the joint', () => {
		const onward = wall('wall-o', { x: 4000, y: 0 }, { x: 8000, y: 0 });
		const runs = wallPasses([north, onward, east], 0.1);
		expect(runs).toHaveLength(3);
		expect(runs[0].body.slice(2)).toEqual([4120, 0]);
		expect(runs[1].body.slice(0, 2)).toEqual([3880, 0]);
		expect(runs[2].body.slice(0, 2)).toEqual([4000, -120]);
	});

	it('stops a T\'s stem where its far corner meets the host\'s far face, at any angle, so it never pokes through', () => {
		// The host runs along y = 0 (far face y = -120), split at x = 4000; the stem leaves the joint 71.6° off it.
		const onward = wall('wall-o', { x: 4000, y: 0 }, { x: 8000, y: 0 }), stem = wall('wall-stem', { x: 4000, y: 0 }, { x: 5000, y: 3000 });
		const [, , passes] = wallPasses([north, onward, stem], 0.1);
		expect(farCorner(passes.body, 240)).toBeCloseTo(-120);
		// The edge pass is 2 / zoom wider, so its corner meets the far side of the host's own 1 px dark line.
		expect(farCorner(passes.edge, 240 + 2 / 0.1)).toBeCloseTo(-130);
	});

	it('pulls a stem too thick for its host at a shallow angle back behind the joint rather than through the far face', () => {
		const onward = wall('wall-o', { x: 4000, y: 0 }, { x: 8000, y: 0 }), stem = { ...wall('wall-stem', { x: 4000, y: 0 }, { x: 7000, y: 1000 }), thickness: 600 };
		const [, , passes] = wallPasses([north, onward, stem], 0.1);
		expect(farCorner(passes.body, 600)).toBeCloseTo(-120);
		expect(passes.body[1]).toBeGreaterThan(0);
	});

	it('extends a curved wall along its end tangent and keeps its interior vertices', () => {
		const arc = wall('wall-arc', { x: 0, y: 0 }, { x: 4000, y: 0 }, 1);
		const line = arcPolyline({ ...arc, bulge: 1 }, 0.25);
		const [passes] = wallPasses([arc], 1);
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
