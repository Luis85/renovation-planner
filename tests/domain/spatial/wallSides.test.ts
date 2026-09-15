import { describe, expect, it } from 'vitest';
import type { Structure, Wall } from '../../../src/domain/spatial/Structure';
import { asymmetricWall, scaleWallSides, validWallSides, wallSideExtents, withWallSideExtents } from '../../../src/domain/spatial/wallSides';
import { validWallFaceCurve, wallFacePoint, wallFacePoints } from '../../../src/domain/spatial/wallFaceGeometry';
import { independentWallNetwork, wallSideGeometryIssue, wallSideNetworkGeometry } from '../../../src/domain/spatial/wallSideNetwork';
import { validateStructure } from '../../../src/domain/spatial/structureGeometry';
import { wallPasses } from '../../../src/presentation/editor/structure/wallPasses';
import { sameGeometryDocument } from '../../../src/application/commands/spatial/sameGeometryDocument';

const base: Wall = { id: 'wall-a', start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, height: 2400, thickness: 150 };
const floor = (walls: readonly Wall[]): Structure => ({ walls, openings: [], boundaries: [] });
const changed = (wall: Wall, a: number, b: number): Wall => ({ ...wall, thickness: a + b, sideExtents: { a, b } });

describe('independent directed wall extents', () => {
	it('resolves exact legacy halves and keeps the incumbent paint for centred networks', () => {
		for (const thickness of [1, 157, 150.25, 999999.5]) {
			const wall = { ...base, thickness }, resolved = { ...wall, sideExtents: wallSideExtents(wall) };
			expect(wallSideExtents(wall)).toEqual({ a: thickness / 2, b: thickness / 2 });
			expect(validWallSides(resolved)).toBe(true); expect(asymmetricWall(resolved)).toBe(false);
			expect(wallPasses([wall], 0.1)).toEqual(wallPasses([resolved], 0.1));
			expect(wallSideNetworkGeometry([resolved]).bodies).toEqual([]);
		}
	});
	it('moves only A or only B, preserves references and distinguishes a same-total shift', () => {
		const wall = changed(base, 75, 75), before = floor([wall]);
		const a = withWallSideExtents(before, wall.id, { a: 85, b: 75 });
		if (!a) throw new Error('A change refused');
		expect(a.walls[0].start).toBe(wall.start); expect(a.walls[0].end).toBe(wall.end);
		expect(wallFacePoints(a.walls[0], 'b')).toEqual(wallFacePoints(wall, 'b'));
		expect(wallFacePoint(a.walls[0], 'a', 0.5)).toEqual({ x: 2000, y: -85 });
		const b = withWallSideExtents(a, wall.id, { a: 85, b: 65 });
		if (!b) throw new Error('B change refused');
		expect(wallFacePoints(b.walls[0], 'a')).toEqual(wallFacePoints(a.walls[0], 'a'));
		expect(b.walls[0].thickness).toBe(wall.thickness);
		expect(sameGeometryDocument({ objects: [], calibration: null, structure: before }, { objects: [], calibration: null, structure: b })).toBe(false);
	});
	it.each([{ a: -1, b: 100 }, { a: 0, b: 0 }, { a: NaN, b: 10 }, { a: 1, b: Infinity }, { a: 1e6, b: 1 }])('refuses invalid extents %s', sides => {
		expect(withWallSideExtents(floor([base]), base.id, sides)).toBeNull();
		expect(validWallSides({ thickness: 150, sideExtents: sides })).toBe(false);
	});
	it('allows a face on the datum, rejects inconsistent totals/missing walls, and scales both distances', () => {
		expect(withWallSideExtents(floor([base]), base.id, { a: 0, b: 1 })?.walls[0].thickness).toBe(1);
		expect(withWallSideExtents(floor([base]), 'wall-gone', { a: 10, b: 20 })).toBeNull();
		expect(validWallSides({ thickness: 150, sideExtents: { a: 100, b: 100 } })).toBe(false);
		expect(validWallSides({ thickness: 150, sideExtents: null as never })).toBe(false);
		expect(scaleWallSides(changed(base, 120, 30), 2)).toEqual({ thickness: 300, sideExtents: { a: 240, b: 60 } });
		expect(scaleWallSides(base, 2)).toEqual({ thickness: 300 });
	});
	it('preserves physical faces when direction and side identities are reversed, including an arc', () => {
		for (const bulge of [0, 0.5, -0.5]) {
			const wall = changed({ ...base, bulge }, 110, 70), reversed = { ...wall, start: wall.end, end: wall.start, bulge: -bulge, sideExtents: { a: 70, b: 110 } };
			for (const fraction of [0, 0.25, 0.5, 0.75, 1]) {
				const a = wallFacePoint(wall, 'a', fraction), b = wallFacePoint(reversed, 'b', 1 - fraction);
				expect(a.x).toBeCloseTo(b.x, 7); expect(a.y).toBeCloseTo(b.y, 7);
			}
		}
	});
});

describe('face-aware joins and curved limits', () => {
	it('fills a real outside L mitre without changing the connected reference points', () => {
		const a = changed(base, 120, 30), b = changed({ ...base, id: 'wall-b', end: { x: 0, y: 3000 } }, 80, 60);
		const geometry = wallSideNetworkGeometry([a, b]);
		expect([...geometry.ids]).toEqual(['wall-a', 'wall-b']);
		expect(geometry.joins).toHaveLength(1);
		expect(geometry.joins[0].points).toContainEqual({ x: -60, y: -120 });
		expect(a.start).toEqual(b.start); expect(validateStructure(floor([a, b]), []).ok).toBe(true);
	});
	it('clips each straight T-stem face to the asymmetric host far face', () => {
		const west = changed({ ...base, id: 'wall-west', start: { x: -4000, y: 0 }, end: { x: 0, y: 0 } }, 100, 50);
		const east = changed(base, 100, 50), stem = changed({ ...base, id: 'wall-stem', start: { x: -3000, y: -3000 }, end: { x: 0, y: 0 } }, 300, 400);
		const walls = [west, east, stem], geometry = wallSideNetworkGeometry(walls);
		const body = geometry.bodies.find(item => item.id === stem.id);
		expect(body?.points.length).toBeGreaterThan(3); expect(body?.points.every(point => point.y <= 50 + 1e-7)).toBe(true);
		expect(wallSideGeometryIssue(walls)).toBeNull();
		expect(wallFacePoints(changed(stem, 310, 400), 'b')).toEqual(wallFacePoints(stem, 'b'));
	});
	it('bevels an extreme outside mitre and leaves disconnected centred walls on their legacy path', () => {
		const a = changed(base, 100, 110), b = { ...base, id: 'wall-b', end: { x: 4000 * Math.cos(Math.PI / 18), y: 4000 * Math.sin(Math.PI / 18) } };
		const separate = { ...base, id: 'wall-separate', start: { x: 0, y: 5000 }, end: { x: 4000, y: 5000 } };
		const geometry = wallSideNetworkGeometry([a, b, separate]);
		expect(geometry.joins[0].points).toHaveLength(3); expect(geometry.ids.has(separate.id)).toBe(false);
		expect(independentWallNetwork([separate]).size).toBe(0);
	});
	it('keeps an arc’s opposite face fixed and refuses an inside radius collapse only for independent networks', () => {
		const arc = changed({ ...base, bulge: 0.5 }, 100, 200), edited = changed(arc, 110, 200);
		expect(wallFacePoints(arc, 'b')).toEqual(wallFacePoints(edited, 'b'));
		expect(wallFacePoint(edited, 'a', 0.5).y).toBeCloseTo(-1110, 6);
		expect(validWallFaceCurve(edited)).toBe(true);
		const collapsed = changed(arc, 100, 2500);
		expect(wallSideGeometryIssue([collapsed])).toEqual({ wallId: arc.id, kind: 'curve-radius' });
		expect(validateStructure(floor([collapsed]), []).ok).toBe(false);
		expect(wallSideNetworkGeometry([collapsed]).bodies[0].points).toEqual([]);
		expect(wallSideGeometryIssue([{ ...base, bulge: 0.5, thickness: 5000 }])).toBeNull();
	});
	it('refuses curved host clipping analytically, independently of render sampling', () => {
		const west = changed({ ...base, id: 'wall-west', start: { x: -4000, y: 0 }, end: { x: 0, y: 0 } }, 100, 50);
		const east = changed(base, 100, 50), stem = changed({ ...base, id: 'wall-curve', start: { x: -3000, y: -3000 }, end: { x: 0, y: 0 }, bulge: 0.1 }, 300, 400);
		const walls = [west, east, stem];
		expect(wallSideGeometryIssue(walls)).toEqual({ wallId: stem.id, kind: 'curved-junction' });
		for (const tolerance of [0.1, 100]) expect(wallSideNetworkGeometry(walls, tolerance).bodies.find(item => item.id === stem.id)?.points).toEqual([]);
	});
});
