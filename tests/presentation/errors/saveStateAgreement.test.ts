import { describe, expect, it } from 'vitest';
import { affectsSaveState } from '../../../src/presentation/editor/save-state/affects-save-state';
import { surfaceFor } from '../../../src/presentation/errors/errorSurfacePolicy';
import { WRITE_BOUNDARY_CODES } from '../../../src/application/ports/versioning';
import type { AppError, ErrorCategory } from '../../../src/core/errors/AppError';

const ALL_CATEGORIES: readonly ErrorCategory[] = [
	'Domain',
	'Validation',
	'Persistence',
	'Geometry',
	'Import',
	'Migration',
	'Reference',
	'Calculation',
];

const err = (category: ErrorCategory, code = 'x.y'): AppError =>
	({ category, code, message: 'developer text' }) as AppError;

/**
 * The agreement `affectsSaveState`'s own docblock asked design slice 17 to establish, written
 * there in the future tense: "when slice 17 authors its error-to-surface table, this predicate
 * is one of the things that table has to agree with, and the agreement will need a check of
 * its own, because nothing today can notice the two disagreeing."
 *
 * This is that check. **The two answer DIFFERENT questions and must not be collapsed into
 * one**, which is what makes the agreement worth asserting rather than obvious:
 *
 * - `surfaceFor` asks WHICH CONTAINER a failure belongs in. At an `autosave-write` origin the
 *   answer is the save indicator, for every category, because that is what is on screen.
 * - `affectsSaveState` asks whether the failure MIGHT HAVE WRITTEN, which decides what the
 *   indicator then says — an error, or a revert to what it read before the batch.
 *
 * So the table routes and the predicate colours, and the seam between them is the one origin
 * they share. A build where the table stopped routing `autosave-write` to `save-state` would
 * leave the predicate deciding the colour of a widget nothing sends anything to.
 */
describe('affectsSaveState agrees with the surface table', () => {
	it('routes every category to the save indicator at an autosave-write origin', () => {
		// The seam itself. If this stops holding, `affectsSaveState` is answering about a
		// surface the table no longer selects, and every case below is about nothing.
		for (const category of ALL_CATEGORIES) {
			expect(surfaceFor(err(category), { kind: 'autosave-write' })).toMatchObject({
				kind: 'save-state',
			});
		}
	});

	it('reports a write-boundary code as affecting in EVERY category', () => {
		// The carve-out `versioning.ts` owns, derived from its exported table rather than from a
		// copy. A revision conflict IS a reached-the-repository refusal whatever category it
		// wears — `revisionConflict` mints it as a `Validation` error, which is otherwise the
		// most pre-write category there is.
		for (const category of ALL_CATEGORIES) {
			for (const suffix of WRITE_BOUNDARY_CODES) {
				expect(affectsSaveState(err(category, `zone.${suffix}`))).toBe(true);
			}
		}
	});

	it('separates a plain persistence refusal from a plain validation one', () => {
		expect(affectsSaveState(err('Persistence', 'zone.save-failed'))).toBe(true);
		expect(affectsSaveState(err('Validation', 'zone.name-required'))).toBe(false);
	});

	it('defaults an unrecognised category toward reporting rather than toward silence', () => {
		// `affectsSaveState` is an inequality against a named pre-write set, so a category
		// nobody has thought about answers "we might not have written your data". That default
		// is the safe direction and it is asserted here rather than left to the predicate's
		// prose, because a later edit that inverted the set would still pass every case above.
		expect(affectsSaveState(err('Import', 'import.some-future-code'))).toBe(true);
		expect(affectsSaveState(err('Migration', 'migration.some-future-code'))).toBe(true);
	});
});
