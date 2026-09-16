import { describe, expect, it } from 'vitest';
import {
	leftWritesBehind,
	markCompensated,
	markUncompensated,
	type AffectedEntity,
} from '../../../src/application/commands/DispatchOutcome';
import type { PersistenceError } from '../../../src/core/errors/AppError';

/**
 * `DispatchOutcome.ts` has no dedicated suite of its own — every existing exercise of
 * `markUncompensated`/`leftWritesBehind` runs through a command or repository that happens to
 * raise one. BP-02 slice 2 task 2 widens the stamp's shape (a boolean to an affected-entity
 * array), and the round-trip and presence-test properties that shape now has to hold are not
 * pinned anywhere a raise site's own test would fail if they broke. This file is that pin.
 */

function cause(): PersistenceError {
	return { category: 'Persistence', code: 'test.injected-failure', message: 'Injected.' };
}

const entities: readonly AffectedEntity[] = [
	{ entityKind: 'zone', entityId: 'zone-1' },
	{ entityKind: 'plan', entityId: 'plan-1' },
];

describe('markUncompensated / leftWritesBehind', () => {
	it('round-trips the entities a raise site names', () => {
		const stamped = markUncompensated(cause(), entities);
		expect(stamped.uncompensatedWrite).toEqual(entities);
		expect(leftWritesBehind(stamped)).toBe(true);
	});

	it('is still recognised when a raise site can name nothing — an empty stamp is legal', () => {
		const stamped = markUncompensated(cause(), []);
		expect(stamped.uncompensatedWrite).toEqual([]);
		// A PRESENCE test, not an equality test: an empty array is still a stamp, distinct
		// from an error nobody ever called `markUncompensated` on at all (below).
		expect(leftWritesBehind(stamped)).toBe(true);
	});

	it('answers false for an error nobody stamped', () => {
		expect(leftWritesBehind(cause())).toBe(false);
	});

	it('does not mutate its argument — the input error carries no uncompensatedWrite field after the call', () => {
		const original = cause();
		const stamped = markUncompensated(original, entities);
		expect(stamped).not.toBe(original);
		expect(leftWritesBehind(original)).toBe(false);
		expect(Object.prototype.hasOwnProperty.call(original, 'uncompensatedWrite')).toBe(false);
	});

	it('leaves every other field untouched — the stamp is additive', () => {
		const original = cause();
		const stamped = markUncompensated(original, entities);
		expect(stamped.category).toBe(original.category);
		expect(stamped.code).toBe(original.code);
		expect(stamped.message).toBe(original.message);
	});
});

// `markCompensated`'s sibling copy behaviour is exercised alongside `markUncompensated`'s here
// because neither has a dedicated file of its own and both share the same "returns a copy"
// property from the same module.
describe('markCompensated', () => {
	it('does not mutate its argument either', () => {
		const original = cause();
		const version = { revision: 2, observed: 't2' as never };
		const stamped = markCompensated(original, version);
		expect(stamped).not.toBe(original);
		expect(Object.prototype.hasOwnProperty.call(original, 'compensatedVersion')).toBe(false);
		expect(stamped.compensatedVersion).toEqual(version);
	});
});
