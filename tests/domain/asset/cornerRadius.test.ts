/**
 * A rounded rectangle's corner radius, READ BACK from its stored points and bulges rather than stored
 * (AD18-R16 Task 12; AD11 item 2), and rebuilt about the same box as one whole-shape edit.
 *
 * The detector's negatives are the point of half of these cases: an outline that has been resized
 * along one axis, rotated off the axes, had a corner moved or an edge bent is no longer something one
 * radius describes, and the answer for it is `null` rather than a guess.
 */
import { describe, expect, it } from 'vitest';
import type { CurvedPolygon } from '../../../src/core/geometry/CurvedPolygon';
import { rotate, scale, translate } from '../../../src/core/geometry/operations';
import type { AssetDetail } from '../../../src/domain/asset/AssetDetail';
import type { AssetShape } from '../../../src/domain/asset/AssetShape';
import { cornerRadiusOf, setCornerRadius } from '../../../src/domain/asset/cornerRadius';
import { circle, rect, roundedRect } from '../../../src/domain/asset/presets/presetGeometry';
import { editableShape, openGraphic, OPEN_POINTS, ROUNDED_RECT as ROUNDED, shapeWithRoundedRect as withRounded } from '../../helpers/assetShapes';
import { expectErr, expectOk } from '../../helpers/domain';

const closed = (outline: CurvedPolygon): AssetDetail => ({ id: 'detail-3', name: 'rounded-rectangle', line: 'solid', pending: false, outline });

const detailOf = (shape: AssetShape, id = 'detail-3'): AssetDetail => {
	const found = shape.details.find((detail) => detail.id === id);
	if (found === undefined) throw new Error(`no ${id}`);
	return found;
};

describe('cornerRadiusOf', () => {
	it('reads the radius back from the eight points and four quarter-circle corners', () => {
		expect(cornerRadiusOf(closed(ROUNDED))).toBe(150);
	});

	it.each([
		['moved', translate(ROUNDED, { dx: 123.456, dy: -78.9 })],
		['turned a quarter about its centre', rotate(ROUNDED, Math.PI / 2, { x: 20, y: 30 })],
		['turned a half about a far point', rotate(ROUNDED, Math.PI, { x: 5000, y: -3000 })],
	] as const)('still reads it once the outline is %s, which keeps it a rounded rectangle', (_, outline) => {
		expect(cornerRadiusOf(closed(outline))).toBeCloseTo(150, 9);
	});

	it('reads a doubled radius once the outline is scaled by 2 on both axes', () => {
		expect(cornerRadiusOf(closed(scale(ROUNDED, 2, { x: 0, y: 0 })))).toBeCloseTo(300, 9);
	});

	it.each([
		['rotated off the axes', rotate(ROUNDED, Math.PI / 6, { x: 20, y: 30 })],
		['stretched along one axis', { ...ROUNDED, points: ROUNDED.points.map((point) => ({ x: point.x * 1.5, y: point.y })) }],
		['given one moved corner', { ...ROUNDED, points: ROUNDED.points.map((point, index) => (index === 0 ? { x: point.x + 10, y: point.y } : point)) }],
		['given one bent edge', { ...ROUNDED, bulges: ROUNDED.bulges?.map((bulge, index) => (index === 1 ? 0.3 : bulge)) }],
		['a plain rectangle', rect(1000, 600)],
		['a circle, whose four arcs meet with no straight side', circle(600)],
		['eight points and no curve at all', { points: ROUNDED.points }],
	] as const)('says no for an outline %s', (_, outline) => {
		expect(cornerRadiusOf(closed(outline))).toBeNull();
	});

	it('says no for an open graphic, which has no corners to round', () => {
		expect(cornerRadiusOf(openGraphic('detail-3', OPEN_POINTS))).toBeNull();
	});
});

describe('setCornerRadius', () => {
	it('rebuilds the same box with the typed radius, keeping the graphic’s id, name, line and pending flag', () => {
		const shape = withRounded();

		const edited = detailOf(expectOk(setCornerRadius(shape, 'detail-3', 80)));

		expect(edited).toEqual({ ...detailOf(shape), kind: 'closed', outline: roundedRect(1000, 600, 80, 20, 30) });
	});

	it.each([1, 80, 299.5])('round-trips %s through the stored geometry', (radius) => {
		expect(cornerRadiusOf(detailOf(expectOk(setCornerRadius(withRounded(), 'detail-3', radius))))).toBeCloseTo(radius, 9);
	});

	it('rebuilds a turned rounded rectangle about the box it now has', () => {
		const shape = withRounded(rotate(ROUNDED, Math.PI / 2, { x: 20, y: 30 }));

		const outline = detailOf(expectOk(setCornerRadius(shape, 'detail-3', 100))).outline;

		expect(outline.points.map(({ x, y }) => [x, y])).toEqual(roundedRect(600, 1000, 100, 20, 30).points.map(({ x, y }) => [expect.closeTo(x, 9), expect.closeTo(y, 9)]));
	});

	/**
	 * The ceiling is EXCLUSIVE, which is the code overruling the brief's `(0, half]`: at exactly half the
	 * shorter side two of the eight points coincide and `createCurvedPolygon` refuses the outline as
	 * self-intersecting (measured). Refusing the value here names the rule the user broke rather than a
	 * geometry sentence about edges they cannot see.
	 */
	it.each([0, -5, 300, 301, Number.POSITIVE_INFINITY])('refuses %s, outside more than 0 and under half the shorter side', (radius) => {
		expect(expectErr(setCornerRadius(withRounded(), 'detail-3', radius)).code).toBe('asset.corner-radius-out-of-range');
	});

	it('refuses a graphic that is no longer a rounded rectangle', () => {
		expect(expectErr(setCornerRadius(editableShape(), 'detail-1', 50)).code).toBe('asset.not-rounded-rectangle');
	});

	it('refuses a graphic the shape does not have', () => {
		expect(expectErr(setCornerRadius(editableShape(), 'detail-9', 50)).code).toBe('asset.part-not-found');
	});
});
