import { describe, expect, it } from 'vitest';
import { boundingBoxOf } from '../../../src/core/geometry/operations';
import { polygonPolyline } from '../../../src/core/geometry/curvePolyline';
import { circle } from '../../../src/domain/asset/presets/presetGeometry';
import { scaleDesignToDimensions } from '../../../src/domain/asset/shapeEdits';
import { placedOutline, placementPoints } from '../../../src/domain/spatial/assetPlacement';
import { editableShape } from '../../helpers/assetShapes';
import { expectOk } from '../../helpers/domain';

/**
 * The designer and a plan approximate a STRETCHED ARC differently, deliberately (consolidation spec
 * §5): the designer keeps bulges, because it has to store its curves and a bulge cannot express an
 * ellipse, while a placement flattens first and stretches the polyline, because it stores nothing.
 *
 * What is GUARANTEED is the measurement: the same nominal size measures the same on both surfaces.
 * What is TOLERATED is the silhouette. This file pins both, so the day a `CurvedPolygon` learns
 * ellipses the second assertion fails and somebody deletes it on purpose.
 *
 * The plan's box is compared with a millimetre of slack because `placedOutline` flattens at a 1 mm
 * sagitta, which sits just inside the true arc.
 */
const ROUND = editableShape({ footprint: circle(1000), clearance: null, details: [] });
const WIDTH = 1400;
const DEPTH = 1000;

function box(points: readonly { readonly x: number; readonly y: number }[]) {
	const xs = points.map((point) => point.x);
	const ys = points.map((point) => point.y);
	return { width: Math.max(...xs) - Math.min(...xs), depth: Math.max(...ys) - Math.min(...ys) };
}

describe('a stretched arc on the two surfaces', () => {
	const designed = expectOk(scaleDesignToDimensions(ROUND, WIDTH, DEPTH));
	const placed = placedOutline({ points: placementPoints({ x: 0, y: 0 }, 0), size: { width: WIDTH, depth: DEPTH } }, ROUND);

	it('measures the same on both', () => {
		const designedBox = expectOk(boundingBoxOf(designed.footprint));
		expect(designedBox.max.x - designedBox.min.x).toBeCloseTo(WIDTH, 3);
		expect(designedBox.max.y - designedBox.min.y).toBeCloseTo(DEPTH, 3);

		const planBox = box(placed.footprint);
		expect(Math.abs(planBox.width - WIDTH)).toBeLessThan(1);
		expect(Math.abs(planBox.depth - DEPTH)).toBeLessThan(1);
	});

	it('draws a different silhouette, which is the tolerated approximation', () => {
		// Confirm both outlines actually have points before trusting the inequality below — an
		// assertion that passes because both sides are empty is not a check.
		const designedPolyline = polygonPolyline(designed.footprint, 1);
		expect(designedPolyline.length).toBeGreaterThan(0);
		expect(placed.footprint.length).toBeGreaterThan(0);
		expect(designedPolyline).not.toEqual(placed.footprint);
	});
});
