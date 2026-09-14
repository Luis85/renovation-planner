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
