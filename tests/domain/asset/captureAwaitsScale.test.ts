import { describe, expect, it } from 'vitest';
import type { AssetShape } from '../../../src/domain/asset/AssetShape';
import { captureAwaitsScale } from '../../../src/domain/asset/captureAwaitsScale';
import { editableShape } from '../../helpers/assetShapes';

/**
 * The capture rule, asked directly now that a draw tool asks it in presentation before any command
 * runs. `setAssetAttributes.test.ts` still drives every arm through a real command, which is where
 * what a user PLACES is held; this holds the three arms in the order they are asked.
 */
const TYPED = editableShape();
const TRACED_PENDING = editableShape({ footprintOrigin: 'traced', footprintPending: true });

describe('captureAwaitsScale', () => {
	it.each<readonly [string, boolean, boolean, AssetShape | null, boolean]>([
		['a calibrated surface, whatever else is on it', true, true, TRACED_PENDING, false],
		['an uncalibrated background, even beside a typed footprint', false, true, TYPED, true],
		['no background and no footprint yet', false, false, null, true],
		['no background around a footprint still awaiting its own scale', false, false, TRACED_PENDING, true],
		['no background around a typed footprint', false, false, TYPED, false],
	])('answers %s', (_label, calibrated, hasBackground, shape, expected) => {
		expect(captureAwaitsScale(calibrated, hasBackground, shape)).toBe(expected);
	});
});
