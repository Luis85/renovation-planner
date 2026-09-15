import { describe, expect, it } from 'vitest';
import type { Point } from '../../../src/core/geometry/Point';
import type { AssetShape } from '../../../src/domain/asset/AssetShape';
import { validSpatialElement, type SpatialElement } from '../../../src/domain/spatial/SpatialElement';
import { placedOutline, placementBox, placementPoints, resizedPlacement, withPlacementSize } from '../../../src/domain/spatial/assetPlacement';

const rounded = (points: readonly Point[]): Point[] => points.map(p => ({ x: Math.round(p.x * 1e6) / 1e6 + 0, y: Math.round(p.y * 1e6) / 1e6 + 0 }));
const rect = (w: number, d: number): Point[] => [{ x: -w / 2, y: -d / 2 }, { x: w / 2, y: -d / 2 }, { x: w / 2, y: d / 2 }, { x: -w / 2, y: d / 2 }];
function shape(patch: Partial<AssetShape> = {}): AssetShape {
	return { footprint: { points: rect(1000, 600) }, footprintOrigin: 'typed', footprintPending: false, clearancePending: false, anchorPending: false, clearance: null, anchor: { x: 0, y: 0 }, facing: 0, details: [], ...patch };
}
function placement(anchor: Point, heading: number, size?: { width: number; depth: number }): SpatialElement {
	return { id: 'element-asset', kind: 'asset', assetId: 'asset-1', points: placementPoints(anchor, heading), ...(size ? { size } : {}) };
}

describe('a placement’s own size', () => {
	it('draws exactly the library outline without a size', () => {
		expect(rounded(placedOutline(placement({ x: 1000, y: 2000 }, 0), shape()).footprint))
			.toEqual([{ x: 500, y: 1700 }, { x: 1500, y: 1700 }, { x: 1500, y: 2300 }, { x: 500, y: 2300 }]);
	});

	it('stretches footprint, clearance and details about the shape anchor before turning them', () => {
		const element = placement({ x: 0, y: 0 }, Math.PI / 2, { width: 2000, depth: 300 });
		const outline = placedOutline(element, shape({ clearance: { points: rect(1200, 800) }, details: [{ id: 'd', name: 'd', outline: { points: rect(200, 100) }, line: 'solid', pending: false }] }));
		// 2× along the shape's x and ½× along its y, then a quarter turn: x' = −y, y' = x.
		expect(rounded(outline.footprint)).toEqual([{ x: 150, y: -1000 }, { x: 150, y: 1000 }, { x: -150, y: 1000 }, { x: -150, y: -1000 }]);
		expect(rounded(outline.clearance ?? [])).toEqual([{ x: 200, y: -1200 }, { x: 200, y: 1200 }, { x: -200, y: 1200 }, { x: -200, y: -1200 }]);
		expect(rounded(outline.details[0].points)).toEqual([{ x: 25, y: -200 }, { x: 25, y: 200 }, { x: -25, y: 200 }, { x: -25, y: -200 }]);
	});

	it('boxes the stretched footprint in the placement frame, anchor at the origin', () => {
		expect(placementBox(placement({ x: 5000, y: 5000 }, 1.2, { width: 2000, depth: 300 }), shape({ anchor: { x: -500, y: 0 } })))
			.toEqual({ min: { x: 0, y: -150 }, max: { x: 2000, y: 150 } });
	});

	it.each([0, Math.PI / 2, Math.PI / 6])('keeps the fixed corner where it was on the plan at heading %s', heading => {
		const element = placement({ x: 1000, y: 1000 }, heading), library = shape();
		const before = placedOutline(element, library).footprint[0];
		// Stretch 1.5 × by 5/3 × about the corner the footprint starts at, (−500, −300) in the frame.
		const resized = resizedPlacement(element, library, { sx: 1.5, sy: 1000 / 600 }, { x: -500, y: -300 });
		if (!resized) throw new Error('Expected a resize');
		expect(resized.size?.width).toBeCloseTo(1500, 9);
		expect(resized.size?.depth).toBeCloseTo(1000, 9);
		const after = placedOutline(withPlacementSize({ ...element, points: resized.points }, resized.size), library).footprint[0];
		expect(after.x).toBeCloseTo(before.x, 6);
		expect(after.y).toBeCloseTo(before.y, 6);
		expect(Math.atan2(resized.points[1].y - resized.points[0].y, resized.points[1].x - resized.points[0].x)).toBeCloseTo(Math.atan2(Math.sin(heading), Math.cos(heading)), 12);
	});

	it('stores no size once a resize lands back within half a millimetre of the library', () => {
		const element = placement({ x: 0, y: 0 }, 0, { width: 2000, depth: 600 });
		expect(resizedPlacement(element, shape(), { sx: 0.50024, sy: 1 }, { x: 0, y: 0 })?.size).toBeUndefined();
		expect(resizedPlacement(element, shape(), { sx: 0.5006, sy: 1 }, { x: 0, y: 0 })?.size).toEqual({ width: expect.closeTo(1001.2, 6), depth: 600 });
	});

	it('neither stretches nor resizes a footprint whose extent is not representable', () => {
		const huge = shape({ footprint: { points: [{ x: -1e308, y: 0 }, { x: 1e308, y: 0 }, { x: 1e308, y: 10 }] } });
		const sized = placement({ x: 0, y: 0 }, 0, { width: 10, depth: 10 });
		expect(placedOutline(sized, huge).footprint).toEqual(placedOutline(placement({ x: 0, y: 0 }, 0), huge).footprint);
		expect(resizedPlacement(sized, huge, { sx: 2, sy: 2 }, { x: 0, y: 0 })).toBeNull();
	});

	it('sets or physically removes the size, and only an asset may carry a positive one up to a kilometre', () => {
		const sized = placement({ x: 0, y: 0 }, 0, { width: 900, depth: 400 });
		expect(withPlacementSize(sized, undefined)).not.toHaveProperty('size');
		expect(withPlacementSize(placement({ x: 0, y: 0 }, 0), { width: 1, depth: 2 }).size).toEqual({ width: 1, depth: 2 });
		expect(validSpatialElement(sized)).toBe(true);
		const item: SpatialElement = { id: 'element-item', kind: 'object', points: [{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 300 }] };
		expect(validSpatialElement({ ...item, size: { width: 900, depth: 400 } })).toBe(false);
		for (const size of [{ width: 0, depth: 400 }, { width: 900, depth: -1 }, { width: Number.NaN, depth: 400 }, { width: 900, depth: 1e6 + 1 }]) {
			expect(validSpatialElement({ ...sized, size })).toBe(false);
		}
	});
});
