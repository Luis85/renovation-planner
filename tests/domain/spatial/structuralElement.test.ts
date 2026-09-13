import { describe, expect, it } from 'vitest';
import { closedFootprintKind, derivedFootprintKind, outlineKind, validSpatialElement, type SpatialElement } from '../../../src/domain/spatial/SpatialElement';
import { beamOutline, DEFAULT_BEAM_WIDTH, DEFAULT_POST_SECTION, postOutline, postSection, resizedPost } from '../../../src/domain/spatial/structuralElement';
import { spatialElementFootprint } from '../../../src/domain/spatial/stairGeometry';
import { scaleStructure } from '../../../src/domain/spatial/structureGeometry';
import { groupPoints } from '../../../src/domain/spatial/groupGeometry';
import { EMPTY_STRUCTURE } from '../../../src/domain/spatial/Structure';

const post: SpatialElement = { id: 'element-post', kind: 'post', loadBearing: true, points: postOutline({ x: 1000, y: 500 }, 140, 140) };
const beam: SpatialElement = { id: 'element-beam', kind: 'beam', loadBearing: true, width: 160, points: [{ x: 0, y: 0 }, { x: 3000, y: 0 }] };

describe('structural posts and beams', () => {
	it('draws a post as its cross-section centred on a point and reads the section back', () => {
		expect(post.points).toEqual([{ x: 930, y: 430 }, { x: 1070, y: 430 }, { x: 1070, y: 570 }, { x: 930, y: 570 }]);
		expect(postSection(post.points)).toEqual({ width: 140, depth: 140 });
		expect(postSection(post.points.slice(0, 3))).toBeNull();
		expect(DEFAULT_POST_SECTION).toEqual({ width: 140, depth: 140 });
		expect(DEFAULT_BEAM_WIDTH).toBe(160);
	});

	it('resizes a rotated post about its centre and keeps the bearing of its first edge', () => {
		const rotated = [{ x: 0, y: -100 }, { x: 100, y: 0 }, { x: 0, y: 100 }, { x: -100, y: 0 }];
		const resized = resizedPost(rotated, 200, 100);
		if (resized === null) throw new Error('a four-corner post resizes');
		const section = postSection(resized);
		expect(section?.width).toBeCloseTo(200); expect(section?.depth).toBeCloseTo(100);
		expect(resized.reduce((sum, point) => sum + point.x, 0) / 4).toBeCloseTo(0);
		expect(resized.reduce((sum, point) => sum + point.y, 0) / 4).toBeCloseTo(0);
		expect(Math.atan2(resized[1].y - resized[0].y, resized[1].x - resized[0].x)).toBeCloseTo(Math.PI / 4);
		expect(resizedPost(rotated.slice(0, 3), 200, 100)).toBeNull();
	});

	it('widens a beam axis into the band it covers and refuses a degenerate axis', () => {
		expect(beamOutline(beam.points, 160)).toEqual([{ x: 0, y: 80 }, { x: 3000, y: 80 }, { x: 3000, y: -80 }, { x: 0, y: -80 }]);
		expect(beamOutline([{ x: 0, y: 0 }, { x: 0, y: 0 }], 160)).toEqual([]);
		expect(beamOutline(beam.points, 0)).toEqual([]);
		expect(spatialElementFootprint(beam)).toEqual(beamOutline(beam.points, 160));
		expect(spatialElementFootprint(post)).toEqual(post.points);
	});

	it('holds a post and a beam to their own fields, and every other kind to none of them', () => {
		expect(validSpatialElement(post)).toBe(true);
		expect(validSpatialElement(beam)).toBe(true);
		expect(validSpatialElement({ ...beam, loadBearing: false })).toBe(true);
		const refused: SpatialElement[] = [
			{ ...post, loadBearing: undefined }, { ...post, width: 160 }, { ...post, points: post.points.slice(0, 2) },
			{ ...beam, width: undefined }, { ...beam, width: 0 }, { ...beam, width: Number.NaN }, { ...beam, width: 2e6 }, { ...beam, loadBearing: undefined },
			{ ...beam, points: [...beam.points, { x: 3000, y: 1000 }] }, { ...beam, points: [beam.points[0], beam.points[0]] },
			{ id: 'element-path', kind: 'path', points: beam.points, loadBearing: true }, { id: 'element-path', kind: 'path', points: beam.points, width: 160 },
		];
		for (const value of refused) expect(validSpatialElement(value)).toBe(false);
	});

	it('names which kinds are stored outlines and which draw a derived footprint', () => {
		expect(['object', 'post'].every(kind => outlineKind(kind))).toBe(true);
		expect(['stair', 'asset', 'beam'].every(kind => derivedFootprintKind(kind))).toBe(true);
		expect(['object', 'post', 'stair', 'asset', 'beam'].every(kind => closedFootprintKind(kind))).toBe(true);
		expect(['path', 'fence', 'measurement', 'arrow', undefined].some(kind => closedFootprintKind(kind))).toBe(false);
	});

	it('scales a beam width with calibration and frames a group by the beam band', () => {
		const structure = { ...EMPTY_STRUCTURE, elements: [post, beam] };
		const scaled = scaleStructure(structure, 2);
		expect(scaled.elements?.[1]).toMatchObject({ width: 320, points: [{ x: 0, y: 0 }, { x: 6000, y: 0 }] });
		expect(scaled.elements?.[0]).not.toHaveProperty('width');
		expect(groupPoints({ objects: [], structure }, [beam.id])).toEqual(beamOutline(beam.points, 160));
	});
});
