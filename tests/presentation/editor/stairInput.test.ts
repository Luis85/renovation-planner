import { expect, it } from 'vitest';
import { DEFAULT_STAIR } from '../../../src/domain/spatial/stairGeometry';
import { parseStairInput, stairText } from '../../../src/presentation/editor/elements/stairInput';
it('preserves untouched submillimetre geometry/options and parses explicit decimal-comma edits', () => {
	const points = [{ x: 1000.123, y: 5000.678 }, { x: 1000.123, y: 2000.321 }], original = { ...DEFAULT_STAIR, width: 900.456 };
	const text = stairText(points, original), unchanged = parseStairInput(points, text, original);
	expect(unchanged.points).toBe(points); expect(unchanged.options.width).toBe(900.456);
	const changed = parseStairInput(points, { ...text, width: '1,2', treads: '15' }, original);
	expect(changed.points).toBe(points); expect(changed.options).toEqual({ width: 1200, treads: 15, direction: 'up' });
	expect(parseStairInput(points, { ...text, treads: '1.5' }, original).errors.has('treads')).toBe(true);
});
