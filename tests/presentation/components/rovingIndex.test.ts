/**
 * The roving tabindex's one movement rule, driven directly.
 *
 * It exists as its own module because two components had grown their own copy of it and
 * `npm run analyze` reported the pair as a clone. Both of those components drive it through their
 * own keyboard cases already — what those cannot reach is the arm where the two callers DIFFER:
 * the Parts panel passes `horizontal: false` and the preset gallery `true`, so the horizontal
 * arrows are owned by one and unowned by the other, and a mistake in that clause would show up as
 * a key quietly doing nothing rather than as a failure.
 */
import { describe, expect, it } from 'vitest';
import { rovingIndex } from '../../../src/presentation/components/rovingIndex';

describe('where a roving tabindex lands', () => {
	it('takes Home and End to the ends whatever the axis', () => {
		for (const horizontal of [true, false]) {
			expect(rovingIndex('Home', 3, 5, horizontal)).toBe(0);
			expect(rovingIndex('End', 1, 5, horizontal)).toBe(4);
		}
	});

	it('steps Up and Down for both callers', () => {
		for (const horizontal of [true, false]) {
			expect(rovingIndex('ArrowDown', 1, 5, horizontal)).toBe(2);
			expect(rovingIndex('ArrowUp', 1, 5, horizontal)).toBe(0);
		}
	});

	// The clause the two callers disagree about, and the whole reason the parameter exists.
	it('steps the horizontal arrows only for a caller that wraps, and disowns them otherwise', () => {
		expect(rovingIndex('ArrowRight', 1, 5, true)).toBe(2);
		expect(rovingIndex('ArrowLeft', 1, 5, true)).toBe(0);
		expect(rovingIndex('ArrowRight', 1, 5, false)).toBe(-1);
		expect(rovingIndex('ArrowLeft', 1, 5, false)).toBe(-1);
	});

	it('clamps at both ends rather than wrapping, which is the list pattern rule', () => {
		expect(rovingIndex('ArrowUp', 0, 5, false)).toBe(0);
		expect(rovingIndex('ArrowDown', 4, 5, false)).toBe(4);
	});

	/**
	 * Inherited behaviour, pinned rather than endorsed: a `-1` start is clamped to 0 and THEN
	 * stepped, so a forward key from nothing-focused lands on the second item. Neither caller can
	 * reach it — both resolve their tabbable item to a real member before asking — and this case
	 * exists so that a caller which one day can reach it meets a stated answer instead of a
	 * surprise. The first draft of the module's docblock claimed the opposite and this caught it.
	 */
	it('clamps a nothing-focused start to zero before stepping, landing on the second item', () => {
		expect(rovingIndex('ArrowDown', -1, 5, false)).toBe(1);
		expect(rovingIndex('ArrowUp', -1, 5, false)).toBe(0);
	});

	it('disowns a key it does not handle', () => {
		expect(rovingIndex('Enter', 1, 5, true)).toBe(-1);
	});
});
