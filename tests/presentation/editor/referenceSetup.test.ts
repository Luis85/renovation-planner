import { expectDefined } from '../../helpers/domain';
import { describe, expect, it } from 'vitest';
import { referencePoint, validReferenceAppearance, type ReferenceAppearance } from '../../../src/domain/plan/ReferenceAppearance';
import { prepareValid, previewTransform, setupMeasurement } from '../../../src/presentation/editor/reference/referenceSetup';
const appearance: ReferenceAppearance = { crop: { x: 20, y: 30, width: 400, height: 200 }, rotation: 90, opacity: 0.5, visible: true, locked: true };
describe('explicit raster → crop → rotation → current-world → calibration conversion', () => {
	it('crops before rotating and scales last', () => {
		const p = referencePoint({ x: 120, y: 80 }, appearance, 2);
		expect(p.x).toBeCloseTo(-100); expect(p.y).toBeCloseTo(200);
		expect(previewTransform(appearance)).toMatchObject({ scale: 0.5 });
		expect(previewTransform({ ...appearance, rotation: 0 })).toMatchObject({ scale: 0.95 });
	});
	it.each([1, 25.4 / 72 / 2])('shares image/PDF raster density (%s) and recalibration math', worldScale => {
		const next = expectDefined(setupMeasurement([{ x: 20, y: 30 }, { x: 120, y: 30 }], '2,5', appearance, worldScale, null), 'scale');
		expect(next.calibration.pixelsPerWorldUnit).toBeCloseTo(worldScale / 25);
		const again = expectDefined(setupMeasurement([{ x: 20, y: 30 }, { x: 120, y: 30 }], '2.5', appearance, worldScale, next.calibration), 'scale');
		expect(again.scaleCorrection).toBeCloseTo(1);
	});
	it.each(['', '0', '-1', 'Infinity', '1e309', 'bad'])('rejects a nonrepresentable known distance %s', text => {
		expect(setupMeasurement([{ x: 20, y: 30 }, { x: 120, y: 30 }], text, appearance, 1, null)).toBeNull();
	});
	it('rejects coincident points and illegal crop/appearance while accepting exact boundaries', () => {
		expect(setupMeasurement([{ x: 20, y: 30 }, { x: 20, y: 30 }], '2', appearance, 1, null)).toBeNull();
		expect(prepareValid(appearance, 420, 230)).toBe(true); expect(prepareValid(appearance, 419, 230)).toBe(false);
		expect(prepareValid(appearance, 420, 229)).toBe(false);
		for (const patch of [{ rotation: 181 }, { opacity: -1 }, { rotation: NaN }, { crop: { x: -1, y: 0, width: 1, height: 1 } }, { locked: 'yes' }]) {
			expect(validReferenceAppearance({ ...appearance, ...patch } as ReferenceAppearance)).toBe(false);
		}
	});
});
