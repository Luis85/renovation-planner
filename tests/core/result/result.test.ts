import { describe, expect, it } from 'vitest';
import { err, isErr, isOk, ok, type Result } from '../../../src/core/result/Result';
import type { ValidationError } from '../../../src/core/errors/AppError';

function expectOk<T, E>(result: Result<T, E>): T {
	if (!result.ok) {
		throw new Error(`expected a value, got ${JSON.stringify(result.error)}`);
	}
	return result.value;
}

function expectErr<T, E>(result: Result<T, E>): E {
	if (result.ok) {
		throw new Error(`expected an error, got ${JSON.stringify(result.value)}`);
	}
	return result.error;
}

describe('Result', () => {
	it('constructs a success carrying its value', () => {
		const result = ok(42);
		expect(result).toEqual({ ok: true, value: 42 });
	});

	it('constructs a failure carrying its error', () => {
		const failure: Result<number, string> = err('boom');
		expect(failure).toEqual({ ok: false, error: 'boom' });
	});

	it('narrows a success to its value through isOk', () => {
		const result: Result<number, ValidationError> = ok(7);
		expect(isOk(result)).toBe(true);
		expect(expectOk(result)).toBe(7);
	});

	it('narrows a failure to its error through isErr', () => {
		const error: ValidationError = {
			category: 'Validation',
			code: 'x-too-small',
			message: 'x must be at least 1.',
		};
		const result: Result<number, ValidationError> = err(error);
		expect(isErr(result)).toBe(true);
		const narrowed = expectErr(result);
		expect(narrowed.category).toBe('Validation');
		expect(narrowed.code).toBe('x-too-small');
	});
});
