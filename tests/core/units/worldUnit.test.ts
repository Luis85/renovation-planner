import { describe, expect, it } from 'vitest';
import { WORLD_UNIT } from '../../../src/core/units/WorldUnit';

describe('WorldUnit', () => {
	it('states the convention: one world unit is one millimeter', () => {
		expect(WORLD_UNIT).toBe('millimeter');
	});
});
