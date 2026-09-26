import { describe, expect, it } from 'vitest';
import { boxResize } from '../../../../src/core/geometry/boxHandles';
import { boundingBoxOf } from '../../../../src/core/geometry/operations';
import type { CurvedPolygon } from '../../../../src/core/geometry/CurvedPolygon';
import type { Point } from '../../../../src/core/geometry/Point';
import { unwrap } from '../../../../src/core/result/Result';
import type { AssetShape } from '../../../../src/domain/asset/AssetShape';
import { outlineOf, resizeBox, type OutlinePart } from '../../../../src/domain/asset/shapeEdits';
import { partMeasure, resizeToExtent, type PartBox } from '../../../../src/presentation/designer/selection/partExtent';
import { draggedShape } from '../../../../src/presentation/designer/selection/selectionDrag';
import { toiletShape } from '../../../helpers/assetShapes';
import { expectDefined, expectOk } from '../../../helpers/domain';

/**
 * `Design an Asset.md` step 107 on the step's OWN input: the toilet preset's bowl, dragged by its bottom-right
 * handle to a size a user could also type. The case's end-to-end comparison typed the numbers the drag had
 * already landed, and a plain stretch lands a size its own solve reproduces exactly, so that comparison could
 * not fail. This one types the size the POINTER asks for.
 *
 * The bowl is `stadium(304, 450)` about (0, 100): its points span 304 x 146 and its top and bottom edges are
 * half-circles, so its curve-aware box is x -152..152 by y -125..325, bottom-right handle (4) on (152, 325).
 * A plain stretch scales the 146 by the depth factor and leaves each half-circle as deep as its chord is
 * wide, so it lands the typed width and misses the typed depth — by 65 mm at the first target below.
 */
const TOILET = toiletShape();
const BOWL: OutlinePart = { kind: 'detail', id: 'detail-2' };
const BOTTOM_RIGHT: Point = { x: 152, y: 325 };
const TOP_LEFT: Point = { x: -152, y: -125 };

/** Pointers landing whole-millimetre sizes the half-circles can reach (depth at least the width). */
const TARGETS: readonly Point[] = [{ x: 200, y: 300 }, { x: 120, y: 380 }, { x: 180, y: 360 }, { x: 100, y: 250 }];

const box = (shape: AssetShape): PartBox => expectDefined(partMeasure(shape, BOWL), 'the bowl');
const outline = (shape: AssetShape): CurvedPolygon => expectDefined(outlineOf(shape, BOWL), 'the bowl');

/** The outline's points measured from its own box's top-left corner, so a drag and a typed resize compare by shape. */
function fromCorner(shape: AssetShape): Point[] {
	const measured = box(shape);
	const corner = { x: measured.centre.x - measured.width / 2, y: measured.centre.y - measured.depth / 2 };
	return outline(shape).points.map((point) => ({ x: point.x - corner.x, y: point.y - corner.y }));
}

describe('a corner drag of the toilet bowl', () => {
	it.each(TARGETS)('lands the size the pointer asks for at ($x, $y), as typing that Width and Depth would, and not a plain stretch', (to) => {
		const width = to.x - TOP_LEFT.x, depth = to.y - TOP_LEFT.y;
		const dragged = expectOk(draggedShape({ shape: TOILET, selection: BOWL, role: { kind: 'box', index: 4 }, from: BOTTOM_RIGHT }, to, { shift: false, snapRotation: (radians) => radians }));
		const typed = expectOk(resizeToExtent(expectOk(resizeToExtent(TOILET, BOWL, 'width', width)), BOWL, 'depth', depth));
		const { factors, origin } = boxResize(unwrap(boundingBoxOf(outline(TOILET))), 4, to, false);
		const stretched = expectOk(resizeBox(TOILET, BOWL, factors, origin));

		// The input discriminates: a plain stretch misses the typed depth by more than a millimetre.
		expect(Math.abs(box(stretched).depth - depth)).toBeGreaterThan(1);

		// The Inspector's Width and Depth, to the nearest whole millimetre: the pointer's, and the typed path's.
		const got = box(dragged);
		expect([Math.round(got.width), Math.round(got.depth)]).toEqual([width, depth]);
		expect([Math.round(got.width), Math.round(got.depth)]).toEqual([Math.round(box(typed).width), Math.round(box(typed).depth)]);
		// The same outline: vertices within a millimetre of the typed one's, measured from each box's corner,
		// every bulge within 0.01 — and the top-left corner the drag holds still where it was.
		fromCorner(dragged).forEach((point, index) => {
			const want = expectDefined(fromCorner(typed)[index], 'a typed vertex');
			expect(Math.abs(point.x - want.x)).toBeLessThan(1);
			expect(Math.abs(point.y - want.y)).toBeLessThan(1);
		});
		const draggedBulges = expectDefined(outline(dragged).bulges, "the dragged outline's bulges");
		const typedBulges = expectDefined(outline(typed).bulges, "the typed outline's bulges");
		expect(draggedBulges.length).toEqual(typedBulges.length);
		draggedBulges.forEach((bulge, index) => expect(bulge).toBeCloseTo(typedBulges[index], 2));
		expect(got.centre.x - got.width / 2).toBeCloseTo(TOP_LEFT.x, 6);
		expect(got.centre.y - got.depth / 2).toBeCloseTo(TOP_LEFT.y, 6);
	});
});
