import { describe, expect, it } from 'vitest';
import type { Point } from '../../../../src/core/geometry/Point';
import { rotate } from '../../../../src/core/geometry/operations';
import type { AssetShape } from '../../../../src/domain/asset/AssetShape';
import type { SpatialElement } from '../../../../src/domain/spatial/SpatialElement';
import { placedOutline, placementPoints, withPlacementSize } from '../../../../src/domain/spatial/assetPlacement';
import { assetTransformBox, itemTransformBox, resizeTransformBox, sizedTransformBox, transformBoxSize, transformHandlePoints, transformHandleWorld } from '../../../../src/presentation/editor/elements/transformBox';
import { expectDefined } from '../../../helpers/domain';

const rounded = (points: readonly Point[]): Point[] => points.map(p => ({ x: Math.round(p.x * 1e6) / 1e6 + 0, y: Math.round(p.y * 1e6) / 1e6 + 0 }));
const side = (a: Point, b: Point): number => Math.hypot(b.x - a.x, b.y - a.y);
const item: SpatialElement = { id: 'element-cabinet', kind: 'object', points: [{ x: 500, y: 500 }, { x: 1500, y: 500 }, { x: 1500, y: 1000 }, { x: 500, y: 1000 }] };

describe('item transform box', () => {
	it('frames an axis-aligned item along its first edge, with padded handles clockwise from the top-left', () => {
		const frame = expectDefined(itemTransformBox(item), 'item frame');
		expect(frame.box).toEqual({ min: { x: 0, y: 0 }, max: { x: 1000, y: 500 } });
		expect(transformBoxSize(frame)).toEqual({ width: 1000, depth: 500 });
		expect(transformHandlePoints(frame, 2)).toEqual([
			{ x: 476, y: 476 }, { x: 1000, y: 476 }, { x: 1524, y: 476 }, { x: 1524, y: 750 },
			{ x: 1524, y: 1024 }, { x: 1000, y: 1024 }, { x: 476, y: 1024 }, { x: 476, y: 750 },
		]);
		expect(transformHandleWorld(frame, 4)).toEqual({ x: 1500, y: 1000 });
	});

	it('stretches an item about the handle opposite the one dragged, and keeps proportions with Shift', () => {
		const frame = expectDefined(itemTransformBox(item), 'item frame');
		const doubled = [{ x: 500, y: 500 }, { x: 2500, y: 500 }, { x: 2500, y: 1500 }, { x: 500, y: 1500 }];
		expect(resizeTransformBox(frame, 4, { x: 2500, y: 1500 }, false)).toEqual({ points: doubled });
		expect(resizeTransformBox(frame, 7, { x: 0, y: 9999 }, false)).toEqual({ points: [{ x: 0, y: 500 }, { x: 1500, y: 500 }, { x: 1500, y: 1000 }, { x: 0, y: 1000 }] });
		expect(resizeTransformBox(frame, 4, { x: 2500, y: 1000 }, true)).toEqual({ points: doubled });
	});

	it('refuses a side under a millimetre, flipped past the fixed side or over a kilometre, and an outline with no area', () => {
		const frame = expectDefined(itemTransformBox(item), 'item frame');
		expect(resizeTransformBox(frame, 4, { x: 500.5, y: 1500 }, false)).toBeNull();
		expect(resizeTransformBox(frame, 4, { x: 100, y: 1500 }, false)).toBeNull();
		expect(resizeTransformBox(frame, 4, { x: 2e6, y: 1500 }, false)).toBeNull();
		expect(itemTransformBox({ ...item, points: [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }] })).toBeNull();
		expect(itemTransformBox({ ...item, points: [{ x: 0, y: 0 }, { x: 500, y: 0 }, { x: 1000, y: 0 }] })).toBeNull();
	});

	it('frames a turned item along its own edge, so a resize keeps it rectangular', () => {
		const turned = { ...item, points: rotate({ points: item.points }, Math.PI / 6, { x: 1000, y: 750 }).points };
		const frame = expectDefined(itemTransformBox(turned), 'turned frame');
		expect(transformBoxSize(frame).width).toBeCloseTo(1000, 9);
		expect(transformBoxSize(frame).depth).toBeCloseTo(500, 9);
		const far = transformHandleWorld(frame, 4);
		const resized = expectDefined(resizeTransformBox(frame, 4, { x: far.x + 100 * Math.cos(Math.PI / 6), y: far.y + 100 * Math.sin(Math.PI / 6) }, false), 'resize').points;
		expect(side(resized[0], resized[1])).toBeCloseTo(1100, 6);
		expect(side(resized[1], resized[2])).toBeCloseTo(500, 6);
		expect(rounded([resized[0]])).toEqual(rounded([turned.points[0]]));
		expect((resized[1].x - resized[0].x) * (resized[2].x - resized[1].x) + (resized[1].y - resized[0].y) * (resized[2].y - resized[1].y)).toBeCloseTo(0, 6);
	});
});

describe('placement transform box', () => {
	const library: AssetShape = { footprint: { points: [{ x: -400, y: -300 }, { x: 400, y: -300 }, { x: 400, y: 300 }, { x: -400, y: 300 }] }, footprintOrigin: 'typed', footprintPending: false, clearancePending: false, anchorPending: false, clearance: null, anchor: { x: 0, y: 0 }, facing: 0, details: [] };
	const placement: SpatialElement = { id: 'element-radiator', kind: 'asset', assetId: 'asset-radiator', points: placementPoints({ x: 1000, y: 1000 }, Math.PI / 2) };

	it('frames a placement on its anchor, turned by heading minus facing, around its footprint', () => {
		const frame = assetTransformBox(placement, library);
		expect(frame.box).toEqual({ min: { x: -400, y: -300 }, max: { x: 400, y: 300 } });
		expect(rounded(transformHandlePoints(frame, 0).filter((_, index) => index % 2 === 0))).toEqual(rounded(placedOutline(placement, library).footprint));
	});

	it('resizes a placement into its own size, holding the opposite corner on the plan', () => {
		const frame = assetTransformBox(placement, library), fixedBefore = transformHandleWorld(frame, 0), far = transformHandleWorld(frame, 4);
		// The frame's x runs down the plan's +y at a quarter turn: 400 further along it and 200 further across it.
		const resized = expectDefined(resizeTransformBox(frame, 4, { x: far.x - 200, y: far.y + 400 }, false), 'resize');
		expect(resized.size).toEqual({ width: expect.closeTo(1200, 6), depth: expect.closeTo(800, 6) });
		const after = assetTransformBox(withPlacementSize({ ...placement, points: resized.points }, resized.size), library);
		expect(rounded([transformHandleWorld(after, 0)])).toEqual(rounded([fixedBefore]));
	});

	it('applies a typed size about the box centre and resets to the library size as no size at all', () => {
		const frame = assetTransformBox(placement, library);
		const wide = expectDefined(sizedTransformBox(frame, { width: 1600, depth: 600 }), 'wide');
		expect(wide.size).toEqual({ width: expect.closeTo(1600, 6), depth: expect.closeTo(600, 6) });
		const widened = withPlacementSize({ ...placement, points: wide.points }, wide.size);
		const reset = expectDefined(sizedTransformBox(assetTransformBox(widened, library), { width: 800, depth: 600 }), 'reset');
		expect(reset.size).toBeUndefined();
		expect(rounded(reset.points.slice(0, 1))).toEqual(rounded(placement.points.slice(0, 1)));
		expect(sizedTransformBox(frame, { width: 0.5, depth: 600 })).toBeNull();
	});
});
