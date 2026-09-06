import { describe, expect, it } from 'vitest';
import { arrowVector } from '../../../../src/presentation/editor/surface/keyboard';

/**
 * Pure logic, no DOM: `arrowVector` takes only `{ key, shiftKey }`, so this is a node test
 * per `CLAUDE.md`'s Testing section rather than a jsdom one over a real `KeyboardEvent`.
 */
describe('arrowVector', () => {
	it.each([
		['ArrowLeft', false, { dx: -10, dy: 0 }],
		['ArrowRight', false, { dx: 10, dy: 0 }],
		['ArrowUp', false, { dx: 0, dy: -10 }],
		['ArrowDown', false, { dx: 0, dy: 10 }],
		['ArrowLeft', true, { dx: -100, dy: 0 }],
		['ArrowRight', true, { dx: 100, dy: 0 }],
		['ArrowUp', true, { dx: 0, dy: -100 }],
		['ArrowDown', true, { dx: 0, dy: 100 }],
	])('%s with shiftKey=%s -> %j', (key, shiftKey, expected) => {
		expect(arrowVector({ key, shiftKey })).toEqual(expected);
	});

	it('answers null for a key that is not an arrow', () => {
		expect(arrowVector({ key: 'a', shiftKey: false })).toBeNull();
	});
});
