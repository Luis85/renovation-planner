import { expect, it } from 'vitest';
import { captionOffsetY } from '../../../src/presentation/editor/layers/zone/captionPlacement';

const viewport = { min: { x: 0, y: 0 }, max: { x: 600, y: 600 } };
it('retains the visible original caption when the full vertical column is occluded', () => {
	expect(captionOffsetY({ x: 200, y: 200 }, [], 1, [viewport], viewport)).toBe(0);
});
it('does not bring an unchanged offscreen Room caption into the viewport', () => {
	expect(captionOffsetY({ x: 200, y: -100 }, [], 1, [], viewport)).toBe(0);
	expect(captionOffsetY({ x: 200, y: -100 }, [{ x: 200, y: -100, number: 1 }], 1, [], viewport)).toBe(-53);
});
