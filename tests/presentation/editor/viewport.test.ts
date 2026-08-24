/**
 * The viewport transform (SDD §24) — the only place world millimetres become pixels.
 *
 * Node, not jsdom: none of this touches a DOM, which is the point of it living in its own
 * module rather than inside a component.
 */
import { describe, expect, it } from 'vitest';
import {
	clampZoom,
	MAX_ZOOM,
	MIN_ZOOM,
	panBy,
	screenPoint,
	screenToWorld,
	STAGE_PIXELS,
	viewportTransform,
	worldToScreen,
	zoomAbout,
	type Viewport,
} from '../../../src/presentation/editor/viewport/Viewport';

const CASES: readonly { name: string; viewport: Viewport; dpr: number }[] = [
	{ name: 'identity', viewport: { pan: { x: 0, y: 0 }, zoom: 1 }, dpr: 1 },
	{ name: 'panned', viewport: { pan: { x: 1500, y: -320 }, zoom: 1 }, dpr: 1 },
	{ name: 'zoomed out', viewport: { pan: { x: 0, y: 0 }, zoom: 0.05 }, dpr: 1 },
	{ name: 'zoomed in', viewport: { pan: { x: -80, y: 40 }, zoom: 8 }, dpr: 1 },
	{ name: 'retina', viewport: { pan: { x: 210, y: 297 }, zoom: 0.5 }, dpr: 2 },
	{ name: 'fractional ratio', viewport: { pan: { x: -7.5, y: 3.25 }, zoom: 1.75 }, dpr: 1.25 },
];

const POINTS = [
	{ x: 0, y: 0 },
	{ x: 1, y: -1 },
	{ x: 4200, y: 2970 },
	{ x: -1234.5, y: 6789.25 },
];

describe('worldToScreen and screenToWorld', () => {
	it.each(CASES)('round-trips every point under $name', ({ viewport, dpr }) => {
		for (const point of POINTS) {
			const back = screenToWorld(worldToScreen(point, viewport, dpr), viewport, dpr);

			expect(back.x).toBeCloseTo(point.x, 9);
			expect(back.y).toBeCloseTo(point.y, 9);
		}
	});

	it('puts the pan origin at the screen origin', () => {
		const viewport: Viewport = { pan: { x: 1500, y: -320 }, zoom: 3 };

		expect(worldToScreen(viewport.pan, viewport, STAGE_PIXELS)).toMatchObject({ x: 0, y: 0 });
	});

	it('scales a world distance by zoom times the device ratio', () => {
		const viewport: Viewport = { pan: { x: 0, y: 0 }, zoom: 2 };

		const at = worldToScreen({ x: 100, y: 50 }, viewport, 3);

		expect(at).toMatchObject({ x: 600, y: 300 });
	});

	/**
	 * The brand exists so a `ScreenPoint` and a `Point` cannot be swapped. It is a
	 * type-level guarantee that the suite cannot check (nothing type-checks `tests/**`), so
	 * what IS checked is the other half of the design: `screenPoint` produces a plain
	 * coordinate pair with no runtime marker to leak into a Konva config or a store.
	 */
	it('produces a plain coordinate pair, with the brand at the type level only', () => {
		expect({ ...screenPoint(3, 4) }).toEqual({ x: 3, y: 4 });
	});
});

describe('the viewport transform bound to a layer', () => {
	it.each(CASES)('places world zero where worldToScreen says it is, under $name', ({ viewport }) => {
		const transform = viewportTransform(viewport);
		const origin = worldToScreen({ x: 0, y: 0 }, viewport, STAGE_PIXELS);

		// Derived from the same function, which is the whole claim: the layer's position and
		// the transform's math are one definition, not two that can drift.
		expect({ x: transform.x, y: transform.y }).toEqual({ x: origin.x, y: origin.y });
		expect(transform.scaleX).toBe(viewport.zoom);
		expect(transform.scaleY).toBe(viewport.zoom);
	});

	/**
	 * Konva's `Stage` already scales its own canvas by the device pixel ratio. A transform
	 * that also carried one would apply it twice and draw everything `dpr` times too large —
	 * a defect that is invisible on a 1× display, which is where CI runs.
	 */
	it('carries no device pixel ratio of its own', () => {
		expect(STAGE_PIXELS).toBe(1);
		expect(viewportTransform({ pan: { x: 0, y: 0 }, zoom: 4 }).scaleX).toBe(4);
	});
});

describe('the camera', () => {
	it('keeps the world point under the anchor under the anchor while zooming', () => {
		const viewport: Viewport = { pan: { x: 120, y: 45 }, zoom: 0.4 };
		const anchor = screenPoint(317, 208);
		const before = screenToWorld(anchor, viewport, STAGE_PIXELS);

		const after = zoomAbout(viewport, anchor, 2.5);
		const stillThere = worldToScreen(before, after, STAGE_PIXELS);

		expect(after.zoom).toBe(2.5);
		expect(stillThere.x).toBeCloseTo(anchor.x, 6);
		expect(stillThere.y).toBeCloseTo(anchor.y, 6);
	});

	it('clamps a zoom past either bound and still anchors correctly', () => {
		const viewport: Viewport = { pan: { x: 0, y: 0 }, zoom: 1 };
		const anchor = screenPoint(50, 60);

		expect(zoomAbout(viewport, anchor, 1e6).zoom).toBe(MAX_ZOOM);
		expect(zoomAbout(viewport, anchor, 1e-6).zoom).toBe(MIN_ZOOM);
		// The anchor still holds at the clamped zoom, which is what would break if the clamp
		// were applied after the pan was computed instead of before.
		const clamped = zoomAbout(viewport, anchor, 1e6);
		expect(worldToScreen(screenToWorld(anchor, viewport, STAGE_PIXELS), clamped, STAGE_PIXELS).x).toBeCloseTo(
			anchor.x,
			6,
		);
	});

	it('clamps a bare zoom value at both ends and passes an in-range one through', () => {
		expect(clampZoom(0)).toBe(MIN_ZOOM);
		expect(clampZoom(1e9)).toBe(MAX_ZOOM);
		expect(clampZoom(1.5)).toBe(1.5);
	});

	it('moves the world under the pointer by exactly the screen delta', () => {
		const viewport: Viewport = { pan: { x: 0, y: 0 }, zoom: 0.25 };
		const grabbed = screenToWorld(screenPoint(200, 100), viewport, STAGE_PIXELS);

		const panned = panBy(viewport, 40, -25);
		const nowAt = worldToScreen(grabbed, panned, STAGE_PIXELS);

		expect(nowAt.x).toBeCloseTo(240, 6);
		expect(nowAt.y).toBeCloseTo(75, 6);
	});

	it('leaves zoom alone while panning', () => {
		expect(panBy({ pan: { x: 3, y: 4 }, zoom: 0.7 }, 10, 10).zoom).toBe(0.7);
	});
});
