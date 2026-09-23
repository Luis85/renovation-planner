import { expect, it } from 'vitest';
import { referencePoint, type ReferenceAppearance } from '../../../src/domain/plan/ReferenceAppearance';
import { previewTransform } from '../../../src/presentation/editor/reference/referenceSetup';
import { dragRotation, referenceScreenCentre, referenceSourcePoint, rotationHandlePoint, zoomReference } from '../../../src/presentation/editor/reference/referenceViewport';

const appearance: ReferenceAppearance = { crop: { x: 20, y: 30, width: 800, height: 600 }, rotation: 0, opacity: 0.65, visible: true, locked: true };
it.each([0, 45, 90, -15, -180])('keeps the original source pixel under the pointer through pan and zoom at %s°', rotation => {
	const prepared = { ...appearance, rotation }, original = structuredClone(prepared), pixel = { x: 410.25, y: 220.5 };
	const fit = previewTransform(prepared, { width: 1000, height: 650 });
	const pan = { ...fit, x: fit.x + 117, y: fit.y - 45 };
	const transformed = referencePoint(pixel, prepared, pan.scale), screen = { x: transformed.x + pan.x, y: transformed.y + pan.y };
	const zoomed = zoomReference(pan, screen, 3.5, fit.scale);
	const restored = referenceSourcePoint(screen, zoomed, prepared);
	expect(restored?.x).toBeCloseTo(pixel.x, 8);
	expect(restored?.y).toBeCloseTo(pixel.y, 8);
	expect(prepared).toEqual(original);
});

it('fits the available viewport, rejects clicks outside the cropped image and bounds zoom', () => {
	const small = previewTransform(appearance), large = previewTransform(appearance, { width: 1000, height: 650 });
	expect(large.scale).toBeGreaterThan(small.scale * 2);
	expect(referenceSourcePoint({ x: -2000, y: -1000 }, large, appearance)).toBeNull();
	expect(zoomReference(large, { x: 200, y: 100 }, 1e8, large.scale).scale).toBe(large.scale * 32);
	expect(zoomReference(large, { x: 200, y: 100 }, 1e-8, large.scale).scale).toBe(large.scale / 4);
	expect(zoomReference(large, { x: 200, y: 100 }, NaN, large.scale)).toBe(large);
});

it('finds the crop centre on screen, with and without rotation and crop offset', () => {
	const view = { x: 10, y: 20, scale: 2 };
	const noRotation: ReferenceAppearance = { ...appearance, rotation: 0 };
	expect(referenceScreenCentre(view, noRotation)).toEqual({ x: 10 + 400 * 2, y: 20 + 300 * 2 });

	const rotated: ReferenceAppearance = { ...appearance, rotation: 90 };
	const centre = referenceScreenCentre(view, rotated);
	expect(centre.x).toBeCloseTo(10 - 300 * 2, 8);
	expect(centre.y).toBeCloseTo(20 + 400 * 2, 8);
});

it.each([
	[0, { x: 0, y: -10 }],
	[90, { x: 10, y: 0 }],
	[-90, { x: -10, y: 0 }],
	[180, { x: 0, y: 10 }],
])('places the handle at rotation %s°', (rotation, offset) => {
	const centre = { x: 50, y: 50 };
	const point = rotationHandlePoint(centre, rotation, 10);
	expect(point.x).toBeCloseTo(centre.x + offset.x, 8);
	expect(point.y).toBeCloseTo(centre.y + offset.y, 8);
});

it('turns a quarter clockwise into +90', () => {
	const centre = { x: 0, y: 0 };
	const start = { x: 0, y: -10 };
	const current = { x: 10, y: 0 };
	expect(dragRotation(0, centre, start, current, false)).toBeCloseTo(90, 8);
});

it('normalises the wrap-around into [-180, 180]', () => {
	const centre = { x: 0, y: 0 };
	const start = { x: 10, y: 0 };
	const current = { x: 10 * Math.cos(20 * Math.PI / 180), y: 10 * Math.sin(20 * Math.PI / 180) };
	expect(dragRotation(170, centre, start, current, false)).toBeCloseTo(-170, 8);
});

it('snaps to the nearest 15° when snap is set, else rounds to 0.1°', () => {
	const centre = { x: 0, y: 0 };
	const start = { x: 10, y: 0 };
	const current = { x: 10 * Math.cos(37.4 * Math.PI / 180), y: 10 * Math.sin(37.4 * Math.PI / 180) };
	expect(dragRotation(0, centre, start, current, true)).toBeCloseTo(30, 8);
	expect(dragRotation(0, centre, start, current, false)).toBeCloseTo(37.4, 8);
});

it('leaves rotation unchanged when either pointer is within 1px of the centre', () => {
	const centre = { x: 50, y: 50 };
	expect(dragRotation(42, centre, { x: 50.5, y: 50 }, { x: 60, y: 50 }, false)).toBe(42);
	expect(dragRotation(42, centre, { x: 60, y: 50 }, { x: 50.5, y: 50 }, false)).toBe(42);
});
