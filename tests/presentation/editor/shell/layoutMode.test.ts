import { describe, expect, it } from 'vitest';
import { CONSTRAINED_MIN_PX, FULL_MIN_PX, layoutModeFor } from '../../../../src/presentation/editor/shell/layoutMode';

describe('layoutModeFor', () => {
	it('is full at and above the full threshold', () => {
		expect(layoutModeFor(FULL_MIN_PX)).toBe('full');
		expect(layoutModeFor(1280)).toBe('full');
	});
	it('is constrained between the two thresholds — 460, a sidebar leaf, is constrained', () => {
		expect(layoutModeFor(FULL_MIN_PX - 1)).toBe('constrained');
		expect(layoutModeFor(460)).toBe('constrained');
		expect(layoutModeFor(CONSTRAINED_MIN_PX)).toBe('constrained');
	});
	it('is unsupported below the floor, including a zero-width pane before layout', () => {
		expect(layoutModeFor(CONSTRAINED_MIN_PX - 1)).toBe('unsupported');
		expect(layoutModeFor(0)).toBe('unsupported');
	});
});
