import { describe, expect, it } from 'vitest';
import type { CurvedPolygon } from '../../../src/core/geometry/CurvedPolygon';
import type { AssetDetail } from '../../../src/domain/asset/AssetDetail';
import { dimensionsOf, shapeFromDimensions, validateAssetShape, type AssetShape } from '../../../src/domain/asset/AssetShape';
import { expectErr, expectOk } from '../../helpers/domain';

/**
 * Spec 2026-09-13 Decisions 1–4: details are curved outlines, validated like a footprint, and the
 * footprint itself may curve. The bow-tie case is the v1 compatibility lock — a straight outline
 * gets exactly the validation it got before curves existed.
 */
const QUARTER = Math.tan(Math.PI / 8);
const circle = (radius: number): CurvedPolygon => ({
	points: [{ x: 0, y: -radius }, { x: radius, y: 0 }, { x: 0, y: radius }, { x: -radius, y: 0 }],
	bulges: [QUARTER, QUARTER, QUARTER, QUARTER],
});
const square = (half: number): CurvedPolygon => ({
	points: [{ x: -half, y: -half }, { x: half, y: -half }, { x: half, y: half }, { x: -half, y: half }],
});
const detail = (id: string, outline: CurvedPolygon, line: AssetDetail['line'] = 'solid'): AssetDetail => ({
	id, name: id, outline, line, pending: false,
});
const base = (): AssetShape => expectOk(shapeFromDimensions(1200, 800));

describe('asset details', () => {
	it('accepts a solid and a dashed detail and hands back copies, not the caller’s objects', () => {
		const input = { ...base(), details: [detail('top', circle(300)), detail('overhead', square(100), 'dashed')] };
		const shape = expectOk(validateAssetShape(input));
		(input.details[0].outline.points as { x: number; y: number }[])[0] = { x: 999, y: 999 };
		expect(shape.details.map((d) => [d.id, d.line])).toEqual([['top', 'solid'], ['overhead', 'dashed']]);
		expect(shape.details[0].outline.points[0]).toEqual({ x: 0, y: -300 });
	});

	it('refuses a repeated or empty detail id', () => {
		const repeated = { ...base(), details: [detail('a', square(10)), detail('a', square(20))] };
		expect(expectErr(validateAssetShape(repeated)).code).toBe('asset.invalid-detail-id');
		expect(expectErr(validateAssetShape({ ...base(), details: [detail('', square(10))] })).code).toBe('asset.invalid-detail-id');
	});

	it('refuses a detail that is not a polygon, and one that encloses no area', () => {
		const twoPoints = { points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] };
		const collinear = { points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }] };
		expect(expectErr(validateAssetShape({ ...base(), details: [detail('a', twoPoints)] })).code).toBe('asset.invalid-detail');
		expect(expectErr(validateAssetShape({ ...base(), details: [detail('a', collinear)] })).code).toBe('asset.degenerate-detail');
	});
});

describe('a curved footprint', () => {
	it('is a valid footprint whose dimensions are its diameter', () => {
		const shape = expectOk(validateAssetShape({ ...base(), footprint: circle(450) }));
		const { width, depth } = expectOk(dimensionsOf(shape.footprint));
		expect(width).toBeCloseTo(900, 9);
		expect(depth).toBeCloseTo(900, 9);
	});

	it('refuses a bulge beyond a semicircle under the footprint’s own code', () => {
		const tooRound = { ...square(100), bulges: [1.5, 0, 0, 0] };
		expect(expectErr(validateAssetShape({ ...base(), footprint: tooRound })).code).toBe('asset.invalid-footprint');
	});

	it('still accepts a straight self-crossing outline, and refuses it once an edge curves', () => {
		const bowTie = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 100 }, { x: 50, y: 100 }];
		expect(validateAssetShape({ ...base(), footprint: { points: bowTie } }).ok).toBe(true);
		const curved = { points: bowTie, bulges: [0.2, 0, 0, 0] };
		expect(expectErr(validateAssetShape({ ...base(), footprint: curved })).code).toBe('asset.invalid-footprint');
	});
});

/**
 * AD04's model extension, asked of the domain validator rather than of the schema: the two refuse
 * different things and neither subsumes the other. The schema counts points and types fields; only
 * this layer knows whether a group names a graphic that survived validation.
 */
const openDetail = (id: string, points: readonly { x: number; y: number }[], bulges?: readonly number[]): AssetDetail =>
	({ id, name: id, kind: 'open', line: 'solid', pending: false, outline: { points, ...(bulges === undefined ? {} : { bulges }) } }) as AssetDetail;

describe('open graphics, labels and groups (AD04)', () => {
	it('accepts a two-point open graphic, which a closed one could never be', () => {
		const shape = expectOk(validateAssetShape({ ...base(), details: [openDetail('swing', [{ x: 0, y: 0 }, { x: 300, y: 0 }])] }));
		expect(shape.details[0]).toMatchObject({ kind: 'open', id: 'swing' });
	});

	/** The open analogue of the area rule: a path is judged on LENGTH, never on what it encloses. */
	it('refuses an open graphic with no length, and does not ask it to enclose an area', () => {
		const flat = validateAssetShape({ ...base(), details: [openDetail('swing', [{ x: 5, y: 5 }, { x: 5, y: 5 }])] });
		expect(expectErr(flat).code).toBe('asset.invalid-detail');
	});

	it('refuses an open graphic whose bulge array is one per POINT, the closed shape-s arithmetic', () => {
		const wrong = validateAssetShape({ ...base(), details: [openDetail('swing', [{ x: 0, y: 0 }, { x: 300, y: 0 }], [0.5, 0])] });
		expect(expectErr(wrong).code).toBe('asset.invalid-detail');
	});

	/** A straight-sided open graphic is still open: nothing closes it on the way through. */
	it('keeps an open graphic open through validation rather than closing it', () => {
		const shape = expectOk(validateAssetShape({ ...base(), details: [openDetail('swing', [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 300 }])] }));
		expect(shape.details[0].kind).toBe('open');
	});

	it('carries a user label beside the stable semantic name, and leaves the name alone', () => {
		const labelled = { ...detail('bowl', circle(300)), label: 'Pan' };
		const shape = expectOk(validateAssetShape({ ...base(), details: [labelled] }));
		expect(shape.details[0]).toMatchObject({ name: 'bowl', label: 'Pan' });
	});

	it('omits the label entirely when there is none, rather than storing an empty one', () => {
		const shape = expectOk(validateAssetShape({ ...base(), details: [detail('bowl', circle(300))] }));
		expect(shape.details[0]).not.toHaveProperty('label');
	});

	const grouped = (groups: readonly { id: string; members: readonly string[] }[]): AssetShape =>
		({ ...base(), details: [detail('a', circle(300)), detail('b', square(100))], groups }) as AssetShape;

	it('accepts a group over graphics the shape really has', () => {
		const shape = expectOk(validateAssetShape(grouped([{ id: 'group-1', members: ['a', 'b'] }])));
		expect(shape.groups).toEqual([{ id: 'group-1', members: ['a', 'b'] }]);
	});

	it('answers an empty array for a shape with no groups at all', () => {
		expect(expectOk(validateAssetShape(base())).groups).toEqual([]);
	});

	/**
	 * Four refusals, one per way a membership can be wrong, and every one REFUSES rather than
	 * repairs (C06): a dropped dangling member or a de-duplicated membership would leave the file
	 * saying one thing and the loaded shape another.
	 */
	it.each([
		['a member no graphic carries', [{ id: 'group-1', members: ['a', 'ghost'] }], 'asset.dangling-group-member'],
		['a graphic in two groups', [{ id: 'group-1', members: ['a'] }, { id: 'group-2', members: ['a'] }], 'asset.overlapping-groups'],
		['the same member twice in one group', [{ id: 'group-1', members: ['a', 'a'] }], 'asset.overlapping-groups'],
		['two groups under one id', [{ id: 'group-1', members: ['a'] }, { id: 'group-1', members: ['b'] }], 'asset.invalid-group-id'],
		['an empty id', [{ id: '', members: ['a'] }], 'asset.invalid-group-id'],
		['no members at all', [{ id: 'group-1', members: [] }], 'asset.empty-group'],
	])('refuses %s', (_label, groups, code) => {
		expect(expectErr(validateAssetShape(grouped(groups))).code).toBe(code);
	});

	/** Membership is checked against the graphics that SURVIVED validation, never against the raw input. */
	it('refuses a group naming a graphic whose own geometry was refused', () => {
		const broken = { ...base(), details: [{ ...detail('a', { points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }] }) }], groups: [{ id: 'group-1', members: ['a'] }] };
		expect(expectErr(validateAssetShape(broken as AssetShape)).code).toBe('asset.degenerate-detail');
	});
});
