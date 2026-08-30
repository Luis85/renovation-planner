/**
 * The routing rule, driven at the function rather than at a form.
 *
 * `toUserMessage` is passed in as a pre-bound `(error) => string`, so these cases assert
 * WHERE a message lands and never WHAT it says: the routing function is language-agnostic
 * by construction and there is no locale table in this file.
 */
import { describe, expect, it } from 'vitest';
import { routeError, type FieldErrorMap } from '../../../src/presentation/errors/route-error';
import type { AppError } from '../../../src/core/errors/AppError';

interface TestInput {
	readonly name: string;
	readonly start: string;
	readonly targetCompletion: string;
}

const MAP: FieldErrorMap<TestInput> = {
	'project.empty-name': 'name',
	'project.target-before-start': ['start', 'targetCompletion'],
};

function validation(code: string): AppError {
	return { category: 'Validation', code, message: 'developer english, never shown' };
}

const say = (error: AppError): string => `copy for ${error.code}`;

describe('routeError', () => {
	it('routes a mapped code to its one field, with toUserMessage’s exact text', () => {
		const routed = routeError(validation('project.empty-name'), MAP, say);

		expect(routed).toEqual({
			kind: 'field',
			fields: ['name'],
			message: 'copy for project.empty-name',
		});
	});

	it('routes a map entry naming two fields to both of them', () => {
		const routed = routeError(validation('project.target-before-start'), MAP, say);

		expect(routed.kind).toBe('field');
		// The array form: neither field alone describes the failure, so neither alone gets it.
		expect(routed.kind === 'field' && routed.fields).toEqual(['start', 'targetCompletion']);
	});

	it('routes a code absent from the map to the banner, with the SAME text', () => {
		// Absence is the explicit statement "this failure is not about one field" — the
		// PersistenceError a save refuses with is about the vault, not about an input.
		const error: AppError = {
			category: 'Persistence',
			code: 'project.save-failed',
			message: 'developer english, never shown',
		};

		expect(routeError(error, MAP, say)).toEqual({
			kind: 'banner',
			message: 'copy for project.save-failed',
		});
	});

	it('routes on code alone, never on category', () => {
		// A Calculation error whose code IS mapped still reaches the field. Which categories
		// may reach a field at all is slice 17's decision, not this function's.
		const error: AppError = {
			category: 'Calculation',
			code: 'project.empty-name',
			message: 'developer english, never shown',
		};

		expect(routeError(error, MAP, say).kind).toBe('field');
	});
});
