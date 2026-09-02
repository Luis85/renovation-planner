import { describe, expect, it } from 'vitest';
import {
	drawnWorldScale,
	PLACEHOLDER_WORLD_SCALE,
} from '../../../src/presentation/editor/layers/background/BackgroundRenderModel';

/**
 * A calibration with `pixelsPerWorldUnit` 0.5 means two world millimetres per source pixel,
 * so a 400 px raster is 800 mm wide on a calibrated surface and 400 mm on an uncalibrated one.
 * A PDF raster arrives with its own guessed scale and the calibration corrects THAT.
 */
describe('drawnWorldScale', () => {
	it('is the raster scale itself while nothing has calibrated the subject', () => {
		expect(drawnWorldScale(PLACEHOLDER_WORLD_SCALE, 1)).toBe(1);
		expect(drawnWorldScale(0.3527, 1)).toBeCloseTo(0.3527);
	});

	it('divides the raster scale by the calibrated pixels-per-world-unit', () => {
		expect(drawnWorldScale(1, 0.5)).toBe(2);
		expect(drawnWorldScale(0.3527, 0.5)).toBeCloseTo(0.7054);
	});
});
