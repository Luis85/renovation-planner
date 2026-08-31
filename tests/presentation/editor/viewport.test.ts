/**
 * The viewport transform (SDD §24) — the only place world millimetres become pixels.
 *
 * Node, not jsdom: none of this touches a DOM, which is the point of it living in its own
 * module rather than inside a component.
 */
import { describe, expect, it } from 'vitest';
import {
	clampZoom,
	fitViewport,
	MAX_ZOOM,
	MIN_ZOOM,
	panBy,
	screenPoint,
	screenToWorld,
	STAGE_PIXELS,
	viewportTransform,
	worldPerScreenPixel,
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

/**
 * The two-point probe three tools each wrote by hand before `worldPerScreenPixel` existed:
 * project (0,0) and (1,0) back into world space and measure the gap.
 */
function probe(viewport: Viewport): number {
	return (
		screenToWorld(screenPoint(1, 0), viewport, STAGE_PIXELS).x
		- screenToWorld(screenPoint(0, 0), viewport, STAGE_PIXELS).x
	);
}

describe('world millimetres per screen pixel', () => {
	it('agrees with the two-point probe at an ordinary camera', () => {
		// Where the probe is accurate, the two must be the same number — otherwise this
		// would be a behaviour change dressed as a refactor.
		const viewport: Viewport = { pan: { x: -480, y: -480 }, zoom: 0.1 };

		expect(worldPerScreenPixel(viewport, STAGE_PIXELS)).toBeCloseTo(probe(viewport), 9);
		expect(worldPerScreenPixel(viewport, STAGE_PIXELS)).toBe(1 / viewport.zoom);
	});

	it('stays exact at a far pan, where the two-point probe does not', () => {
		// `screenToWorld(p) = p.x / scale + pan.x`, so the probe recovers `1 / scale` by
		// subtracting two numbers dominated by `pan.x` — and loses low-order bits of exactly
		// the quantity being measured. This is the reason the direct form exists, not merely
		// a tidier spelling of it: a tolerance that quantises turns a drag into a click or a
		// click into a drag, silently.
		const farPanned: Viewport = { pan: { x: 1e12, y: -3e11 }, zoom: 0.037 };

		expect(worldPerScreenPixel(farPanned, STAGE_PIXELS)).toBe(1 / 0.037);
		// Not merely different in the last bit: the probe is out by ~5e-5 of a world
		// millimetre here, and grows with the pan.
		expect(probe(farPanned)).not.toBe(1 / 0.037);
		expect(Math.abs(probe(farPanned) - 1 / 0.037)).toBeGreaterThan(1e-5);
	});

	it('scales with the device-pixel argument, like both transforms', () => {
		expect(worldPerScreenPixel({ pan: { x: 0, y: 0 }, zoom: 2 }, 2)).toBeCloseTo(0.25, 12);
	});
});

/** Where a world point lands on screen under a given camera, for reading a fit back. */
function onScreen(viewport: Viewport, point: { x: number; y: number }) {
	return worldToScreen(point, viewport, STAGE_PIXELS);
}

/**
 * `fitViewport` answers `null` for a pane with no area, and the two cases at the bottom of the
 * `fitViewport` block are what hold that. Every OTHER case there passes a pane that has area,
 * so a `null` is not a camera to assert against — it is that block's own premise being wrong,
 * and it should say so rather than surface as `Cannot read properties of null`.
 *
 * Module scope, not inside the block, because it captures nothing from it —
 * `unicorn/consistent-function-scoping`, and the same reasoning `captureReadiness.test.ts`
 * records for its own predicate.
 */
function fit(
	bounds: Parameters<typeof fitViewport>[0],
	stage: Parameters<typeof fitViewport>[1],
	paddingPx: number,
	currentZoom: number,
): Viewport {
	const fitted = fitViewport(bounds, stage, paddingPx, currentZoom);
	if (fitted === null) throw new Error('fitViewport refused a pane that has area');
	return fitted;
}

describe('fitViewport', () => {
	/** A pane, and a 4000 x 2000 mm plan sitting away from the world origin. */
	const STAGE = { width: 800, height: 600 };
	const BOUNDS = { min: { x: 1000, y: 500 }, max: { x: 5000, y: 2500 } };
	/** Whatever camera the user is already at — only a doubly-degenerate extent reads it. */
	const CURRENT_ZOOM = 5;

	it('puts the whole extent inside the pane', () => {
		const fitted = fit(BOUNDS, STAGE, 0, CURRENT_ZOOM);

		const topLeft = onScreen(fitted, BOUNDS.min);
		const bottomRight = onScreen(fitted, BOUNDS.max);
		expect(topLeft.x).toBeGreaterThanOrEqual(-1e-9);
		expect(topLeft.y).toBeGreaterThanOrEqual(-1e-9);
		expect(bottomRight.x).toBeLessThanOrEqual(STAGE.width + 1e-9);
		expect(bottomRight.y).toBeLessThanOrEqual(STAGE.height + 1e-9);
	});

	it('centres it, rather than parking it in a corner', () => {
		const fitted = fit(BOUNDS, STAGE, 0, CURRENT_ZOOM);

		const centre = onScreen(fitted, { x: 3000, y: 1500 });
		expect(centre.x).toBeCloseTo(STAGE.width / 2, 9);
		expect(centre.y).toBeCloseTo(STAGE.height / 2, 9);
	});

	it('fits the TIGHTER axis, so the other one gains slack rather than overflowing', () => {
		// 4000 x 2000 mm into 800 x 600 px: 0.2 across, 0.3 down. Taking the larger would put
		// 4000 mm into 800 px at 0.3 and hang a third of the plan off both sides.
		expect(fit(BOUNDS, STAGE, 0, CURRENT_ZOOM).zoom).toBeCloseTo(0.2, 9);
	});

	it('reserves the padding on every side', () => {
		// 40 px of padding leaves 720 x 520 for the plan: 0.18 across, 0.26 down.
		const fitted = fit(BOUNDS, STAGE, 40, CURRENT_ZOOM);

		expect(fitted.zoom).toBeCloseTo(0.18, 9);
		expect(onScreen(fitted, BOUNDS.min).x).toBeCloseTo(40, 9);
	});

	it('keeps a degenerate extent at a usable zoom instead of dividing by zero', () => {
		// One zone, one point, or a perfectly axis-aligned line: a real extent with no width.
		// The naive form answers `Infinity`, and a camera at `Infinity` renders nothing at all.
		const point = { min: { x: 250, y: 250 }, max: { x: 250, y: 250 } };

		const fitted = fit(point, STAGE, 0, CURRENT_ZOOM);

		expect(Number.isFinite(fitted.zoom)).toBe(true);
		expect(fitted.zoom).toBeLessThanOrEqual(MAX_ZOOM);
		expect(onScreen(fitted, point.min).x).toBeCloseTo(STAGE.width / 2, 9);
		expect(onScreen(fitted, point.min).y).toBeCloseTo(STAGE.height / 2, 9);
	});

	it('keeps the CURRENT zoom for that extent, rather than snapping to the opening camera', () => {
		// With both axes degenerate there is no ratio to take, and the fallback used to be
		// `DEFAULT_ZOOM` — `0.1`, the camera a freshly opened editor starts at. So framing a
		// point-sized selection at 5x dropped the user to a tenth: not "nothing to fit" but a
		// jump they never asked for, under a comment that had promised the opposite all along.
		const point = { min: { x: 250, y: 250 }, max: { x: 250, y: 250 } };

		expect(fit(point, STAGE, 0, CURRENT_ZOOM).zoom).toBe(CURRENT_ZOOM);
		expect(fit(point, STAGE, 0, 2).zoom).toBe(2);
	});

	it('still clamps that zoom, so an out-of-range camera cannot be carried through', () => {
		// The fallback is the caller's number rather than a constant now, so it takes the same
		// clamp everything else here does instead of trusting what it was handed.
		const point = { min: { x: 250, y: 250 }, max: { x: 250, y: 250 } };

		expect(fit(point, STAGE, 0, 1e9).zoom).toBe(MAX_ZOOM);
		expect(fit(point, STAGE, 0, 0).zoom).toBe(MIN_ZOOM);
	});

	it('clamps to the camera bounds, so a vast plan cannot fit past the floor', () => {
		const vast = { min: { x: 0, y: 0 }, max: { x: 1e9, y: 1e9 } };

		expect(fit(vast, STAGE, 0, CURRENT_ZOOM).zoom).toBe(MIN_ZOOM);
	});

	it('refuses a pane with no area rather than answering a camera nothing can draw', () => {
		// The stage is measured from a container that is 0 x 0 until layout runs, so this is
		// an ordinary early call and not a programming error — `null` lets the caller keep
		// the camera it has.
		expect(fitViewport(BOUNDS, { width: 0, height: 600 }, 0, CURRENT_ZOOM)).toBeNull();
	});

	it('refuses padding that leaves no room, rather than inverting the fit', () => {
		// 300 px of padding on a 600 px-tall pane leaves nothing. A signed width would fold
		// the camera inside out and answer a negative zoom.
		expect(fitViewport(BOUNDS, STAGE, 300, CURRENT_ZOOM)).toBeNull();
	});
});
