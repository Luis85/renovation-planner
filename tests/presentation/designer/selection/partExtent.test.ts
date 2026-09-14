import { describe, expect, it, vi } from 'vitest';
import type { CurvedPolygon } from '../../../../src/core/geometry/CurvedPolygon';
import { ok } from '../../../../src/core/result/Result';
import type { AssetShape } from '../../../../src/domain/asset/AssetShape';
import { outlineOf, type OutlinePart } from '../../../../src/domain/asset/shapeEdits';
import { partBox, resizeToExtent, withPartBox } from '../../../../src/presentation/designer/selection/partExtent';
import { editableShape, toiletShape } from '../../../helpers/assetShapes';
import { expectDefined, expectOk } from '../../../helpers/domain';

/**
 * A typed Width or Depth lands the typed CURVE-AWARE extent (asset designer symbols spec, "Inspector for
 * the selection"). `resizeBox` keeps bulges, so on a curved outline a factor of typed / current does not
 * give the typed extent: the toilet's bowl is a stadium 304 x 450 on (0, 100) whose semicircular ends
 * bow 152 beyond its corner points, so doubling its points' depth takes the box to 596, not 900.
 */
const TOILET = toiletShape();
const BOWL: OutlinePart = { kind: 'detail', id: 'detail-2' };

function boxAfter(shape: AssetShape, part: OutlinePart) {
	return partBox(expectDefined(outlineOf(shape, part), 'the part') as CurvedPolygon);
}

describe('partBox', () => {
	it('measures the bowl’s curve-aware box, not its corner points', () => {
		expect(boxAfter(TOILET, BOWL)).toEqual({ centre: { x: 0, y: 100 }, width: 304, depth: 450 });
	});
});

describe('withPartBox', () => {
	it('answers the edit over the part’s box on the shape it is handed', () => {
		const seen: ReturnType<typeof partBox>[] = [];

		const answered = withPartBox(TOILET, BOWL, (box) => {
			seen.push(box);
			return ok(TOILET);
		});

		expect(answered).toEqual(ok(TOILET));
		expect(seen).toEqual([{ centre: { x: 0, y: 100 }, width: 304, depth: 450 }]);
	});

	it('refuses a part the shape no longer has, without calling the edit', () => {
		const edit = vi.fn<(box: ReturnType<typeof partBox>) => ReturnType<typeof resizeToExtent>>();

		const refused = withPartBox(TOILET, { kind: 'detail', id: 'detail-9' }, edit);

		expect(refused.ok ? null : refused.error.code).toBe('asset.part-not-found');
		expect(edit).not.toHaveBeenCalled();
	});
});

describe('resizeToExtent', () => {
	it('lands Depth 900 on the bowl: its curve-aware depth rounds to 900, its width and ends kept', () => {
		const resized = expectOk(resizeToExtent(TOILET, BOWL, 'depth', 900));

		const box = boxAfter(resized, BOWL);
		expect(Math.round(box.depth)).toBe(900);
		expect(box.width).toBeCloseTo(304, 9);
		expect(outlineOf(resized, BOWL)?.bulges).toEqual([1, 0, 1, 0]);
	});

	it('lands Width 608 on the bowl in one step, since its straight sides are its extent', () => {
		const resized = expectOk(resizeToExtent(TOILET, BOWL, 'width', 608));

		expect(Math.round(boxAfter(resized, BOWL).width)).toBe(608);
		expect(outlineOf(resized, BOWL)?.points.map((point) => point.x)).toEqual([-304, 304, 304, -304]);
	});

	/**
	 * Accepted behaviour (spec Decision 9: a non-uniform resize keeps bulges): the bowl's semicircles stay
	 * semicircles on chords twice as long, so they bow 304 rather than 152 and the depth grows 450 → 754.
	 */
	it('lets a typed Width on the bowl grow its depth too, since its ends keep their bulges', () => {
		const resized = expectOk(resizeToExtent(TOILET, BOWL, 'width', 608));

		expect(Math.round(boxAfter(resized, BOWL).depth)).toBe(754);
	});

	it('lands a typed width on a circle, whose extent is not linear in the factor', () => {
		const shape = editableShape();
		const circle: OutlinePart = { kind: 'detail', id: 'detail-2' };

		expect(Math.round(boxAfter(expectOk(resizeToExtent(shape, circle, 'width', 500)), circle).width)).toBe(500);
	});

	/**
	 * Its arcs keep their bulges, so a four-arc circle of diameter 200 cannot be narrowed below about 41.42
	 * with a positive factor. 42 is reachable and lands.
	 */
	it('narrows a circle to a reachable width near its floor', () => {
		const shape = editableShape();
		const circle: OutlinePart = { kind: 'detail', id: 'detail-2' };

		expect(Math.round(boxAfter(expectOk(resizeToExtent(shape, circle, 'width', 42)), circle).width)).toBe(42);
	});

	/**
	 * 20 is below that floor, and the secant steps past zero on the way: the step is halved toward zero
	 * instead, and the answer is the NEAREST resize tried — a narrower circle, never a refusal worded as a
	 * scale to nothing.
	 */
	it('answers the nearest resize it tried for a width a circle cannot reach', () => {
		const shape = editableShape();
		const circle: OutlinePart = { kind: 'detail', id: 'detail-2' };

		const width = boxAfter(expectOk(resizeToExtent(shape, circle, 'width', 20)), circle).width;

		expect(width).toBeGreaterThan(41.42);
		expect(width).toBeLessThan(43);
	});

	it('refuses a zero extent as a scale to nothing', () => {
		const refused = resizeToExtent(TOILET, BOWL, 'width', 0);

		expect(refused.ok ? null : refused.error.code).toBe('asset.invalid-scale');
	});

	it('refuses a part the shape no longer has', () => {
		const refused = resizeToExtent(TOILET, { kind: 'detail', id: 'detail-9' }, 'depth', 900);

		expect(refused.ok ? null : refused.error.code).toBe('asset.part-not-found');
	});
});
