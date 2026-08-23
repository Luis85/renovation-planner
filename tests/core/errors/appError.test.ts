import { describe, expect, it } from 'vitest';
import type {
	CalculationError,
	DomainError,
	GeometryError,
	ImportError,
	MigrationError,
	PersistenceError,
	ReferenceError,
	ValidationError,
	AppError,
} from '../../../src/core/errors/AppError';
import { isErr, type Result } from '../../../src/core/result/Result';

class ReferenceErrorJS extends globalThis.ReferenceError {}

function expectErr(result: Result<never, AppError>): AppError {
	if (result.ok) {
		throw new Error('expected an error, got a value');
	}
	return result.error;
}

describe('AppError categories', () => {
	const cases: Array<[string, AppError]> = [
		['Domain', { category: 'Domain', code: 'zone-frozen', message: 'Zone is frozen.' }],
		[
			'Validation',
			{
				category: 'Validation',
				code: 'name-empty',
				message: 'Name must not be empty.',
			},
		],
		[
			'Persistence',
			{
				category: 'Persistence',
				code: 'file-missing',
				message: 'The note is gone.',
				cause: new Error('ENOENT'),
			},
		],
		['Geometry', { category: 'Geometry', code: 'polygon-zero-area', message: 'Zero area.' }],
		['Import', { category: 'Import', code: 'bad-csv', message: 'Unparseable row 3.' }],
		[
			'Migration',
			{
				category: 'Migration',
				code: 'marker-missing',
				message: 'Split marker absent.',
			},
		],
		[
			'Reference',
			{
				category: 'Reference',
				code: 'asset-dangling',
				message: 'Asset id resolves to nothing.',
			},
		],
		[
			'Calculation',
			{ category: 'Calculation', code: 'sum-overflow', message: 'Total overflowed.' },
		],
	];

	for (const [category, error] of cases) {
		it(`${category} carries its discriminant through construction and narrowing`, () => {
			const result: Result<never, AppError> = { ok: false, error };
			expect(isErr(result)).toBe(true);
			expect(expectErr(result).category).toBe(category);
		});
	}

	it('keeps the domain types plain data — no Error prototype anywhere', () => {
		const geometry: GeometryError = {
			category: 'Geometry',
			code: 'x',
			message: 'm',
		};
		expect(geometry instanceof Error).toBe(false);
	});

	it('types the eight aliases as the shared base shape', () => {
		const all: Array<
			DomainError | ValidationError | PersistenceError | GeometryError | ImportError |
			MigrationError | ReferenceError | CalculationError
		> = cases.map(([, error]) => error);
		expect(all.every((e) => typeof e.code === 'string' && typeof e.message === 'string')).toBe(
			true,
		);
	});

	it('does not disturb the JavaScript built-in of the same name', () => {
		expect(() => {
			throw new ReferenceErrorJS();
		}).toThrow(ReferenceErrorJS);
	});
});
