import { describe, expect, it } from 'vitest';
import { surfaceFor, type ErrorOrigin } from '../../../src/presentation/errors/errorSurfacePolicy';
import type { AppError, ErrorCategory } from '../../../src/core/errors/AppError';

const err = (category: ErrorCategory, code = 'x.y'): AppError =>
	({ category, code, message: 'developer text' }) as AppError;

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

const FIELD: ErrorOrigin = { kind: 'form-field-commit', field: 'quantity' };
const AUTOSAVE: ErrorOrigin = { kind: 'autosave-write' };
const OPERATION: ErrorOrigin = { kind: 'explicit-operation' };
const DECISION: ErrorOrigin = { kind: 'decision-required' };
const HYDRATION: ErrorOrigin = { kind: 'view-hydration' };
const BACKGROUND: ErrorOrigin = { kind: 'background-cascade' };
const BOOTSTRAP: ErrorOrigin = { kind: 'bootstrap' };

const ALL_ORIGINS: readonly ErrorOrigin[] = [
	BOOTSTRAP,
	FIELD,
	AUTOSAVE,
	OPERATION,
	DECISION,
	HYDRATION,
	BACKGROUND,
];

describe('surfaceFor', () => {
	it('answers a session failure for every category at a bootstrap origin', () => {
		// BOOTSTRAP is asked FIRST and invalidates the questions below it: there is no field to
		// annotate and no query that "failed", because none was ever wired.
		for (const category of ALL_CATEGORIES) {
			expect(surfaceFor(err(category), BOOTSTRAP)).toMatchObject({ kind: 'session-failure' });
		}
	});

	it('answers a modal for a decision-required origin', () => {
		expect(surfaceFor(err('Reference', 'reference.referents-exist'), DECISION)).toMatchObject({
			kind: 'modal',
		});
	});

	it('carries the field name through to an inline surface', () => {
		expect(surfaceFor(err('Validation'), FIELD)).toMatchObject({
			kind: 'inline',
			field: 'quantity',
		});
	});

	it('answers a view failure for a hydrating query that refused', () => {
		expect(surfaceFor(err('Persistence'), HYDRATION)).toMatchObject({ kind: 'view-failure' });
	});

	it('answers a save-state surface for an autosave write', () => {
		expect(surfaceFor(err('Persistence'), AUTOSAVE)).toMatchObject({ kind: 'save-state' });
	});

	it('answers an error toast for an explicit operation', () => {
		expect(surfaceFor(err('Persistence'), OPERATION)).toMatchObject({
			kind: 'toast',
			level: 'error',
		});
	});

	// The one pairing that resolves QUIETER than its origin suggests. Its own case rather than a
	// row in a loop, because an implementation keyed on origin alone passes every other
	// explicit-operation assertion while getting this one wrong.
	it('answers a WARNING toast for a Geometry error at an explicit operation', () => {
		expect(surfaceFor(err('Geometry'), OPERATION)).toMatchObject({
			kind: 'toast',
			level: 'warning',
		});
	});

	describe('the background-cascade origin', () => {
		// The exception, and it gets its own case for the reason the slice document gives: an
		// implementation that folded background-cascade into a single early return would pass
		// every other case in this file.
		it('answers a toast for a Persistence error, because the marker write is what failed', () => {
			expect(surfaceFor(err('Persistence'), BACKGROUND)).toMatchObject({
				kind: 'toast',
				level: 'warning',
			});
		});

		it('answers none for every OTHER category', () => {
			for (const category of ALL_CATEGORIES.filter((c) => c !== 'Persistence')) {
				expect(surfaceFor(err(category), BACKGROUND)).toMatchObject({ kind: 'none' });
			}
		});
	});

	describe('the splits the table names explicitly', () => {
		it('routes a Calculation error three ways by origin alone', () => {
			expect(surfaceFor(err('Calculation', 'calibration.invalid-distance'), FIELD)).toMatchObject(
				{ kind: 'inline', field: 'quantity' },
			);
			expect(
				surfaceFor(err('Calculation', 'calibration.coincident-points'), OPERATION),
			).toMatchObject({ kind: 'toast', level: 'error' });
			expect(surfaceFor(err('Calculation'), BACKGROUND)).toMatchObject({ kind: 'none' });
		});

		it('routes a Reference error by origin, modal for the delete decision', () => {
			expect(surfaceFor(err('Reference'), DECISION)).toMatchObject({ kind: 'modal' });
			expect(surfaceFor(err('Reference'), BACKGROUND)).toMatchObject({ kind: 'none' });
		});
	});

	it('is total over every category at every origin', () => {
		// Not an exhaustiveness PROOF — that is the compiler's, in the sibling .test-d.ts. This
		// asserts the weaker runtime property that no pair falls through to undefined, which a
		// switch with a missing arm would do.
		for (const category of ALL_CATEGORIES) {
			for (const origin of ALL_ORIGINS) {
				expect(surfaceFor(err(category), origin).kind).toEqual(expect.any(String));
			}
		}
	});
});
