import { expect, it } from 'vitest';
import { referencePoint, type ReferenceAppearance } from '../../../src/domain/plan/ReferenceAppearance';
import { previewTransform } from '../../../src/presentation/editor/reference/referenceSetup';
import { referenceSourcePoint, zoomReference } from '../../../src/presentation/editor/reference/referenceViewport';

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
