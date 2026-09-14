import { describe, expect, it } from 'vitest';
import type { CurvedPolygon } from '../../../../src/core/geometry/CurvedPolygon';
import type { AssetShape } from '../../../../src/domain/asset/AssetShape';
import { outlineOf, type OutlinePart } from '../../../../src/domain/asset/shapeEdits';
import { partBox, resizeToExtent } from '../../../../src/presentation/designer/selection/partExtent';
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

	it('lands a typed width on a circle, whose extent is not linear in the factor', () => {
		const shape = editableShape();
		const circle: OutlinePart = { kind: 'detail', id: 'detail-2' };

		expect(Math.round(boxAfter(expectOk(resizeToExtent(shape, circle, 'width', 500)), circle).width)).toBe(500);
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
